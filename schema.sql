-- ============================================================
-- Man-Machine Chart DB Schema — Cloudflare D1 (SQLite)
-- ============================================================

-- Folders (Process Groups)
CREATE TABLE IF NOT EXISTS folders (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  processType TEXT NOT NULL DEFAULT 'custom',
  expanded    INTEGER NOT NULL DEFAULT 1,
  createdAt   TEXT NOT NULL
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
