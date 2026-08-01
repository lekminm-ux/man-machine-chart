const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

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
  const localRequire = (id) => {
    if (mocks[id]) return mocks[id];
    if (id === '@/types') return loadTypeScriptModule('src/types/index.ts');
    if (id === './chart-utils') return loadTypeScriptModule('src/lib/chart-utils.ts');
    if (id === './time-study') return loadTypeScriptModule('src/lib/time-study.ts');
    return require(id);
  };

  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', 'require', '__filename', output)(
    cjsModule.exports, cjsModule, localRequire, filename
  );
  return cjsModule.exports;
}

const ct = loadTypeScriptModule('src/lib/combination-table.ts');

let seq = 0;
function row(jobElement, operator, kind, min) {
  return { id: `r-${++seq}`, seq, jobElement, operator, kind, readings: [min] };
}
const study = rows => ({ readingCount: 1, rows });

test('worker elements run one after another on that worker clock', () => {
  const r = ct.buildCombinationTable(study([
    row('load', 'Worker A', 'man', 10),
    row('walk', 'Worker A', 'walk', 5),
    row('check', 'Worker A', 'man', 8),
  ]), 0);

  assert.deepEqual(r.rows.map(x => [x.start, x.end]), [[0, 10], [10, 15], [15, 23]]);
  assert.equal(r.cycleTime, 23);
});

test('two workers run in parallel, each on their own clock', () => {
  const r = ct.buildCombinationTable(study([
    row('a1', 'Worker A', 'man', 10),
    row('b1', 'Worker B', 'man', 4),
    row('a2', 'Worker A', 'man', 6),
    row('b2', 'Worker B', 'man', 7),
  ]), 0);

  const byDesc = Object.fromEntries(r.rows.map(x => [x.description, [x.start, x.end]]));
  assert.deepEqual(byDesc.a1, [0, 10]);
  assert.deepEqual(byDesc.a2, [10, 16]);
  assert.deepEqual(byDesc.b1, [0, 4]);   // Worker B does not queue behind A
  assert.deepEqual(byDesc.b2, [4, 11]);
  assert.equal(r.cycleTime, 16);         // Worker A: 10 + 6
});

test('a machine starts when the element before it finishes and runs in parallel', () => {
  const r = ct.buildCombinationTable(study([
    row('load', 'Worker A', 'man', 10),
    row('auto run', 'Auto M/C', 'machine', 40),
    row('next job', 'Worker A', 'man', 6),
  ]), 0);

  const [load, auto, next] = r.rows;
  assert.deepEqual([load.start, load.end], [0, 10]);
  assert.deepEqual([auto.start, auto.end], [10, 50]);  // starts after loading
  assert.deepEqual([next.start, next.end], [10, 16]);  // operator does NOT wait
  assert.equal(r.cycleTime, 50);                       // gated by the machine
});

test('the machine a worker tends extends THAT worker loop', () => {
  // Worker A loads for 65 s, blow molding then runs 385 s and stops at 450.
  // Worker A's own work totals 356 s and fits inside the run, but Worker A
  // cannot unload — and so cannot restart — before 450.
  const r = ct.buildCombinationTable(study([
    row('load', 'Worker A', 'man', 65),
    row('Blow molding', 'Auto M/C', 'machine', 385),
    row('cut scrap', 'Worker A', 'man', 150),
    row('check', 'Worker A', 'man', 20),
    row('send', 'Worker A', 'man', 30),
    row('prepare nut', 'Worker A', 'man', 91),
  ]), 0);

  assert.equal(r.rows[1].start, 65, 'the machine starts when loading ends');
  assert.equal(r.rows[1].end, 450);
  assert.equal(r.actors.find(a => a.operator === 'Worker A').cycle, 450);
  assert.equal(r.cycleTime, 450);
});

test('a machine nobody waits for does not set the cycle', () => {
  // Worker A runs the main machine; Worker D feeds a scrap crusher that
  // finishes long before Worker D does. The crusher must not gate the line.
  const r = ct.buildCombinationTable(study([
    row('A load', 'Worker A', 'man', 65),
    row('Blow molding', 'Auto M/C', 'machine', 320),   // ends at 385
    row('A work', 'Worker A', 'man', 200),
    row('D push cart', 'Worker D', 'man', 70),
    row('D cut scrap', 'Worker D', 'man', 65),         // D is at 135
    row('Crusher', 'Auto M/C', 'machine', 60),         // 135 -> 195
    row('D bag it', 'Worker D', 'man', 120),           // D own total 255
  ]), 0);

  const a = r.actors.find(x => x.operator === 'Worker A');
  const d = r.actors.find(x => x.operator === 'Worker D');
  assert.equal(r.rows[5].start, 135, 'the crusher starts after D finishes cutting');
  assert.equal(r.rows[5].end, 195);
  assert.equal(a.cycle, 385);   // waits for the blow moulder
  assert.equal(d.cycle, 255);   // own work; the crusher ended at 195
  assert.equal(r.cycleTime, 385);
});

test('two machines started by the same person run in parallel, not queued', () => {
  const r = ct.buildCombinationTable(study([
    row('load', 'Worker A', 'man', 5),
    row('m1', 'Auto M/C', 'machine', 40),
    row('m2', 'Auto M/C', 'machine', 60),
  ]), 0);

  assert.equal(r.rows[1].start, 5);
  assert.equal(r.rows[2].start, 5, 'both start when the operator finishes loading');
  assert.equal(r.rows[1].end, 45);
  assert.equal(r.rows[2].end, 65);
  assert.equal(r.actors.find(a => a.operator === 'Worker A').cycle, 65);
  assert.equal(r.cycleTime, 65);
});

test('a row assigned to Auto M/C counts as a machine even if typed man', () => {
  const r = ct.buildCombinationTable(study([
    row('load', 'Worker A', 'man', 5),
    row('mislabelled', 'Auto M/C', 'man', 30),
  ]), 0);
  assert.equal(r.rows[1].kind, 'machine');
  assert.equal(r.rows[1].operator, 'Auto M/C');
});

test('Rule 2 — an operator under Takt gets the waiting time to Takt', () => {
  const r = ct.buildCombinationTable(study([
    row('a1', 'Worker A', 'man', 30),
    row('b1', 'Worker B', 'man', 45),
  ]), 60);

  const a = r.actors.find(x => x.operator === 'Worker A');
  const b = r.actors.find(x => x.operator === 'Worker B');
  assert.equal(a.wait, 30);
  assert.equal(b.wait, 15);
  assert.equal(a.overTakt, false);
});

test('an operator over Takt is flagged and has no waiting time', () => {
  const r = ct.buildCombinationTable(study([row('a1', 'Worker A', 'man', 75)]), 60);
  const a = r.actors[0];
  assert.equal(a.overTakt, true);
  assert.equal(a.wait, 0);
});

test('Rule 1 — a bar past Takt is cut there and wrapped back to zero', () => {
  const r = ct.buildCombinationTable(study([
    row('load', 'Worker A', 'man', 10),
    row('long run', 'Auto M/C', 'machine', 70),   // 10 -> 80, Takt is 60
  ]), 60);

  const machine = r.rows[1];
  assert.equal(machine.overrunsTakt, true);
  assert.deepEqual(machine.segments, [
    { start: 10, end: 60, wrapped: false },
    { start: 0, end: 20, wrapped: true },
  ]);
});

test('a bar starting after Takt is drawn entirely wrapped', () => {
  const r = ct.buildCombinationTable(study([
    row('a1', 'Worker A', 'man', 70),
    row('a2', 'Worker A', 'man', 10),   // 70 -> 80, both past Takt 60
  ]), 60);

  assert.deepEqual(r.rows[1].segments, [{ start: 10, end: 20, wrapped: true }]);
});

test('a bar that ends exactly on Takt is not treated as an overrun', () => {
  const r = ct.buildCombinationTable(study([row('a1', 'Worker A', 'man', 60)]), 60);
  assert.equal(r.rows[0].overrunsTakt, false);
  assert.deepEqual(r.rows[0].segments, [{ start: 0, end: 60, wrapped: false }]);
});

test('with no Takt set, nothing wraps and no waiting time is invented', () => {
  const r = ct.buildCombinationTable(study([row('a1', 'Worker A', 'man', 90)]), 0);
  assert.equal(r.rows[0].overrunsTakt, false);
  assert.deepEqual(r.rows[0].segments, [{ start: 0, end: 90, wrapped: false }]);
  assert.equal(r.actors[0].wait, 0);
});

test('rows with no reading produce no drawing segments', () => {
  const r = ct.buildCombinationTable(study([
    { id: 'blank', seq: 1, jobElement: '', operator: 'Worker A', kind: 'man', readings: [null] },
  ]), 60);
  assert.deepEqual(r.rows[0].segments, []);
  assert.equal(r.rows[0].duration, 0);
});

test('an empty sheet does not crash and reports a usable axis', () => {
  const r = ct.buildCombinationTable(study([]), 0);
  assert.equal(r.cycleTime, 0);
  assert.equal(r.rows.length, 0);
  assert.ok(r.axisMax >= 1);
});

test('the axis covers the latest end, the cycle and Takt', () => {
  const r = ct.buildCombinationTable(study([
    row('load', 'Worker A', 'man', 10),
    row('auto', 'Auto M/C', 'machine', 100),
  ]), 60);
  assert.equal(r.axisMax, 110);   // the machine ends at 110
});

test('axis ticks are round numbers covering the range', () => {
  const ticks = ct.axisTicks(110);
  assert.equal(ticks[0], 0);
  assert.ok(ticks[ticks.length - 1] >= 110);
  const step = ticks[1] - ticks[0];
  assert.ok([1, 2, 2.5, 5, 10, 20, 25, 50].includes(step), `unexpected step ${step}`);
});

test('axis ticks handle a zero range', () => {
  assert.deepEqual(ct.axisTicks(0), [0]);
});

test('walk elements keep their own kind so they can be drawn differently', () => {
  const r = ct.buildCombinationTable(study([
    row('walk to rack', 'Worker A', 'walk', 3),
  ]), 0);
  assert.equal(r.rows[0].kind, 'walk');
});
