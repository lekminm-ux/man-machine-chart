const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');

function loadTsModule(relativePath) {
  const filename = path.join(rootDir, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(output, {
    exports: mod.exports, module: mod,
    require: (id) => { if (id === '@/types') return {}; return require(id); },
  }, { filename });
  return mod.exports;
}

const L = loadTsModule('src/lib/layout-utils.ts');

const box = (x, y, w, h, extra = {}) => ({ id: 'b', type: 'machine', label: '', x, y, width: w, height: h, ...extra });

test('shapeOf falls back to the palette default for the type', () => {
  assert.equal(L.shapeOf({ type: 'worker' }), 'circle');
  assert.equal(L.shapeOf({ type: 'inspection' }), 'diamond');
  assert.equal(L.shapeOf({ type: 'machine' }), 'rect');
  // explicit override wins
  assert.equal(L.shapeOf({ type: 'machine', shape: 'ellipse' }), 'ellipse');
});

test('edgePoint lands on the box border toward the target', () => {
  const b = box(0, 0, 100, 100); // centre (50,50)
  // target far to the right → exits the right edge at x=100, y=50
  const p = L.edgePoint(b, { x: 500, y: 50 });
  assert.equal(p.x, 100);
  assert.equal(p.y, 50);
  // target straight up → exits the top edge at y=0
  const up = L.edgePoint(b, { x: 50, y: -500 });
  assert.equal(up.y, 0);
  assert.equal(up.x, 50);
});

test('straightPath clips both ends to the element edges', () => {
  const a = box(0, 0, 100, 100);   // centre (50,50)
  const b = box(200, 0, 100, 100); // centre (250,50)
  const { pts } = L.straightPath(a, b);
  assert.equal(pts.length, 2);
  assert.deepEqual({ x: pts[0].x, y: pts[0].y }, { x: 100, y: 50 }); // right edge of A
  assert.deepEqual({ x: pts[1].x, y: pts[1].y }, { x: 200, y: 50 }); // left edge of B
});

test('orthogonalPath produces a right-angle route with a single jog', () => {
  const a = box(0, 0, 100, 100);
  const b = box(300, 0, 100, 100);
  const { pts } = L.orthogonalPath(a, b);
  assert.equal(pts.length, 4);
  // starts on A's right edge, ends on B's left edge, same y
  assert.equal(pts[0].x, 100);
  assert.equal(pts[3].x, 300);
  // the jog column is shared by the two middle points
  assert.equal(pts[1].x, pts[2].x);
});

test('arrowHeadPoints yields a 3-vertex triangle at the tip', () => {
  const s = L.arrowHeadPoints({ x: 0, y: 0 }, { x: 10, y: 0 }, 9);
  const verts = s.trim().split(' ');
  assert.equal(verts.length, 3);
  assert.equal(verts[0], '10,0'); // tip first
});

test('polylineMidpoint is the halfway point along the path', () => {
  const mid = L.polylineMidpoint([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
  // total length 20, halfway (10) is exactly the corner
  assert.equal(mid.x, 10);
  assert.equal(mid.y, 0);
});

// Normalize vm-realm arrays/objects so deepEqual doesn't fail on prototypes.
const norm = (v) => JSON.parse(JSON.stringify(v));

test('connectionPath: free arrow uses its floating endpoints verbatim', () => {
  const conn = { fromPt: { x: 20, y: 30 }, toPt: { x: 120, y: 30 }, routing: 'straight' };
  const res = L.connectionPath(conn, () => undefined);
  assert.deepEqual(
    norm(res.pts.map(p => ({ x: p.x, y: p.y }))),
    [{ x: 20, y: 30 }, { x: 120, y: 30 }],
  );
});

test('connectionPath: attached ends clip to element edges', () => {
  const a = box(0, 0, 100, 100);   // centre (50,50), right edge x=100
  const b = box(200, 0, 100, 100); // centre (250,50), left edge x=200
  const els = { a, b };
  const conn = { fromId: 'a', toId: 'b', routing: 'straight' };
  const res = L.connectionPath(conn, (id) => els[id]);
  assert.deepEqual(norm(res.pts.map(p => ({ x: p.x, y: p.y }))), [{ x: 100, y: 50 }, { x: 200, y: 50 }]);
});

test('connectionPath: mixed end (box → free point) clips only the attached side', () => {
  const a = box(0, 0, 100, 100); // centre (50,50)
  const conn = { fromId: 'a', toPt: { x: 300, y: 50 }, routing: 'straight' };
  const res = L.connectionPath(conn, (id) => (id === 'a' ? a : undefined));
  assert.deepEqual(norm(res.pts[0]), { x: 100, y: 50 }); // clipped to A's right edge
  assert.deepEqual(norm(res.pts[1]), { x: 300, y: 50 }); // free point untouched
});

test('connectionPath: returns null when an attached element is missing', () => {
  const conn = { fromId: 'gone', toPt: { x: 10, y: 10 } };
  assert.equal(L.connectionPath(conn, () => undefined), null);
});

test('connectionPath: free arrow with orthogonal routing makes a right-angle jog', () => {
  const conn = { fromPt: { x: 0, y: 0 }, toPt: { x: 100, y: 60 }, routing: 'orthogonal' };
  const res = L.connectionPath(conn, () => undefined);
  assert.equal(res.pts.length, 4);
  assert.equal(res.pts[1].x, res.pts[2].x); // shared jog column
});
