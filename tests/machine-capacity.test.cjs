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

const mc = loadTypeScriptModule('src/lib/machine-capacity.ts');

let seq = 0;
const nextId = () => `mc-${++seq}`;

function row(processName, manualTime, autoTime, changeQty = 0, changeTime = 0) {
  return { id: nextId(), no: 0, processName, machineNo: '', manualTime, autoTime, changeQty, changeTime };
}

test('net shift time is gross minus breaks, in seconds', () => {
  // Summit Auto Seats: 540 min shift, 80 min of breaks (60 lunch + 20 before OT)
  const sheet = { shiftGrossMinutes: 540, breakMinutes: 80, requiredPerShift: 0, rows: [] };
  assert.equal(mc.netShiftSeconds(sheet), 460 * 60);
  assert.equal(mc.netShiftSeconds(sheet), 27600);
});

test('net shift time never goes negative', () => {
  const sheet = { shiftGrossMinutes: 60, breakMinutes: 90, requiredPerShift: 0, rows: [] };
  assert.equal(mc.netShiftSeconds(sheet), 0);
});

test('completion time is manual plus auto (Excel: 4.13 + 46.54 = 50.67)', () => {
  const stats = mc.computeCapacityRow(row('Utrasonic', 4.13, 46.54), 27600);
  assert.equal(stats.completionTime, 50.67);
  assert.equal(stats.changeTimePerUnit, 0);
  assert.equal(stats.effectiveTime, 50.67);
  // 27600 / 50.67 = 544.7 units per shift
  assert.equal(stats.capacity, 544.7);
});

test('tool change time is charged per unit', () => {
  // 300 s change every 100 units = 3 s per unit
  const stats = mc.computeCapacityRow(row('Press', 5, 25, 100, 300), 27600);
  assert.equal(stats.changeTimePerUnit, 3);
  assert.equal(stats.effectiveTime, 33);
  assert.equal(stats.capacity, 836.36);
});

test('no tool change means no per-unit change time', () => {
  const stats = mc.computeCapacityRow(row('Press', 5, 25, 0, 300), 27600);
  assert.equal(stats.changeTimePerUnit, 0);
  assert.equal(stats.effectiveTime, 30);
});

test('a row with no time reports zero capacity instead of dividing by zero', () => {
  const stats = mc.computeCapacityRow(row('empty', 0, 0), 27600);
  assert.equal(stats.capacity, 0);
  assert.ok(Number.isFinite(stats.capacity));
});

test('the bottleneck is the slowest process, and it sets the line output', () => {
  const slow = row('Ultrasonic', 4, 46);   // 50 s  -> 552 units
  const fast = row('Assembly', 5, 15);     // 20 s  -> 1380 units
  const sheet = { shiftGrossMinutes: 540, breakMinutes: 80, requiredPerShift: 0, rows: [fast, slow] };

  const summary = mc.computeCapacitySummary(sheet);
  assert.equal(summary.bottleneckRowId, slow.id);
  assert.equal(summary.bottleneckCapacity, 552);
  assert.equal(summary.shiftSeconds, 27600);
});

test('rows with no time entered are ignored when picking the bottleneck', () => {
  const real = row('Ultrasonic', 4, 46);
  const blank = row('', 0, 0);
  const sheet = { shiftGrossMinutes: 540, breakMinutes: 80, requiredPerShift: 0, rows: [blank, real] };

  const summary = mc.computeCapacitySummary(sheet);
  assert.equal(summary.bottleneckRowId, real.id);
  assert.equal(summary.bottleneckCapacity, 552);
});

test('takt time and load come from customer demand', () => {
  const sheet = {
    shiftGrossMinutes: 540, breakMinutes: 80, requiredPerShift: 400,
    rows: [row('Ultrasonic', 4, 46)],
  };
  const summary = mc.computeCapacitySummary(sheet);

  assert.equal(summary.taktTime, 69);            // 27600 / 400
  assert.equal(summary.bottleneckCapacity, 552);
  assert.equal(summary.loadPercent, 72.46);      // 400 / 552
  assert.equal(summary.shortfall, false);
});

test('demand above the bottleneck raises a shortfall', () => {
  const sheet = {
    shiftGrossMinutes: 540, breakMinutes: 80, requiredPerShift: 700,
    rows: [row('Ultrasonic', 4, 46)],
  };
  const summary = mc.computeCapacitySummary(sheet);
  assert.equal(summary.shortfall, true);
  assert.ok(summary.loadPercent > 100);
});

test('no demand entered leaves takt and load at zero rather than Infinity', () => {
  const sheet = { shiftGrossMinutes: 540, breakMinutes: 80, requiredPerShift: 0, rows: [row('x', 4, 46)] };
  const summary = mc.computeCapacitySummary(sheet);
  assert.equal(summary.taktTime, 0);
  assert.equal(summary.loadPercent, 0);
  assert.equal(summary.shortfall, false);
});

test('an empty sheet does not crash', () => {
  const summary = mc.computeCapacitySummary(mc.emptyMachineCapacity());
  assert.equal(summary.bottleneckCapacity, 0);
  assert.equal(summary.bottleneckRowId, null);
});

test('seeding from M1 takes one process per machine row, using its Min', () => {
  const study = {
    readingCount: 5,
    rows: [
      { id: 'a', seq: 1, jobElement: 'pick', operator: 'Worker A', kind: 'man', readings: [5, 6, 7, 5, 5] },
      { id: 'b', seq: 2, jobElement: 'Blow molding', operator: 'Auto M/C', kind: 'machine', readings: [47.83, 48.55, 46.99, 48.72, 47.08] },
      { id: 'c', seq: 3, jobElement: 'Crusher', operator: 'Auto M/C', kind: 'machine', readings: [60, 62, 61, 60, 60] },
    ],
  };

  const seeded = mc.machineCapacityFromTimeStudy(study, mc.emptyMachineCapacity(), nextId);
  assert.equal(seeded.rows.length, 2);                 // worker rows are not processes
  assert.equal(seeded.rows[0].processName, 'Blow molding');
  assert.equal(seeded.rows[0].autoTime, 46.99);        // the Min reading
  assert.equal(seeded.rows[0].manualTime, 0);          // left for the user to fill in
  assert.equal(seeded.rows[1].processName, 'Crusher');
  assert.equal(seeded.rows[1].autoTime, 60);
  assert.deepEqual(seeded.rows.map(r => r.no), [1, 2]);
});

test('seeding keeps the shift settings already entered', () => {
  const base = { shiftGrossMinutes: 480, breakMinutes: 60, requiredPerShift: 250, rows: [] };
  const study = { readingCount: 5, rows: [{ id: 'b', seq: 1, jobElement: 'M', operator: 'Auto M/C', kind: 'machine', readings: [30] }] };
  const seeded = mc.machineCapacityFromTimeStudy(study, base, nextId);
  assert.equal(seeded.shiftGrossMinutes, 480);
  assert.equal(seeded.breakMinutes, 60);
  assert.equal(seeded.requiredPerShift, 250);
});

test('renumbering restores a contiguous No. after edits', () => {
  const rows = [row('a', 1, 1), row('b', 1, 1), row('c', 1, 1)];
  assert.deepEqual(mc.renumberCapacityRows(rows).map(r => r.no), [1, 2, 3]);
});
