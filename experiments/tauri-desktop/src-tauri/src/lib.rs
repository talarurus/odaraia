// SPDX-License-Identifier: MPL-2.0
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;
use tauri::{Manager, State};

mod native_store;
use native_store::call;
struct Store {
    path: PathBuf,
}
#[tauri::command]
async fn store_read(store: State<'_, Store>) -> Result<Value, String> {
    let path = store.path.clone();
    tauri::async_runtime::spawn_blocking(move || call(path, json!({"op":"read"})))
        .await
        .map_err(|_| "Storage task failed")?
}
#[tauri::command]
async fn store_commit(
    store: State<'_, Store>,
    expected: u64,
    data: Value,
) -> Result<Value, String> {
    if expected > 9_007_199_254_740_990 || data.to_string().len() > 32 * 1024 * 1024 {
        return Err("Storage request too large".into());
    }
    let path = store.path.clone();
    tauri::async_runtime::spawn_blocking(move || {
        call(path, json!({"op":"commit","expected":expected,"data":data}))
    })
    .await
    .map_err(|_| "Storage task failed")?
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Export {
    filename: String,
    text: String,
    csv: bool,
}
#[tauri::command]
async fn export_file(file: Export) -> Result<(), String> {
    if file.text.len() > 16 * 1024 * 1024
        || file.filename
            != if file.csv {
                "odaraia-transactions.csv"
            } else {
                "odaraia-backup.json"
            }
    {
        return Err("Invalid export".into());
    }
    if !file.csv {
        let value: Value = serde_json::from_str(&file.text).map_err(|_| "Invalid backup JSON")?;
        if value["format"] != "talarurus-finance" || value["version"] != 1 {
            return Err("Invalid backup format".into());
        }
    }
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::Write;
        let path = rfd::FileDialog::new()
            .set_file_name(&file.filename)
            .save_file()
            .ok_or("Export cancelled")?;
        let parent = path.parent().ok_or("Invalid destination")?;
        let mut temp = None;
        for suffix in 0..100 {
            let candidate = parent.join(format!(
                ".odaraia-export-{}-{suffix}.tmp",
                std::process::id()
            ));
            let mut options = std::fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            match options.open(&candidate) {
                Ok(mut output) => {
                    let written = output
                        .write_all(file.text.as_bytes())
                        .and_then(|_| output.sync_all());
                    drop(output);
                    if written.is_err() {
                        let _ = std::fs::remove_file(&candidate);
                        return Err("Export write failed".to_string());
                    }
                    temp = Some(candidate);
                    break;
                }
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(_) => return Err("Export destination unavailable".to_string()),
            }
        }
        let temp = temp.ok_or("Export temporary file unavailable")?;
        if std::fs::rename(&temp, &path).is_err() {
            let _ = std::fs::remove_file(&temp);
            return Err("Export move failed".into());
        }
        Ok(())
    })
    .await
    .map_err(|_| "Export task failed")?
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            // No runtime URL/profile argument can select the founder's existing DB.
            if std::fs::symlink_metadata(&dir)
                .map(|m| m.file_type().is_symlink())
                .unwrap_or(false)
            {
                return Err("Unsafe profile directory".into());
            }
            std::fs::create_dir_all(&dir)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700))?;
            }
            let path = dir.canonicalize()?.join("synthetic-ledger.sqlite");
            app.manage(Store { path });
            eprintln!("ODARAIA_NATIVE_SETUP_READY");
            Ok(())
        })
        .on_page_load(|webview, payload| {
            if webview.label() == "main"
                && payload.event() == tauri::webview::PageLoadEvent::Finished
            {
                // Fixed lifecycle diagnostics only: no paths, tokens or ledger data.
                eprintln!(
                    "ODARAIA_NATIVE_PAGE_FINISHED window_visible={}",
                    webview.window().is_visible().unwrap_or(false)
                );
            }
        })
        .invoke_handler(tauri::generate_handler![
            store_read,
            store_commit,
            export_file
        ])
        .run(tauri::generate_context!())
        .expect("Prototype startup failed");
}

#[cfg(test)]
mod ipc_tests {
    use super::*;
    use tauri::{
        ipc::{CallbackFn, InvokeBody},
        test::{get_ipc_response, mock_builder, INVOKE_KEY},
        webview::InvokeRequest,
    };

    fn request(command: &str, body: Value, url: &str) -> InvokeRequest {
        InvokeRequest {
            cmd: command.into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: url.parse().unwrap(),
            body: InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.into(),
        }
    }

    #[test]
    fn generated_capability_allows_only_bundled_main_window_and_fixed_commands() {
        let dir = std::env::temp_dir().join(format!(
            "odaraia-ipc-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir(&dir).unwrap();
        let path = dir.canonicalize().unwrap().join("synthetic.sqlite");
        let app = mock_builder()
            .manage(Store { path: path.clone() })
            .invoke_handler(tauri::generate_handler![
                store_read,
                store_commit,
                export_file
            ])
            .build(tauri::generate_context!())
            .unwrap();
        let main = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();
        let other = tauri::WebviewWindowBuilder::new(&app, "other", Default::default())
            .build()
            .unwrap();
        for (window, url) in [
            (&other, "tauri://localhost"),
            (&main, "https://unrelated.example"),
        ] {
            assert!(get_ipc_response(window, request("store_read", json!({}), url)).is_err());
        }
        assert!(
            !path.exists(),
            "denied requests must not initialize storage"
        );
        for command in ["sql.execute", "plugin:fs|read_file", "plugin:shell|execute"] {
            assert!(
                get_ipc_response(&main, request(command, json!({}), "tauri://localhost")).is_err()
            );
        }
        let snapshot: Value =
            get_ipc_response(&main, request("store_read", json!({}), "tauri://localhost"))
                .unwrap()
                .deserialize()
                .unwrap();
        assert_eq!(snapshot["revision"], 0);
        let saved: Value = get_ipc_response(
            &main,
            request(
                "store_commit",
                json!({"expected":0,"data":snapshot["data"]}),
                "tauri://localhost",
            ),
        )
        .unwrap()
        .deserialize()
        .unwrap();
        assert_eq!(saved["revision"], 1);
        // Invalid export is rejected before opening a native dialog or any file.
        assert!(get_ipc_response(
            &main,
            request(
                "export_file",
                json!({"file":{"filename":"../../secret","text":"{}","csv":false}}),
                "tauri://localhost"
            )
        )
        .is_err());
        drop(app);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
