# plainbalance screenshot and media gate

The original white corner app icon, outlined lowercase wordmark and secondary by Talarurus attribution are founder-approved. Do not redesign them or reuse the archived alternatives. Current browser captures are local review evidence only; no product screenshots are approved for publication. Installed native-window screenshots/acceptance remain pending. Older dashboard captures and fabricated UI must not be used as current product evidence.

Run the existing actual-frontend/Rust harness on a Mac with Chrome/Playwright:

```sh
node experiments/tauri-desktop/test-native.mjs
node experiments/tauri-desktop/build-review.mjs
node app/scripts/capture-preview.mjs
```

An existing Chrome is tried first; `CHROMIUM_PATH` can select another executable. Install Playwright Chromium only if needed. The capture script uses the real frontend bundle and Rust contract transport with disposable fictional profiles. It captures browser pixels, not a native Tauri window or mobile application. A failed or partial run is not certified media. Local outputs stay ignored under `app/artifacts/v031/screenshots/`.

`media-plan.json` reserves next-release README and website destinations using a `<release-tag>` template. The next tag/version is deliberately undecided; current metadata remains 0.3.1. README image examples are inside a nonrendered comment. The website has a hidden media section with no active image requests. No nonexistent image is linked in rendered content.

Required review: populated/empty Overview and onboarding; Accounts/Transactions; light/dark; Settings; collapsed sidebar; narrow responsive browser. Record exact source snapshot/commit, capture date, actual runtime/platform, fixture, viewport/theme, filename, SHA-256 and alt text. Native-window Overview is a separate OS screenshot after the installed-app journey in PLAINBALANCE_V031_DEVELOPER_PREVIEW.md. Verify fictional labels/amounts and absence of tokens, personal filenames, desktop details or stale branding. Do not label browser pixels as native acceptance.

After explicit media approval, copy selected actual PNGs into `docs/screenshots/<release-tag>/`, add exact file paths/binary hashes and license notices to the source manifest, activate the README image links, and copy the same approved pixels into website `assets/products/plainbalance/<release-tag>/`. Activate the hidden media section only with real images, accurate captions/alt text and reviewed responsive sizing. Regenerate source/licensing audits and review each publication diff. Source push and website deployment require their own approvals. No unencrypted-storage consumer binaries accompany this source rebrand.
