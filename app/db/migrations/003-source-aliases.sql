CREATE TABLE source_aliases (source_key TEXT PRIMARY KEY, transaction_id TEXT NOT NULL REFERENCES transactions(id), evidence TEXT NOT NULL CHECK(json_valid(evidence))) STRICT;
