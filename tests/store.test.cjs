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
    // Fail loudly, not silently-succeed-with-mismatched-data, when a test
    // exercises openFile/saveActiveFile's read-back path without configuring
    // what the "fresh Cloud read" should return — an unconfigured default
    // that looked like success could mask a real contract mismatch.
    loadFileFromCloud: async () => ({ ok: false, error: 'not found (default test mock — override loadFileFromCloud per test)' }),
    createFolderCloud: async () => {},
    updateFolderCloud: async () => {},
    deleteFolderCloud: async () => {},
    createFileCloud: async () => {},
    saveFileCloud: async () => ({ ok: false, error: 'not implemented (default test mock — override saveFileCloud per test)' }),
    deleteFileCloud: async () => {},
    closeRevisionCloud: async () => ({ ok: false, error: 'not implemented (default test mock — override closeRevisionCloud per test)' }),
    openRevisionCloud: async () => ({ ok: false, error: 'not implemented (default test mock — override openRevisionCloud per test)' }),
    listRevisionSnapshotsCloud: async () => ({ ok: true, snapshots: [] }),
    // Real (not stubbed) implementation — it's a pure field-picker with no
    // side effects, and useChartStore's read-back comparison depends on it
    // matching the real one exactly, field-for-field.
    chartFileContent: (file) => ({
      header: file.header,
      steps: file.steps,
      layoutDiagram: file.layoutDiagram,
      timeMeasurement: file.timeMeasurement,
      timeStudy: file.timeStudy,
      machineCapacity: file.machineCapacity,
      kaizen: file.kaizen,
    }),
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

// A promise whose resolution the test controls explicitly — used to inspect
// store state *while* a Cloud request is still pending, not just before/after.
function deferred() {
  let resolve;
  const promise = new Promise(res => { resolve = res; });
  return { promise, resolve };
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

test('duplicateFile starts a copied locked chart as an open revision', async () => {
  const store = await freshReadyStore();
  await store.getState().createFolder('Test', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Locked Original');

  const originalId = store.getState().activeFileId;
  const lockedAt = '2026-08-10T00:00:00.000Z';
  store.setState({
    files: store.getState().files.map(file => file.id === originalId ? { ...file, lockedAt } : file),
  });

  await store.getState().duplicateFile(originalId);

  const copy = store.getState().activeFile();
  const original = store.getState().files.find(file => file.id === originalId);
  assert.ok(copy, 'the duplicate should become the active file');
  assert.equal(original.lockedAt, lockedAt, 'the source revision must stay locked');
  assert.equal(copy.lockedAt, null, 'the duplicate must start unlocked without a snapshot');
});

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
    saveFileCloud: async () => ({ ok: false, error: 'server rejected the move' }),
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
  assert.equal(store.getState().activeFileId, null, 'a failed load must not select the unverified target as active');
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
  assert.equal(store.getState().activeFileId, 'file-1', 'a successful load must select the newly confirmed file as active');
});

test('a failed saveActiveFile never reports saved and preserves the draft content', async () => {
  const store = await freshReadyStore({
    saveFileCloud: async () => ({ ok: false, error: 'server rejected the save' }),
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

// ── Prompt 02 fix round: Phase 0C Save-to-Cloud Persistence ──────────────────

test('a successful saveActiveFile is only reported saved after a matching fresh Cloud read-back', async () => {
  let stored = null; // simulates the row Cloud actually holds after the PUT
  const store = await freshReadyStore({
    saveFileCloud: async (file, updatedAt) => {
      stored = { ...file, updatedAt };
      return { ok: true, id: file.id, updatedAt };
    },
    loadFileFromCloud: async (id) => {
      if (!stored || stored.id !== id) return { ok: false, error: 'not found' };
      return { ok: true, file: stored };
    },
  });
  await store.getState().createFolder('F', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');
  store.getState().addStep();
  const step = store.getState().activeFile().steps[0];
  store.getState().updateStep(step.id, { description: 'confirmed content', manualTime: 15 });

  await store.getState().saveActiveFile();

  assert.equal(store.getState().syncStatus, 'saved', 'a write confirmed by a matching read-back must report saved');
  assert.equal(store.getState().activeFile().steps[0].description, 'confirmed content');
});

test('saveActiveFile reports unconfirmed, not saved, when the write succeeds but the read-back does not match', async () => {
  const store = await freshReadyStore({
    saveFileCloud: async (file, updatedAt) => ({ ok: true, id: file.id, updatedAt }),
    // Cloud read-back returns something that does not match what was just
    // sent — e.g. another process's row, or a write that silently applied
    // differently than requested. This must never be reported as saved.
    loadFileFromCloud: async (id) => ({
      ok: true,
      file: {
        id, name: 'Chart 1', folderId: 'other-folder-entirely',
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        header: { processName: 'unrelated stale content', partNumber: '', partName: '', model: '', moldNo: '', cycleTime: 60, issueDate: '', revNo: 'A', preparedBy: '', approvedBy: '' },
        steps: [], layoutDiagram: { elements: [], connections: [] },
      },
    }),
  });
  await store.getState().createFolder('F', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');

  await store.getState().saveActiveFile();

  assert.equal(store.getState().syncStatus, 'unconfirmed', 'a write whose read-back does not match the sent payload must not be reported as saved');
  const file = store.getState().files.find(f => f.id === store.getState().activeFileId);
  assert.equal(file._unconfirmed, true, 'the draft must be explicitly marked _unconfirmed for recovery/retry, not just reflected in the ephemeral syncStatus');
});

test('saveActiveFile is blocked while cloudReady is false, even with an otherwise-successful mock save', async () => {
  const store = freshStore({
    saveFileCloud: async (file, updatedAt) => ({ ok: true, id: file.id, updatedAt }),
    loadFileFromCloud: async () => ({ ok: true, file: null }),
  }); // never hydrated — cloudReady stays false
  await store.getState().saveActiveFile();
  assert.equal(store.getState().syncStatus, 'error', 'save must be blocked before any write is attempted while cloud is not confirmed ready');
});

test('saveActiveFile reports unconfirmed if even one module field (e.g. machineCapacity) is lost in the read-back', async () => {
  let stored = null;
  const store = await freshReadyStore({
    saveFileCloud: async (file, updatedAt) => {
      stored = { ...file, updatedAt };
      return { ok: true, id: file.id, updatedAt };
    },
    loadFileFromCloud: async (id) => {
      if (!stored || stored.id !== id) return { ok: false, error: 'not found' };
      // Simulate the read-back silently losing machineCapacity — exactly the
      // class of bug GPT's review caught (a whole module field dropped on
      // save because only header/steps/layoutDiagram were ever compared).
      const { machineCapacity, ...rest } = stored;
      return { ok: true, file: rest };
    },
  });
  await store.getState().createFolder('F', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');
  store.getState().updateMachineCapacity({
    shiftGrossMinutes: 720, breakMinutes: 60, requiredPerShift: 50,
    rows: [{ id: 'mc1', no: 1, processName: 'MARKER', machineNo: 'M1', manualTime: 1, autoTime: 1, changeQty: 0, changeTime: 0 }],
  });

  await store.getState().saveActiveFile();

  assert.equal(store.getState().syncStatus, 'unconfirmed', 'losing even one module field in the read-back must never be reported as saved');
});

test('updateKaizen replaces the active sheet wholesale, bumps updatedAt, and is not blocked by a lock at store level', async () => {
  const store = await freshReadyStore();
  await store.getState().createFolder('F', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');
  const fileId = store.getState().activeFileId;
  const initialUpdatedAt = store.getState().activeFile().updatedAt;

  await new Promise(resolve => setTimeout(resolve, 2));
  const first = {
    problem: 'First problem', solution: 'First solution', beforeNote: 'Before one', afterNote: 'After one',
    details: [{ id: 'detail-1', detail: 'First detail', priority: 2, response: 'First response', eva: 'First eva' }],
    result: 'First result', responsiblePerson: 'First owner', dueDate: '2026-08-20',
  };
  store.setState(s => ({ files: s.files.map(f => f.id === fileId ? { ...f, lockedAt: '2026-08-10T00:00:00.000Z' } : f) }));
  store.getState().updateKaizen(first);

  const afterFirst = store.getState().activeFile();
  assert.equal(afterFirst.kaizen.problem, 'First problem');
  assert.equal(afterFirst.kaizen.details.length, 1);
  assert.notEqual(afterFirst.updatedAt, initialUpdatedAt);

  await new Promise(resolve => setTimeout(resolve, 2));
  const second = {
    problem: 'Second problem', solution: '', beforeNote: '', afterNote: '', details: [],
    result: '', responsiblePerson: '', dueDate: '',
  };
  store.getState().updateKaizen(second);

  const afterSecond = store.getState().activeFile();
  assert.equal(afterSecond.kaizen.problem, 'Second problem');
  assert.equal(afterSecond.kaizen.details.length, 0, 'a replacement must not retain rows from the previous sheet');
  assert.notEqual(afterSecond.updatedAt, afterFirst.updatedAt);
  assert.equal(afterSecond.lockedAt, '2026-08-10T00:00:00.000Z', 'store action follows Module 2 and leaves lock enforcement to the UI');
});

// ── GPT review Round 2 fix: _unsynced records must block every Cloud action ──

const blankHeader = { processName: '', partNumber: '', partName: '', model: '', moldNo: '', cycleTime: 60, issueDate: '', revNo: 'A', preparedBy: '', approvedBy: '' };

test('renameFile is blocked against a local-only (_unsynced) file — no cloud call, no rename, never reports saved', async () => {
  let calls = 0;
  const store = await freshReadyStore({ saveFileCloud: async () => { calls++; return { ok: true, id: 'x', updatedAt: 'x' }; } });
  const unsyncedFile = {
    id: 'local-file-1', name: 'Never Synced', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _unsynced: true,
  };
  store.setState({ files: [unsyncedFile] });

  await store.getState().renameFile('local-file-1', 'New Name');

  assert.equal(calls, 0, 'no cloud call may be attempted against a local-only id');
  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().files.find(f => f.id === 'local-file-1').name, 'Never Synced', 'the local-only file must not be silently renamed either');
});

test('moveFile is blocked against a local-only (_unsynced) source file, and against moving into a local-only folder', async () => {
  let calls = 0;
  const store = await freshReadyStore({ saveFileCloud: async () => { calls++; return { ok: true, id: 'x', updatedAt: 'x' }; } });
  const unsyncedFile = {
    id: 'local-file-1', name: 'Never Synced', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _unsynced: true,
  };
  const normalFile = {
    id: 'normal-file-1', name: 'Confirmed', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
  };
  const unsyncedFolder = { id: 'local-folder-1', parentId: null, name: 'Never Synced Folder', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z', _unsynced: true };
  store.setState({ files: [unsyncedFile, normalFile], folders: [unsyncedFolder] });

  await store.getState().moveFile('local-file-1', 'some-other-folder');
  await store.getState().moveFile('normal-file-1', 'local-folder-1');

  assert.equal(calls, 0, 'no cloud call may be attempted for either a local-only source file or a local-only destination folder');
  assert.equal(store.getState().files.find(f => f.id === 'normal-file-1').folderId, 'folder-1', 'a confirmed file must not be moved into a local-only folder either');
  assert.equal(store.getState().syncStatus, 'error');
});

test('deleteFile is blocked against a local-only (_unsynced) file', async () => {
  let calls = 0;
  const store = await freshReadyStore({ deleteFileCloud: async () => { calls++; } });
  const unsyncedFile = {
    id: 'local-file-1', name: 'Never Synced', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _unsynced: true,
  };
  store.setState({ files: [unsyncedFile] });

  await store.getState().deleteFile('local-file-1');

  assert.equal(calls, 0, 'no cloud call may be attempted against a local-only id');
  assert.equal(store.getState().files.length, 1, 'the local-only file must not be deleted locally either — it stays until it can be reconciled');
  assert.equal(store.getState().syncStatus, 'error');
});

test('saveActiveFile is blocked against a local-only (_unsynced) active file', async () => {
  let calls = 0;
  const store = await freshReadyStore({ saveFileCloud: async () => { calls++; return { ok: true, id: 'x', updatedAt: 'x' }; } });
  const unsyncedFile = {
    id: 'local-file-1', name: 'Never Synced', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _unsynced: true,
  };
  store.setState({ files: [unsyncedFile], activeFileId: 'local-file-1' });

  await store.getState().saveActiveFile();

  assert.equal(calls, 0, 'no cloud call may be attempted when saving a local-only active file');
  assert.equal(store.getState().syncStatus, 'error', 'a blocked save must never report saved');
});

test('createFile is blocked when the target folder is local-only (_unsynced)', async () => {
  let calls = 0;
  const store = await freshReadyStore({ createFileCloud: async () => { calls++; } });
  const unsyncedFolder = { id: 'local-folder-1', parentId: null, name: 'Never Synced Folder', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z', _unsynced: true };
  store.setState({ folders: [unsyncedFolder] });

  await store.getState().createFile('local-folder-1', 'New Chart');

  assert.equal(calls, 0, 'no cloud call may be attempted when the target folder is local-only');
  assert.equal(store.getState().files.length, 0, 'no local file should be created into a local-only folder either');
  assert.equal(store.getState().syncStatus, 'error');
});

test('renameFolder, moveFolder, and deleteFolder are all blocked against a local-only (_unsynced) folder', async () => {
  let calls = 0;
  const store = await freshReadyStore({
    updateFolderCloud: async () => { calls++; },
    deleteFolderCloud: async () => { calls++; },
  });
  const unsyncedFolder = { id: 'local-folder-1', parentId: null, name: 'Never Synced Folder', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z', _unsynced: true };
  store.setState({ folders: [unsyncedFolder] });

  await store.getState().renameFolder('local-folder-1', 'New Name');
  await store.getState().moveFolder('local-folder-1', null);
  await store.getState().deleteFolder('local-folder-1');

  assert.equal(calls, 0, 'no cloud call may be attempted against a local-only folder id, for rename, move, or delete');
  assert.equal(store.getState().folders.length, 1, 'the local-only folder must not be deleted locally either');
  assert.equal(store.getState().folders[0].name, 'Never Synced Folder', 'nor renamed');
  assert.equal(store.getState().syncStatus, 'error');
});

test('toggleFolder on a local-only (_unsynced) folder still toggles locally, but makes no cloud call', async () => {
  let calls = 0;
  const store = await freshReadyStore({ updateFolderCloud: async () => { calls++; } });
  const unsyncedFolder = { id: 'local-folder-1', parentId: null, name: 'Never Synced Folder', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z', _unsynced: true };
  store.setState({ folders: [unsyncedFolder] });

  await store.getState().toggleFolder('local-folder-1');

  assert.equal(calls, 0, 'no cloud call may be attempted against a local-only folder id');
  assert.equal(store.getState().folders[0].expanded, false, 'the local toggle itself must still work — it is harmless review-only UI state, not a Cloud mutation');
});

// ── GPT review Round 2 fix: an unconfirmed/unloaded draft must never surface as the active Cloud file ──

test('hydrate clears activeFileId for an _unconfirmed draft, even with a matching updatedAt, but preserves its data', async () => {
  const unconfirmedDraft = {
    id: 'file-1', name: 'Draft Chart', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
    header: { ...blankHeader, processName: 'UNCONFIRMED DRAFT MARKER' },
    steps: [], layoutDiagram: { elements: [], connections: [] },
    // This is exactly what storage.ts's real merge produces for an
    // _unconfirmed file — _loaded:false regardless of the updatedAt match.
    _loaded: false,
    _unconfirmed: true,
  };
  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: true,
      db: { folders: [], files: [unconfirmedDraft], activeFileId: 'file-1' },
    }),
  });

  await store.getState().hydrate();

  assert.equal(store.getState().cloudReady, true);
  assert.notEqual(store.getState().activeFileId, 'file-1', 'an unconfirmed draft must never be silently presented as the active Cloud document after hydration');
  assert.equal(store.getState().activeFile(), null, 'the editor must show "no file open", not the unconfirmed draft, until it is re-opened and confirmed');
  const stillThere = store.getState().files.find(f => f.id === 'file-1');
  assert.ok(stillThere, 'the draft itself must be preserved for recovery, not discarded');
  assert.equal(stillThere.header.processName, 'UNCONFIRMED DRAFT MARKER', 'the draft content must survive so it can be inspected or retried');
});

test('hydrate also clears activeFileId for a merely un-loaded active file, not just _unconfirmed drafts', async () => {
  const notYetLoaded = {
    id: 'file-1', name: 'Chart', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: false,
  };
  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: true,
      db: { folders: [], files: [notYetLoaded], activeFileId: 'file-1' },
    }),
  });

  await store.getState().hydrate();

  assert.equal(store.getState().activeFileId, null, 'a not-yet-loaded file must not be shown as active either, even without _unconfirmed set');
});

test('hydrate keeps a confirmed, fully-loaded file as the active file (non-regression)', async () => {
  const confirmedFile = {
    id: 'file-1', name: 'Chart', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
    header: { ...blankHeader, processName: 'CONFIRMED' },
    steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: true,
    lockedAt: '2026-08-06T05:00:00.000Z',
  };
  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: true,
      db: { folders: [], files: [confirmedFile], activeFileId: 'file-1' },
    }),
  });

  await store.getState().hydrate();

  assert.equal(store.getState().activeFileId, 'file-1', 'a confirmed, already-loaded active file must stay active across hydration');
  assert.ok(store.getState().activeFile(), 'the editor must still show the confirmed file, not an empty state');
  assert.equal(store.getState().activeFile().lockedAt, '2026-08-06T05:00:00.000Z', 'a confirmed lock must survive hydration unchanged');
});

// ── GPT review Round 3 fix: unloaded placeholders must never reach a full-payload mutation ──

test('renameFile is blocked against a placeholder file whose content has not finished loading from the cloud (_loaded:false)', async () => {
  let calls = 0;
  const store = await freshReadyStore({ saveFileCloud: async () => { calls++; return { ok: true, id: 'x', updatedAt: 'x' }; } });
  const placeholderFile = {
    id: 'file-1', name: 'Needs Loading', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: false,
  };
  store.setState({ files: [placeholderFile] });

  await store.getState().renameFile('file-1', 'New Name');

  assert.equal(calls, 0, 'no cloud call may be attempted against an unloaded placeholder');
  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().files.find(f => f.id === 'file-1').name, 'Needs Loading', 'the placeholder must not be renamed locally either, to avoid a later save PUTting blank content under the new name');
});

test('moveFile is blocked against a placeholder file whose content has not finished loading from the cloud (_loaded:false)', async () => {
  let calls = 0;
  const store = await freshReadyStore({ saveFileCloud: async () => { calls++; return { ok: true, id: 'x', updatedAt: 'x' }; } });
  const placeholderFile = {
    id: 'file-1', name: 'Needs Loading', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: false,
  };
  store.setState({ files: [placeholderFile] });

  await store.getState().moveFile('file-1', 'some-other-folder');

  assert.equal(calls, 0, 'no cloud call may be attempted against an unloaded placeholder');
  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().files.find(f => f.id === 'file-1').folderId, 'folder-1', 'the placeholder must not be moved locally either');
});

test('duplicateFile is blocked against a placeholder file whose content has not finished loading from the cloud (_loaded:false)', async () => {
  let calls = 0;
  const store = await freshReadyStore({ createFileCloud: async () => { calls++; } });
  const placeholderFile = {
    id: 'file-1', name: 'Needs Loading', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: false,
  };
  store.setState({ files: [placeholderFile] });

  await store.getState().duplicateFile('file-1');

  assert.equal(calls, 0, 'no cloud call may be attempted against an unloaded placeholder');
  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().files.length, 1, 'no blank copy should be created from an unloaded placeholder');
});

test('saveActiveFile is blocked against an active file whose content has not finished loading from the cloud (_loaded:false), and reports a sync error', async () => {
  let calls = 0;
  const store = await freshReadyStore({ saveFileCloud: async () => { calls++; return { ok: true, id: 'x', updatedAt: 'x' }; } });
  const placeholderFile = {
    id: 'file-1', name: 'Needs Loading', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: false,
  };
  store.setState({ files: [placeholderFile], activeFileId: 'file-1' });

  await store.getState().saveActiveFile();

  assert.equal(calls, 0, 'no cloud call may be attempted while the active file is still an unloaded placeholder');
  assert.equal(store.getState().syncStatus, 'error', 'a blocked save must report a sync error instead of staying silently idle');
});

// ── GPT review Round 3 fix: a confirmed file's _unsynced folder must also block the Cloud call ──

test("renameFile is blocked when the file's folder is local-only (_unsynced), even though the file itself is confirmed", async () => {
  let calls = 0;
  const store = await freshReadyStore({ saveFileCloud: async () => { calls++; return { ok: true, id: 'x', updatedAt: 'x' }; } });
  const unsyncedFolder = { id: 'local-folder-1', parentId: null, name: 'Never Synced Folder', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z', _unsynced: true };
  const confirmedFile = {
    id: 'file-1', name: 'Confirmed', folderId: 'local-folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
  };
  store.setState({ folders: [unsyncedFolder], files: [confirmedFile] });

  await store.getState().renameFile('file-1', 'New Name');

  assert.equal(calls, 0, "no cloud call may be attempted for a file whose folder Cloud has never confirmed");
  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().files.find(f => f.id === 'file-1').name, 'Confirmed', 'must not be renamed locally either');
});

test("duplicateFile is blocked when the source file's folder is local-only (_unsynced), even though the file itself is confirmed", async () => {
  let calls = 0;
  const store = await freshReadyStore({ createFileCloud: async () => { calls++; } });
  const unsyncedFolder = { id: 'local-folder-1', parentId: null, name: 'Never Synced Folder', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z', _unsynced: true };
  const confirmedFile = {
    id: 'file-1', name: 'Confirmed', folderId: 'local-folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
  };
  store.setState({ folders: [unsyncedFolder], files: [confirmedFile] });

  await store.getState().duplicateFile('file-1');

  assert.equal(calls, 0, "no cloud call may be attempted for a file whose folder Cloud has never confirmed");
  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().files.length, 1, 'no copy should be created');
});

test("saveActiveFile is blocked when the active file's folder is local-only (_unsynced), even though the file itself is confirmed", async () => {
  let calls = 0;
  const store = await freshReadyStore({ saveFileCloud: async () => { calls++; return { ok: true, id: 'x', updatedAt: 'x' }; } });
  const unsyncedFolder = { id: 'local-folder-1', parentId: null, name: 'Never Synced Folder', processType: 'custom', expanded: true, createdAt: '2026-01-01T00:00:00.000Z', _unsynced: true };
  const confirmedFile = {
    id: 'file-1', name: 'Confirmed', folderId: 'local-folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
  };
  store.setState({ folders: [unsyncedFolder], files: [confirmedFile], activeFileId: 'file-1' });

  await store.getState().saveActiveFile();

  assert.equal(calls, 0, "no cloud call may be attempted for an active file whose folder Cloud has never confirmed");
  assert.equal(store.getState().syncStatus, 'error');
});

// ── GPT review Round 3 fix: hydrate must also clear an _unsynced active file ──

test('hydrate also clears activeFileId for an _unsynced active file, not just _loaded:false ones', async () => {
  const unsyncedFile = {
    id: 'file-1', name: 'Never Synced', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: { ...blankHeader, processName: 'LOCAL ONLY MARKER' },
    steps: [], layoutDiagram: { elements: [], connections: [] },
    _unsynced: true,
  };
  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: true,
      db: { folders: [], files: [unsyncedFile], activeFileId: 'file-1' },
    }),
  });

  await store.getState().hydrate();

  assert.equal(store.getState().cloudReady, true);
  assert.notEqual(store.getState().activeFileId, 'file-1', 'a local-only file Cloud has never confirmed must not be silently presented as the active Cloud document after hydration');
  assert.equal(store.getState().activeFile(), null, 'the editor must show "no file open" until the local-only file is re-opened explicitly');
  const stillThere = store.getState().files.find(f => f.id === 'file-1');
  assert.ok(stillThere, 'the local-only file itself must be preserved for recovery, not discarded');
  assert.equal(stillThere.header.processName, 'LOCAL ONLY MARKER');
});

// ── GPT review Round 3 fix: openFile must not surface an unverified target as active ──

test('a failed openFile on a different file retains the previously active, already-confirmed file — does not switch to the unverified target', async () => {
  const openFileA = {
    id: 'file-a', name: 'File A', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: { ...blankHeader, processName: 'FILE A CONTENT' },
    steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: true,
  };
  const placeholderB = {
    id: 'file-b', name: 'File B', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: false,
  };
  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: true,
      db: { folders: [], files: [openFileA, placeholderB], activeFileId: 'file-a' },
    }),
    loadFileFromCloud: async () => ({ ok: false, error: 'network unreachable' }),
  });
  await store.getState().hydrate();
  assert.equal(store.getState().activeFileId, 'file-a', 'test setup: file A must be active after hydration');

  await store.getState().openFile('file-b');

  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().activeFileId, 'file-a', 'a failed open of a different file must retain the previously active, confirmed file');
  assert.equal(store.getState().activeFile().header.processName, 'FILE A CONTENT', 'the editor must keep showing the confirmed file, not the unverified target');
});

test('openFile on an already-loaded file switches the active selection immediately, with no cloud fetch', async () => {
  let calls = 0;
  const loadedFile = {
    id: 'file-1', name: 'Already Loaded', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: true,
  };
  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: true,
      db: { folders: [], files: [loadedFile], activeFileId: null },
    }),
    loadFileFromCloud: async () => { calls++; return { ok: false, error: 'must not be called' }; },
  });
  await store.getState().hydrate();

  await store.getState().openFile('file-1');

  assert.equal(calls, 0, 'an already-loaded file must not trigger a redundant cloud fetch');
  assert.equal(store.getState().activeFileId, 'file-1');
});

test('openFile on a local-only (_unsynced) file switches the active selection immediately, with no cloud fetch attempted, even if it was never fully loaded', async () => {
  let calls = 0;
  const unsyncedPlaceholder = {
    id: 'file-1', name: 'Never Synced', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: false, _unsynced: true,
  };
  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: true,
      db: { folders: [], files: [unsyncedPlaceholder], activeFileId: null },
    }),
    loadFileFromCloud: async () => { calls++; return { ok: false, error: 'must not be called' }; },
  });
  await store.getState().hydrate();

  await store.getState().openFile('file-1');

  assert.equal(calls, 0, 'a local-only file has no Cloud row to fetch — opening it must not attempt a cloud call even if _loaded is false');
  assert.equal(store.getState().activeFileId, 'file-1');
});

// ── GPT review Round 3 fix: save read-back must validate the confirmed file id ──

test('saveActiveFile reports unconfirmed when the read-back file id does not match what was saved', async () => {
  let stored = null;
  const store = await freshReadyStore({
    saveFileCloud: async (file, updatedAt) => {
      stored = { ...file, updatedAt };
      return { ok: true, id: file.id, updatedAt };
    },
    loadFileFromCloud: async (id) => {
      if (!stored || stored.id !== id) return { ok: false, error: 'not found' };
      // Every field matches except the id — e.g. a swapped/misrouted response.
      return { ok: true, file: { ...stored, id: 'a-completely-different-id' } };
    },
  });
  await store.getState().createFolder('F', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');

  await store.getState().saveActiveFile();

  assert.equal(store.getState().syncStatus, 'unconfirmed', 'a read-back whose id does not match the saved file must never be reported as saved');
});

// ── GPT review Round 4 fix: an _unconfirmed draft must never bypass verification ──

test('openFile performs a fresh Cloud GET for an _unconfirmed file instead of taking the immediate-select fast path', async () => {
  let calls = 0;
  const unconfirmedDraft = {
    id: 'file-1', name: 'Chart', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
    header: { ...blankHeader, processName: 'DRAFT CONTENT' },
    steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: true, _unconfirmed: true,
  };
  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: true,
      db: { folders: [], files: [unconfirmedDraft], activeFileId: null },
    }),
    loadFileFromCloud: async () => { calls++; return { ok: false, error: 'still unreachable' }; },
  });
  await store.getState().hydrate();

  await store.getState().openFile('file-1');

  assert.equal(calls, 1, 'an _unconfirmed file must trigger a fresh Cloud GET, not the immediate-select fast path');
});

test('a failed reopen of an _unconfirmed file does not present it as confirmed, and preserves the draft for recovery', async () => {
  const confirmedActive = {
    id: 'file-a', name: 'File A', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: { ...blankHeader, processName: 'FILE A CONTENT' },
    steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: true,
  };
  const unconfirmedDraft = {
    id: 'file-b', name: 'File B', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
    header: { ...blankHeader, processName: 'UNSAVED DRAFT CONTENT' },
    steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: true, _unconfirmed: true,
  };
  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: true,
      db: { folders: [], files: [confirmedActive, unconfirmedDraft], activeFileId: 'file-a' },
    }),
    loadFileFromCloud: async () => ({ ok: false, error: 'network unreachable' }),
  });
  await store.getState().hydrate();
  assert.equal(store.getState().activeFileId, 'file-a', 'test setup: file A must be active after hydration');

  await store.getState().openFile('file-b');

  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().activeFileId, 'file-a', 'a failed reopen of an unconfirmed file must not switch the editor to it');
  const draft = store.getState().files.find(f => f.id === 'file-b');
  assert.ok(draft, 'the unconfirmed draft must still be present for recovery');
  assert.equal(draft._unconfirmed, true, 'must remain flagged unconfirmed, not silently cleared');
  assert.equal(draft.header.processName, 'UNSAVED DRAFT CONTENT', 'the draft content itself must be preserved, not discarded');
});

test('renameFile is blocked against a file with an unconfirmed save pending (_unconfirmed)', async () => {
  let calls = 0;
  const store = await freshReadyStore({ saveFileCloud: async () => { calls++; return { ok: true, id: 'x', updatedAt: 'x' }; } });
  const unconfirmedFile = {
    id: 'file-1', name: 'Draft', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: true, _unconfirmed: true,
  };
  store.setState({ files: [unconfirmedFile] });

  await store.getState().renameFile('file-1', 'New Name');

  assert.equal(calls, 0, 'no cloud call may be attempted against a file with an unconfirmed save pending');
  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().files.find(f => f.id === 'file-1').name, 'Draft', 'must not be renamed locally either');
});

test('moveFile is blocked against a file with an unconfirmed save pending (_unconfirmed)', async () => {
  let calls = 0;
  const store = await freshReadyStore({ saveFileCloud: async () => { calls++; return { ok: true, id: 'x', updatedAt: 'x' }; } });
  const unconfirmedFile = {
    id: 'file-1', name: 'Draft', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: true, _unconfirmed: true,
  };
  store.setState({ files: [unconfirmedFile] });

  await store.getState().moveFile('file-1', 'some-other-folder');

  assert.equal(calls, 0, 'no cloud call may be attempted against a file with an unconfirmed save pending');
  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().files.find(f => f.id === 'file-1').folderId, 'folder-1', 'must not be moved locally either');
});

test('duplicateFile is blocked against a file with an unconfirmed save pending (_unconfirmed)', async () => {
  let calls = 0;
  const store = await freshReadyStore({ createFileCloud: async () => { calls++; } });
  const unconfirmedFile = {
    id: 'file-1', name: 'Draft', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: true, _unconfirmed: true,
  };
  store.setState({ files: [unconfirmedFile] });

  await store.getState().duplicateFile('file-1');

  assert.equal(calls, 0, 'no cloud call may be attempted against a file with an unconfirmed save pending');
  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().files.length, 1, 'no copy should be created from an unconfirmed draft');
});

test('saveActiveFile is NOT blocked by _unconfirmed — it is the explicit retry path, and a successful retry clears it', async () => {
  let stored = null;
  const store = await freshReadyStore({
    saveFileCloud: async (file, updatedAt) => {
      stored = { ...file, updatedAt };
      return { ok: true, id: file.id, updatedAt };
    },
    loadFileFromCloud: async (id) => {
      if (!stored || stored.id !== id) return { ok: false, error: 'not found' };
      return { ok: true, file: stored };
    },
  });
  await store.getState().createFolder('F', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');
  const fileId = store.getState().activeFileId;
  store.setState(s => ({ files: s.files.map(f => f.id === fileId ? { ...f, _unconfirmed: true } : f) }));

  await store.getState().saveActiveFile();

  assert.equal(store.getState().syncStatus, 'saved', 'retrying Save on an _unconfirmed file must be allowed and must succeed once confirmed');
  const file = store.getState().files.find(f => f.id === fileId);
  assert.equal(file._unconfirmed, false, 'a successful retry must clear the _unconfirmed flag');
});

// ── GPT review Round 4 fix: hydrate() must gate the editor while Cloud is pending ──

test('hydrate() keeps hydrated:false while the Cloud request is pending — the editor must not render cached content as confirmed', async () => {
  const cloud = deferred();
  const store = freshStore({ loadDatabaseFromCloud: () => cloud.promise });

  const hydratePromise = store.getState().hydrate();
  // hydrate() does all of its synchronous setup (including the local-cache
  // `set()`) before its first `await`, so the pending state is already
  // observable here without needing a tick/microtask delay.
  assert.equal(store.getState().hydrated, false, 'hydrated must stay false until the Cloud result is known');
  assert.equal(store.getState().cloudReady, false);

  cloud.resolve({ ok: true, db: { folders: [], files: [], activeFileId: null } });
  await hydratePromise;

  assert.equal(store.getState().hydrated, true, 'hydrated must become true once the Cloud result is known');
  assert.equal(store.getState().cloudReady, true);
});

test('a concurrent second hydrate() call while the first is still pending does not trigger a second Cloud fetch', async () => {
  let calls = 0;
  const cloud = deferred();
  const store = freshStore({
    loadDatabaseFromCloud: () => { calls++; return cloud.promise; },
  });

  const first = store.getState().hydrate();
  const second = store.getState().hydrate(); // e.g. React StrictMode's double effect-invocation
  assert.equal(store.getState().hydrated, false);

  cloud.resolve({ ok: true, db: { folders: [], files: [], activeFileId: null } });
  await Promise.all([first, second]);

  assert.equal(calls, 1, 'a second hydrate() call while one is already in flight must not start a duplicate Cloud fetch');
  assert.equal(store.getState().hydrated, true);
});

test('hydrate also clears activeFileId for a raw _unconfirmed active file, even if _loaded was not separately reset to false', async () => {
  const rawUnconfirmed = {
    id: 'file-1', name: 'Chart', folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
    header: { ...blankHeader, processName: 'RAW UNCONFIRMED' },
    steps: [], layoutDiagram: { elements: [], connections: [] },
    _loaded: true, _unconfirmed: true,
  };
  const store = freshStore({
    loadDatabaseFromCloud: async () => ({
      ok: true,
      db: { folders: [], files: [rawUnconfirmed], activeFileId: 'file-1' },
    }),
  });

  await store.getState().hydrate();

  assert.equal(store.getState().cloudReady, true);
  assert.notEqual(store.getState().activeFileId, 'file-1', 'an _unconfirmed file must not remain active even if _loaded is still true');
  assert.equal(store.getState().activeFile(), null, 'the editor must show "no file open" until the draft is re-opened and confirmed');
  const stillThere = store.getState().files.find(f => f.id === 'file-1');
  assert.ok(stillThere, 'preserved for recovery');
  assert.equal(stillThere.header.processName, 'RAW UNCONFIRMED');
});

// ── Phase 5a-1: revision close/open and locked-save guards ──────────────────

test('closeRevision saves and confirms first, then locks the file locally', async () => {
  let saved;
  let saveCalls = 0;
  let closeCalls = 0;
  const closedAt = '2026-08-06T06:00:00.000Z';
  const store = await freshReadyStore({
    saveFileCloud: async (file, updatedAt) => {
      saveCalls++;
      saved = { ...file, updatedAt };
      return { ok: true, id: file.id, updatedAt };
    },
    loadFileFromCloud: async id => ({ ok: true, file: { ...saved, id } }),
    closeRevisionCloud: async (chartFileId, revNo) => {
      closeCalls++;
      return { ok: true, snapshot: { id: 'snapshot-1', chartFileId, revNo, closedAt } };
    },
  });
  await store.getState().createFolder('F', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');
  const fileId = store.getState().activeFileId;

  await store.getState().closeRevision('  A  ');

  assert.equal(saveCalls, 1, 'close must perform the existing save flow first');
  assert.equal(closeCalls, 1);
  assert.equal(store.getState().files.find(file => file.id === fileId).lockedAt, closedAt);
  assert.equal(store.getState().syncStatus, 'idle');
});

test('closeRevision does not call the close API when the preceding save is unconfirmed', async () => {
  let closeCalls = 0;
  const store = await freshReadyStore({
    saveFileCloud: async (file, updatedAt) => ({ ok: true, id: file.id, updatedAt }),
    loadFileFromCloud: async () => ({ ok: false, error: 'read-back unavailable' }),
    closeRevisionCloud: async () => {
      closeCalls++;
      return { ok: true, snapshot: { id: 'should-not-exist', chartFileId: 'file-1', revNo: 'A', closedAt: 'x' } };
    },
  });
  await store.getState().createFolder('F', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');

  await store.getState().closeRevision('A');

  assert.equal(closeCalls, 0, 'an unconfirmed preceding save must block the close API');
  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().files[0]._unconfirmed, true);
});

test('closeRevision on an already-locked file is blocked before save or close API calls', async () => {
  let saveCalls = 0;
  let closeCalls = 0;
  const store = await freshReadyStore({
    saveFileCloud: async () => { saveCalls++; return { ok: true, id: 'file-1', updatedAt: 'x' }; },
    closeRevisionCloud: async () => {
      closeCalls++;
      return { ok: true, snapshot: { id: 'snapshot-1', chartFileId: 'file-1', revNo: 'B', closedAt: 'x' } };
    },
  });
  const lockedFile = {
    id: 'file-1', name: 'Locked', folderId: 'folder-1',
    createdAt: '2026-08-06T00:00:00.000Z', updatedAt: '2026-08-06T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    lockedAt: '2026-08-06T06:00:00.000Z',
  };
  store.setState({ files: [lockedFile], activeFileId: 'file-1' });

  await store.getState().closeRevision('B');

  assert.equal(saveCalls, 0);
  assert.equal(closeCalls, 0);
  assert.equal(store.getState().syncStatus, 'error');
});

test('closeRevision rejects a blank Rev No before any save or close API call', async () => {
  let saveCalls = 0;
  let closeCalls = 0;
  const store = await freshReadyStore({
    saveFileCloud: async () => { saveCalls++; return { ok: true, id: 'file-1', updatedAt: 'x' }; },
    closeRevisionCloud: async () => {
      closeCalls++;
      return { ok: true, snapshot: { id: 'snapshot-1', chartFileId: 'file-1', revNo: 'A', closedAt: 'x' } };
    },
  });
  const file = {
    id: 'file-1', name: 'Chart', folderId: 'folder-1',
    createdAt: '2026-08-06T00:00:00.000Z', updatedAt: '2026-08-06T00:00:00.000Z',
    header: { ...blankHeader, revNo: 'A' }, steps: [], layoutDiagram: { elements: [], connections: [] },
  };
  store.setState({ files: [file], activeFileId: 'file-1' });

  await store.getState().closeRevision('   ');

  assert.equal(saveCalls, 0);
  assert.equal(closeCalls, 0);
  assert.equal(store.getState().syncStatus, 'error');
});

test('saveActiveFile is blocked on a locked file and does not call the save API', async () => {
  let saveCalls = 0;
  const store = await freshReadyStore({
    saveFileCloud: async () => { saveCalls++; return { ok: true, id: 'file-1', updatedAt: 'x' }; },
  });
  const lockedFile = {
    id: 'file-1', name: 'Locked', folderId: 'folder-1',
    createdAt: '2026-08-06T00:00:00.000Z', updatedAt: '2026-08-06T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
    lockedAt: '2026-08-06T06:00:00.000Z',
  };
  store.setState({ files: [lockedFile], activeFileId: 'file-1' });

  await store.getState().saveActiveFile();

  assert.equal(saveCalls, 0);
  assert.equal(store.getState().syncStatus, 'error');
  assert.equal(store.getState().files[0].lockedAt, '2026-08-06T06:00:00.000Z');
});

test('openNewRevision clears a confirmed lock and leaves the file content intact', async () => {
  let openCalls = 0;
  const store = await freshReadyStore({
    openRevisionCloud: async chartFileId => {
      openCalls++;
      assert.equal(chartFileId, 'file-1');
      return { ok: true };
    },
  });
  const lockedFile = {
    id: 'file-1', name: 'Locked', folderId: 'folder-1',
    createdAt: '2026-08-06T00:00:00.000Z', updatedAt: '2026-08-06T00:00:00.000Z',
    header: { ...blankHeader, processName: 'KEEP THIS CONTENT' },
    steps: [{ id: 'step-1', no: 1, description: 'keep' }], layoutDiagram: { elements: [], connections: [] },
    lockedAt: '2026-08-06T06:00:00.000Z',
  };
  store.setState({ files: [lockedFile], activeFileId: 'file-1' });

  await store.getState().openNewRevision();

  assert.equal(openCalls, 1);
  const file = store.getState().files[0];
  assert.equal(file.lockedAt, null);
  assert.equal(file.header.processName, 'KEEP THIS CONTENT');
  assert.equal(file.steps[0].description, 'keep');
  assert.equal(store.getState().syncStatus, 'idle');
});

test('openNewRevision on an already-unlocked file is blocked before the API call', async () => {
  let openCalls = 0;
  const store = await freshReadyStore({
    openRevisionCloud: async () => { openCalls++; return { ok: true }; },
  });
  const file = {
    id: 'file-1', name: 'Unlocked', folderId: 'folder-1',
    createdAt: '2026-08-06T00:00:00.000Z', updatedAt: '2026-08-06T00:00:00.000Z',
    header: blankHeader, steps: [], layoutDiagram: { elements: [], connections: [] },
  };
  store.setState({ files: [file], activeFileId: 'file-1' });

  await store.getState().openNewRevision();

  assert.equal(openCalls, 0);
  assert.equal(store.getState().syncStatus, 'error');
});
