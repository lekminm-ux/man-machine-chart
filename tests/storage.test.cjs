// Phase 0C — src/lib/storage.ts tested directly (not through the store), so
// the actual hydration merge/staleness logic and the save/read-back
// contracts run for real, instead of being bypassed by a mock. `fetch` and
// `localStorage` are the only real dependencies storage.ts has, so those are
// mocked at the global level for each test; nothing here touches Production
// D1, local Pages Dev D1, or the external recovery export.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const rootDir = path.resolve(__dirname, '..');

function loadTypeScriptModule(relativePath) {
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
  const localRequire = (id) => {
    if (id === '@/types') return loadTypeScriptModule('src/types/index.ts');
    return require(id);
  };
  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', 'require', '__filename', output)(
    cjsModule.exports, cjsModule, localRequire, filename
  );
  return cjsModule.exports;
}

function mockLocalStorage(initial) {
  const store = { mm_chart_db_v2: initial ? JSON.stringify(initial) : undefined };
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
  };
}

function mockResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const blankHeader = { processName: '', partNumber: '', partName: '', model: '', moldNo: '', cycleTime: 60, issueDate: '', revNo: 'A', preparedBy: '', approvedBy: '' };

let originalWindow, originalLocalStorage, originalFetch;
function installGlobals({ local, fetchImpl }) {
  originalWindow = global.window;
  originalLocalStorage = global.localStorage;
  originalFetch = global.fetch;
  global.window = {};
  global.localStorage = mockLocalStorage(local);
  global.fetch = fetchImpl;
}
function restoreGlobals() {
  global.window = originalWindow;
  global.localStorage = originalLocalStorage;
  global.fetch = originalFetch;
}

function loadStorage() {
  // Re-required fresh each time so module-level state (none currently, but
  // defensive) can't leak between tests.
  delete require.cache[require.resolve('typescript')];
  return loadTypeScriptModule('src/lib/storage.ts');
}

// ── loadDatabaseFromCloud: staleness / source-of-truth merge ───────────────

test('loadDatabaseFromCloud resets a stale local file to _loaded:false instead of trusting it', async () => {
  installGlobals({
    local: {
      folders: [],
      files: [{
        id: 'file-1', name: 'Chart', folderId: 'folder-1',
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        header: { ...blankHeader, processName: 'OLD CACHED CONTENT' },
        steps: [], layoutDiagram: { elements: [], connections: [] },
        _loaded: true,
      }],
      activeFileId: null,
    },
    fetchImpl: async (url) => {
      const u = String(url);
      if (u.includes('/api/folders')) return mockResponse([]);
      if (u.includes('/api/files')) {
        return mockResponse([{ id: 'file-1', name: 'Chart', folderId: 'folder-1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' }]);
      }
      throw new Error('unexpected fetch: ' + u);
    },
  });
  try {
    const storage = loadStorage();
    const result = await storage.loadDatabaseFromCloud();
    assert.equal(result.ok, true);
    const file = result.db.files.find(f => f.id === 'file-1');
    assert.equal(file._loaded, false, 'a local file whose updatedAt differs from Cloud must be treated as stale');
    assert.equal(file.header.processName, '', 'stale cached content must not be presented as current — falls back to the blank lazy-load placeholder');
  } finally {
    restoreGlobals();
  }
});

test('loadDatabaseFromCloud trusts a local file whose updatedAt still matches Cloud', async () => {
  installGlobals({
    local: {
      folders: [],
      files: [{
        id: 'file-1', name: 'Chart', folderId: 'folder-1',
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
        header: { ...blankHeader, processName: 'CONFIRMED CURRENT CONTENT' },
        steps: [], layoutDiagram: { elements: [], connections: [] },
        _loaded: true,
      }],
      activeFileId: null,
    },
    fetchImpl: async (url) => {
      const u = String(url);
      if (u.includes('/api/folders')) return mockResponse([]);
      if (u.includes('/api/files')) {
        return mockResponse([{ id: 'file-1', name: 'Chart', folderId: 'folder-1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' }]);
      }
      throw new Error('unexpected fetch: ' + u);
    },
  });
  try {
    const storage = loadStorage();
    const result = await storage.loadDatabaseFromCloud();
    const file = result.db.files.find(f => f.id === 'file-1');
    assert.equal(file._loaded, true);
    assert.equal(file.header.processName, 'CONFIRMED CURRENT CONTENT', 'matching updatedAt means the cached content is still confirmed — no need to discard it');
  } finally {
    restoreGlobals();
  }
});

test('a local-only file absent from Cloud is flagged _unsynced, not silently folded into a confirmed state', async () => {
  installGlobals({
    local: {
      folders: [],
      files: [{
        id: 'local-only-1', name: 'Never synced', folderId: 'folder-1',
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
      }],
      activeFileId: null,
    },
    fetchImpl: async (url) => {
      const u = String(url);
      if (u.includes('/api/folders')) return mockResponse([]);
      if (u.includes('/api/files')) return mockResponse([]); // Cloud has no files at all
      throw new Error('unexpected fetch: ' + u);
    },
  });
  try {
    const storage = loadStorage();
    const result = await storage.loadDatabaseFromCloud();
    assert.equal(result.ok, true);
    const file = result.db.files.find(f => f.id === 'local-only-1');
    assert.ok(file, 'the local-only file should still be present for review');
    assert.equal(file._unsynced, true, 'a file missing from Cloud must be explicitly flagged, never presented as a confirmed row');
  } finally {
    restoreGlobals();
  }
});

test('loadDatabaseFromCloud never throws on a network failure — it resolves ok:false with the local fallback', async () => {
  installGlobals({
    local: { folders: [{ id: 'f1', parentId: null, name: 'Cached Folder', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z' }], files: [], activeFileId: null },
    fetchImpl: async () => { throw new TypeError('network unreachable'); },
  });
  try {
    const storage = loadStorage();
    const result = await storage.loadDatabaseFromCloud();
    assert.equal(result.ok, false);
    assert.equal(result.fallback.folders[0].name, 'Cached Folder', 'the cached data must still be returned for display/review');
  } finally {
    restoreGlobals();
  }
});

// ── saveFileCloud: explicit save contract ───────────────────────────────────

const sampleFile = {
  id: 'file-1', name: 'Chart', folderId: 'folder-1',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
};

test('saveFileCloud reports success with the confirmed id/updatedAt when the API confirms the write', async () => {
  installGlobals({
    local: undefined,
    fetchImpl: async (url, opts) => {
      assert.equal(opts.method, 'PUT');
      const body = JSON.parse(opts.body);
      return mockResponse({ success: true, id: body.id, updatedAt: body.updatedAt });
    },
  });
  try {
    const storage = loadStorage();
    const result = await storage.saveFileCloud(sampleFile, '2026-01-02T00:00:00.000Z');
    assert.equal(result.ok, true);
    assert.equal(result.id, 'file-1');
    assert.equal(result.updatedAt, '2026-01-02T00:00:00.000Z');
  } finally {
    restoreGlobals();
  }
});

test('saveFileCloud reports failure on a zero-row/not-found API response, without throwing', async () => {
  installGlobals({
    local: undefined,
    fetchImpl: async () => mockResponse({ error: 'no chart row was updated — this id does not exist in Cloud', id: 'file-1' }, 409),
  });
  try {
    const storage = loadStorage();
    const result = await storage.saveFileCloud(sampleFile, '2026-01-02T00:00:00.000Z');
    assert.equal(result.ok, false);
  } finally {
    restoreGlobals();
  }
});

test('saveFileCloud reports failure when the response is missing the confirmed fields, even with a 200', async () => {
  installGlobals({
    local: undefined,
    // A 200 with just `{success:true}` and no updatedAt is exactly the old,
    // unverified contract — must not be treated as confirmed.
    fetchImpl: async () => mockResponse({ success: true }),
  });
  try {
    const storage = loadStorage();
    const result = await storage.saveFileCloud(sampleFile, '2026-01-02T00:00:00.000Z');
    assert.equal(result.ok, false, 'a 200 without an explicit confirmed id/updatedAt must not count as a proven save');
  } finally {
    restoreGlobals();
  }
});

// ── GPT review Round 3 fix: the PUT response identity must be validated ─────

test('saveFileCloud reports failure when the response id does not match the file being saved, even with success:true and a valid updatedAt', async () => {
  installGlobals({
    local: undefined,
    // Simulates a malformed or misrouted response: everything looks
    // confirmed except the id doesn't actually match what was sent.
    fetchImpl: async (url, opts) => {
      const body = JSON.parse(opts.body);
      return mockResponse({ success: true, id: 'a-completely-different-id', updatedAt: body.updatedAt });
    },
  });
  try {
    const storage = loadStorage();
    const result = await storage.saveFileCloud(sampleFile, '2026-01-02T00:00:00.000Z');
    assert.equal(result.ok, false, 'a response whose id does not match the file being saved must never be treated as a confirmed write');
  } finally {
    restoreGlobals();
  }
});

test('loadFileFromCloud never throws on failure — it resolves ok:false', async () => {
  installGlobals({
    local: undefined,
    fetchImpl: async () => mockResponse({ error: 'not found' }, 404),
  });
  try {
    const storage = loadStorage();
    const result = await storage.loadFileFromCloud('missing-id');
    assert.equal(result.ok, false);
  } finally {
    restoreGlobals();
  }
});

// ── GPT review fix round: complete-payload persistence ──────────────────────

test('saveFileCloud sends the complete ChartFile payload — timeMeasurement/timeStudy/machineCapacity included, not just header/steps/layoutDiagram', async () => {
  let capturedBody = null;
  installGlobals({
    local: undefined,
    fetchImpl: async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return mockResponse({ success: true, id: capturedBody.id, updatedAt: capturedBody.updatedAt });
    },
  });
  try {
    const storage = loadStorage();
    const fileWithAllModules = {
      ...sampleFile,
      timeMeasurement: { laps: [{ id: 'l1', lapNumber: 1, timeSeconds: 5 }], minTime: 5, maxTime: 5, avgTime: 5, fluctuation: 0, taktTime: 0 },
      timeStudy: { readingCount: 1, rows: [{ id: 'r1', seq: 1, jobElement: 'MARKER-TIMESTUDY', operator: 'Worker A', kind: 'man', readings: [3] }] },
      machineCapacity: { shiftGrossMinutes: 720, breakMinutes: 60, requiredPerShift: 100, rows: [{ id: 'mc1', no: 1, processName: 'MARKER-MACHINECAP', machineNo: 'M1', manualTime: 1, autoTime: 2, changeQty: 0, changeTime: 0 }] },
    };
    const result = await storage.saveFileCloud(fileWithAllModules, '2026-01-02T00:00:00.000Z');
    assert.equal(result.ok, true);
    assert.ok(capturedBody.content.timeMeasurement, 'timeMeasurement must be sent, not silently dropped');
    assert.ok(capturedBody.content.timeStudy, 'timeStudy must be sent, not silently dropped');
    assert.equal(capturedBody.content.timeStudy.rows[0].jobElement, 'MARKER-TIMESTUDY');
    assert.ok(capturedBody.content.machineCapacity, 'machineCapacity must be sent, not silently dropped');
    assert.equal(capturedBody.content.machineCapacity.rows[0].processName, 'MARKER-MACHINECAP');
  } finally {
    restoreGlobals();
  }
});

// ── GPT review fix round: unconfirmed drafts must never win a fresh hydration ──

test('an _unconfirmed local file is never trusted on a fresh hydration, even with a matching updatedAt — but its data is not discarded', async () => {
  installGlobals({
    local: {
      folders: [],
      files: [{
        id: 'file-1', name: 'Draft Chart', folderId: 'folder-1',
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', // matches Cloud below
        header: { ...blankHeader, processName: 'UNCONFIRMED DRAFT MARKER' },
        steps: [], layoutDiagram: { elements: [], connections: [] },
        _loaded: true,
        _unconfirmed: true, // the last save's read-back never confirmed this
      }],
      activeFileId: null,
    },
    fetchImpl: async (url) => {
      const u = String(url);
      if (u.includes('/api/folders')) return mockResponse([]);
      if (u.includes('/api/files')) {
        return mockResponse([{ id: 'file-1', name: 'Draft Chart', folderId: 'folder-1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' }]);
      }
      throw new Error('unexpected fetch: ' + u);
    },
  });
  try {
    const storage = loadStorage();
    const result = await storage.loadDatabaseFromCloud();
    assert.equal(result.ok, true);
    const file = result.db.files.find(f => f.id === 'file-1');
    assert.equal(file._loaded, false, 'an unconfirmed draft must never be trusted as confirmed Cloud content, even with a matching updatedAt — Cloud content must win on the next open');
    assert.equal(file.header.processName, 'UNCONFIRMED DRAFT MARKER', 'the draft itself must not be silently discarded or blanked — only flagged so the next open re-fetches genuine Cloud content');
  } finally {
    restoreGlobals();
  }
});

// ── GPT review fix round: local-only records alongside the real tree ────────

test('a synthetic multi-level tree survives hydration alongside a local-only unsynced folder and file', async () => {
  installGlobals({
    local: {
      folders: [
        { id: 'root-1', parentId: null, name: 'Root', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'mid-1', parentId: 'root-1', name: 'Mid', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'leaf-1', parentId: 'mid-1', name: 'Leaf', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'local-folder-1', parentId: null, name: 'Never Synced Folder', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      files: [{
        id: 'local-file-1', name: 'Never Synced Chart', folderId: 'local-folder-1',
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
      }],
      activeFileId: null,
    },
    fetchImpl: async (url) => {
      const u = String(url);
      if (u.includes('/api/folders')) {
        // local-folder-1 intentionally absent — it never synced.
        return mockResponse([
          { id: 'root-1', parentId: null, name: 'Root', processType: 'custom', expanded: 1, createdAt: '2026-01-01T00:00:00.000Z' },
          { id: 'mid-1', parentId: 'root-1', name: 'Mid', processType: 'custom', expanded: 1, createdAt: '2026-01-01T00:00:00.000Z' },
          { id: 'leaf-1', parentId: 'mid-1', name: 'Leaf', processType: 'custom', expanded: 1, createdAt: '2026-01-01T00:00:00.000Z' },
        ]);
      }
      if (u.includes('/api/files')) return mockResponse([]); // local-file-1 intentionally absent
      throw new Error('unexpected fetch: ' + u);
    },
  });
  try {
    const storage = loadStorage();
    const result = await storage.loadDatabaseFromCloud();
    assert.equal(result.ok, true);
    const confirmedFolders = result.db.folders.filter(f => !f._unsynced);
    assert.equal(confirmedFolders.length, 3, 'the confirmed 3-level tree must survive intact');
    assert.equal(result.db.folders.find(f => f.id === 'leaf-1').parentId, 'mid-1');

    const localFolder = result.db.folders.find(f => f.id === 'local-folder-1');
    const localFile = result.db.files.find(f => f.id === 'local-file-1');
    assert.ok(localFolder, 'the local-only folder must still be present for review');
    assert.equal(localFolder._unsynced, true);
    assert.ok(localFile, 'the local-only file must still be present for review');
    assert.equal(localFile._unsynced, true);
  } finally {
    restoreGlobals();
  }
});

// ── Phase 5a-1: revision snapshot cloud actions ────────────────────────────

test('closeRevisionCloud sends a fresh snapshot id and accepts only a matching confirmed snapshot', async () => {
  let requestBody;
  installGlobals({
    local: undefined,
    fetchImpl: async (url, opts) => {
      assert.equal(url, '/api/revisions');
      assert.equal(opts.method, 'POST');
      requestBody = JSON.parse(opts.body);
      return mockResponse({
        success: true,
        snapshot: {
          id: requestBody.id,
          chartFileId: requestBody.chartFileId,
          revNo: requestBody.revNo,
          closedAt: '2026-08-06T05:00:00.000Z',
        },
      });
    },
  });
  try {
    const storage = loadStorage();
    const result = await storage.closeRevisionCloud('file-1', 'A');
    assert.equal(result.ok, true);
    assert.match(requestBody.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.deepEqual(requestBody, { id: requestBody.id, chartFileId: 'file-1', revNo: 'A' });
    assert.deepEqual(result.snapshot, {
      id: requestBody.id, chartFileId: 'file-1', revNo: 'A', closedAt: '2026-08-06T05:00:00.000Z',
    });
  } finally {
    restoreGlobals();
  }
});

test('closeRevisionCloud converts API and network failures into ok:false', async () => {
  installGlobals({
    local: undefined,
    fetchImpl: async () => mockResponse({ error: 'already locked' }, 409),
  });
  try {
    const storage = loadStorage();
    const apiFailure = await storage.closeRevisionCloud('file-1', 'A');
    assert.equal(apiFailure.ok, false);
    assert.match(apiFailure.error, /API \/api\/revisions/);
  } finally {
    restoreGlobals();
  }

  installGlobals({
    local: undefined,
    fetchImpl: async () => { throw new TypeError('network unreachable'); },
  });
  try {
    const storage = loadStorage();
    const networkFailure = await storage.closeRevisionCloud('file-1', 'A');
    assert.deepEqual(networkFailure, { ok: false, error: 'network unreachable' });
  } finally {
    restoreGlobals();
  }
});

test('openRevisionCloud sends the chart id and accepts/rejects explicit results', async () => {
  let requestBody;
  installGlobals({
    local: undefined,
    fetchImpl: async (url, opts) => {
      assert.equal(url, '/api/revisions');
      assert.equal(opts.method, 'PUT');
      requestBody = JSON.parse(opts.body);
      return mockResponse({ success: true, chartFileId: requestBody.chartFileId });
    },
  });
  try {
    const storage = loadStorage();
    const result = await storage.openRevisionCloud('file-1');
    assert.deepEqual(requestBody, { chartFileId: 'file-1' });
    assert.deepEqual(result, { ok: true });
  } finally {
    restoreGlobals();
  }

  installGlobals({
    local: undefined,
    fetchImpl: async () => { throw new TypeError('network unreachable'); },
  });
  try {
    const storage = loadStorage();
    const result = await storage.openRevisionCloud('file-1');
    assert.deepEqual(result, { ok: false, error: 'network unreachable' });
  } finally {
    restoreGlobals();
  }
});

test('listRevisionSnapshotsCloud returns metadata on success and ok:false on API failure', async () => {
  const snapshots = [{ id: 'snapshot-1', chartFileId: 'file-1', revNo: 'A', closedAt: '2026-08-06T05:00:00.000Z' }];
  installGlobals({
    local: undefined,
    fetchImpl: async (url, opts) => {
      assert.equal(opts, undefined);
      assert.equal(url, '/api/revisions?chartFileId=file-1');
      return mockResponse(snapshots);
    },
  });
  try {
    const storage = loadStorage();
    const result = await storage.listRevisionSnapshotsCloud('file-1');
    assert.deepEqual(result, { ok: true, snapshots });
  } finally {
    restoreGlobals();
  }

  installGlobals({
    local: undefined,
    fetchImpl: async () => mockResponse({ error: 'not found' }, 404),
  });
  try {
    const storage = loadStorage();
    const result = await storage.listRevisionSnapshotsCloud('file-1');
    assert.equal(result.ok, false);
    assert.match(result.error, /API \/api\/revisions/);
  } finally {
    restoreGlobals();
  }
});

test('getRevisionSnapshotCloud returns the confirmed snapshot shape', async () => {
  const snapshot = {
    id: 'snapshot-1',
    chartFileId: 'file-1',
    revNo: 'A',
    closedAt: '2026-08-06T05:00:00.000Z',
    content: {
      header: blankHeader,
      steps: [],
      layoutDiagram: { elements: [], connections: [] },
    },
  };
  installGlobals({
    local: undefined,
    fetchImpl: async (url, opts) => {
      assert.equal(url, '/api/revisions?id=snapshot-1');
      assert.equal(opts, undefined);
      return mockResponse(snapshot);
    },
  });
  try {
    const storage = loadStorage();
    const result = await storage.getRevisionSnapshotCloud('snapshot-1');
    assert.deepEqual(result, { ok: true, snapshot });
  } finally {
    restoreGlobals();
  }
});

test('getRevisionSnapshotCloud rejects API failures and malformed responses without throwing', async () => {
  installGlobals({
    local: undefined,
    fetchImpl: async () => mockResponse({ error: 'not found' }, 404),
  });
  try {
    const storage = loadStorage();
    const apiFailure = await storage.getRevisionSnapshotCloud('missing-id');
    assert.equal(apiFailure.ok, false);
    assert.match(apiFailure.error, /API \/api\/revisions/);
  } finally {
    restoreGlobals();
  }

  installGlobals({
    local: undefined,
    fetchImpl: async () => mockResponse({
      id: 'snapshot-1', chartFileId: 'file-1', revNo: 'A', closedAt: '2026-08-06T05:00:00.000Z',
      // A response without content is not proof that the full immutable snapshot was fetched.
    }),
  });
  try {
    const storage = loadStorage();
    const malformed = await storage.getRevisionSnapshotCloud('snapshot-1');
    assert.deepEqual(malformed, {
      ok: false,
      error: 'get revision snapshot did not return an explicit confirmed response',
    });
  } finally {
    restoreGlobals();
  }

  installGlobals({
    local: undefined,
    fetchImpl: async () => { throw new TypeError('network unreachable'); },
  });
  try {
    const storage = loadStorage();
    const networkFailure = await storage.getRevisionSnapshotCloud('snapshot-1');
    assert.deepEqual(networkFailure, { ok: false, error: 'network unreachable' });
  } finally {
    restoreGlobals();
  }
});
