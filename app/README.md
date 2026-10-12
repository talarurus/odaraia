# plainbalance application workspace

v0.3.1 Developer Preview, synthetic data only. The shared React application, exact finance services, Node SQLite adapter, async native contracts and preserved Swift/AppKit host live here. The isolated Tauri/Rust project is in `../experiments/tauri-desktop/`.

Start with the [root README](../README.md) for locked dependency installation, safe synthetic profiles, tests and platform limitations. The original Swift application is preserved; Tauri uses the same accepted workspace and design system. No new design library or financial policy is introduced.

```sh
npm ci
npm test
npm run test:persistent
npm run test:journey
npm run build
npm run check:assets
```

`npm run review:synthetic` creates a separate fictional web profile; append `-- --empty` for first run. The plain `dev` command retains the existing `data/finance.sqlite` default; use an explicit synthetic `FINANCE_DB` for deliberate persistence. Never run tests against a personal store.

`npm run build:tauri` builds an internal ad hoc macOS bundle. Fetch locked Cargo dependencies first on a fresh checkout. Full installed GUI acceptance and screenshots remain pending. `npm run test:rust` exercises the actual Rust/bundled-SQLite contracts, not the installed window.

Database schema 3, backup `talarurus-finance` version 1, exact arithmetic, existing migrations, transfer semantics and native restrictions remain unchanged. Databases and backups are unencrypted. No consumer distribution is approved. See [security policy](../SECURITY.md), [preview acceptance](../PLAINBALANCE_V031_DEVELOPER_PREVIEW.md), [support matrix](../PLAINBALANCE_PLATFORM_SUPPORT_MATRIX.md) and [license audit](../LICENSE_RECOMMENDATION.md).
