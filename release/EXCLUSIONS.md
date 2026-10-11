# Source publication exclusions

The release manifest is an explicit file allowlist; ignored/unlisted files are never copied or staged by preparation tooling. The original directory has no imported Git history. `.gitignore` is not a history scrubber.

The filename-only inventory snapshot taken during this milestone excluded **56,922 files / 8,227,857,213 logical bytes** (sizes fluctuate as tests/builds add evidence). Counts include dependencies, compiler outputs and previous app archives. No excluded database content was opened. The full private path/size list stays in `app/artifacts/v031/workspace-inventory.json`, outside this source release.

| Exclusion | Why |
| --- | --- |
| npm node_modules, Cargo registry caches, Rust target, generated schemas/frontend output | Downloadable/generated dependencies and builds; lockfiles and source included instead. |
| Application bundles, installers, app-build archives, dylibs/object/archive files | No consumer binary release; large internal review products are not source. |
| Financial SQLite/DB files, WAL/SHM/journals, local profiles, backup/export files | Personal-data and plaintext storage boundary; never publish even if believed synthetic. Synthetic fixture source is explicitly allowlisted. |
| Environment/config secrets, tokens, signing keys/certificates, developer provisioning | Credentials must never enter a public source tree or its history. |
| Logs, traces, HAR, crash/benchmark output, temporary screenshots, local diagnostics | May contain paths, launch credentials or financial data; raw evidence is private. |
| Reference screenshots/backgrounds, downloaded research archives | Redistribution rights not established. |
| Archived product-name/logo candidates, company master/build files, private brand records | Not approved product identity or public brand material. Only active placeholder and official publisher exports are included. |
| Historical internal strategy/review documents and private-machine instructions | Superseded or contain personal paths/internal context. Public README, architecture, roadmap, security and milestone records replace their publication role. |

Current screenshots require deliberate review and explicit binary hashes before adding to the source manifest. See docs/screenshots/README.md. Official publisher artwork is unchanged and has separate rights. The original accepted Swift application is preserved outside the curated repository.

The separate local website integration patch, copied site pages and website-preview tool are excluded from the application source manifest pending incorporated-site rights review. Historical licensing proposals remain local review artifacts; the source release includes the active license, policies, coverage and canonical verification record.
