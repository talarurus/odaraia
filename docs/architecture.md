# Shared application architecture

Odaraia separates financial policy, application capabilities, persistence and presentation.

| Layer | Source | Responsibility |
| --- | --- | --- |
| Exact policy | `app/domain/` | Integer minor-unit money, dates, reports, transfers, CSV validation. |
| Services | `app/services/` | Ledger operations, import identity/reconciliation, full backup validation and application commands. |
| Node SQLite | `app/db/`, `app/server/` | Existing migrations, transactions, localhost development/native Swift transport. |
| Async native adapter | `app/storage/async-native.ts`, `native-sqlite/` | Reuses services, optimistic revision check, transactional C/SQLite snapshot persistence. |
| Tauri host | `experiments/tauri-desktop/` | Rust/C ownership boundary and fixed-profile commands, native save dialog; bundled SQLite, no Node sidecar. |
| Accepted macOS host | `app/desktop/` | Existing Swift/AppKit/WKWebView implementation; optional internal private glass stays isolated. |
| Shared presentation | `app/web/` | One React workspace and `workspace.css` entry point with shared design tokens; responsive desktop/mobile web layouts. |
| Independent proof | `experiments/finance-proof/` | Synthetic comparison fixtures, report-policy reference and regression harness, not a second product shell. |

The Tauri capability configuration remains restricted to bundled main-window storage/export commands. No shell, arbitrary SQL, filesystem plugin, live banking or remote financial endpoint is introduced. Native contract tests exercise the real Rust FFI/bundled SQLite process; mock IPC tests do not certify a real installed WebView boundary.

Stable legacy identifiers are intentional: backup `talarurus-finance` v1 and stored preference keys remain compatible across the Odaraia display-name changes. Schema remains 3. Do not rename identifiers as cosmetic cleanup.

Financial tables and forms use readable solid surfaces; charts sit in the continuous workspace. Native glass is optional and has no role in financial semantics. Desktop sidebar collapse, mobile touch navigation/safe areas and shared theme tokens are already implemented. No native mobile target exists yet.

The C prototype uses full snapshots with size/revision bounds; future performance work must preserve atomicity and validation. Never allow Node and native adapters to co-write one profile because native revision metadata is adapter-specific. Backups are the current cross-adapter portability boundary. Databases and backups remain plaintext.
