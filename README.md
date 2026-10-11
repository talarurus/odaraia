# Odaraia by Talarurus

A local-first personal-finance application for understanding accounts, spending, cash flow, budgets, and net worth.

**v0.3.1 Developer Preview · active development · source publication pending founder approval.** Odaraia combines a restrained financial workspace with exact accounting rules and portable records. This is development software for fictional data, with no verified consumer download.

## Screenshots

Current Tauri screenshots are awaiting capture and review. The founder reports that the simplified macOS prototype launches; this environment cannot launch a browser or native window to verify pixels. Older dashboard images are deliberately excluded because they no longer represent the product. [Capture instructions and required views](docs/screenshots/README.md) provide a repeatable path to accurate screenshots with synthetic data. Responsive web layouts are not native mobile applications.

## Implemented features

- Manual accounts and dated opening balances; exact posted balances and account history.
- Transactions, categories, pending records, refunds, paired transfers, edits, void and undo.
- Overview, Accounts, Transactions, Spending, Cash Flow, Net Worth, and monthly category budgets.
- CSV mapping, preview, explicit duplicate/reconciliation decisions, and replay protection.
- Financial CSV export and versioned full backups, validated restore into an empty profile.
- Isolated fictional demo, dismissible onboarding, collapsible desktop navigation, light/dark appearance, and focused Settings.

Currency is currently USD. No live banking, cloud sync, encrypted storage, automatic updater, recurrence, or mobile application is shipped. Whole-import undo and account archiving remain future work.

## Local-first architecture

The shared React workspace calls capability-scoped application services. Exact JavaScript financial rules serve the Node SQLite adapter and an async native adapter. An isolated Tauri/Rust host links the existing C storage core and bundled SQLite in process; it does not require a Node runtime. The existing Swift/AppKit/WKWebView implementation remains in the source and has not been replaced. Optional experimental native glass is confined to the Swift host.

Records stay in the local profile; there is no cloud account requirement or bank provider integration. [Architecture](docs/architecture.md) explains the boundaries.

## Platforms

| Platform | Current status |
| --- | --- |
| macOS, Apple Silicon | Experimental Swift application and isolated Tauri review bundle. Founder-reported Tauri launch; builds and persistence contracts verified on macOS 27.0.1 arm64. Full GUI journey pending. Tauri declares macOS 14.0 minimum; older systems untested. |
| Web frontend | React frontend and localhost Node service implemented. Browser interaction acceptance blocked in this environment. No browser-local persistent/PWA edition. |
| Windows / Linux | Shared storage source and prototype packaging configuration exist; no verified app, installer, or native GUI tests. |
| iOS / iPadOS / Android | Planned; no application packages or mobile screenshots. |

See the [support matrix](ODARAIA_PLATFORM_SUPPORT_MATRIX.md) for evidence and limitations. CI configuration is not proof of platform support.

## Financial correctness

Money uses exact integer minor units and `BigInt` arithmetic, with checked int64 storage boundaries. Independent fixtures check reports, opening-date policy, refunds, pending exclusion, paired transfers, budgets, import identity, and backup portability. Regression suites exercise transactional failures, migrations, concurrent writes, crashes, and process restarts. Chart coordinates may use display numbers; authoritative totals retain exact values.

## Privacy and security

**Databases and exported backups are unencrypted. Use synthetic data only.** File permissions, local execution, amount masking, and backup checksums do not provide encryption or authenticated confidentiality. Ad hoc macOS signatures are for internal review and do not authenticate a public publisher. Native dialogs, accessibility, installed lifecycle, and real WebView capability behavior still require acceptance. Experimental private glass APIs must not enter a general-release binary.

Source publication and consumer software distribution have different gates. [SECURITY.md](SECURITY.md) describes reporting and current limitations.

## Development setup

Use Node **24.21.0**, npm, and locked dependencies. Native macOS work additionally needs Xcode Command Line Tools and Rust **1.99.0** (the tested compiler). The crate declares Rust 1.90 as a source minimum, not a verified minimum toolchain. Run from the repository root:

```sh
npm ci --prefix app
npm ci --prefix experiments/finance-proof
node tools/check-release.mjs
node tools/developer-preview.mjs web
```

The last command creates a new fictional profile and starts the frontend/backend on localhost. Use `web --empty` for first run. Open the private URL printed by the server; do not publish terminal logs containing its launch credential. Ctrl-C stops the server. Each invocation uses a new profile. For a persistent developer workspace use `FINANCE_DB=artifacts/my-synthetic-profile/finance.sqlite npm --prefix app run dev`; this path is relative to `app` and must contain fictional records only.

## Testing and native build

```sh
npm test --prefix app
npm test --prefix experiments/finance-proof
npm --prefix app run test:persistent
node tools/developer-preview.mjs journey
npm --prefix app run build
node tools/check-assets.mjs
node tools/dependency-audit.mjs
node tools/licensing.mjs check
```

For the isolated **macOS-only** Tauri review app:

```sh
cargo fetch --locked --manifest-path experiments/tauri-desktop/src-tauri/Cargo.toml
node experiments/tauri-desktop/test-native.mjs
node tools/developer-preview.mjs journey --rust
node experiments/tauri-desktop/build-review.mjs
node experiments/tauri-desktop/build-review.mjs --recovery
open "app/artifacts/tauri-validation/mac/Odaraia SQLite Prototype.app"
```

`cargo fetch` requires registry access on a new checkout. Tests/builds then use `--offline --locked`; the private workspace's registry cache is never part of the source release. These scripts build with Cargo directly, so a global Tauri CLI is unnecessary. Native launches use their own prototype/recovery profile identifiers, separate from Swift and development records. Do not co-write a profile with multiple adapters.

[Developer preview procedure](ODARAIA_V031_DEVELOPER_PREVIEW.md) covers full GUI acceptance, screenshots, backup/recovery, dependency advisory checks, and source artifacts. CI runs core tests on macOS and Linux and the native contract/build job on macOS; Linux desktop and Windows/mobile app support remain unverified. No automatic public-release pipeline is installed.

## Roadmap

| Milestone | Purpose |
| --- | --- |
| v0.3.1 | GitHub Developer Preview: reviewed source, documentation, CI, reproducible synthetic workflows. |
| v0.4.0 | Functional Alpha: complete normal financial journeys and installed-app acceptance. |
| v0.5.0 | Cross-platform Beta Foundation: additional tested runtimes using shared contracts. |
| v0.8.0 | Security and Release Candidate: encryption, recovery, signing, privacy and release review. |
| v1.0 | Stable Release: declared support, security and usability acceptance. |

[Release roadmap](ODARAIA_RELEASE_ROADMAP.md) tracks the gates rather than promising dates.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Use fictional data, preserve exact arithmetic and backup compatibility, and keep the accepted minimalist interface. Do not include financial records, credentials, binaries, or proprietary reference artwork in issues or patches. Contributions use DCO 1.1 sign-off with file-specific inbound terms. Source publication still awaits separate founder authorization.

## License

Original Odaraia source uses **MPL-2.0**, with two MIT-adapted files and separately protected corporate artwork. [LICENSE](LICENSE), [LICENSING.md](LICENSING.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) define the exact coverage. Application metadata `MPL-2.0 AND MIT` describes cumulative file-level obligations, **not** an alternative MIT license for the entire application.

Commercial redistribution and independent proprietary extensions/services are permitted subject to the applicable licenses. Distributed covered-file changes remain under MPL. [Contributions](ODARAIA_CONTRIBUTION_POLICY.md) use DCO 1.1 without copyright assignment or automatic proprietary relicensing rights.

Talarurus and Odaraia names and official marks have separate rights. The two unchanged publisher SVGs have [limited attribution/redistribution permission](LICENSES/LicenseRef-Talarurus-Publisher-Artwork.txt). Neutral temporary icons remain reusable software assets, not final official marks. See the [brand policy](ODARAIA_BRAND_AND_TRADEMARK_POLICY.md).

Licensing is implemented locally; ownership/provenance dispositions, current advisory checks and the [source-publication gate](ODARAIA_SOURCE_PUBLICATION_APPROVAL.md) remain for founder review. No consumer binary release is certified.

Built by [Talarurus](https://talarurus.com). The proposed repository is `talarurus/odaraia`; no remote has been created or configured.
