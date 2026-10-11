CREATE TABLE imports (file_key TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES accounts(id), name TEXT NOT NULL, time TEXT NOT NULL, result TEXT NOT NULL CHECK(json_valid(result))) STRICT;
CREATE TABLE previews (id TEXT PRIMARY KEY, file_key TEXT NOT NULL, account TEXT NOT NULL REFERENCES accounts(id), payload TEXT NOT NULL CHECK(json_valid(payload)), created_at TEXT NOT NULL) STRICT;
