// SPDX-License-Identifier: MPL-2.0
// Feature-gated developer harness, never bundled. Exercises the exact Rust
// serialization + safe FFI wrapper + bundled SQLite used by the native host.
#[path = "../native_store.rs"]
mod native_store;
use std::{
    io::{self, Read},
    path::PathBuf,
};
fn main() {
    let mut args = std::env::args_os().skip(1);
    let path = PathBuf::from(args.next().expect("test database path required"));
    assert!(args.next().is_none(), "one test database path required");
    let mut input = String::new();
    io::stdin()
        .take(32 * 1024 * 1024 + 1)
        .read_to_string(&mut input)
        .expect("test request");
    let value = serde_json::from_str(&input)
        .map_err(|_| "Invalid storage request".to_string())
        .and_then(|request| native_store::call(path, request))
        .unwrap_or_else(
            |_| serde_json::json!({"error":"Invalid storage request","code":"INVALID_REQUEST"}),
        );
    println!("{value}");
}
