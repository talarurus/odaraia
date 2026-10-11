# Security policy

Odaraia v0.3.1 is a developer preview for synthetic records. No version is currently certified for sensitive financial data, and no consumer security-support guarantee is offered.

## Report privately

Use the existing Talarurus [security reporting page](https://talarurus.com/security/) or email **ammaar@talarurus.com**, subject “Odaraia security report”. This is the public contact already published by Talarurus. Do not post exploitable details, real ledgers, access tokens, launch URLs, database files, or backup exports in public issues. Include a minimal fictional reproduction, affected version, platform, and expected boundary. No response-time or bounty promise is made.

## Current limitations

- SQLite databases, WAL/journals, and financial JSON backups are **unencrypted**. OS permissions are not encryption. Amount masking changes presentation only.
- Backup SHA-256 checksums detect accidental changes; they do not authenticate a sender or prevent deliberate rewriting.
- The renderer has legitimate financial capabilities. Main-window/origin/command checks reduce exposure; they do not make a compromised renderer safe.
- Native mock IPC contracts pass, but real WebView/CSP/file-dialog and installed lifecycle tests remain pending.
- Ad hoc review signatures do not authenticate Talarurus to consumers; no updater, production signing, or notarized release is offered.
- The optional Swift experimental glass implementation uses private APIs and is internal-only. The Tauri host does not include that implementation. Public distributions must use reviewed public APIs.
- USD-only records, full-snapshot native writes, and a 16 MiB backup limit need further scale/recovery work. No cloud sync, live bank connection, telemetry or crash upload is implemented.

Use disposable synthetic profiles. Restore only into an explicitly empty destination; never merge or overwrite a personal profile to perform a test. Publishing reviewed source is a separate decision from distributing an application for actual financial records.

Before an unrestricted finance-app release: implement reviewed encryption and platform key custody, encrypted portable backups and recovery, dependency advisory review, signing and update integrity, installed migration/failure acceptance, accessibility testing, and a documented support policy. See ODARAIA_RELEASE_ROADMAP.md.
