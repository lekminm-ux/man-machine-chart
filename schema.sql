-- ============================================================
-- Man-Machine Chart DB Schema — Cloudflare D1 (SQLite)
-- ============================================================

-- Folders (Process Groups)
CREATE TABLE IF NOT EXISTS folders (
  id          TEXT PRIMARY KEY,
  parentId    TEXT DEFAULT NULL,
  name        TEXT NOT NULL,
  processType TEXT NOT NULL DEFAULT 'custom',
  expanded    INTEGER NOT NULL DEFAULT 1,
  createdAt   TEXT NOT NULL,
  FOREIGN KEY (parentId) REFERENCES folders(id) ON DELETE CASCADE
);

-- Chart Files (each file = one Man-Machine Chart)
-- content stores the full JSON: { header, steps, layoutDiagram }
CREATE TABLE IF NOT EXISTS chart_files (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  folderId  TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  content   TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (folderId) REFERENCES folders(id) ON DELETE CASCADE
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_files_folder ON chart_files(folderId);
CREATE INDEX IF NOT EXISTS idx_files_updated ON chart_files(updatedAt DESC);

-- Revision Snapshots (Phase 5a) — immutable history of closed revisions
ALTER TABLE chart_files ADD COLUMN lockedAt TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS revision_snapshots (
  id          TEXT PRIMARY KEY,
  chartFileId TEXT NOT NULL,
  revNo       TEXT NOT NULL,
  content     TEXT NOT NULL,
  closedAt    TEXT NOT NULL,
  FOREIGN KEY (chartFileId) REFERENCES chart_files(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_revision_snapshots_unique
  ON revision_snapshots(chartFileId, revNo);
CREATE INDEX IF NOT EXISTS idx_revision_snapshots_file
  ON revision_snapshots(chartFileId);

-- 90-day recoverable trash. Apply these additive statements as a separate
-- migration to an existing D1; do not re-run this whole schema.sql file.
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
