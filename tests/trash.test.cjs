const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const makeD1 = require('./helpers/d1-memory.cjs');

function load(relativePath) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'module', 'require', output)(mod.exports, mod, require);
  return mod.exports;
}

const filesApi = load('functions/api/files.js');
const foldersApi = load('functions/api/folders.js');
const revisionsApi = load('functions/api/revisions.js');
const trashApi = load('functions/api/trash.js');
const { purgeExpired } = load('workers/trash-purge.js');

const date = '2026-01-01T00:00:00.000Z';
function fixture() {
  const content = JSON.stringify({ header: { processName: 'Preserve me' }, steps: [{ id: 'step-1', manualTime: 12 }], kaizen: { beforePhotoKey: 'chart-1/photo.png' } });
  return makeD1({
    folders: [
      { id: 'root', parentId: null, name: 'Root', processType: 'custom', expanded: 1, createdAt: date },
      { id: 'child', parentId: 'root', name: 'Child', processType: 'custom', expanded: 1, createdAt: date },
    ],
    chart_files: [{ id: 'chart-1', name: 'Chart 1', folderId: 'child', createdAt: date, updatedAt: date, content }],
    revision_snapshots: [{ id: 'rev-1', chartFileId: 'chart-1', revNo: 'A', content, closedAt: date }],
  });
}
function req(url, body) { return { url, json: async () => body }; }
async function body(response) { return JSON.parse(await response.text()); }
async function trashFile(mock) {
  const response = await filesApi.onRequestDelete({ env: mock.env, request: req('http://local/api/files?id=chart-1') });
  assert.equal(response.status, 200);
  return (await body(response)).trashId;
}
async function trashFolder(mock, id = 'root') {
  const response = await foldersApi.onRequestDelete({ env: mock.env, request: req(`http://local/api/folders?id=${id}`) });
  assert.equal(response.status, 200);
  return (await body(response)).trashId;
}

test('chart trash hides the chart and revisions, then restores full content and history', async () => {
  const mock = fixture();
  const originalContent = mock.state.chart_files[0].content;
  const id = await trashFile(mock);
  assert.equal(mock.state.chart_files[0].content, originalContent);
  assert.equal(mock.state.revision_snapshots.length, 1);
  assert.equal((await body(await filesApi.onRequestGet({ env: mock.env, request: req('http://local/api/files') }))).length, 0);
  assert.equal((await filesApi.onRequestGet({ env: mock.env, request: req('http://local/api/files?id=chart-1') })).status, 404);
  assert.equal((await revisionsApi.onRequestGet({ env: mock.env, request: req('http://local/api/revisions?id=rev-1') })).status, 404);
  const list = await body(await trashApi.onRequestGet({ env: mock.env }));
  assert.equal(list.entries[0].id, id);
  assert.ok(list.hiddenFileIds.includes('chart-1'));
  const restore = await trashApi.onRequestPost({ env: mock.env, request: req('http://local/api/trash', { action: 'restore', id }) });
  assert.equal(restore.status, 200);
  const reopened = await body(await filesApi.onRequestGet({ env: mock.env, request: req('http://local/api/files?id=chart-1') }));
  assert.deepEqual(reopened.content.steps, [{ id: 'step-1', manualTime: 12 }]);
  assert.equal(mock.state.revision_snapshots.length, 1);
  await trashFile(mock);
  assert.equal(mock.state.trash_members.filter(m => m.memberId === 'chart-1').length, 2);
});

test('a chart separately trashed inside a folder needs its parent restored first', async () => {
  const mock = fixture();
  const fileTrashId = await trashFile(mock);
  const folderTrashId = await trashFolder(mock);
  const premature = await trashApi.onRequestPost({ env: mock.env, request: req('http://local/api/trash', { action: 'restore', id: fileTrashId }) });
  assert.equal(premature.status, 409);
  assert.equal((await trashApi.onRequestPost({ env: mock.env, request: req('http://local/api/trash', { action: 'restore', id: folderTrashId }) })).status, 200);
  assert.equal(mock.state.chart_files[0].trashId, fileTrashId);
  assert.equal((await trashApi.onRequestPost({ env: mock.env, request: req('http://local/api/trash', { action: 'restore', id: fileTrashId }) })).status, 200);
  assert.equal(mock.state.chart_files[0].trashId, null);
});

test('old clients cannot save a trashed chart or create inside a trashed folder', async () => {
  const mock = fixture();
  const originalContent = mock.state.chart_files[0].content;
  await trashFile(mock);
  const save = await filesApi.onRequestPut({ env: mock.env, request: req('http://local/api/files', { id: 'chart-1', name: 'Stale save', content: { overwritten: true } }) });
  assert.equal(save.status, 409);
  assert.equal(mock.state.chart_files[0].content, originalContent);
  const close = await revisionsApi.onRequestPost({ env: mock.env, request: req('http://local/api/revisions', { id: 'new-rev', chartFileId: 'chart-1', revNo: 'B' }) });
  assert.equal(close.status, 404);
  await trashFolder(mock, 'child');
  const create = await filesApi.onRequestPost({ env: mock.env, request: req('http://local/api/files', { id: 'new-chart', name: 'New', folderId: 'child' }) });
  assert.equal(create.status, 400);
  const staleRename = await foldersApi.onRequestPut({ env: mock.env, request: req('http://local/api/folders', { id: 'child', name: 'Stale rename' }) });
  assert.equal(staleRename.status, 409);
  assert.equal(mock.state.chart_files.length, 1);
});

test('no permanent purge occurs without an acknowledged in-app warning', async () => {
  const mock = fixture();
  const id = await trashFile(mock);
  mock.db.prepare('UPDATE trash_entries SET expiresAt = ? WHERE id = ?').run('2026-01-01T00:00:00.000Z', id);
  const deleted = [];
  mock.env.PHOTOS = { list: async () => ({ objects: [{ key: 'chart-1/photo.png' }], truncated: false }), delete: async key => deleted.push(key) };
  await purgeExpired(mock.env, new Date('2026-09-30T00:00:00.000Z'));
  assert.equal(mock.state.chart_files.length, 1);
  assert.equal(deleted.length, 0);
  const ack = await trashApi.onRequestPost({ env: mock.env, request: req('http://local/api/trash', { action: 'acknowledge', id }) });
  assert.equal(ack.status, 200);
  const warnedAt = (await body(ack)).warnedAt;
  await purgeExpired(mock.env, new Date(Date.parse(warnedAt) + 6 * 86400000));
  assert.equal(mock.state.chart_files.length, 1, 'warning must remain visible for seven full days');
  await purgeExpired(mock.env, new Date(Date.parse(warnedAt) + 8 * 86400000));
  assert.equal(mock.state.chart_files.length, 0);
  assert.equal(mock.state.revision_snapshots.length, 0);
  assert.deepEqual(deleted, ['chart-1/photo.png']);
  assert.ok(mock.state.trash_entries[0].purgedAt);
  const inventory = await body(await trashApi.onRequestGet({ env: mock.env }));
  assert.equal(inventory.entries.length, 0);
  assert.ok(inventory.hiddenFileIds.includes('chart-1'), 'other browsers must not resurrect a permanently deleted chart from cache');
});

test('warning cannot be acknowledged early and restore stops once purge starts', async () => {
  const mock = fixture();
  const id = await trashFile(mock);
  const early = await trashApi.onRequestPost({ env: mock.env, request: req('http://local/api/trash', { action: 'acknowledge', id }) });
  assert.equal(early.status, 409);
  mock.db.prepare('UPDATE trash_entries SET purgeStartedAt = ? WHERE id = ?').run(new Date().toISOString(), id);
  const restore = await trashApi.onRequestPost({ env: mock.env, request: req('http://local/api/trash', { action: 'restore', id }) });
  assert.equal(restore.status, 409);
  assert.ok(mock.state.chart_files[0].trashId);
});

test('parent folder purge waits while a separately trashed child chart retains its own deadline', async () => {
  const mock = fixture();
  const fileId = await trashFile(mock);
  const folderId = await trashFolder(mock);
  mock.db.prepare('UPDATE trash_entries SET expiresAt = ?, warnedAt = ? WHERE id = ?')
    .run('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', folderId);
  mock.env.PHOTOS = { list: async () => ({ objects: [], truncated: false }), delete: async () => {} };
  await purgeExpired(mock.env, new Date('2026-09-30T00:00:00.000Z'));
  assert.equal(mock.state.folders.length, 2);
  assert.equal(mock.state.chart_files.length, 1);
  mock.db.prepare('UPDATE trash_entries SET expiresAt = ?, warnedAt = ? WHERE id = ?')
    .run('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', fileId);
  await purgeExpired(mock.env, new Date('2026-09-30T00:00:00.000Z'));
  assert.equal(mock.state.chart_files.length, 0);
  await purgeExpired(mock.env, new Date('2026-09-30T00:00:00.000Z'));
  assert.equal(mock.state.folders.length, 0);
});

test('R2 failure keeps D1 rows and retries cleanup before permanent deletion', async () => {
  const mock = fixture();
  const id = await trashFile(mock);
  mock.db.prepare('UPDATE trash_entries SET expiresAt = ?, warnedAt = ? WHERE id = ?')
    .run('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', id);
  let attempts = 0;
  mock.env.PHOTOS = {
    list: async () => ({ objects: [{ key: 'chart-1/photo.png' }], truncated: false }),
    delete: async () => { if (++attempts === 1) throw new Error('temporary R2 failure'); },
  };
  const originalError = console.error;
  console.error = () => {};
  try { await purgeExpired(mock.env, new Date('2026-09-30T00:00:00.000Z')); }
  finally { console.error = originalError; }
  assert.equal(mock.state.chart_files.length, 1);
  assert.ok(mock.state.trash_entries[0].purgeStartedAt);
  await purgeExpired(mock.env, new Date('2026-09-30T00:00:00.000Z'));
  assert.equal(mock.state.chart_files.length, 0);
  assert.equal(attempts, 2);
});
