const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const filename = path.resolve(__dirname, '../src/lib/layout-copy.ts');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: mod.exports, module: mod, require }, { filename });
const { captureLayoutSelection, cloneLayoutSelection } = mod.exports;
const plain = value => JSON.parse(JSON.stringify(value));
const bounds = { width: 1000, height: 1000 };
let seq = 0;
const newId = () => `copy-${++seq}`;
const el = (id, x, extras = {}) => ({ id, type: 'rack', label: id, x, y: 20, width: 80, height: 40, ...extras });

test('copy snapshots shapes and internal connectors without source references or outside links', () => {
  const layout = {
    elements: [el('a', 10, { color: '#334155', textColor: '#ffffff', rotation: 30 }), el('b', 130), el('c', 230)],
    connections: [
      { id: 'internal', fromId: 'a', toId: 'b', routing: 'orthogonal', label: 'Flow' },
      { id: 'outside', fromId: 'b', toId: 'c' },
      { id: 'mixed', fromId: 'a', toPt: { x: 90, y: 90 } },
      { id: 'free', fromPt: { x: 1, y: 1 }, toPt: { x: 2, y: 2 } },
    ],
  };
  const snapshot = captureLayoutSelection(layout, ['a', 'b']);
  assert.deepEqual(plain(snapshot.connections.map(c => c.id)), ['internal', 'mixed']);
  layout.elements[0].label = 'changed later';
  layout.connections[2].toPt.x = 999;
  assert.equal(snapshot.elements[0].label, 'a');
  assert.equal(snapshot.connections[1].toPt.x, 90);
  const copy = cloneLayoutSelection(snapshot, layout.elements, newId, 24, bounds);
  assert.equal(copy.elements[0].color, '#334155');
  assert.equal(copy.elements[0].textColor, '#ffffff');
  assert.equal(copy.elements[0].rotation, 30);
  assert.equal(copy.elements[1].x - copy.elements[0].x, 120);
  assert.equal(copy.connections[0].fromId, copy.elements[0].id);
  assert.equal(copy.connections[0].toId, copy.elements[1].id);
  assert.equal(copy.connections[0].label, 'Flow');
  assert.equal(copy.connections[1].toPt.x, 114);
  assert.notEqual(copy.connections[1].toPt, snapshot.connections[1].toPt);
});

test('pasted groups are independent and uniquely named; Alt-copied member is ungrouped', () => {
  const layout = { elements: [el('a', 10, { groupId: 'g', groupName: 'Finishing' }), el('b', 130, { groupId: 'g', groupName: 'Finishing' })], connections: [] };
  const snapshot = captureLayoutSelection(layout, ['a', 'b']);
  const copy = cloneLayoutSelection(snapshot, layout.elements, newId, 24, bounds);
  assert.notEqual(copy.elements[0].groupId, 'g');
  assert.equal(copy.elements[0].groupId, copy.elements[1].groupId);
  assert.equal(copy.elements[0].groupName, 'Finishing - Copy');
  const second = cloneLayoutSelection(snapshot, [...layout.elements, ...copy.elements], newId, 48, bounds);
  assert.equal(second.elements[0].groupName, 'Finishing - Copy 2');
  assert.notEqual(second.elements[0].id, copy.elements[0].id);
  assert.notEqual(second.elements[0].groupId, copy.elements[0].groupId);
  const member = captureLayoutSelection(layout, ['a']);
  assert.equal(member.elements[0].groupId, undefined);
  assert.equal(member.elements[0].groupName, undefined);
  assert.equal(layout.elements[0].groupId, 'g');
});

test('paste clamps the whole set together at canvas edges, including floating endpoints', () => {
  const snapshot = { elements: [el('a', 900), el('b', 800)], connections: [{ id: 'c', fromId: 'a', toPt: { x: 990, y: 995 } }] };
  const copy = cloneLayoutSelection(snapshot, [], newId, 48, bounds);
  assert.equal(copy.elements[0].x, 910);
  assert.equal(copy.elements[1].x, 810);
  assert.equal(copy.connections[0].toPt.x, 1000);
  assert.equal(copy.connections[0].toPt.y, 1000);
  assert.equal(captureLayoutSelection(snapshot, ['missing']), null);
  assert.deepEqual(plain(cloneLayoutSelection({ elements: [], connections: [] }, [], newId, 24, bounds)), { elements: [], connections: [] });
});
