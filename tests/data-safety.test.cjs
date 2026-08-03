// Phase 0B — runtime data-safety guards for the folder/file hierarchy API.
//
// These tests exercise functions/api/folders.js and functions/api/files.js
// directly, against an in-memory mock D1 built for this file. They never
// touch Production D1, local Pages Dev D1, or the external recovery export —
// per the Database Safety Gate, that export is recovery evidence only, never
// a test fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const rootDir = path.resolve(__dirname, '..');

// Same in-realm loader used by the other *.test.cjs files (chart-utils,
// time-study, machine-capacity) — works for plain JS with ESM export syntax
// too, since transpileModule is a syntactic transform, not a type-checked
// program build.
function loadModule(relativePath) {
  const filename = path.join(rootDir, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;

  const cjsModule = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', 'require', '__filename', output)(
    cjsModule.exports, cjsModule, require, filename
  );
  return cjsModule.exports;
}

const foldersApi = loadModule('functions/api/folders.js');
const filesApi = loadModule('functions/api/files.js');

// ── In-memory mock D1 — recognizes exactly the query shapes this project's
//    API handlers issue. Not a general SQL engine. ─────────────────────────
function makeMockD1(initial = {}) {
  const state = {
    folders: (initial.folders ?? []).map(f => ({ ...f })),
    chart_files: (initial.chart_files ?? []).map(f => ({ ...f })),
  };

  function runSelect(sql, binds) {
    if (sql.startsWith('SELECT id, parentId, name, processType, expanded, createdAt FROM folders')) {
      return [...state.folders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    if (sql === 'SELECT 1 FROM folders WHERE id = ?') {
      return state.folders.some(f => f.id === binds[0]) ? [{ '1': 1 }] : [];
    }
    if (sql === 'SELECT parentId FROM folders WHERE id = ?') {
      const f = state.folders.find(x => x.id === binds[0]);
      return f ? [{ parentId: f.parentId }] : [];
    }
    if (sql === 'SELECT 1 FROM folders WHERE parentId = ? LIMIT 1') {
      return state.folders.some(f => f.parentId === binds[0]) ? [{ '1': 1 }] : [];
    }
    if (sql === 'SELECT 1 FROM chart_files WHERE folderId = ? LIMIT 1') {
      return state.chart_files.some(f => f.folderId === binds[0]) ? [{ '1': 1 }] : [];
    }
    throw new Error('mock D1: unhandled SELECT: ' + sql);
  }

  function runMutate(sql, binds) {
    if (sql.startsWith('INSERT INTO folders')) {
      const [id, parentId, name, processType, expanded, createdAt] = binds;
      state.folders.push({ id, parentId, name, processType, expanded, createdAt });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE folders SET')) {
      const id = binds[binds.length - 1];
      const folder = state.folders.find(f => f.id === id);
      if (!folder) return { success: true, meta: { changes: 0 } };
      const setPart = sql.slice('UPDATE folders SET '.length, sql.indexOf(' WHERE'));
      const cols = setPart.split(',').map(s => s.trim().split('=')[0].trim());
      cols.forEach((col, i) => { folder[col] = binds[i]; });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql === 'DELETE FROM folders WHERE id = ?') {
      const before = state.folders.length;
      state.folders = state.folders.filter(f => f.id !== binds[0]);
      return { success: true, meta: { changes: before - state.folders.length } };
    }
    if (sql.startsWith('INSERT INTO chart_files')) {
      const [id, name, folderId, createdAt, updatedAt, content] = binds;
      state.chart_files.push({ id, name, folderId, createdAt, updatedAt, content });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE chart_files SET')) {
      const id = binds[binds.length - 1];
      const file = state.chart_files.find(f => f.id === id);
      if (!file) return { success: true, meta: { changes: 0 } };
      const [name, folderId, updatedAt, content] = binds;
      if (name !== null) file.name = name;
      if (folderId !== null) file.folderId = folderId;
      file.updatedAt = updatedAt;
      if (content !== null) file.content = content;
      return { success: true, meta: { changes: 1 } };
    }
    throw new Error('mock D1: unhandled mutation: ' + sql);
  }

  function prepare(sql) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const stmt = {
      _binds: [],
      bind(...args) { stmt._binds = args; return stmt; },
      async first() {
        const rows = runSelect(normalized, stmt._binds);
        return rows[0] ?? null;
      },
      async all() {
        return { results: runSelect(normalized, stmt._binds) };
      },
      async run() {
        return runMutate(normalized, stmt._binds);
      },
    };
    return stmt;
  }

  return { env: { DB: { prepare } }, state };
}

function fakeRequest(body) {
  return { json: async () => body, url: 'http://local.test/api/folders' };
}
function fakeRequestWithUrl(url) {
  return { url };
}

async function bodyOf(response) {
  return JSON.parse(await response.text());
}

// ── Synthetic topology mirroring Production's shape (3 roots, one 3-level
//    branch) — synthetic names/ids only, never the real export. ───────────
function syntheticTree() {
  return {
    folders: [
      { id: 'root-a', parentId: null,    name: 'Root A', processType: 'blow_molding',     expanded: 1, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'root-b', parentId: null,    name: 'Root B', processType: 'injection_molding', expanded: 1, createdAt: '2026-01-02T00:00:00.000Z' },
      { id: 'root-c', parentId: null,    name: 'Root C', processType: 'custom',            expanded: 1, createdAt: '2026-01-03T00:00:00.000Z' },
      { id: 'mid',    parentId: 'root-c', name: 'Mid',    processType: 'blow_molding',     expanded: 1, createdAt: '2026-01-04T00:00:00.000Z' },
      { id: 'leaf',   parentId: 'mid',    name: 'Leaf',   processType: 'blow_molding',     expanded: 1, createdAt: '2026-01-05T00:00:00.000Z' },
    ],
    chart_files: [
      { id: 'chart-1', name: 'Chart One', folderId: 'root-a', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', content: '{}' },
      { id: 'chart-2', name: 'Chart Two', folderId: 'leaf',   createdAt: '2026-01-05T00:00:00.000Z', updatedAt: '2026-01-05T00:00:00.000Z', content: '{}' },
    ],
  };
}

// ── 1. Folder API validation: parent existence, self-parent, cycles ────────

test('POST /api/folders rejects a parentId that does not exist', async () => {
  const mock = makeMockD1(syntheticTree());
  const res = await foldersApi.onRequestPost({
    env: mock.env,
    request: fakeRequest({ id: 'new-1', parentId: 'does-not-exist', name: 'New', processType: 'custom', expanded: true, createdAt: '2026-01-06T00:00:00.000Z' }),
  });
  assert.equal(res.status, 400);
  assert.equal(mock.state.folders.length, 5, 'no row should have been inserted');
});

test('PUT /api/folders rejects a folder becoming its own parent', async () => {
  const mock = makeMockD1(syntheticTree());
  const res = await foldersApi.onRequestPut({
    env: mock.env,
    request: fakeRequest({ id: 'mid', parentId: 'mid' }),
  });
  assert.equal(res.status, 400);
  const midAfter = mock.state.folders.find(f => f.id === 'mid');
  assert.equal(midAfter.parentId, 'root-c', 'parentId must be unchanged');
});

test('PUT /api/folders rejects moving a folder into its own descendant', async () => {
  const mock = makeMockD1(syntheticTree());
  // root-c is an ancestor of leaf; moving root-c under leaf is a cycle.
  const res = await foldersApi.onRequestPut({
    env: mock.env,
    request: fakeRequest({ id: 'root-c', parentId: 'leaf' }),
  });
  assert.equal(res.status, 400);
  const rootCAfter = mock.state.folders.find(f => f.id === 'root-c');
  assert.equal(rootCAfter.parentId, null, 'parentId must be unchanged');
});

test('PUT /api/folders rejects a parentId that does not exist', async () => {
  const mock = makeMockD1(syntheticTree());
  const res = await foldersApi.onRequestPut({
    env: mock.env,
    request: fakeRequest({ id: 'root-a', parentId: 'does-not-exist' }),
  });
  assert.equal(res.status, 400);
});

test('PUT /api/folders accepts a legitimate reparent to an existing, non-descendant folder', async () => {
  const mock = makeMockD1(syntheticTree());
  const res = await foldersApi.onRequestPut({
    env: mock.env,
    request: fakeRequest({ id: 'root-a', parentId: 'root-b' }),
  });
  assert.equal(res.status, 200);
  assert.equal(mock.state.folders.find(f => f.id === 'root-a').parentId, 'root-b');
});

test('a corrupt/cyclic parentId chain already in the database does not hang the cycle check', async () => {
  // x -> y -> x, unrelated to the folder being moved. wouldCreateCycle must
  // still terminate (bounded walk) rather than loop forever.
  const mock = makeMockD1({
    folders: [
      { id: 'x', parentId: 'y', name: 'X', processType: 'custom', expanded: 1, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'y', parentId: 'x', name: 'Y', processType: 'custom', expanded: 1, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'z', parentId: null, name: 'Z', processType: 'custom', expanded: 1, createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    chart_files: [],
  });
  const res = await foldersApi.onRequestPut({
    env: mock.env,
    request: fakeRequest({ id: 'z', parentId: 'x' }),
  });
  // Walking from x's chain (x -> y -> x -> ...) never reaches 'z', but it is
  // cyclic and must not hang; the bounded walk treats it as unsafe.
  assert.equal(res.status, 400, 'a corrupt cyclic chain must be refused, not hang the request');
});

// ── 2. Non-empty-folder deletion refusal ────────────────────────────────────

test('DELETE /api/folders refuses to delete a folder with child folders (zero rows deleted)', async () => {
  const mock = makeMockD1(syntheticTree());
  const before = mock.state.folders.length;
  const res = await foldersApi.onRequestDelete({ env: mock.env, request: fakeRequestWithUrl('http://local.test/api/folders?id=root-c') });
  assert.equal(res.status, 409);
  assert.equal(mock.state.folders.length, before, 'zero folders must be deleted');
});

test('DELETE /api/folders refuses to delete a folder with chart files (zero rows deleted)', async () => {
  const mock = makeMockD1(syntheticTree());
  const beforeFolders = mock.state.folders.length;
  const beforeFiles = mock.state.chart_files.length;
  const res = await foldersApi.onRequestDelete({ env: mock.env, request: fakeRequestWithUrl('http://local.test/api/folders?id=root-a') });
  assert.equal(res.status, 409);
  assert.equal(mock.state.folders.length, beforeFolders, 'zero folders must be deleted');
  assert.equal(mock.state.chart_files.length, beforeFiles, 'zero chart files must be deleted (no cascading delete in this phase)');
});

test('DELETE /api/folders allows deleting a genuinely empty folder', async () => {
  const mock = makeMockD1(syntheticTree());
  // root-b has no child folders and no chart files in the synthetic tree —
  // leaf looks childless but actually holds chart-2, which is the case the
  // previous two tests exist to catch.
  const res = await foldersApi.onRequestDelete({ env: mock.env, request: fakeRequestWithUrl('http://local.test/api/folders?id=root-b') });
  assert.equal(res.status, 200);
  assert.equal(mock.state.folders.find(f => f.id === 'root-b'), undefined);
});

// ── 3. GET must not perform a hidden schema write ───────────────────────────

test('GET /api/folders returns a clear schema-unavailable error (not a silent ALTER TABLE) when parentId is missing', async () => {
  const mock = makeMockD1(syntheticTree());
  // Simulate a database that predates the parentId column: strip it, and
  // make the mock throw like SQLite does for a genuinely missing column.
  const originalPrepare = mock.env.DB.prepare;
  mock.env.DB.prepare = (sql) => {
    if (sql.includes('parentId') && sql.startsWith('SELECT id, parentId')) {
      return { bind() { return this; }, async all() { throw new Error('no such column: parentId'); }, async first() { throw new Error('no such column: parentId'); } };
    }
    return originalPrepare(sql);
  };
  const res = await foldersApi.onRequestGet({ env: mock.env });
  assert.equal(res.status, 409);
  const body = await bodyOf(res);
  assert.match(body.error, /schema-unavailable/);
});

// ── 4. Synthetic multi-level tree survives the API boundary intact ─────────

test('a synthetic multi-level folder tree and all chart placements survive a GET round trip', async () => {
  const synthetic = syntheticTree();
  const mock = makeMockD1(synthetic);
  const res = await foldersApi.onRequestGet({ env: mock.env });
  assert.equal(res.status, 200);
  const rows = await bodyOf(res);
  assert.equal(rows.length, synthetic.folders.length);
  for (const f of synthetic.folders) {
    const got = rows.find(r => r.id === f.id);
    assert.ok(got, `folder ${f.id} must be present`);
    assert.equal(got.parentId, f.parentId);
    assert.equal(got.name, f.name);
  }
  // chart_files untouched by a folders GET — still exactly as seeded.
  assert.equal(mock.state.chart_files.length, synthetic.chart_files.length);
});

// ── 5. files.js: folderId move regression (found while implementing this phase) ──

test('PUT /api/files actually applies folderId — a move must not silently no-op', async () => {
  const mock = makeMockD1(syntheticTree());
  const res = await filesApi.onRequestPut({
    env: mock.env,
    request: fakeRequest({ id: 'chart-1', folderId: 'root-b', updatedAt: '2026-01-07T00:00:00.000Z' }),
  });
  assert.equal(res.status, 200);
  assert.equal(mock.state.chart_files.find(f => f.id === 'chart-1').folderId, 'root-b');
});

test('POST /api/files rejects a folderId that does not reference an existing folder', async () => {
  const mock = makeMockD1(syntheticTree());
  const res = await filesApi.onRequestPost({
    env: mock.env,
    request: fakeRequest({ id: 'chart-new', name: 'New Chart', folderId: 'does-not-exist' }),
  });
  assert.equal(res.status, 400);
  assert.equal(mock.state.chart_files.length, 2, 'no row should have been inserted');
});

// ── Phase 0C: Save-to-Cloud Persistence — API save contract ────────────────

test('PUT /api/files returns 409 and reports nothing was written for a stale/local-only id', async () => {
  const mock = makeMockD1(syntheticTree());
  const res = await filesApi.onRequestPut({
    env: mock.env,
    request: fakeRequest({ id: 'never-existed-in-cloud', name: 'X', updatedAt: '2026-01-07T00:00:00.000Z', content: { header: {}, steps: [], layoutDiagram: { elements: [], connections: [] } } }),
  });
  assert.equal(res.status, 409, 'a zero-row update must not report success');
  const body = await bodyOf(res);
  assert.match(body.error, /no chart row was updated/);
});

test('PUT /api/files returns the confirmed id and updatedAt on a real write', async () => {
  const mock = makeMockD1(syntheticTree());
  const res = await filesApi.onRequestPut({
    env: mock.env,
    request: fakeRequest({ id: 'chart-1', name: 'Renamed', updatedAt: '2026-01-07T00:00:00.000Z' }),
  });
  assert.equal(res.status, 200);
  const body = await bodyOf(res);
  assert.equal(body.success, true);
  assert.equal(body.id, 'chart-1');
  assert.equal(body.updatedAt, '2026-01-07T00:00:00.000Z', 'the response must echo the canonical saved version/timestamp so the client can verify against it');
});
