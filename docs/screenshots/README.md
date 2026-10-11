# Current product screenshot gate

No current v0.3.1 screenshot has been certified in this execution environment. Browser engines abort before rendering and native GUI automation is unavailable. The founder reports the current simplified Tauri app launches. Do not reuse older Talarurus Finance dashboard captures or render a fabricated UI as product evidence.

Run on a Mac with working GUI access:

```sh
node experiments/tauri-desktop/test-native.mjs
node experiments/tauri-desktop/build-review.mjs
node app/scripts/capture-preview.mjs
```

The capture script uses the real frontend bundle and Rust contract transport with disposable fictional profiles. It records browser screenshots and interactions, **not native-window acceptance**. Install Playwright Chromium first with `cd app && npx playwright install chromium`. The optional `CHROMIUM_PATH` selects an existing Chrome executable; no personal cache path is embedded.

Capture: populated Overview, empty Overview, onboarding, Accounts, Transactions, Spending, Cash Flow, Net Worth, Budgets, Settings (Appearance/Privacy/Recovery), light/dark, desktop expanded/collapsed, and narrow responsive web layout. Also complete the manual installed-app journey in ODARAIA_V031_DEVELOPER_PREVIEW.md and capture a native Overview using the OS screenshot tool.

Only after verifying fictional labels/amounts, current version, no filenames/tokens/personal desktop content, approved branding, and correct layout, copy selected PNGs from `app/artifacts/v031/screenshots/` into this folder. Add each explicit path and binary SHA-256 to `release/source-files.json`, keep attribution/date/platform/fixture metadata, update README and website figure, then rerun the publication audit. Never call a responsive browser screenshot an iOS/Android app.
