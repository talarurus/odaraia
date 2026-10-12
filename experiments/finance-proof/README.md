# Independent synthetic finance proof

This harness checks exact report policy against a separate SQLite-backed implementation and golden fictional fixtures. It is not the plainbalance application shell and does not connect to a bank or a user profile.

```sh
npm ci --prefix experiments/finance-proof
npm test --prefix experiments/finance-proof
npm --prefix experiments/finance-proof run build
```

90 tests cover exact arithmetic, date/filter policy, import identity, backups, concurrent/recovery behavior, appearance and accessible chart structure. Original regression snapshots now live in `harness/fixtures/` so tests do not depend on generated artifact folders. Browser tests require a working Playwright installation and GUI/browser permissions; headless model/render tests do not certify pixels or native applications.

Dependencies are locked. Notices are retained in NOTICES.md and notices/third-party. Actual Budget probing is optional and not a shipped dependency; no bank connection or cloud service is configured. All generated evidence belongs under ignored artifacts/. See the root README for the maintained product UI, developer preview and security limitations.
