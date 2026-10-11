# Odaraia v0.3.1 — final source-publication approval report

2026-10-11 · **Licensing implemented and validated locally. GitHub publication remains unauthorized.** This is the single current founder source-publication gate. Workflow approvals here do not add restrictions to downstream MPL rights.

## Exact source and licensing result

The curated repository at `release/odaraia-source/` contains **370 explicitly allowed files**, replacing the previous 339-file snapshot. It has **zero commits, zero remotes**, matching staged/current bytes and no unresolved publication-scanner findings. The new source-only archive is generated from that exact allowlist and checked for exact member/content equality. Its digest is recorded beside the archive, avoiding a recursive digest inside the archived report itself.

- Standard unmodified **MPL-2.0** is active in LICENSE, with SPDX source comments and directory notices for unchanged formats/generated code. No separate Exhibit B notice is attached. Complete canonical text is verified through Mozilla's source reader; direct raw HTTP download remains DNS-blocked. License SHA-256: `f35b870c59c69f29f127265bb7adb7417c6fe0d19a75c2dd8a50fd8447e66536`.
- `DesktopGlass.swift` and `ExperimentalGlassBridge.m` remain **MIT**, with copyright 2026 Nick and all existing MonoCode LICENSE/NOTICE/provenance records retained. The current upstream MIT text matches; the historical adaptation revision is still unverified.
- npm application metadata is **MPL-2.0 AND MIT**, cumulative per-file terms, not an alternative MIT license for the entire app. Proof and original Rust crate metadata use MPL-2.0. Dependency versions/checksums, npm private flags and Cargo publish restriction are unchanged.
- Corporate names/official marks have separate protection. The two unchanged publisher SVGs have an explicit limited attribution/redistribution permission, including commercial redistribution. Neutral temporary icons are reusable MPL assets. All official SVG/icon hashes remain unchanged; no private asset or commercial service is required by the application build.
- **DCO 1.1** and Signed-off-by instructions are active; no CLA or assignment is imposed. DCO does not authorize proprietary relicensing of community MPL contributions. Independent hosted services may remain proprietary; distributed covered-file changes still follow MPL.

[LICENSING.md](LICENSING.md), [file coverage](licensing/coverage.json), [canonical/upstream verification](licensing/canonical-verification.json), [third-party notices](THIRD_PARTY_NOTICES.md), [brand policy](ODARAIA_BRAND_AND_TRADEMARK_POLICY.md) and [contribution policy](ODARAIA_CONTRIBUTION_POLICY.md) contain the exact terms and scope.

The application source manifest excludes the obsolete pending-license notice, historical licensing proposals and the separate website integration material/tool. The local website review patch and website checkout remain untouched; incorporated site rights are a separate review. Dependencies/caches, databases/profiles/backups, generated apps/installers, private logs, historical screenshots and archived brand concepts remain excluded. Nine original placeholder icon binaries are explicitly hash-allowlisted. Twelve scanner matches are individually dispositioned as fictional test/example inputs or intentional public/required copyright contacts; zero unresolved matches is a targeted audit result, not a comprehensive security certification.

## Verification

| Check | Result |
| --- | --- |
| Application / finance-proof tests | **116 / 90 pass**, original workspace and curated copy |
| C/system SQLite / actual Rust-bundled SQLite contracts | **16 / 16 pass**, both copies |
| Rust unit/mock IPC contracts | **3 pass**, both copies; **241 total**, zero skipped |
| Synthetic service journeys | Node and Rust journeys pass in both copies: account/opening balance, transaction, reports, budget edit, 7-row CSV, backup validation, separate empty restore, merge refusal and persistence |
| Frontend / Tauri packaging | Frontend and optimized Tauri build pass from curated source; new original-workspace review/recovery bundles build and verify ad hoc signatures |
| License packaging | Exact MPL, retained MIT/NOTICE, publisher permission and provenance verified in review/recovery bundles; available npm texts and explicit internal-only source-access statement included |
| Swift preservation | Accepted existing Swift app untouched, signature verifies. Public fallback and experimental-glass hosts compile in separate test outputs. All 27 recorded implementation files are byte-identical or differ only by the exact added SPDX comment |
| Coverage / release / asset / dependency metadata / source checks | Pass; every final path classified and notice mapped; standard legal text hashes checked; 146 npm entries and 478 Cargo packages inventoried |

Authoritative totals remain exact: synthetic journey final balance/net worth **$4,297.50**, September income **$5,000.00**, spending **$1,702.50**, surplus **$3,297.50**. Financial arithmetic, migration files/schema, transfer/import semantics, backup format and native capability behavior are unchanged. Tests use fictional disposable profiles; no user database was opened or modified.

Native builds were verified with cached locked dependencies. Fresh online npm/Cargo fetch and actual GitHub Actions execution remain unverified. Builds and headless contracts do not certify installed GUI behavior or screenshots. Full target-specific binary compliance remains unverified despite the added legal files.

## Remaining founder decisions — separate gates

| Gate | Required disposition |
| --- | --- |
| Legal ownership/provenance | Confirm the original legal rightsholder, employee/contractor authority and permission to grant the corporate artwork rights. Resolve or explicitly accept the documented historical MonoCode revision limitation and any unrecorded copied-expression concern. Current upstream NOTICE adds Devin/Cognition provider names; the original retained NOTICE remains unchanged. No independent title/patent clearance is claimed. Configured brand-context lookup was unavailable; supplied rules/recorded exports were followed. |
| Dependency security | npm advisory requests failed registry DNS; cargo-audit is unavailable and registry discovery failed DNS. No clean vulnerability result exists. Run connected scans and review findings, or explicitly record a source-only publication exception for unavailable services. |
| Screenshots | No current v0.3.1 capture is certified: previous browser engines aborted before pixels. Capture current fictional-data views, or explicitly defer screenshots for the source repository with README's honest disclosure. No older prototype image is substituted. |
| Installed desktop acceptance | Complete the actual Tauri journey in ODARAIA_V031_DEVELOPER_PREVIEW.md, or explicitly defer it for development-source publication. Native dialogs, window lifecycle, focus and visual acceptance are not proven by compilation. |
| Official binaries/consumer security | Not approved. Complete target/features notices and real corresponding-source access, security/encryption, signing and installed acceptance before official public binary distribution. Databases/backups remain unencrypted. |
| Website | Patch stays local, excluded and unapplied. Review incorporated rights, current site edits and real screenshots before separately authorizing integration/deployment; do not overwrite newer site files with stale overlays. |
| GitHub source publication | Approve these exact reviewed staged bytes, the archive digest and commit identity for **public `talarurus/odaraia`**, using **talarurus-admin**. No remote existence has been assumed or probed. |

## Local verification and artifact commands

From the curated repository:

```sh
node tools/licensing.mjs check
node tools/check-release.mjs
node tools/check-assets.mjs
node tools/dependency-audit.mjs
node tools/source-release.mjs audit
git diff --cached --check
git diff --cached --stat
```

After any deliberate source/notice edit, update the explicit allowlist as needed, run `node tools/licensing.mjs notices`, then `node tools/licensing.mjs coverage`; review, stage with `node tools/source-release.mjs stage`, audit again and regenerate with `node tools/source-release.mjs archive`. The local archive is `release/archives/odaraia-v0.3.1-source-review.tar.gz` with adjacent `.sha256`. Never broadly stage the original workspace.

The original workspace's new isolated review bundles are:

```sh
open "app/artifacts/tauri-validation/mac/Odaraia SQLite Prototype Review mv3cirp6.app"
open "app/artifacts/tauri-validation/mac/Odaraia SQLite Prototype Recovery Review mv3cn3ok.app"
```

Keep recovery empty until testing restore. Future source checkouts can build their own fresh profiles with `node experiments/tauri-desktop/build-review.mjs --fresh-profile` and `--recovery --fresh-profile`; open each printed path. Do not rebuild between persistence checks, because fresh builds create new identifiers.

## Prepared GitHub commands — not executed

Run only after explicit authorization to commit, create the public repository and push, and after the preceding dispositions. Set approved `ODARAIA_COMMIT_NAME` and `ODARAIA_COMMIT_EMAIL`; no identity is assigned by this preparation.

```sh
(
  set -eu
  : "${ODARAIA_COMMIT_NAME:?Set founder-approved commit name}"
  : "${ODARAIA_COMMIT_EMAIL:?Set founder-approved commit email}"
  cd ~/projects/talarurus/finance-product/release/odaraia-source
  node tools/licensing.mjs check
  node tools/source-release.mjs audit
  git diff --cached --check
  test -z "$(git remote)"
  gh auth switch --hostname github.com --user talarurus-admin
  test "$(gh api user --jq .login)" = talarurus-admin
  ODARAIA_SSH_RESPONSE="$(ssh -T git@github-talarurus 2>&1 || true)"
  printf '%s\n' "$ODARAIA_SSH_RESPONSE"
  case "$ODARAIA_SSH_RESPONSE" in *'Hi talarurus-admin!'*) ;; *) exit 1 ;; esac
  git -c user.name="$ODARAIA_COMMIT_NAME" -c user.email="$ODARAIA_COMMIT_EMAIL" \
      commit -s -m "Prepare Odaraia v0.3.1 Developer Preview"
  gh repo create talarurus/odaraia --public \
      --description "Local-first personal finance by Talarurus — Developer Preview"
  gh repo view talarurus/odaraia --json nameWithOwner,visibility,url
  git remote add origin git@github-talarurus:talarurus/odaraia.git
  git push -u origin main
)
```

If repository creation reports an existing repository, stop and verify owner, visibility and history before any different action. After a first commit the unborn-tree auditor intentionally requires a separate history review. After an authorized push, inspect CI and the actual repository before updating publication links/status. This block publishes no GitHub Release or installer and deploys no website. No part of it has been executed.
