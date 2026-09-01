CREATE TABLE IF NOT EXISTS vocabulary_items (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL,
  normalized_term TEXT NOT NULL UNIQUE,
  meaning_zh TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('word', 'phrase')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS vocabulary_items_updated_at
  ON vocabulary_items (updated_at DESC);
