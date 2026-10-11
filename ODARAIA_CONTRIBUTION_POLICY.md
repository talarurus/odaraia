# Odaraia contribution policy

2026-10-11 · **Implemented locally; no public repository or contribution intake has been published.**

Odaraia uses **Developer Certificate of Origin 1.1 sign-off, with inbound licenses matching the affected files**, without a CLA. Contributors retain copyright. No copyright assignment, exclusive grant or additional proprietary relicensing permission is imposed. Talarurus maintains the project; maintenance does not transfer contributors' ownership.

## DCO versus CLA

| Approach | Practical effect | Relicensing consequence |
| --- | --- | --- |
| DCO 1.1 + inbound-equals-outbound | Contributor certifies authority/provenance and public record; code enters under the affected file's published license. Simple sign-off workflow. | Does not let Talarurus relicense third-party MPL contributions into proprietary source. Separate owners' permission is needed. |
| Nonexclusive CLA | A separately negotiated agreement can grant additional copyright/patent permissions while contributors retain ownership. Requires clear language, identity/authority handling and administration; may reduce participation. | Could authorize future dual licensing if its explicit terms do so. A generic CLA does not automatically guarantee those rights. |
| Copyright assignment | Transfers agreed ownership rights and needs a separate executed agreement. | Can centralize control but imposes a larger contributor burden; **not proposed or authorized**. |

The [official DCO 1.1](https://developercertificate.org/) certifies the right to submit under the indicated open-source license; it is not a blanket relicensing contract. The [Apache contributor-agreement explanation](https://www.apache.org/licenses/contributor-agreements.html) illustrates a different grant model, not an agreement being adopted by Odaraia. The verbatim certificate is in [DCO](DCO).

If unrestricted proprietary dual licensing of the community core is essential from the first external contribution, resolve a nonexclusive CLA **before accepting that contribution**. Do not quietly add one later or assume DCO sign-offs cover it. For the currently stated plan—MPL application and separate optional commercial services—DCO is the recommended balance. Publicly released licenses cannot be revoked merely because the contribution policy changes later.

## Contributor terms

1. Submit original work you have authority to contribute, or identify upstream material and its compatible license/provenance. Obtain employer or other rightsholder approval where needed. Declare copied/generated portions and their sources; tool use does not prove ownership or license compatibility.
2. Original contributions to MPL-covered files are offered under standard MPL-2.0. Contributions to the two MIT adaptation files remain MIT with their upstream notices. Explicitly separately licensed assets retain their stated terms; do not place a new company logo under MPL accidentally. A mixed patch follows each file's terms, not one blanket repository label.
3. Sign off each contributed commit with `git commit -s` or `git commit --amend --signoff`, meaning you certify the **unmodified DCO 1.1**. Use a consistent identity/address you are authorized and willing to make public; sign-offs and Git history are enduring public records. Sign-off is not a cryptographic signature or copyright assignment. Do not insert someone else's sign-off for them.
4. Preserve required copyright/license/NOTICE information. Include source references and exact revisions for adaptations, and flag uncertainty instead of asserting unverified ownership. Maintainers may decline material whose rights cannot be established.
5. Use fictional financial data and follow CONTRIBUTING.md for focused changes, tests, storage/backup compatibility, accessibility and the accepted interface. Do not include personal records, secrets, private assets, generated builds or unrelated archives.

CONTRIBUTING.md and the pull-request template link this policy and DCO, explain per-file inbound terms, and require sign-offs. A future CI check can verify trailers but cannot prove legal authority. No CLA service or contributor bot is installed; maintainers must verify sign-offs during review.

## Maintainer responsibilities and commercial development

Record provenance and exceptions; preserve authorship when squashing or cherry-picking; obtain a real contributor certification rather than manufacturing trailers. Keep employee/contractor ownership or license agreements separate from the community DCO. Confirm the legal copyright holder before applying a company-wide notice.

Talarurus may commercially distribute compliant MPL builds, charge for services/support and develop independent proprietary modules without a CLA. It cannot close distributed covered-file improvements made by community contributors through an invented “commercial exception.” To offer those contributions under another license, obtain additional permission or remove/independently replace the affected expression. MPL's limited secondary-license mechanism is not a proprietary relicensing grant.

DCO and these inbound terms are implemented locally. Any future nonexclusive CLA requires an explicit new decision and contributor agreement; it cannot silently change past contributions. No copyright assignment is required.
