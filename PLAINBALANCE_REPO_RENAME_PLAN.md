# plainbalance repository rename plan

Prepared locally. No remote rename, commit, push, tag, release, deploy or media publication is authorized. Use **talarurus-admin**, never the personal GitHub account, for all publication operations.

The existing public repository is `talarurus/odaraia`, repository ID `1413991449`, node ID `R_kgDOVEfMGQ`. Its current `main` and the local `release/odaraia-source` HEAD are `972731fb4b0b9631fa23bd3e7e4185758bf9d6d3`. Preserve this existing repository and every ancestor. The parent finance workspace is the active implementation; the publication checkout receives only the exact reviewed source manifest. Keep its historical local path. Do not initialize a replacement repository, import workspace history, force-push or recreate the old repository name.

## Read-only preflight — 2026-10-11

- Scoped keyring authentication confirms `talarurus-admin`; active organization membership role is admin and repository `permissions.admin` is true. The default gh account remains personal; it was not used for authenticated preflight requests or switched.
- `github-talarurus` uses the dedicated company SSH key with IdentitiesOnly and GitHub greets `talarurus-admin` (SSH test exit 1 is normal when GitHub denies a shell).
- Current owner `talarurus`, visibility public, default branch main; one public branch at the reviewed commit, unprotected; no repository rulesets, webhooks, Pages site or releases. Organization-level policy may change: recheck immediately before execution.
- Target `talarurus/plainbalance` returns 404 to the authenticated organization admin. This is no visible occupying repository, not a reservation or guarantee. See PLAINBALANCE_NAME_PREFLIGHT.md for domain/name limits and unresolved clearance.
- The current description already matches `Local-first personal finance. Accounts, cash flow, spending, budgets, and net worth.` Homepage remains `https://talarurus.com`; set the product URL only after its deployment is verified.

## Approval and execution sequence

1. Founder reviews the exact source inventory/digest, deliberate removed paths, source diff, approved original icon/outlined wordmark, licensing/ownership dispositions, current advisory findings and website diff. Approve source-only scope explicitly; unencrypted-storage consumer binaries remain prohibited. Decide whether native/media acceptance can be deferred for source publication. Confirm the target/name clearance disposition.
2. At the approved publication window, select the company account and verify it before any write. Commands below are instructions only and were not executed:

```sh
gh auth switch --hostname github.com --user talarurus-admin
test "$(gh api user --jq .login)" = talarurus-admin
gh api repos/talarurus/odaraia --jq '{id,full_name,visibility,default_branch,permissions}'
gh api repos/talarurus/plainbalance
ssh -T git@github-talarurus
git -C release/odaraia-source ls-remote origin refs/heads/main
```

The target GET should still be 404. Any existing target, identity/permission mismatch, changed remote SHA or unexpected checkout change stops execution for review. SSH must greet `talarurus-admin`. Git commit author identity is separate from API/SSH login: retain existing authors and use the approved company commit identity/sign-off for the new commit.

3. Rename the **existing** repository in GitHub Settings → General → Repository name, or execute the specifically approved command:

```sh
gh repo rename plainbalance --repo talarurus/odaraia --yes
gh api repos/talarurus/plainbalance --jq '{id,full_name,visibility,default_branch}'
git -C release/odaraia-source remote set-url origin git@github-talarurus:talarurus/plainbalance.git
git -C release/odaraia-source ls-remote origin refs/heads/main
```

The new endpoint must retain repository ID `1413991449`, owner talarurus, visibility, main branch and the old commit. Verify anonymous old/new web and Git redirects. The `git remote set-url` is a later local step; origin is unchanged in this preparation.

4. Apply the reviewed post-rename source patch prepared locally under `integration/publication/` only after the rename is verified. It switches README clone/reference URLs and release destination metadata; it does not migrate data or change version 0.3.1. Recheck its recorded baseline hashes and `git apply --check`; stale patches require regeneration, never forcing. New clone instructions become `git clone https://github.com/talarurus/plainbalance.git` then `cd plainbalance`. Regenerate license coverage/audit and obtain approval of any changed source bytes before committing.
5. Stage only the explicit reviewed manifest plus deliberate deletions from the publication inventory, inspect `git diff --cached --check` and the entire staged diff, commit under the approved identity, and push only the approved branch. Do not use `git add .`, the unborn-tree prepare/stage helper, force-push, tags, Releases, uploaded binaries or media. Verify that the original commit remains an ancestor of the new commit. Run CI and verify anonymous README, SECURITY and both old/new policy/support/roadmap document URLs. Old ODARAIA document files remain migration stubs or historical records; repository redirects alone do not map renamed files.
6. Once the new source/document URLs return 200, apply the separately reviewed website-link patch. It switches the product-page GitHub links to the new repository and PLAINBALANCE filenames. Revalidate the real website checkout and any intervening unrelated edits. The `/products/plainbalance/` page, sitemap/listings and old-route 301 source are local. Approve a website commit/push/deployment separately: pushing its main branch auto-deploys. No DNS or Cloudflare configuration change is required or authorized.
7. After verified site deployment, set the homepage to the product route. The description is already correct; preserve it. Approved later command:

```sh
gh repo edit talarurus/plainbalance --description 'Local-first personal finance. Accounts, cash flow, spending, budgets, and net worth.' --homepage 'https://talarurus.com/products/plainbalance/'
```

8. Verify actual deployed redirect status/Location for both `/products/odaraia` and `/products/odaraia/`, canonical/Open Graph URL, sitemap, footer/navigation, headers, 404 handling and public document links. Locally emulating the rules is not proof of live host behavior. Publish only separately approved actual synthetic screenshots; hidden media slots and README image templates remain inactive until then. Choose the next release tag/version separately.

## Redirect and compatibility expectations

[GitHub's current rename guidance](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository) covers repository web/Git redirects and preserved repository information. Project Pages URLs and hosted action calls need separate attention; none are currently enabled here. Never reuse `talarurus/odaraia`, which would remove redirects. Update clones even when redirects work; do not promise every renamed asset/document deep link survives without retained files.

Keep `com.talarurus.odaraia`, Rust/C/FFI names, SQLite migrations/schemas, backup format, profile paths, onboarding/preferences/sidebar keys, native bridge names and HTTP security headers/cookies unchanged. The app name is plainbalance; publisher is Talarurus. Original history and legal records retain Odaraia where historical. The preferred original icon geometry and official corporate artwork are immutable in this task.
