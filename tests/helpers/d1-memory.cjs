// Small D1-compatible adapter around Node's in-memory SQLite. It executes the
// actual recursive and transactional SQL used by the trash API.
const { DatabaseSync } = require('node:sqlite');

module.exports = function makeMockD1(initial = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE folders (id TEXT PRIMARY KEY, parentId TEXT, name TEXT NOT NULL,
      processType TEXT NOT NULL, expanded INTEGER NOT NULL, createdAt TEXT NOT NULL,
      trashId TEXT);
    CREATE TABLE chart_files (id TEXT PRIMARY KEY, name TEXT NOT NULL, folderId TEXT NOT NULL,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, content TEXT NOT NULL,
      lockedAt TEXT, trashId TEXT);
    CREATE TABLE revision_snapshots (id TEXT PRIMARY KEY, chartFileId TEXT NOT NULL,
      revNo TEXT NOT NULL, content TEXT NOT NULL, closedAt TEXT NOT NULL,
      FOREIGN KEY (chartFileId) REFERENCES chart_files(id) ON DELETE CASCADE);
    CREATE UNIQUE INDEX revision_unique ON revision_snapshots(chartFileId, revNo);
    CREATE TABLE trash_entries (id TEXT PRIMARY KEY, kind TEXT NOT NULL, rootId TEXT NOT NULL,
      name TEXT NOT NULL, deletedAt TEXT NOT NULL, expiresAt TEXT NOT NULL,
      warnedAt TEXT, purgeStartedAt TEXT, restoredAt TEXT, purgedAt TEXT);
    CREATE TABLE trash_members (kind TEXT NOT NULL, memberId TEXT NOT NULL,
      trashId TEXT NOT NULL, PRIMARY KEY (kind, memberId, trashId));`);
  // Some legacy revision fixtures intentionally contain an orphan snapshot.
  // Seed them as historical rows, then enable FK behavior for API operations.
  db.exec('PRAGMA foreign_keys = OFF');

  for (const f of initial.folders ?? []) {
    db.prepare('INSERT INTO folders VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(f.id, f.parentId ?? null, f.name, f.processType, f.expanded, f.createdAt, f.trashId ?? null);
  }
  for (const f of initial.chart_files ?? []) {
    db.prepare('INSERT INTO chart_files VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(f.id, f.name, f.folderId, f.createdAt, f.updatedAt, f.content, f.lockedAt ?? null, f.trashId ?? null);
  }
  for (const r of initial.revision_snapshots ?? []) {
    db.prepare('INSERT INTO revision_snapshots VALUES (?, ?, ?, ?, ?)')
      .run(r.id, r.chartFileId, r.revNo, r.content, r.closedAt);
  }
  for (const e of initial.trash_entries ?? []) {
    db.prepare('INSERT INTO trash_entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(e.id, e.kind, e.rootId, e.name, e.deletedAt, e.expiresAt,
        e.warnedAt ?? null, e.purgeStartedAt ?? null, e.restoredAt ?? null, e.purgedAt ?? null);
  }
  db.exec('PRAGMA foreign_keys = ON');

  function prepare(sql) {
    const statement = { binds: [] };
    statement.bind = (...args) => { statement.binds = args; return statement; };
    statement.first = async () => db.prepare(sql).get(...statement.binds) ?? null;
    statement.all = async () => ({ results: db.prepare(sql).all(...statement.binds) });
    statement.run = async () => {
      const info = db.prepare(sql).run(...statement.binds);
      return { success: true, meta: { changes: Number(info.changes) } };
    };
    return statement;
  }

  async function batch(statements) {
    db.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      db.exec('COMMIT');
      return results;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  const state = {
    get folders() { return db.prepare('SELECT * FROM folders ORDER BY createdAt').all().map(row => ({ ...row })); },
    get chart_files() { return db.prepare('SELECT * FROM chart_files ORDER BY createdAt').all().map(row => ({ ...row })); },
    get revision_snapshots() { return db.prepare('SELECT * FROM revision_snapshots').all().map(row => ({ ...row })); },
    get trash_entries() { return db.prepare('SELECT * FROM trash_entries').all().map(row => ({ ...row })); },
    get trash_members() { return db.prepare('SELECT * FROM trash_members').all().map(row => ({ ...row })); },
  };
  return { env: { DB: { prepare, batch } }, state, db };
};
