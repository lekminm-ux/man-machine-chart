const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');

function loadTypeScriptModule(relativePath, mocks = {}) {
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
  const sandbox = {
    exports: cjsModule.exports,
    module: cjsModule,
    require: (id) => {
      if (mocks[id]) return mocks[id];
      if (id === '@/types') return loadTypeScriptModule('src/types/index.ts');
      if (id === '@/lib/chart-utils') return loadTypeScriptModule('src/lib/chart-utils.ts');
      if (id === '@/lib/time-study') return loadTypeScriptModule('src/lib/time-study.ts');
      if (id === '@/lib/machine-capacity') return loadTypeScriptModule('src/lib/machine-capacity.ts');
      if (id === './chart-utils') return loadTypeScriptModule('src/lib/chart-utils.ts');
      if (id === './time-study') return loadTypeScriptModule('src/lib/time-study.ts');
      return require(id);
    },
    setTimeout,
    clearTimeout,
  };

  vm.runInNewContext(output, sandbox, { filename });
  return cjsModule.exports;
}

// ── In-memory storage mock (no localStorage / fetch in node) ────────────────
// `loadDatabaseFromCloud` mirrors the real ok/not-ok CloudLoadResult contract
// (src/lib/storage.ts) so hydrate() exercises the exact shape it handles in
// production — a plain `{folders,...}` object here would silently pass
// `result.ok` as undefined and mask a real contract mismatch.
function makeStorageMock(overrides = {}) {
  return {
    loadLocalDatabase: () => ({ folders: [], files: [], activeFileId: null }),
    saveLocalDatabase: () => {},
    loadDatabaseFromCloud: async () => ({ ok: true, db: { folders: [], files: [], activeFileId: null } }),
    loadFileFromCloud: async () => null,
    createFolderCloud: async () => {},
    updateFolderCloud: async () => {},
    deleteFolderCloud: async () => {},
    createFileCloud: async () => {},
    saveFileCloud: async () => {},
    deleteFileCloud: async () => {},
    ...overrides,
  };
}

function freshStore(overrides = {}) {
  const { useChartStore } = loadTypeScriptModule('src/store/useChartStore.ts', {
    '@/lib/storage': makeStorageMock(overrides),
    '@/lib/seed-data': loadTypeScriptModule('src/lib/seed-data.ts'),
  });
  return useChartStore;
}

// Most tests care about behavior *after* a successful cloud hydration, not
// about hydration itself — this runs the real hydrate() flow (not a
// shortcut straight to cloudReady: true) so every test still exercises the
// actual gate that create/rename/move/delete/save now depend on.
async function freshReadyStore(overrides = {}) {
  const store = freshStore(overrides);
  await store.getState().hydrate();
  assert.equal(store.getState().cloudReady, true, 'test setup expected hydrate() to succeed');
  return store;
}

test('activeFile() returns a stable reference (no re-render loop)', async () => {
  const store = await freshReadyStore();
  await store.getState().createFolder('Test', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');

  const a = store.getState().activeFile();
  const b = store.getState().activeFile();
  assert.ok(a, 'active file should exist');
  assert.equal(a, b, 'consecutive calls must return the same object reference');
});

test('cycle time follows the duration model when steps change', async () => {
  const store = await freshReadyStore();
  await store.getState().createFolder('Test', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');

  store.getState().addStep();
  const step1 = store.getState().activeFile().steps[0];
  // Worker A works until the 10-second mark
  store.getState().updateStep(step1.id, { manualTime: 10 });
  assert.equal(store.getState().activeFile().header.cycleTime, 10);

  // The machine is loaded at t=5 and runs for 40 s, so it stops at 45. Nobody
  // can unload it — or start the next cycle — before then, so the cycle time
  // is the machine's END time, charged to the operator who loaded it.
  store.getState().addStep();
  const step2 = store.getState().activeFile().steps[1];
  store.getState().updateStep(step2.id, { operator: 'Auto M/C', machineTime: 40, startTime: 5 });
  assert.equal(store.getState().activeFile().header.cycleTime, 45);

  // Deleting the machine step drops the cycle time back to 10
  store.getState().deleteStep(step2.id);
  assert.equal(store.getState().activeFile().header.cycleTime, 10);
});

test('insertStep places the new step and renumbers', async () => {
  const store = await freshReadyStore();
  await store.getState().createFolder('Test', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');

  store.getState().addStep();
  store.getState().addStep();
  const [s1] = store.getState().activeFile().steps;
  store.getState().updateStep(s1.id, { description: 'first' });

  store.getState().insertStep(0, 'below');
  const steps = store.getState().activeFile().steps;
  assert.equal(steps.length, 3);
  // spread into a host-realm array for deepEqual
  assert.deepEqual([...steps.map(s => s.no)], [1, 2, 3]);
  assert.equal(steps[0].description, 'first');
  assert.equal(steps[1].description, '', 'inserted step is blank');
});

test('duplicateFile deep-copies steps and remaps layout connections', async () => {
  const store = await freshReadyStore();
  await store.getState().createFolder('Test', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Original');

  store.getState().addStep();
  store.getState().addLayoutElement({ type: 'machine', label: 'M1', x: 0, y: 0, width: 10, height: 10 });
  store.getState().addLayoutElement({ type: 'rack', label: 'R1', x: 50, y: 0, width: 10, height: 10 });
  const [elA, elB] = store.getState().activeFile().layoutDiagram.elements;
  store.getState().addLayoutConnection({ fromId: elA.id, toId: elB.id });

  const originalId = store.getState().activeFileId;
  await store.getState().duplicateFile(originalId);

  const copy = store.getState().activeFile();
  const original = store.getState().files.find(f => f.id === originalId);

  assert.notEqual(copy.id, original.id);
  assert.equal(copy.name, 'Original - Copy');
  assert.notEqual(copy.steps[0].id, original.steps[0].id, 'step ids must be new');

  const [copyA, copyB] = copy.layoutDiagram.elements;
  const conn = copy.layoutDiagram.connections[0];
  assert.equal(conn.fromId, copyA.id, 'connection must point at the copied elements');
  assert.equal(conn.toId, copyB.id);
});

// ── Phase 0B: runtime data-safety guards ─────────────────────────────────────

test('cloud load failure produces an unsafe/unavailable state, not a silent success', async () => {
  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: false,
      error: 'network unreachable',
      fallback: { folders: [], files: [], activeFileId: null },
    }),
  });
  await store.getState().hydrate();
  assert.equal(store.getState().cloudReady, false, 'a failed cloud read must never be treated as confirmed');
  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().hydrated, true, 'hydration still completes so cached data can be reviewed and the spinner clears');
});

test('structural and save actions are blocked while cloud is not ready', async () => {
  const store = freshStore(); // never hydrated — cloudReady stays false
  await store.getState().createFolder('Should not persist', 'custom');
  // .length, not deepEqual against a literal [] — the store's array comes out
  // of a separate vm realm, so deepStrictEqual would flag it as a mismatched
  // prototype even when both are empty.
  assert.equal(store.getState().folders.length, 0, 'a blocked create must not add a local-only record either');
  assert.equal(store.getState().syncStatus, 'error');

  await store.getState().saveActiveFile();
  assert.equal(store.getState().syncStatus, 'error');
});

test('a failed delete leaves the local folder/file state unchanged (rollback, not partial apply)', async () => {
  const store = await freshReadyStore({
    deleteFolderCloud: async () => { throw new Error('server rejected the delete'); },
  });
  await store.getState().createFolder('Keep me', 'custom');
  const before = store.getState().folders;
  assert.equal(before.length, 1);

  await store.getState().deleteFolder(before[0].id);

  assert.equal(store.getState().folders, before, 'a failed delete must restore the exact pre-mutation folders array');
  assert.equal(store.getState().syncStatus, 'error');
});

test('a failed move leaves the local file state unchanged (rollback, not partial apply)', async () => {
  const store = await freshReadyStore({
    saveFileCloud: async () => { throw new Error('server rejected the move'); },
  });
  await store.getState().createFolder('Folder A', 'custom');
  const folderA = store.getState().folders[0].id;
  await store.getState().createFolder('Folder B', 'custom');
  const folderB = store.getState().folders[1].id;
  await store.getState().createFile(folderA, 'Chart 1');
  const fileId = store.getState().activeFileId;

  const beforeFiles = store.getState().files;
  await store.getState().moveFile(fileId, folderB);

  assert.equal(store.getState().files, beforeFiles, 'a failed move must restore the exact pre-mutation files array');
  assert.equal(store.getState().files.find(f => f.id === fileId).folderId, folderA, 'the file must still belong to its original folder');
  assert.equal(store.getState().syncStatus, 'error');
});

test('a synthetic multi-level folder tree hydrates intact, matching every id and parentId', async () => {
  const root1 = { id: 'root-1', parentId: null,     name: 'Root One', processType: 'custom',       expanded: true, createdAt: '2026-01-01T00:00:00.000Z' };
  const root2 = { id: 'root-2', parentId: null,     name: 'Root Two', processType: 'blow_molding',  expanded: true, createdAt: '2026-01-01T00:00:00.000Z' };
  const mid   = { id: 'mid-1',  parentId: 'root-2', name: 'Mid',      processType: 'blow_molding',  expanded: true, createdAt: '2026-01-01T00:00:00.000Z' };
  const leaf  = { id: 'leaf-1', parentId: 'mid-1',  name: 'Leaf',     processType: 'blow_molding',  expanded: true, createdAt: '2026-01-01T00:00:00.000Z' };
  const synthFolders = [root1, root2, mid, leaf];
  const synthFile = { id: 'file-1', name: 'Synthetic Chart', folderId: 'leaf-1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: true,
      db: { folders: synthFolders, files: [synthFile], activeFileId: null },
    }),
  });
  await store.getState().hydrate();

  assert.equal(store.getState().cloudReady, true);
  assert.equal(store.getState().folders.length, 4);
  assert.equal(store.getState().files.length, 1);
  for (const f of synthFolders) {
    const got = store.getState().folders.find(x => x.id === f.id);
    assert.ok(got, `folder ${f.id} must survive hydration`);
    assert.equal(got.parentId, f.parentId);
  }
  assert.equal(store.getState().files[0].folderId, 'leaf-1');
});

// ── Prompt 04 fix round: GPT review findings ─────────────────────────────────

test('toggleFolder makes no cloud call while cloudReady is false, but still toggles locally for review', async () => {
  let calls = 0;
  const store = freshStore({ updateFolderCloud: async () => { calls++; } }); // never hydrated — cloudReady stays false
  const folder = { id: 'f1', parentId: null, name: 'F', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z' };
  // Seed a folder directly into state without going through createFolder
  // (which itself requires cloudReady) — this test is about toggleFolder
  // specifically, on a folder that's only present for cached review.
  store.setState({ folders: [folder] });

  await store.getState().toggleFolder('f1');

  assert.equal(calls, 0, 'no cloud call may be attempted while cloudReady is false');
  assert.equal(store.getState().folders.find(f => f.id === 'f1').expanded, false, 'the local toggle itself must still work for reviewing the cached tree');
});

test('toggleFolder rolls back the expanded flag when the cloud call fails', async () => {
  const store = await freshReadyStore({
    updateFolderCloud: async () => { throw new Error('server rejected the update'); },
  });
  await store.getState().createFolder('F', 'custom');
  const before = store.getState().folders;
  assert.equal(before[0].expanded, true);

  await store.getState().toggleFolder(before[0].id);

  assert.equal(store.getState().folders, before, 'a failed toggle must restore the exact pre-mutation folders array');
  assert.equal(store.getState().folders[0].expanded, true, 'expanded must roll back to its pre-toggle value');
  assert.equal(store.getState().syncStatus, 'error');
});

test('a failed openFile cloud load never gets stuck in syncing, sets error, and keeps _loaded false', async () => {
  const placeholderFile = {
    id: 'file-1', name: 'Needs Loading', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: { processName: '', partNumber: '', partName: '', model: '', moldNo: '', cycleTime: 60, issueDate: '', revNo: 'A', preparedBy: '', approvedBy: '' },
    steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: false,
  };
  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: true,
      db: {
        folders: [{ id: 'folder-1', parentId: null, name: 'F', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z' }],
        files: [placeholderFile],
        activeFileId: null,
      },
    }),
    loadFileFromCloud: async () => ({ ok: false, error: 'network unreachable' }),
  });
  await store.getState().hydrate();
  assert.equal(store.getState().cloudReady, true);

  await store.getState().openFile('file-1');

  assert.equal(store.getState().syncStatus, 'error', 'a failed file load must never remain stuck in syncing');
  const file = store.getState().files.find(f => f.id === 'file-1');
  assert.equal(file._loaded, false, '_loaded must stay false — flipping it true with blank content would let a later save wipe the real cloud content');
  assert.equal(file.steps.length, 0, 'no blank content should have been substituted for the still-unloaded placeholder');
});

test('a successful openFile cloud load marks the file loaded and sets idle', async () => {
  const placeholderFile = {
    id: 'file-1', name: 'Needs Loading', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: { processName: '', partNumber: '', partName: '', model: '', moldNo: '', cycleTime: 60, issueDate: '', revNo: 'A', preparedBy: '', approvedBy: '' },
    steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: false,
  };
  const fullFile = { ...placeholderFile, steps: [{ id: 's1', no: 1, description: 'Real step', operator: 'Worker A', manualTime: 10, machineTime: 0, walkingTime: 0, idleTime: 0 }] };
  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: true,
      db: {
        folders: [{ id: 'folder-1', parentId: null, name: 'F', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z' }],
        files: [placeholderFile],
        activeFileId: null,
      },
    }),
    loadFileFromCloud: async () => ({ ok: true, file: fullFile }),
  });
  await store.getState().hydrate();

  await store.getState().openFile('file-1');

  assert.equal(store.getState().syncStatus, 'idle');
  const file = store.getState().files.find(f => f.id === 'file-1');
  assert.equal(file._loaded, true);
  assert.equal(file.steps.length, 1);
});

test('a failed saveActiveFile never reports saved and preserves the draft content', async () => {
  const store = await freshReadyStore({
    saveFileCloud: async () => { throw new Error('server rejected the save'); },
  });
  await store.getState().createFolder('F', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');
  store.getState().addStep();
  const step = store.getState().activeFile().steps[0];
  store.getState().updateStep(step.id, { description: 'draft in progress', manualTime: 42 });

  await store.getState().saveActiveFile();

  assert.equal(store.getState().syncStatus, 'error', 'a failed save must never report saved');
  const file = store.getState().activeFile();
  assert.equal(file.steps[0].description, 'draft in progress', "the user's draft edits must survive a failed save");
  assert.equal(file.steps[0].manualTime, 42);
});
