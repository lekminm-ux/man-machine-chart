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
      return require(id);
    },
    setTimeout,
    clearTimeout,
  };

  vm.runInNewContext(output, sandbox, { filename });
  return cjsModule.exports;
}

// ── In-memory storage mock (no localStorage / fetch in node) ────────────────
function makeStorageMock() {
  return {
    loadLocalDatabase: () => ({ folders: [], files: [], activeFileId: null }),
    saveLocalDatabase: () => {},
    loadDatabaseFromCloud: async () => ({ folders: [], files: [], activeFileId: null }),
    loadFileFromCloud: async () => null,
    createFolderCloud: async () => {},
    updateFolderCloud: async () => {},
    deleteFolderCloud: async () => {},
    createFileCloud: async () => {},
    saveFileCloud: async () => {},
    deleteFileCloud: async () => {},
  };
}

function freshStore() {
  const { useChartStore } = loadTypeScriptModule('src/store/useChartStore.ts', {
    '@/lib/storage': makeStorageMock(),
    '@/lib/seed-data': loadTypeScriptModule('src/lib/seed-data.ts'),
  });
  return useChartStore;
}

test('activeFile() returns a stable reference (no re-render loop)', async () => {
  const store = freshStore();
  await store.getState().createFolder('Test', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');

  const a = store.getState().activeFile();
  const b = store.getState().activeFile();
  assert.ok(a, 'active file should exist');
  assert.equal(a, b, 'consecutive calls must return the same object reference');
});

test('cycle time follows the stop-time model when steps change', async () => {
  const store = freshStore();
  await store.getState().createFolder('Test', 'custom');
  const folderId = store.getState().folders[0].id;
  await store.getState().createFile(folderId, 'Chart 1');

  store.getState().addStep();
  const step1 = store.getState().activeFile().steps[0];
  // Worker A works until the 10-second mark
  store.getState().updateStep(step1.id, { manualTime: 10 });
  assert.equal(store.getState().activeFile().header.cycleTime, 10);

  // Machine runs in parallel from t=5 until t=40 → busy for 35s.
  // Cycle time = the busiest actor's TOTAL time (35), not the timeline end (40).
  store.getState().addStep();
  const step2 = store.getState().activeFile().steps[1];
  store.getState().updateStep(step2.id, { operator: 'Auto M/C', machineTime: 40, startTime: 5 });
  assert.equal(store.getState().activeFile().header.cycleTime, 35);

  // Deleting the machine step drops the cycle time back to 10
  store.getState().deleteStep(step2.id);
  assert.equal(store.getState().activeFile().header.cycleTime, 10);
});

test('insertStep places the new step and renumbers', async () => {
  const store = freshStore();
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
  const store = freshStore();
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
