const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const rootDir = path.resolve(__dirname, '..');

/**
 * Transpile a TS module and run it in THIS realm (not a fresh vm context), so
 * arrays it returns share the host's Array prototype and deepStrictEqual works.
 */
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
    return require(id);
  };

  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', 'require', '__filename', output)(
    cjsModule.exports, cjsModule, localRequire, filename
  );
  return cjsModule.exports;
}

const timeStudy = loadTypeScriptModule('src/lib/time-study.ts');
const chartUtils = loadTypeScriptModule('src/lib/chart-utils.ts');

let seq = 0;
const nextId = () => `id-${++seq}`;

function row(jobElement, operator, kind, readings) {
  return { id: nextId(), seq: 0, jobElement, operator, kind, readings };
}

// ── Reference data straight out of JOB_C CAP_1 (3 TEN SET Line SUV_Rev.01.xlsx)
// Row 8  "เดินไปที่ rack"     1.50 1.60 2.00 1.70 1.85  → Min 1.50  Max 2.00  Aver 1.73
// Row 25 "เครื่องจักรทำงาน"  47.83 48.55 46.99 48.72 47.08 → Min 46.99 Max 48.72 Aver 47.83
const excelWalk = [1.5, 1.6, 2.0, 1.7, 1.85];
const excelMachine = [47.83, 48.55, 46.99, 48.72, 47.08];
const excelQc = [13.15, 12.3, 13.25, 14.0, 12.58];

test('row stats match the Excel MIN / MAX / AVERAGE formulas', () => {
  const walk = timeStudy.computeRowStats(row('เดินไปที่ rack', 'Worker A', 'walk', excelWalk));
  assert.equal(walk.min, 1.5);
  assert.equal(walk.max, 2.0);
  assert.equal(walk.average, 1.73);
  assert.equal(walk.fluctuation, 0.5);
  assert.equal(walk.count, 5);

  const qc = timeStudy.computeRowStats(row('ทำการตรวจ qc', 'Worker A', 'man', excelQc));
  assert.equal(qc.min, 12.3);
  assert.equal(qc.max, 14.0);
  assert.equal(qc.average, 13.06);

  const machine = timeStudy.computeRowStats(row('เครื่องจักรทำงาน', 'Auto M/C', 'machine', excelMachine));
  assert.equal(machine.min, 46.99);
  assert.equal(machine.max, 48.72);
  assert.equal(machine.average, 47.83);
});

test('blank readings are ignored, like empty cells in Excel', () => {
  const stats = timeStudy.computeRowStats(row('partial', 'Worker A', 'man', [2, null, 4, null, null]));
  assert.equal(stats.count, 2);
  assert.equal(stats.min, 2);
  assert.equal(stats.max, 4);
  assert.equal(stats.average, 3);
});

test('a row with no readings reports zeros instead of NaN/Infinity', () => {
  const stats = timeStudy.computeRowStats(row('empty', 'Worker A', 'man', [null, null]));
  assert.deepEqual(stats, { min: 0, max: 0, fluctuation: 0, average: 0, count: 0 });
});

test('TOTAL subtracts the machine row, matching =SUM(C8:C44)-C25', () => {
  const study = {
    readingCount: 5,
    rows: [
      row('เดินไปที่ rack', 'Worker A', 'walk', excelWalk),
      row('ทำการตรวจ qc', 'Worker A', 'man', excelQc),
      row('เครื่องจักรทำงาน', 'Auto M/C', 'machine', excelMachine),
    ],
  };
  const totals = timeStudy.computeTotals(study);

  // column 1: 1.50 + 13.15 = 14.65 — the 47.83 machine reading is left out
  assert.equal(totals.perReading[0], 14.65);
  assert.equal(totals.perReading[1], 13.9);
  assert.equal(totals.min, 13.8);            // 1.50 + 12.30
  assert.equal(totals.max, 16.0);            // 2.00 + 14.00
  assert.equal(totals.average, 14.79);       // 1.73 + 13.06

  // machine figures are reported separately, not folded into the operator total
  assert.equal(totals.machineMin, 46.99);
  assert.equal(totals.machineMax, 48.72);
});

test('a row typed as man but assigned to Auto M/C still counts as machine', () => {
  const study = {
    readingCount: 5,
    rows: [
      row('operator work', 'Worker A', 'man', [10, 10, 10, 10, 10]),
      row('mislabelled machine', 'Auto M/C', 'man', [40, 40, 40, 40, 40]),
    ],
  };
  const totals = timeStudy.computeTotals(study);
  assert.equal(totals.perReading[0], 10);
  assert.equal(totals.min, 10);
  assert.equal(totals.machineMin, 40);
});

test('operator totals split workers from the machine', () => {
  const study = {
    readingCount: 5,
    rows: [
      row('a1', 'Worker A', 'man', [5, 6, 7, 5, 5]),
      row('a2', 'Worker A', 'walk', [1, 1, 1, 1, 1]),
      row('b1', 'Worker B', 'man', [9, 9, 9, 9, 9]),
      row('m1', 'Auto M/C', 'machine', [30, 31, 30, 30, 30]),
    ],
  };
  const totals = timeStudy.computeOperatorTotals(study);
  const byOp = Object.fromEntries(totals.map(t => [t.operator, t]));

  assert.equal(byOp['Worker A'].min, 6);   // 5 + 1
  assert.equal(byOp['Worker A'].max, 8);   // 7 + 1
  assert.equal(byOp['Worker B'].min, 9);
  assert.equal(byOp['Auto M/C'].min, 30);
  assert.equal(byOp['Worker A'].rowCount, 2);
});

test('resizing the sheet keeps existing readings and pads with blanks', () => {
  const study = { readingCount: 5, rows: [row('x', 'Worker A', 'man', [1, 2, 3, 4, 5])] };

  const grown = timeStudy.resizeReadings(study, 10);
  assert.equal(grown.rows[0].readings.length, 10);
  assert.deepEqual(grown.rows[0].readings.slice(0, 5), [1, 2, 3, 4, 5]);
  assert.equal(grown.rows[0].readings[9], null);

  const shrunk = timeStudy.resizeReadings(grown, 5);
  assert.deepEqual(shrunk.rows[0].readings, [1, 2, 3, 4, 5]);
});

// ── Bridge with Module 4 ────────────────────────────────────────────────────
// Module 4 stores STOP times, Module 1 stores DURATIONS. These tests pin the
// conversion down in both directions, because getting it wrong silently
// corrupts every downstream number.

test('importing from M4 converts stop times into per-element durations', () => {
  const steps = [
    { id: 's1', no: 1, description: 'pick', operator: 'Worker A', manualTime: 5, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 's2', no: 2, description: 'walk', operator: 'Worker A', manualTime: 0, machineTime: 0, walkingTime: 8, idleTime: 0, startTime: 0 },
    { id: 's3', no: 3, description: 'run',  operator: 'Auto M/C', manualTime: 0, machineTime: 40, walkingTime: 0, idleTime: 0, startTime: 0 },
  ];

  const study = timeStudy.timeStudyFromSteps(steps, 5, nextId);
  assert.equal(study.rows.length, 3);
  assert.equal(study.readingCount, 5);

  // step 2's stop time is 8 but it starts when step 1 ends (5) → duration 3.
  // The machine stops at 40 and starts when the operator finishes at 8 → 32.
  assert.equal(study.rows[0].readings[0], 5);
  assert.equal(study.rows[1].readings[0], 3);
  assert.equal(study.rows[2].readings[0], 32);

  assert.equal(study.rows[0].kind, 'man');
  assert.equal(study.rows[1].kind, 'walk');
  assert.equal(study.rows[2].kind, 'machine');
  assert.equal(study.rows[1].jobElement, 'walk');

  // unmeasured rounds stay blank
  assert.deepEqual(study.rows[0].readings.slice(1), [null, null, null, null]);
});

test('pushing to M4 converts durations back into stop times', () => {
  const study = {
    readingCount: 5,
    rows: [
      row('pick', 'Worker A', 'man', [5, 6, 7, 5, 5]),
      row('walk', 'Worker A', 'walk', [3, 3, 4, 3, 3]),
      row('run',  'Auto M/C', 'machine', [40, 41, 40, 40, 40]),
    ],
  };

  const steps = timeStudy.stepsFromTimeStudy(study, 'min', nextId);
  assert.equal(steps.length, 3);

  // Min basis: 5 then 3 → stop times 5 and 8 on Worker A's track. The machine
  // is loaded at 8 and runs 40, so its stop reading is 48.
  assert.equal(steps[0].manualTime, 5);
  assert.equal(steps[1].walkingTime, 8);
  assert.equal(steps[2].machineTime, 48);
  assert.equal(steps[2].operator, 'Auto M/C');

  // and the durations survive the round trip through the chart engine
  const calc = chartUtils.getCalculatedSteps(steps);
  assert.equal(calc[0].calcDuration, 5);
  assert.equal(calc[1].calcDuration, 3);
  assert.equal(calc[2].calcDuration, 40);
});

test('push basis switches between Min, Average and Max', () => {
  const study = {
    readingCount: 5,
    rows: [row('pick', 'Worker A', 'man', [4, 6, 8, 6, 6])],
  };
  assert.equal(timeStudy.stepsFromTimeStudy(study, 'min', nextId)[0].manualTime, 4);
  assert.equal(timeStudy.stepsFromTimeStudy(study, 'max', nextId)[0].manualTime, 8);
  assert.equal(timeStudy.stepsFromTimeStudy(study, 'average', nextId)[0].manualTime, 6);
});

test('M4 -> M1 -> M4 round trip preserves every duration', () => {
  const original = [
    { id: 'r1', no: 1, description: 'a', operator: 'Worker A', manualTime: 5,  machineTime: 0,  walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 'r2', no: 2, description: 'b', operator: 'Worker A', manualTime: 0,  machineTime: 0,  walkingTime: 9, idleTime: 0, startTime: 0 },
    { id: 'r3', no: 3, description: 'c', operator: 'Worker B', manualTime: 12, machineTime: 0,  walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 'r4', no: 4, description: 'd', operator: 'Auto M/C', manualTime: 0,  machineTime: 30, walkingTime: 0, idleTime: 0, startTime: 0 },
  ];

  const study = timeStudy.timeStudyFromSteps(original, 5, nextId);
  const rebuilt = timeStudy.stepsFromTimeStudy(study, 'min', nextId);

  const durationsOf = steps => chartUtils.getCalculatedSteps(steps).map(s => s.calcDuration);
  assert.deepEqual(durationsOf(rebuilt), durationsOf(original));
  assert.equal(chartUtils.computeCycleTime(rebuilt), chartUtils.computeCycleTime(original));
});

test('parsePastedGrid reads a block copied out of Excel', () => {
  const grid = timeStudy.parsePastedGrid('1.50\t1.60\t2.00\n2.48\t2.39\t2.90\n');
  assert.deepEqual(grid, [[1.5, 1.6, 2.0], [2.48, 2.39, 2.9]]);
});

test('parsePastedGrid keeps blanks and rejects non-numeric cells', () => {
  const grid = timeStudy.parsePastedGrid('1.5\t\tabc\t1,234');
  assert.deepEqual(grid, [[1.5, null, null, 1234]]);
});

test('renumber restores a contiguous Seq after edits', () => {
  const rows = [row('a', 'Worker A', 'man', []), row('b', 'Worker A', 'man', [])];
  assert.deepEqual(timeStudy.renumber(rows).map(r => r.seq), [1, 2]);
});
