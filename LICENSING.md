# plainbalance licensing scope

Original plainbalance source and software-related neutral placeholder artwork are licensed under **Mozilla Public License 2.0**. The complete unmodified text is in [LICENSE](LICENSE). No Exhibit B incompatibility notice is attached to project source files.

This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

[licensing/coverage.json](licensing/coverage.json) identifies every curated publication path, its file-level treatment, notice location and content digest. Original frontend/components/styles, exact finance services, SQLite migrations/adapters, native Rust/C/Swift integrations, tests, tooling, documentation and configuration are covered, subject to the explicit exceptions below. Comments carry SPDX notices where practical; directory `LICENSES.md` files attach notices to unchanged data formats, generated code and assets. A directory notice does not relicense excluded third-party material.

| Exception | Applicable terms |
| --- | --- |
| `app/desktop/DesktopGlass.swift`, `app/desktop/ExperimentalGlassBridge.m` | MIT for the whole files, including project changes. Preserve copyright 2026 Nick and the full license, NOTICE and provenance record under `app/desktop/third-party/monocode/`. |
| Two official SVGs under `app/public/brand/publisher/` | Separate limited unchanged-artwork permission in [LICENSES/LicenseRef-Talarurus-Publisher-Artwork.txt](LICENSES/LicenseRef-Talarurus-Publisher-Artwork.txt); not MPL artwork. |
| Existing upstream license/NOTICE/provenance files, root LICENSE and DCO | Retained legal texts and provenance; not relabeled as original MPL code. |
| Dependencies | Their own licenses, recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); dependency implementations are not vendored. |

The temporary independent corner placeholder SVGs and generated icons are reusable MPL software assets, not final official product marks. Talarurus and plainbalance names, official artwork and distribution identities remain separately protected; see [brand policy](PLAINBALANCE_BRAND_AND_TRADEMARK_POLICY.md). No private asset or unpublished service is required to build the application.

The application npm metadata `MPL-2.0 AND MIT` summarizes file-specific cumulative obligations. It is **not** an offer of the whole application under MIT, nor an `OR` license. The isolated proof package and original Rust crate use `MPL-2.0`. `private: true` and `publish = false` prevent registry uploads; they do not restrict the software license.

Independent files containing no copied MPL code may form proprietary extensions or hosted services. Distributed modifications to covered files, including new files containing covered code, remain subject to MPL. Contributors retain ownership under [DCO instructions](PLAINBALANCE_CONTRIBUTION_POLICY.md); Talarurus receives no automatic right to relicense their MPL contributions as proprietary code.

Public-source authorization does not certify title or patents. Original ownership follows the available project record; the exact legal rightsholder/employee-contractor authority and historical MonoCode revision remain publication-review questions. No copyright assignment is created by a header or sign-off. Incorporated Talarurus website review files have separate unresolved rights and are excluded from this application source release; the local review patch remains untouched.

Licensing is implemented locally. GitHub publication, website deployment and official public binaries remain outside the agent's authorization. These are Talarurus workflow gates, not additional restrictions on downstream software-license rights; independent redistribution is governed by the applicable licenses. Lack of official certification does not withdraw MPL permissions. Databases/backups remain unencrypted; use fictional records only.

The unchanged Inter 4.001 WOFF2 in `brand/plainbalance/source/fonts/` uses **OFL-1.1**, with its full original license and provenance retained beside it. It is an editable wordmark source dependency, not MPL software or corporate artwork. Original outline-generation tooling/settings and product SVG exports retain their mapped MPL treatment. No application runtime font or dependency is added.
