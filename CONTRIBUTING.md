# Contributing to plainbalance

plainbalance is preparing v0.3.1 Developer Preview. Original code uses MPL-2.0 with explicit file-level exceptions. Publication remains subject to a separate founder gate. See LICENSING.md and PLAINBALANCE_CONTRIBUTION_POLICY.md.

Use Node 24.21.0 and the checked-in npm lockfiles. Native work is currently verified only on Apple Silicon macOS, using Rust 1.99.0. Follow the root README setup and test commands.

For each change:

1. Reproduce the problem with fictional accounts and records, in a separate profile.
2. Keep changes focused; preserve exact arithmetic, transactional semantics, transfer pairing, CSV identities, migrations, backup v1, and capability restrictions.
3. Run the relevant tests, then application and finance-proof suites. Storage changes require both persistent contract suites and backup/restart checks.
4. For UI changes preserve shared tokens, the continuous workspace, focused Settings and responsive navigation. Include real light/dark screenshots with synthetic records when a browser is available; label blocked tests honestly.
5. Run `node tools/licensing.mjs check`, `node tools/check-release.mjs`, `node tools/check-assets.mjs`, `node tools/dependency-audit.mjs`, and `node tools/source-release.mjs audit`. A new source file must be deliberately added to `release/source-files.json` after review; run `node tools/licensing.mjs notices` and `node tools/licensing.mjs coverage` to refresh notices/hashes before checking. Do not suppress findings without a specific explanation.
6. Describe behavior, validation, limitations and any migration or compatibility impact in the pull request.

Never add `.env` files, launch URLs, financial databases, backup exports, profiles, signing material, generated installers, dependency caches, or third-party reference screenshots. `.gitignore` does not erase history. Report suspected disclosures privately using SECURITY.md.

Retain third-party licenses and adaptation notices. Preserve official Talarurus artwork byte-for-byte, using the recorded upstream exports. Brand names and assets are separate from the source-license decision. Experimental Swift private glass is for internal review and must stay excluded from a general-release build.

There is no automated publication pipeline. Maintainers must obtain founder approval for repository/publication, website integration, any license-policy change and any distributable release separately.

## DCO sign-off

Each contributed commit must certify the unmodified [DCO 1.1](DCO). Use `git commit -s` (or `git commit --amend --signoff` for your own commit). A fictional example trailer is:

```text
Signed-off-by: Fictional Contributor <contributor@example.org>
```

Use your own authorized public identity/address, never copy the example or sign on someone else's behalf. Your sign-off becomes part of public Git history. It is not a cryptographic signature or copyright assignment.

Contributions to MPL files enter under MPL-2.0; contributions to the identified MIT files remain MIT. Preserve upstream notices and disclose copied material/provenance. DCO grants no automatic right for Talarurus to relicense community MPL work as proprietary source; additional permission would be needed. No CLA is imposed. See PLAINBALANCE_CONTRIBUTION_POLICY.md.
