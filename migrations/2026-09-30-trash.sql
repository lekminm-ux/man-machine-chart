-- Apply once, after a verified Production export and schema inventory.
-- Do not run schema.sql against an existing database.
ALTER TABLE folders ADD COLUMN trashId TEXT DEFAULT NULL;
ALTER TABLE chart_files ADD COLUMN trashId TEXT DEFAULT NULL;
CREATE TABLE IF NOT EXISTS trash_entries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('file', 'folder')),
  rootId TEXT NOT NULL,
  name TEXT NOT NULL,
  deletedAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  warnedAt TEXT DEFAULT NULL,
  purgeStartedAt TEXT DEFAULT NULL,
  restoredAt TEXT DEFAULT NULL,
  purgedAt TEXT DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS trash_members (
  kind TEXT NOT NULL CHECK (kind IN ('file', 'folder')),
  memberId TEXT NOT NULL,
  trashId TEXT NOT NULL,
  PRIMARY KEY (kind, memberId, trashId),
  FOREIGN KEY (trashId) REFERENCES trash_entries(id)
);
CREATE INDEX IF NOT EXISTS idx_folders_trash ON folders(trashId);
CREATE INDEX IF NOT EXISTS idx_files_trash ON chart_files(trashId);
CREATE INDEX IF NOT EXISTS idx_trash_members_batch ON trash_members(trashId);
CREATE INDEX IF NOT EXISTS idx_trash_expiry ON trash_entries(expiresAt, warnedAt)
  WHERE restoredAt IS NULL AND purgedAt IS NULL;
