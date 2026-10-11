CREATE TABLE accounts (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('checking','savings','credit','asset','liability')),
 currency TEXT NOT NULL CHECK(currency='USD'), anchor TEXT NOT NULL, opening INTEGER NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0)
) STRICT;
CREATE TABLE transactions (
 id TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES accounts(id), date TEXT NOT NULL, amount INTEGER NOT NULL,
 payee TEXT NOT NULL, category TEXT NOT NULL, classification TEXT NOT NULL CHECK(classification IN ('income','expense','unclassified','transfer','adjustment')),
 status TEXT NOT NULL CHECK(status IN ('posted','pending','removed')), note TEXT NOT NULL,
 transfer_id TEXT, source_key TEXT NOT NULL UNIQUE, source_id TEXT, revision INTEGER NOT NULL CHECK(revision>0),
 provenance TEXT NOT NULL CHECK(json_valid(provenance)),
 CHECK((classification='transfer' AND transfer_id IS NOT NULL) OR (classification!='transfer' AND transfer_id IS NULL))
) STRICT;
CREATE INDEX transactions_date ON transactions(date,account,status);
CREATE INDEX transactions_transfer ON transactions(transfer_id);
CREATE TABLE budgets (month TEXT NOT NULL,category TEXT NOT NULL,planned INTEGER NOT NULL CHECK(planned>=0),PRIMARY KEY(month,category)) STRICT;
CREATE TABLE audit (id TEXT PRIMARY KEY, time TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, before_json TEXT, after_json TEXT NOT NULL CHECK(json_valid(after_json))) STRICT;
