# Odaraia platform support matrix

2026-10-10 · v0.3.1 Developer Preview · No certified consumer platform release.

“Verified” applies only to the stated check. Headless services, compilation and mock IPC do not certify installed UI, operating-system support or encryption.

| Target | Actual implementation | Verified evidence | Remaining acceptance |
| --- | --- | --- | --- |
| macOS Swift/AppKit | Existing WKWebView + local Node/SQLite host; optional internal experimental glass. | Founder-reported working baseline. Existing application bundles and Swift/Objective-C host source preserved in this milestone. | No new native lifecycle or supported-OS certification. Public releases must exclude private glass APIs and meet signing/security gates. |
| macOS Tauri, arm64 | Isolated Rust/C host, bundled SQLite, shared React workspace; no Node sidecar. | v0.3.1 optimized review and recovery bundles build and ad hoc signature verification pass on macOS 27.0.1 arm64, Node 24.21.0, Rust 1.99.0. Founder reports current simplified app launches on their Mac. | Agent GUI launch blocked; full installed account/transaction/budget/import/dialog/restore/restart acceptance and current screenshots pending. Declared/actual Mach-O minimum 14.0 is not older-OS testing. |
| Native SQLite core, macOS | C/system SQLite and Rust FFI/bundled SQLite contracts. | 16 system-SQLite contracts; same 16 through actual Rust boundary; 3 Rust unit/mock IPC tests. Full synthetic account/budget/CSV/backup/reopen journeys pass on both adapters. | Other-OS execution, real WebView/CSP/dialog behavior, fuzzing, memory-safety review and scale acceptance. |
| Web frontend with localhost Node | Shared React UI and Node SQLite service. | Frontend builds; financial services, in-process API and synthetic persistence journey verified on Node. | Chrome/Chromium/WebKit abort before rendering in this environment. No verified browser interactions or touch/keyboard acceptance this pass. |
| Browser-local Web/PWA | Shared pure services and responsive UI only. | Compilation foundation. | No browser persistent adapter, service worker, installable PWA, eviction/multitab recovery or hosted deployment. Planned. |
| Windows | Shared source and prototype NSIS configuration. | No Windows execution. | Toolchain/runner, WebView2, package/install/lifecycle/accessibility and storage tests. No supported version or installer claimed. |
| Linux | Shared source and prototype `.deb` configuration. | No native Linux app execution. CI core-source job prepared for Ubuntu 24.04, not yet run on GitHub. | Real GTK/WebKit desktop dependencies, build/package, Wayland/X11, storage/install/lifecycle acceptance. |
| iOS | Shared engine/UI foundation. | No iOS application. | Xcode target, simulator/device, native storage/key custody/navigation and accessibility. Planned. |
| iPadOS | Shared engine/UI foundation. | No iPad application. | Tablet target/device, adaptive layout and native acceptance. Planned. |
| Android | Shared engine/UI foundation. | No Android application. | SDK/NDK/Gradle target, emulator/device, storage/key custody/navigation and accessibility. Planned. |

## Capability evidence

| Capability | Node SQLite | Actual Rust/C process | Installed Tauri GUI |
| --- | --- | --- | --- |
| Create account, opening balance, manual transaction, exact updated report | PASS | PASS | Pending |
| Budget create/modify | PASS | PASS | Pending |
| Sample CSV preview/confirm and replay policy | PASS | PASS | Pending |
| Backup validation/export data, empty restore, refusal to merge | PASS | PASS | Native save/load dialogs pending |
| Reopen persisted records/report | PASS | PASS (fresh process per command) | Quit/reopen UI pending |
| Transfer pairing, refunds, pending, rollback/concurrency/crash | Regression suites PASS | Persistence contracts PASS | UI acceptance pending |
| Navigation, onboarding, themes, sidebar, keyboard, resize | Render/model regressions PASS | Not a UI | Browser/native execution blocked here; founder procedure prepared |
| Encryption | Not implemented | Not implemented | Not implemented |

Current local test totals: **116 application + 90 independent proof + 16 C/SQLite + 16 Rust-boundary contracts + 3 Rust tests**, with no skipped tests in those suites. Both repeatable full data journeys pass. Linux CI checks core source and Node behavior only; its presence does not establish Linux desktop support. CI and fresh online dependency fetches remain unexecuted here.

No mobile package/screenshots, Windows installer, Linux desktop package, public notarized macOS release, browser-local edition or auto-update service is delivered. Planned minimum OS versions are intentionally deferred until real target tests. Before distribution, recheck official platform/SDK requirements rather than treating historical proposed floors as support promises.

See README.md, SECURITY.md, ODARAIA_RELEASE_ROADMAP.md, and ODARAIA_V031_DEVELOPER_PREVIEW.md.
