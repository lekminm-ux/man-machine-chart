// Phase 5a-1 — direct tests for immutable revision snapshots and locks.
// This file uses synthetic rows only. It never touches local Pages Dev D1 or
// Production D1.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const rootDir = path.resolve(__dirname, '..');

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

const revisionsApi = loadModule('functions/api/revisions.js');
const filesApi = loadModule('functions/api/files.js');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeMockD1(initial = {}) {
  const state = {
    chart_files: clone(initial.chart_files ?? []),
    revision_snapshots: clone(initial.revision_snapshots ?? []),
  };

  function runSelect(sql, binds) {
    if (sql === 'SELECT * FROM revision_snapshots WHERE id = ?') {
      return state.revision_snapshots.filter(row => row.id === binds[0]);
    }
    if (sql === 'SELECT id, chartFileId, revNo, closedAt FROM revision_snapshots WHERE chartFileId = ? ORDER BY closedAt DESC') {
      return state.revision_snapshots
        .filter(row => row.chartFileId === binds[0])
        .sort((a, b) => b.closedAt.localeCompare(a.closedAt))
        .map(({ id, chartFileId, revNo, closedAt }) => ({ id, chartFileId, revNo, closedAt }));
    }
    if (sql === 'SELECT id, content, lockedAt FROM chart_files WHERE id = ?') {
      const row = state.chart_files.find(file => file.id === binds[0]);
      return row ? [{ id: row.id, content: row.content, lockedAt: row.lockedAt ?? null }] : [];
    }
    if (sql === 'SELECT lockedAt FROM chart_files WHERE id = ?') {
      const row = state.chart_files.find(file => file.id === binds[0]);
      return row ? [{ lockedAt: row.lockedAt ?? null }] : [];
    }
    if (sql === 'SELECT 1 FROM folders WHERE id = ?') {
      return [{ '1': 1 }];
    }
    throw new Error('mock D1: unhandled SELECT: ' + sql);
  }

  function runMutate(sql, binds) {
    if (sql === 'INSERT INTO revision_snapshots (id, chartFileId, revNo, content, closedAt) VALUES (?, ?, ?, ?, ?)') {
      const [id, chartFileId, revNo, content, closedAt] = binds;
      if (state.revision_snapshots.some(row => row.id === id)) {
        throw new Error('UNIQUE constraint failed: revision_snapshots.id');
      }
      if (state.revision_snapshots.some(row => row.chartFileId === chartFileId && row.revNo === revNo)) {
        throw new Error('UNIQUE constraint failed: revision_snapshots.chartFileId, revision_snapshots.revNo');
      }
      state.revision_snapshots.push({ id, chartFileId, revNo, content, closedAt });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql === 'UPDATE chart_files SET lockedAt = ? WHERE id = ? AND lockedAt IS NULL') {
      const [lockedAt, id] = binds;
      const row = state.chart_files.find(file => file.id === id);
      if (!row || row.lockedAt != null) return { success: true, meta: { changes: 0 } };
      row.lockedAt = lockedAt;
      return { success: true, meta: { changes: 1 } };
    }
    if (sql === 'UPDATE chart_files SET lockedAt = NULL WHERE id = ?') {
      const row = state.chart_files.find(file => file.id === binds[0]);
      if (!row) return { success: true, meta: { changes: 0 } };
      row.lockedAt = null;
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE chart_files SET name = COALESCE(')) {
      const [name, folderId, updatedAt, content, id] = binds;
      const row = state.chart_files.find(file => file.id === id);
      if (!row) return { success: true, meta: { changes: 0 } };
      if (name !== null) row.name = name;
      if (folderId !== null) row.folderId = folderId;
      row.updatedAt = updatedAt;
      if (content !== null) row.content = content;
      return { success: true, meta: { changes: 1 } };
    }
    throw new Error('mock D1: unhandled mutation: ' + sql);
  }

  function restore(snapshot) {
    state.chart_files.splice(0, state.chart_files.length, ...clone(snapshot.chart_files));
    state.revision_snapshots.splice(0, state.revision_snapshots.length, ...clone(snapshot.revision_snapshots));
  }

  function prepare(sql) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const statement = {
      _binds: [],
      bind(...args) { statement._binds = args; return statement; },
      async first() {
        const rows = runSelect(normalized, statement._binds);
        return rows[0] ?? null;
      },
      async all() {
        return { results: runSelect(normalized, statement._binds) };
      },
      async run() {
        return runMutate(normalized, statement._binds);
      },
    };
    return statement;
  }

  return {
    env: {
      DB: {
        prepare,
        async batch(statements) {
          const before = clone(state);
          try {
            const results = [];
            for (const statement of statements) results.push(await statement.run());
            return results;
          } catch (err) {
            restore(before);
            throw err;
          }
        },
      },
    },
    state,
  };
}

function fakeRequest(body, url = 'http://local.test/api/revisions') {
  return { json: async () => body, url };
}

async function bodyOf(response) {
  return JSON.parse(await response.text());
}

function chartFile(overrides = {}) {
  return {
    id: 'chart-1',
    name: 'Chart One',
    folderId: 'folder-1',
    createdAt: '2026-08-06T00:00:00.000Z',
    updatedAt: '2026-08-06T00:00:00.000Z',
    content: JSON.stringify({
      header: { revNo: 'A', processName: 'SNAPSHOT MARKER' },
      steps: [{ id: 'step-1', description: 'before close' }],
      layoutDiagram: { elements: [], connections: [] },
      timeMeasurement: { laps: [] },
      timeStudy: { rows: [] },
      machineCapacity: { rows: [] },
    }),
    lockedAt: null,
    ...overrides,
  };
}

test('close creates an immutable snapshot and locks the chart in one atomic batch', async () => {
  const file = chartFile();
  const mock = makeMockD1({ chart_files: [file] });
  const response = await revisionsApi.onRequestPost({
    env: mock.env,
    request: fakeRequest({ id: 'snapshot-1', chartFileId: 'chart-1', revNo: 'A' }),
  });

  assert.equal(response.status, 200);
  const body = await bodyOf(response);
  assert.equal(body.success, true);
  assert.equal(mock.state.revision_snapshots.length, 1);
  const snapshot = mock.state.revision_snapshots[0];
  const storedFile = mock.state.chart_files[0];
  assert.equal(snapshot.content, file.content, 'the raw chart content must be copied verbatim');
  assert.equal(snapshot.id, body.snapshot.id);
  assert.equal(snapshot.closedAt, storedFile.lockedAt, 'snapshot close time and chart lock must agree');
  assert.equal(snapshot.chartFileId, 'chart-1');
  assert.equal(snapshot.revNo, 'A');
});

test('close on an already-locked chart returns 409 and creates no snapshot', async () => {
  const mock = makeMockD1({ chart_files: [chartFile({ lockedAt: '2026-08-06T01:00:00.000Z' })] });
  const response = await revisionsApi.onRequestPost({
    env: mock.env,
    request: fakeRequest({ id: 'snapshot-2', chartFileId: 'chart-1', revNo: 'B' }),
  });

  assert.equal(response.status, 409);
  assert.match((await bodyOf(response)).error, /already locked/);
  assert.equal(mock.state.revision_snapshots.length, 0);
});

test('duplicate revNo returns 409 without locking or overwriting the existing snapshot', async () => {
  const existing = {
    id: 'snapshot-old', chartFileId: 'chart-1', revNo: 'A',
    content: '{"old":true}', closedAt: '2026-08-06T01:00:00.000Z',
  };
  const mock = makeMockD1({ chart_files: [chartFile()], revision_snapshots: [existing] });
  const response = await revisionsApi.onRequestPost({
    env: mock.env,
    request: fakeRequest({ id: 'snapshot-new', chartFileId: 'chart-1', revNo: 'A' }),
  });

  assert.equal(response.status, 409);
  assert.match((await bodyOf(response)).error, /was already closed/);
  assert.equal(mock.state.chart_files[0].lockedAt, null, 'duplicate close must not lock the chart');
  assert.deepEqual(mock.state.revision_snapshots, [existing], 'duplicate close must not overwrite history');
});

test('closing one chart does not touch unrelated snapshots', async () => {
  const unrelated = {
    id: 'snapshot-other', chartFileId: 'chart-2', revNo: 'X',
    content: '{"other":true}', closedAt: '2026-08-05T00:00:00.000Z',
  };
  const mock = makeMockD1({
    chart_files: [chartFile(), chartFile({ id: 'chart-2' })],
    revision_snapshots: [unrelated],
  });

  const response = await revisionsApi.onRequestPost({
    env: mock.env,
    request: fakeRequest({ id: 'snapshot-target', chartFileId: 'chart-1', revNo: 'A' }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(mock.state.revision_snapshots.find(row => row.id === unrelated.id), unrelated);
  assert.equal(mock.state.revision_snapshots.filter(row => row.chartFileId === 'chart-1').length, 1);
});

test('open clears lockedAt', async () => {
  const mock = makeMockD1({ chart_files: [chartFile({ lockedAt: '2026-08-06T01:00:00.000Z' })] });
  const response = await revisionsApi.onRequestPut({
    env: mock.env,
    request: fakeRequest({ chartFileId: 'chart-1' }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await bodyOf(response), { success: true, chartFileId: 'chart-1' });
  assert.equal(mock.state.chart_files[0].lockedAt, null);
});

test('open on an already-unlocked chart returns 409', async () => {
  const mock = makeMockD1({ chart_files: [chartFile()] });
  const response = await revisionsApi.onRequestPut({
    env: mock.env,
    request: fakeRequest({ chartFileId: 'chart-1' }),
  });

  assert.equal(response.status, 409);
  assert.match((await bodyOf(response)).error, /not currently locked/);
});

test('open on a nonexistent chart returns 404', async () => {
  const mock = makeMockD1();
  const response = await revisionsApi.onRequestPut({
    env: mock.env,
    request: fakeRequest({ chartFileId: 'missing-chart' }),
  });

  assert.equal(response.status, 404);
});

test('list returns metadata only and orders snapshots by closedAt descending', async () => {
  const mock = makeMockD1({
    chart_files: [chartFile()],
    revision_snapshots: [
      { id: 'snapshot-old', chartFileId: 'chart-1', revNo: 'A', content: '{"old":true}', closedAt: '2026-08-06T01:00:00.000Z' },
      { id: 'snapshot-new', chartFileId: 'chart-1', revNo: 'B', content: '{"new":true}', closedAt: '2026-08-06T02:00:00.000Z' },
      { id: 'snapshot-other', chartFileId: 'chart-2', revNo: 'X', content: '{"other":true}', closedAt: '2026-08-06T03:00:00.000Z' },
    ],
  });
  const response = await revisionsApi.onRequestGet({
    env: mock.env,
    request: fakeRequest(undefined, 'http://local.test/api/revisions?chartFileId=chart-1'),
  });

  assert.equal(response.status, 200);
  const rows = await bodyOf(response);
  assert.deepEqual(rows, [
    { id: 'snapshot-new', chartFileId: 'chart-1', revNo: 'B', closedAt: '2026-08-06T02:00:00.000Z' },
    { id: 'snapshot-old', chartFileId: 'chart-1', revNo: 'A', closedAt: '2026-08-06T01:00:00.000Z' },
  ]);
  assert.equal(rows.some(row => Object.hasOwn(row, 'content')), false);
});

test('get single snapshot returns full parsed content', async () => {
  const content = JSON.stringify({ marker: 'FULL CONTENT', steps: [{ id: 's1' }] });
  const mock = makeMockD1({
    revision_snapshots: [{
      id: 'snapshot-full', chartFileId: 'chart-1', revNo: 'A', content,
      closedAt: '2026-08-06T01:00:00.000Z',
    }],
  });
  const response = await revisionsApi.onRequestGet({
    env: mock.env,
    request: fakeRequest(undefined, 'http://local.test/api/revisions?id=snapshot-full'),
  });

  assert.equal(response.status, 200);
  const body = await bodyOf(response);
  assert.deepEqual(body.content, JSON.parse(content));
  assert.equal(body.id, 'snapshot-full');
});

test('PUT /api/files rejects a locked chart before changing its content', async () => {
  const file = chartFile({ lockedAt: '2026-08-06T01:00:00.000Z' });
  const mock = makeMockD1({ chart_files: [file] });
  const response = await filesApi.onRequestPut({
    env: mock.env,
    request: fakeRequest({
      id: 'chart-1', name: 'Should Not Save',
      content: { marker: 'MUST NOT OVERWRITE' },
      updatedAt: '2026-08-06T04:00:00.000Z',
    }, 'http://local.test/api/files'),
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await bodyOf(response), {
    error: 'this revision is locked — open a new revision to keep editing',
    id: 'chart-1', locked: true,
  });
  assert.equal(mock.state.chart_files[0].content, file.content);
  assert.equal(mock.state.chart_files[0].name, file.name);
});
