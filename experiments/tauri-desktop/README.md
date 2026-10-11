# Isolated Odaraia Tauri prototype

v0.3.1 Developer Preview. The Rust host links the existing C SQLite core in process and embeds the shared React workspace. No Node sidecar, private glass API, unrestricted filesystem/SQL/shell capability, or additional platform rewrite is introduced. Storage and backups remain unencrypted; synthetic records only.

From the repository root on Apple Silicon macOS with Node 24.21.0, Rust 1.99.0 and Xcode Command Line Tools:

```sh
npm ci --prefix app
cargo fetch --locked --manifest-path experiments/tauri-desktop/src-tauri/Cargo.toml
node experiments/tauri-desktop/test-native.mjs
node tools/developer-preview.mjs journey --rust
node experiments/tauri-desktop/build-review.mjs
node experiments/tauri-desktop/build-review.mjs --recovery
open "app/artifacts/tauri-validation/mac/Odaraia SQLite Prototype.app"
```

Builds/tests use locked offline Cargo after the explicit fetch. Local cached dependencies and target output are never published. The bundler uses Cargo directly, not an unpinned global Tauri CLI.

`--fresh-profile` generates a new build-time application identifier/name so manual acceptance opens an entirely new profile without clearing or reading an existing one. The generated bundle path is printed and recorded in `app/artifacts/tauri-validation/mac/package.json` (or recovery-package.json). This only changes build tooling; native capabilities remain fixed-profile.

The founder reports the simplified Tauri app launches on their Mac. This execution environment builds/signs and verifies Rust persistence/IPC contracts, but native GUI and browser engines cannot launch. See the root preview procedure for first-run, financial navigation, backup dialogs, restart, themes, keyboard and screenshots. macOS 14.0 is the declared deployment floor, not a tested supported-version range. Windows/Linux configs are unverified plans; no mobile project exists.
