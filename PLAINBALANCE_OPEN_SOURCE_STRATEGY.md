# plainbalance open-source strategy

2026-10-11 · MPL-2.0 implementation completed locally under founder instruction; **publication remains unauthorized**.

plainbalance is a public, mostly open-source application maintained by Talarurus. The locally implemented arrangement is standard MPL-2.0 for original application source and reusable neutral placeholders, MIT for two MonoCode-adapted files, limited separate corporate artwork permissions, and DCO 1.1 contributions without assignment. Independently written optional hosted services may remain proprietary.

## License comparison and rationale

| Decision | MPL-2.0 | MIT | Apache-2.0 |
| --- | --- | --- | --- |
| Community contributions | Contributors retain copyright; distributed modifications to covered files stay available under MPL. | Contributions can be reused in closed derivatives with notices. | Permissive reuse; express contribution/patent provisions and notice duties. |
| Commercial redistribution | Allowed, including sale and a proprietary Larger Work; provide covered source and required notices. | Allowed with copyright/permission notice. | Allowed with license, applicable notices and modification notices. |
| Proprietary extensions | Separate files containing no covered code can have other terms. Copying covered code into a new file brings that file within MPL's modification definition. | Closed extensions and modified original files permitted under retained upstream terms. | Closed extensions and modified original files permitted under retained upstream obligations. |
| Changes to existing core | When distributed, covered source changes must be MPL; private changes do not trigger disclosure. | No obligation to disclose changes. | No obligation to disclose changes. |
| Patent grants | Express contributor patent grant, scope limits and patent-litigation termination. | No express patent grant in the standard text. | Express contributor patent grant and patent-litigation termination. |
| Trademarks | Expressly excluded except necessary notice compliance; separate brand permission needed. | No express trademark grant; do not infer brand permission from a copyright license. | Expressly excluded except customary origin description/NOTICE reproduction. |
| Future dual licensing | Talarurus can offer other terms for code it controls. Community contributions need their owners' additional permission for proprietary relicensing, unless an approved agreement already grants it. | Broad permissive reuse reduces the need for a separate commercial license, but does not transfer contributor ownership. | Same practical permissive flexibility; retain contributor terms and applicable patent/notice obligations. |
| Funding/startup flexibility | Paid hosting, support, distribution and independent modules remain possible; competitors can also sell compliant forks. | Lowest downstream licensing friction; competitors can close improvements. | Broad enterprise reuse with explicit patent terms; competitors can close improvements. |


The standard [MPL](https://www.mozilla.org/en-US/MPL/2.0/), [MIT](https://opensource.org/license/mit) and [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) texts control. MPL fits sharing distributed covered-file improvements while preserving independent commercial work. It does not guarantee participation, funding, exclusivity or patent clearance. Plain MPL-2.0 is used without separately attaching Exhibit B; its limited secondary-license compatibility is retained.

## Implemented coverage

[LICENSE](LICENSE) is the unmodified Mozilla canonical text. [LICENSING.md](LICENSING.md) and [licensing/coverage.json](licensing/coverage.json) map the final source file set. Original frontend/design styles, finance engine/services, persistence adapters/migrations, native integrations, tests/tooling/configuration and original documentation use MPL-2.0. SPDX headers and directory notices attach the appropriate terms without changing financial behavior.

`app/desktop/DesktopGlass.swift` and `app/desktop/ExperimentalGlassBridge.m` remain MIT as whole files, retaining copyright 2026 Nick, full MIT text, NOTICE and provenance. The two corporate publisher SVGs are separately permitted unchanged artwork, not MPL art. The founder-preferred original corner icons remain reusable MPL software assets; their selection does not withdraw those permissions. Standard legal texts and upstream notices are not relabeled as project-authored MPL source.

Application npm metadata `MPL-2.0 AND MIT` describes cumulative file-level obligations; it is not an alternative MIT license for the whole application. The isolated proof package and Rust crate use MPL-2.0. Locked dependency versions, checksums, native capability restrictions, npm private flags, Cargo publish flag, schema 3 and backup v1 are preserved.

The separate website patch and copied site files are excluded from the application publication manifest because incorporated site rights require separate review. The website checkout and local integration overlay are rebranded locally; deployment remains unauthorized. No unlicensed company assets or unpublished services are required for the application build.

## Commercial boundaries and contributions

Potential independent commercial modules include hosted encrypted sync infrastructure, bank-provider integrations, team administration and managed deployment/support. These are future options, not implemented availability claims. Keep independent source files/packages/repositories and explicit licenses/interfaces. The local application's accounts, transactions, reports, budgets, CSV, backup/restore and persistence must remain usable without those services.

A distributed change to an existing covered file remains MPL; a new file containing copied covered code is also covered. A directory name or process boundary does not remove those obligations. MPL has no network-copyleft trigger for undistributed server code, while delivered browser JS/CSS is distribution. A compliant Larger Work can include independently owned proprietary files.

[DCO contribution terms](PLAINBALANCE_CONTRIBUTION_POLICY.md) retain contributor copyrights and match inbound licenses to affected files. Talarurus does not automatically acquire proprietary relicensing rights over external MPL contributions. Dual licensing code not wholly controlled by Talarurus requires the relevant owners' additional permission, an explicitly agreed prospective CLA, or independent replacement. Past grants cannot simply be withdrawn from compliant recipients.

## Remaining gates

[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) records available source notices and unresolved historical MonoCode revision. The current upstream LICENSE matches; current NOTICE adds provider names beyond the retained historical copy. No dependency source/cache is vendored. The recorded dependency license graph supports the selected arrangement, but metadata is not legal compatibility certification.

Original legal rightsholder/employer-contractor authority and any unrecorded copied expression still need founder confirmation before public distribution. The current corporate brand context was checked for this rebrand; official exports and their recorded provenance remain unchanged. Target-specific full binary notices, exact corresponding-source access, live advisory scans, current screenshots and installed-desktop acceptance remain separate gates.

See [the final source-publication report](ODARAIA_SOURCE_PUBLICATION_APPROVAL.md). No commit, remote, push, release, installer publication or deployment is authorized by these locally implemented terms.
