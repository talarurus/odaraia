# Security policy

plainbalance v0.3.1 is a developer preview for synthetic records. No version is currently certified for sensitive financial data, and no consumer security-support guarantee is offered.

## Report privately

Use the existing Talarurus [security reporting page](https://talarurus.com/security/) or email **ammaar@talarurus.com**, subject “plainbalance security report”. This is the public contact already published by Talarurus. Do not post exploitable details, real ledgers, access tokens, launch URLs, database files, or backup exports in public issues. Include a minimal fictional reproduction, affected version, platform, and expected boundary. No response-time or bounty promise is made.

## Current limitations

- SQLite databases, WAL/journals, and financial JSON backups are **unencrypted**. OS permissions are not encryption. Amount masking changes presentation only.
- Backup SHA-256 checksums detect accidental changes; they do not authenticate a sender or prevent deliberate rewriting.
- The renderer has legitimate financial capabilities. Main-window/origin/command checks reduce exposure; they do not make a compromised renderer safe.
- Native mock IPC contracts pass, but real WebView/CSP/file-dialog and installed lifecycle tests remain pending.
- Ad hoc review signatures do not authenticate Talarurus to consumers; no updater, production signing, or notarized release is offered.
- The optional Swift experimental glass implementation uses private APIs and is internal-only. The Tauri host does not include that implementation. Public distributions must use reviewed public APIs.
- USD-only records, full-snapshot native writes, and a 16 MiB backup limit need further scale/recovery work. No cloud sync, live bank connection, telemetry or crash upload is implemented.

Use disposable synthetic profiles. Restore only into an explicitly empty destination; never merge or overwrite a personal profile to perform a test. Publishing reviewed source is a separate decision from distributing an application for actual financial records.

Before an unrestricted finance-app release: implement reviewed encryption and platform key custody, encrypted portable backups and recovery, dependency advisory review, signing and update integrity, installed migration/failure acceptance, accessibility testing, and a documented support policy. See PLAINBALANCE_RELEASE_ROADMAP.md.

## Publication advisory screen — 2026-10-11

Live lockfile checks completed during rebrand preparation; this is not a clean advisory result or a full security review. Dependencies were not changed by the branding task. Founder disposition/remediation review is required before source publication; no consumer binaries are authorized.

- Both npm lockfiles flag esbuild 0.27.3: [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr), low severity, Windows development-server path traversal. The checked project scripts use the build API and their own local servers, not esbuild's vulnerable servedir server. Patched upstream versions start at 0.28.1; an upgrade needs its own dependency/build validation.
- OSV screening of all 477 third-party locked Rust packages flags glib 0.18.5: [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html), VariantStrIter unsoundness, patched in 0.20.0; its GHSA alias is the same issue, not a second vulnerability.
- The same screen flags proc-macro-error 1.0.4: [RUSTSEC-2024-0370](https://rustsec.org/advisories/RUSTSEC-2024-0370.html), an unmaintained-package advisory with no patched version. This is a maintenance warning, not a claimed exploit.

Inverse Cargo trees place the two Rust packages in the GTK/WebKit dependency chain; neither appears in the current aarch64-apple-darwin dependency tree. Linux desktop execution and actual affected-function reachability remain unverified. Target absence in this macOS build does not clear future Linux releases. OSV version screening does not replace full RustSec policy, target/reachability, dependency ownership or native capability review. The local preparation report retains the scan evidence. Do not silently suppress findings or claim that passing financial tests resolves them.
