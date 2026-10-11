# Odaraia GitHub source readiness

2026-10-11 · Local preparation only; no commit, remote, push, release or deployment.

The final source-publication decision and remaining blockers are in [ODARAIA_SOURCE_PUBLICATION_APPROVAL.md](ODARAIA_SOURCE_PUBLICATION_APPROVAL.md). This document is supporting context, not a separate approval gate.

The deliberate allowlist now contains **370 files**, replacing the 339-file pre-license snapshot. It adds standard LICENSE/DCO, scope and brand/contribution terms, file-level notices, coverage verification and packaging notices; removes the obsolete license-status notice and separate website review material. The curated repository has no imported history. The original multi-gigabyte workspace, databases, caches, previous builds, private records and references remain outside the source release.

[LICENSING.md](LICENSING.md) specifies MPL-2.0 original source, two MIT adaptations, retained upstream texts and limited unchanged publisher artwork permissions. [licensing/coverage.json](licensing/coverage.json) maps exact final paths/hashes. npm metadata is cumulative file-specific licensing, not a whole-project MIT alternative. DCO requires no assignment or automatic proprietary relicensing.

Run `node tools/licensing.mjs check` and `node tools/source-release.mjs audit` before staging/archive creation. `stage` takes only the explicit manifest; do not use broad git add. The publication auditor checks index bytes, unlisted files, source signatures, private paths, financial identifiers and approved binary hashes. It refuses to certify existing history; `.gitignore` cannot erase old secrets. After any first commit, history review is a separate check. CI checks current checkout bytes only and cannot authorize publication.

Current automated and packaging results are in the final report and release/verification.json. Compilation/headless service journeys do not establish installed GUI or screenshot acceptance. Source licensing does not certify public binaries or production security. Databases/backups remain unencrypted and review data remains fictional.

Publication must use the authorized Talarurus organization identity (`talarurus-admin`) and repository `talarurus/odaraia`, with separately approved commit identity, owner/visibility verification and exact reviewed bytes. No repository existence has been assumed or probed. The separate website patch remains local, unapplied and excluded from this source release.
