# Odaraia website integration

2026-10-11 · Separate local review patch; not applied, deployed or included in the application source release.

The copied site HTML and integration material require separate ownership/permission review. They and tools/website-preview.mjs are deliberately excluded from the curated public application source manifest; they remain unchanged in the founder workspace. Commands below apply only to that original workspace with its local integration files. Do not infer a software license grant for the entire Talarurus site.

The actual Talarurus website is buildless HTML/CSS/JavaScript. The integration preserves that framework, shared header/footer, self-hosted font, existing warm palette, navigation, security headers and official logo reference. No new framework, tracking, external script, account or hosting service is introduced. The Sites skill’s local-only workflow was used; no Sites hosting tool was invoked.

## Delivered files

- `integration/website/overlay/products/odaraia/index.html`: product page at `/products/odaraia/`.
- `integration/website/overlay/css/odaraia.css`: scoped responsive page styles using the site's existing tokens.
- Updated copies of `index.html`, `work/index.html` and `sitemap.xml`: replace only the generic finance project listing and add the route.
- `integration/website/odaraia.patch`: unified review patch; `manifest.json`: base commit and before/after SHA-256 for each file.

Base website commit: `c93e16b6d5cdb19a93537754a71bd0d4e7e67674`. `git apply --check` passes against that checkout. The actual website checkout was not modified. Recheck hashes/applicability if the site changes before applying; do not copy full overlay pages over intervening site work.

## Content and presentation

Odaraia by Talarurus has a typographic hero, concise local-first positioning, account/transaction/report/budget/import/backup features, real platform status, architecture overview and staged roadmap. Explore features and Development status are working anchor CTAs. There is no Download button and no enabled link to the proposed GitHub repository. Add View on GitHub only after publication, founder authorization and destination verification.

Corporate artwork is referenced as the site's existing `/assets/talarurus-logo.svg` without modification. No product-mark concept or reference screenshot is copied. The public Talarurus security/contact route is retained. The page clearly states synthetic developer use and unencrypted databases/backups.

**Hero screenshot remains a review blocker.** Browser engines abort before rendering here and no current founder screenshot was supplied. The HTML contains an inert `<template>` for the approved screenshot; it does not display a fabricated UI or request a nonexistent image. Before website publication, capture the current synthetic native Overview, inspect it, add `/assets/odaraia/overview-light.png`, replace the template with its figure, and add approved real secondary screenshots if useful. The page is ready to review for copy/integration; visual acceptance and screenshot completion remain pending.

## Local review and eventual application

From the finance source root:

```sh
node tools/website-preview.mjs
```

The script assembles a local ignored copy of the actual site's public HTML/CSS/JS/assets, overlays only the reviewed five files, and serves `http://127.0.0.1:4181/products/odaraia/`. It never changes the website checkout. Optional positional argument supplies a different existing site root. Ctrl-C stops the preview. Local bind/browser access may be blocked in a restricted execution environment; the patch can still be reviewed directly.

After separate founder authorization to change the site, from its checkout:

```sh
git apply --check ../finance-product/integration/website/odaraia.patch
git apply ../finance-product/integration/website/odaraia.patch
git diff --check
git diff --stat
```

Do not run the mutating apply step before authorization. The site deploys from its existing Git workflow; this task authorizes no commit, push, Cloudflare change, DNS change or deployment.

Before publication: founder approves copy, real screenshots, current platform/security claims, responsive layout, keyboard/focus/contrast, image alt text and applicable asset rights; run local link/HTML checks and browser inspection; verify proposed GitHub destination before enabling that CTA. No production-availability badges, metrics, testimonials or consumer-readiness claims are included.
