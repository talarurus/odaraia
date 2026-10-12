# plainbalance website integration

Implemented locally in the actual `talarurus.com` checkout. No deploy or push. Preserve all unrelated local work.

The product page is `/products/plainbalance/` with title/attribution `plainbalance by Talarurus`, shared website typography, scoped `css/plainbalance.css`, existing platform/security limitations and official company header/footer/favicon unchanged. Product listings, footer navigation, metadata and sitemap use the new product route. `_redirects` prepares 301 redirects for `/products/odaraia` and `/products/odaraia/`, effective only after a separately approved deployment.

GitHub CTAs retain the existing public repository URL `https://github.com/talarurus/odaraia` and currently published ODARAIA document paths until rename and source push are verified. See PLAINBALANCE_REPO_RENAME_PLAN.md for the sequence. The website production branch auto-deploys; do not push as a routine local check.

The local `integration/website/overlay` is refreshed from the actual website and its manifest records the current baseline hashes. Do not apply an old whole-file overlay over new work. The historical odaraia.patch is superseded by plainbalance.patch; it is a review artifact only. `node tools/website-preview.mjs --assemble-only` assembles a local copy; without the flag it serves `/products/plainbalance/` on localhost:4181.

Current real screenshots have not been approved. A hidden `#media` section is prepared without active image URLs; next-release destinations and metadata requirements are in `docs/screenshots/media-plan.json`. Exact post-source GitHub link mappings are prepared locally in `integration/publication/`; live links remain on the existing public URLs until rename/source verification. Keep the restrained text page until current plainbalance synthetic native captures pass founder review. Use `docs/screenshots/README.md`; no old-name media or fabricated UI. Site assets remain outside the public application manifest and retain their own rights. Founder approval is required before source push, site deployment or media publication.
