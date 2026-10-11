# Odaraia release roadmap

2026-10-10 · v0.3.1 Developer Preview preparation · No consumer release approved.

Source publication is a separate decision from distributing software for actual financial records. The founder may present an active development project before all platforms or production security features exist, provided limitations are clear.

| Stage | Scope | Exit gate |
| --- | --- | --- |
| **v0.3.1 — GitHub Developer Preview** | Curated source, accurate README/security/platform records, approved license, CI, repeatable synthetic workflows, review-ready website page. | Founder approves license and source/publication scope; current-source audit passes; online dependency advisories reviewed; current screenshots captured or explicitly deferred; no consumer-security claims. |
| **v0.4.0 — Functional Alpha** | Reliable daily account, transaction, budget, CSV, report and recovery journeys; accepted minimal UI retained. | Installed macOS journey and native dialogs/restart verified, keyboard/accessibility checks, known feature gaps visible, scale/backup capacity plan. Synthetic/limited internal use until security gate. |
| **v0.5.0 — Cross-platform Beta Foundation** | First additional desktop target, then mobile/web foundations using shared services and persistence contracts. | Real Windows/Linux build/install/lifecycle evidence per target; browser-local persistence before PWA claims; actual iOS/iPadOS/Android projects and devices before mobile support claims. |
| **v0.8.0 — Security and Release Candidate** | Reviewed database encryption, key custody, encrypted portable backups and recovery, public APIs, signed packages/update integrity, privacy/support policy. | Independent security review and failure/recovery acceptance, clean-machine signing/install tests, supported OS matrix and accessibility evidence. |
| **v1.0 — Stable Release** | Dependable personal finance on explicitly supported platforms. | Security, correctness, usability, recovery, performance and distribution gates passed; founder authorizes stable release. |

## Next product work

1. Finish the current installed macOS acceptance and capture real synthetic screenshots; record what the founder already observed separately from headless contract evidence.
2. Fix only demonstrated journey failures. Preserve the accepted Swift host, shared React workspace, exact arithmetic, migrations, transfer semantics, import identity, backup compatibility and Tauri restrictions.
3. Complete scale/backup capacity work without deleting audit/history. Current full backup ceiling is 16 MiB and native full snapshots require performance review.
4. Test a real Ubuntu desktop package and Windows WebView2/installer path before promising support. No new native UI rewrite is required to begin this work.
5. Create and test mobile targets only when their toolchains/devices are available. Responsive web UI is a foundation, not an installed mobile app.
6. Implement security and recovery protections before unrestricted distribution for real records. Do not delay honest source presentation solely because those protections are incomplete.

## Publication and distribution

The proposed repository is `talarurus/odaraia`; no repository existence, remote creation, push or GitHub release is assumed. The curated local tree has an explicit source allowlist and no imported history. `.gitignore` does not remove historic secrets; introducing any history requires a new full-history review.

After founder approval, use the authorized Talarurus organization identity, verify the organization/repository visibility and ownership, review the exact staged manifest and license, and only then create/connect/push through a separately authorized action. Do not use the restricted personal identity. No automatic release/deploy pipeline is configured.

For each future source milestone: update coherent versions, run tests/builds/journeys, review advisories/licenses/asset rights, regenerate source audit/archive and hashes, complete platform-appropriate acceptance, write factual notes, then obtain publication approval. A source archive has no installers or user data. A binary release needs target-specific license notices, security, signing, install and recovery gates in addition.

The website patch does not deploy itself. Applying it to the current site and pushing its auto-deploy branch requires separate authorization. No download CTA until a verified distributable exists; no GitHub CTA until the repository is published and verified.

## Platform ambition

macOS, Windows, Linux, iOS, iPadOS, Android and Web remain targets. They are not equally implemented or supported. See ODARAIA_PLATFORM_SUPPORT_MATRIX.md and ODARAIA_V031_DEVELOPER_PREVIEW.md for evidence, exact commands and remaining acceptance.
