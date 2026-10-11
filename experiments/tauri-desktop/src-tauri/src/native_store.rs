// SPDX-License-Identifier: MPL-2.0
//! Private safe wrapper for the fixed-operation C store. No renderer paths/SQL.
use serde_json::Value;
use std::{
    ffi::{c_char, CStr, CString},
    path::PathBuf,
    ptr::NonNull,
};

#[link(name = "odaraia_store", kind = "static")]
unsafe extern "C" {
    fn odaraia_store(path: *const c_char, request: *const c_char) -> *mut c_char;
    fn odaraia_free(result: *mut c_char);
}

struct Response(NonNull<c_char>);
impl Drop for Response {
    fn drop(&mut self) {
        // SAFETY: the C ABI returns one malloc-owned, non-null response. This
        // guard owns it exclusively and releases it exactly once, even on error.
        unsafe { odaraia_free(self.0.as_ptr()) }
    }
}

pub(crate) fn call(path: PathBuf, request: Value) -> Result<Value, String> {
    let path = CString::new(path.to_str().ok_or("Unsupported profile path")?)
        .map_err(|_| "Invalid profile path")?;
    let serialized = request.to_string();
    if serialized.len() > 32 * 1024 * 1024 {
        return Err("Storage request too large".into());
    }
    let request = CString::new(serialized).map_err(|_| "Invalid request")?;
    // SAFETY: both CStrings stay alive throughout the synchronous call; the C
    // store does not retain either pointer. libsqlite3-sys supplies the bundled
    // SQLite linkage. Each invocation opens/closes its own database connection.
    let raw = unsafe {
        let _ = libsqlite3_sys::sqlite3_libversion();
        odaraia_store(path.as_ptr(), request.as_ptr())
    };
    let result = Response(NonNull::new(raw).ok_or("Storage allocation failed")?);
    // SAFETY: the store ABI returns a NUL-terminated allocation, valid until
    // the guard drops. Parsing copies into an owned Value before that point.
    let bytes = unsafe { CStr::from_ptr(result.0.as_ptr()).to_bytes() };
    serde_json::from_slice(bytes).map_err(|_| "Invalid storage response".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_round_trip_preserves_nested_insertion_order_and_exact_money() {
        // Backups checksum JSON.stringify(data), and CSV undo compares nested
        // provenance against JSON stored inside audit.before_json strings.
        let original = r#"{"z":"-9007199254740993","a":{"kind":"csv","fileKey":"fictional","normalized":{"status":"posted","account":"checking","amount":"9223372036854775807"}},"before_json":"{\"z\":1,\"a\":2}"}"#;
        let value: Value = serde_json::from_str(original).unwrap();
        assert_eq!(value.to_string(), original);
        assert_eq!(value["z"], "-9007199254740993");
        assert_eq!(value["a"]["normalized"]["amount"], "9223372036854775807");
    }

    #[test]
    fn ffi_rejects_nul_path_and_oversized_request_before_opening_storage() {
        assert_eq!(
            call(PathBuf::from("bad\0path"), serde_json::json!({})).unwrap_err(),
            "Invalid profile path"
        );
        assert_eq!(
            call(
                PathBuf::from("unused.sqlite"),
                Value::String("x".repeat(32 * 1024 * 1024))
            )
            .unwrap_err(),
            "Storage request too large"
        );
    }
}
