# Odaraia v0.3.1 Developer Preview

2026-10-10 · Prepared locally, unpublished · Synthetic records only.

This milestone prepares a credible source/development project under Talarurus. It does not certify a finance application for real records. The minimalist shared workspace and existing Swift app are preserved; no financial-engine, migration, bridge or storage-policy rewrite was made.

## Exact local commands

From the repository root:

```sh
npm ci --prefix app
npm ci --prefix experiments/finance-proof
node tools/check-release.mjs
node tools/check-assets.mjs
npm test --prefix app
npm test --prefix experiments/finance-proof
npm --prefix app run test:persistent
node tools/developer-preview.mjs journey
npm --prefix app run build
node tools/dependency-audit.mjs
```

Safe web review with a fresh fictional profile:

```sh
node tools/developer-preview.mjs web
node tools/developer-preview.mjs web --empty
```

Run one server at a time; Ctrl-C between commands. Use the private localhost URL printed by the server, never share it or its logs. For deliberate persistence use `FINANCE_DB=artifacts/my-synthetic-profile/finance.sqlite npm --prefix app run dev`; the path is resolved under app. Do not use the default development database for review.

Tauri on Apple Silicon macOS with Xcode Command Line Tools, Node 24.21.0 and Rust 1.99.0:

```sh
cargo fetch --locked --manifest-path experiments/tauri-desktop/src-tauri/Cargo.toml
node experiments/tauri-desktop/test-native.mjs
node tools/developer-preview.mjs journey --rust
node experiments/tauri-desktop/build-review.mjs
node experiments/tauri-desktop/build-review.mjs --recovery
open "app/artifacts/tauri-validation/mac/Odaraia SQLite Prototype.app"
open "app/artifacts/tauri-validation/mac/Odaraia SQLite Prototype Recovery.app"
```

Those stable prototype profiles are separate from the accepted Swift app. For **guaranteed new first-run and recovery profiles**, build with `--fresh-profile` and `--recovery --fresh-profile`, then open each exact printed bundle path. Build-time identifiers get a unique suffix; no runtime profile selector or native capability expansion is added. Never delete or reset an occupied profile to obtain an empty screenshot. The builder archives previous review executables and does not modify databases. Both versioned bundles are ad hoc signed and are not public distributables.

New checkouts require registry access for npm/Cargo installation. Existing private caches are excluded from publication. `cargo fetch` is explicit; subsequent native test/build scripts use `--offline --locked`. No global cargo-tauri is needed. Source lockfiles pin resolved versions; byte-identical signed bundles across SDK/compiler versions are not promised.

## Automated journey evidence

`tools/developer-preview.mjs journey` uses real Node SQLite in a new ignored folder. `journey --rust` uses shared services and the exact Rust FFI/bundled SQLite process in another new folder. Each verifies:

| Step | Expected result |
| --- | --- |
| Fresh state / account | No accounts, then Fictional Developer Checking with opening $1,000.00 on 2026-08-31. |
| Manual transaction | 2026-09-01 Fictional Stationery, expense Office, -$12.50; balance $987.50. |
| Budget | September Groceries created at $250.00, modified to $300.00. |
| CSV | All 7 rows of `app/fixtures/sample-checking.csv` preview and commit; pending row excluded from posted reports. |
| Reports | September income $5,000.00, spending $1,702.50, surplus $3,297.50; net worth/balance $4,297.50. |
| Files / recovery | Financial CSV export, backup schema/checksum validation, identical restore into separate empty SQLite file, repeated restore refused. |
| Persistence | Node closes/reopens real database; native commands start fresh Rust processes. Backup records and exact net worth remain identical. |

Results are in ignored `app/artifacts/v031/journey-node.json` and `journey-rust.json`. These checks prove data/service behavior; they do not prove clicking native controls, save panels, quit/reopen lifecycle or correct pixels.

## Founder installed-app acceptance

Use the two fresh-profile build commands above. Start with the normal review app and leave the recovery app empty. Record version, macOS/architecture, generated identifier, and actual results. All data below is fictional.

1. Launch the review app. Confirm Odaraia / by Talarurus hierarchy, first-run Add account / Explore demo actions, minimal Overview, and compact experimental disclosure. About/Privacy must state unencrypted storage/backups and synthetic-only use.
2. Explore demo and exit. Confirm the local profile is still empty. Dismiss onboarding, quit/reopen, and confirm dismissal. Revisit via Settings → About Odaraia → Open getting started guide.
3. Add Fictional Developer Checking, checking, opening date 2026-08-31, balance 1000.00. Confirm $1,000.00. Onboarding should stop occupying Overview.
4. Add 2026-09-01 transaction, Fictional Stationery, -12.50, expense, Office. Confirm $987.50 in Accounts/Overview/Transactions.
5. Visit Accounts, Transactions, Spending, Cash Flow, Net Worth, Budgets and Import CSV. Select September 2026 where a month filter is shown. Confirm dates/filter explanations and visible financial data. Scroll a long page, then open Settings; its heading must start at the top with no onboarding above it.
6. In Budgets create September Groceries 250.00, then modify to 300.00. Confirm the saved value.
7. Import `app/fixtures/sample-checking.csv` into the fictional account. Choose ISO dates, signed amounts, and map ID/Date/Merchant/Amount/Category/Classification/Status/Note. Confirm preview before committing 7 rows. Compare the exact report values above; Groceries actual is $180.00 and remaining $120.00. Reimport the same file; no duplicates should be added.
8. Export transactions and a full financial backup through the native save dialog into a **synthetic review-only** location. Confirm cancel does not report a save. Treat the JSON as plaintext, even though its records are fictional.
9. Open the new empty recovery app. Settings → Data & recovery: validate the saved backup and restore with explicit empty-profile confirmation. Confirm identical account/transactions/budget/reports. A second restore must refuse to merge. Keep the original review profile intact.
10. Quit both apps normally, reopen the exact bundles, and confirm $4,297.50 and identical records. This is the native lifecycle check missing from headless persistence evidence.
11. Check Light/Dark/System, amount masking, reduced motion, sidebar collapse/persistence, keyboard focus and modal Escape/return focus. Test the documented app shortcuts (Cmd/Ctrl+B sidebar, Cmd/Ctrl+N transaction) and resize desktop/narrow web layouts. Do not represent a narrow browser as an installed mobile app.
12. Capture actual current Overview (populated/empty), onboarding, Accounts, Transactions, Settings, light/dark, collapsed sidebar and responsive web. Verify no personal desktop/profile/token appears. See docs/screenshots/README.md for automated browser capture.

If a feature fails, retain the fictional reproduction and report the failed step; do not silently skip it. Compilation alone is not acceptance. The current capture harness covers actual browser navigation/onboarding/account/transaction/theme/sidebar/resize/focus checks; it cannot execute in this environment.

## Verification record

Local automated checks pass: 116 application tests, 90 finance-proof tests, 16 system-SQLite contracts, the same 16 through Rust/bundled SQLite, 3 Rust unit/mock IPC tests; frontend and optimized Tauri normal/recovery builds; release/asset/license-metadata checks; Node and Rust full data journeys. No tests were skipped in those suites.

The curated source also installs with npm ci using lock-identified cached tarballs and passes the same test suites, both journeys, frontend and native review build. Online clean fetch remains a separate unverified check.

Blocked: Chrome/Chromium/WebKit launch before rendering; native GUI automation; current screenshots and full installed journey; fresh online npm/Cargo fetch; live npm advisory databases (DNS failure); `cargo audit` unavailable; GitHub Actions has not been run; extra-platform applications untested. The founder's latest report establishes Tauri launch, not completion of all acceptance steps. Review tools do not claim security certification.

## Source artifact commands

```sh
node tools/source-release.mjs inventory
node tools/source-release.mjs audit
node tools/source-release.mjs prepare
cd release/odaraia-source
node tools/source-release.mjs audit
node tools/source-release.mjs stage
node tools/source-release.mjs archive
git diff --cached --stat
git remote -v
```

`prepare` creates a new curated local repository with no commits/remote; it refuses to overwrite an existing review tree. `stage` audits first and stages only the exact source manifest. `archive` emits a local source-only tarball and SHA-256, never an installer or public release. Reports/profiles remain ignored. After any source or license change, rebuild the review tree deliberately and regenerate all audits; never push the 7+ GiB working directory. Source manifests and audit policy are review aids, not proof of erased history.

MPL-2.0, MIT exceptions, DCO and asset permissions are implemented locally. The founder gate covers ownership/provenance acceptance, source publication, online advisory review, screenshot/installed-desktop acceptance or explicit source-only deferment, and separate website review. See ODARAIA_SOURCE_PUBLICATION_APPROVAL.md. No commit, push, remote creation, release or deployment is authorized by this document.
