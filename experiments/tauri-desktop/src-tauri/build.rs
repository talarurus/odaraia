// SPDX-License-Identifier: MPL-2.0
fn main() {
    let core = "../../../app/storage/native-sqlite";
    let include = std::env::var("DEP_SQLITE3_INCLUDE").expect("bundled SQLite headers required");
    cc::Build::new()
        .file(format!("{core}/store.c"))
        .include(include)
        .include(core)
        .define("_POSIX_C_SOURCE", "200809L")
        .compile("odaraia_store");
    for file in ["store.c", "store.h", "schema.h"] {
        println!("cargo:rerun-if-changed={core}/{file}");
    }
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["store_read", "store_commit", "export_file"]),
    ))
    .expect("Tauri build metadata failed");
}
