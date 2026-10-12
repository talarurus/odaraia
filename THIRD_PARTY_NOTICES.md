# Third-party notices

2026-10-11 · Source-release index; not a substitute for the original license texts.

Original source is licensed under MPL-2.0 with explicit file-level exceptions in LICENSING.md. Third-party material retains its own terms. Full preserved notices are indexed below; source publication and binary redistribution remain separate approvals.

## Incorporated adaptation

`app/desktop/DesktopGlass.swift` and `app/desktop/ExperimentalGlassBridge.m` adapt MonoCode's native glass sequence. Preserve **Copyright (c) 2026 Nick**, the complete MIT text, NOTICE and ADAPTATION record in `app/desktop/third-party/monocode/`. The arrangement keeps these two whole files MIT, including Talarurus changes; it does not erase upstream authorship. The header's linked LICENSE and release-adjacent full text are present. Exact upstream revision remains unverified. NOTICE's provider names are attribution/disclaimers, not copied artwork or an endorsement.

The public Swift fallback excludes the experimental private implementation; Tauri does not link it. Retaining its source and notices does not approve use of private platform APIs in consumer binaries.

## Dependencies

| Material | Recorded terms / notice location | Current conclusion |
| --- | --- | --- |
| React, React DOM, Recharts and MIT transitive packages | Each project's `notices/third-party/`; existing NOTICES tables | Available copied license texts retained; do not replace with MPL. |
| D3 and related dependencies | ISC/BSD/MIT texts under the same directories | Preserve applicable copyright, license and disclaimer texts. |
| Playwright tooling | Apache-2.0 LICENSE and NOTICE copies | Both license and supplied NOTICE retained; no browser-engine binaries are included in the source release. |
| axe-core development tooling | MPL-2.0 and its third-party license list | Texts retained; any distributed modified covered tooling needs corresponding source. |
| Cargo dependencies | `release/cargo-licenses.json` and exact Cargo.lock | 477 third-party package metadata records; fetched source retains its own licenses. No Cargo cache/source is vendored. Full target-specific notices are not assembled. |
| SQLite | Node/system SQLite and Rust libsqlite3-sys with bundled SQLite | SQLite core is public-domain software per [SQLite's own copyright statement](https://www.sqlite.org/copyright.html); bindings, build tooling and runtime dependencies have separate terms. Check the actual distribution graph. |

Run `node tools/dependency-audit.mjs` to regenerate an ignored lock/license metadata inventory. The two npm locks record 146 entries including optional platforms; Cargo records 478 packages including the original project. A metadata check is not a legal compatibility solver or vulnerability scan.

The existing notice tables have rows with missing root license text (platform esbuild package, Redux subpath entries and victory-vendor). Determine whether these are aliases/subpackages covered by a parent text and collect any independently required notices before shipping their code. Do not claim they are cleared merely because metadata says MIT. Existing copied texts are kept unchanged.

## Assets and references

The two Talarurus publisher SVGs are separately reserved corporate artwork with the narrow redistribution permission in PLAINBALANCE_BRAND_AND_TRADEMARK_POLICY.md. Original neutral placeholders are software-related MPL assets, not approved exclusive product marks. No SharkFin/Monarch/Actual reference screenshots, private brand galleries, archived logo concepts or downloaded research assets are included. No Actual source is vendored on the available source record. The separate local website patch and copied site HTML are excluded from the application publication manifest; their rights remain a separate integration review.

## Redistribution status

For this **source-only** tree, available MonoCode MIT copyright/license text and additional NOTICE/provenance records are present, and existing dependency license copies are retained. Ownership, historical MonoCode revision and authority for the separately scoped artwork permissions remain ownership-review questions. Lockfiles alone do not ship third-party dependency implementations.

Neither current application bundle is certified for public redistribution: Tauri packaging includes available notices and a clear internal-only source-access statement, but lacks a complete target-specific notice/source-access certification; Swift collects some runtime notices without proving complete obligations. Before a binary or hosted frontend release, resolve the target/features graph, include applicable full texts/notices, identify preferred-form MPL source and access instructions, handle minified JS as executable form, and verify required source availability. Preserve third-party source terms even if the combined executable uses another permitted license. No binary release is authorized here.

## Upstream verification on 2026-10-11

The retained MonoCode MIT text matches the current [upstream LICENSE](https://raw.githubusercontent.com/hardbeat920/monocode/main/LICENSE) as returned by the source reader. Current [upstream NOTICE](https://raw.githubusercontent.com/hardbeat920/monocode/main/NOTICE) adds provider names Devin and Cognition relative to the retained historical copy. The original saved NOTICE is preserved byte-for-byte; no provider artwork or UI was copied. The historical source commit cannot be reconstructed from this moving-main check, and the commit API was unavailable. These checks do not independently prove upstream title. See licensing/canonical-verification.json.

## plainbalance wordmark source font

Inter 4.001: unchanged website font copied into `brand/plainbalance/source/fonts/inter-latin-wght.woff2`, under SIL Open Font License 1.1 (SPDX `OFL-1.1`). Complete original license: `brand/plainbalance/source/fonts/OFL.txt`; file hash and provenance: `brand/plainbalance/source/fonts/PROVENANCE.md`. fontTools and HarfBuzz are generation tools installed separately, not vendored application runtime code. The official Talarurus corporate wordmark/logo is not an input.
