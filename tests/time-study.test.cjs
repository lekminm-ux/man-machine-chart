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

function row(jobElement, operator, kind, readings, category) {
  const base = { id: nextId(), seq: 0, jobElement, operator, kind, readings };
  return category ? { ...base, category } : base;
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
  assert.equal(byOp['Worker A'].average, 6.6);
  assert.equal(byOp['Worker B'].min, 9);
  assert.equal(byOp['Worker B'].max, 9);
  assert.equal(byOp['Worker B'].average, 9);
  assert.equal(byOp['Auto M/C'].min, 30);
  assert.equal(byOp['Worker A'].rowCount, 2);
  assert.equal(byOp['Worker B'].rowCount, 1);
  assert.equal(byOp['Auto M/C'].max, 31);
  assert.equal(byOp['Auto M/C'].average, 30.2);
  assert.equal(byOp['Auto M/C'].rowCount, 1);
});

test('operator totals split mixed work kinds without leaking across operators', () => {
  const study = {
    readingCount: 3,
    rows: [
      row('A-man', 'Worker A', 'man', [5, 6, 7]),
      row('A-walk', 'Worker A', 'walk', [1, 2, 3]),
      row('A-idle', 'Worker A', 'idle', [4, 5, 6]),
      row('B-man', 'Worker B', 'man', [9, 10, 11]),
      row('B-walk', 'Worker B', 'walk', [2, 2, 2]),
    ],
  };
  const totals = timeStudy.computeOperatorTotals(study);
  const byOp = Object.fromEntries(totals.map(t => [t.operator, t]));

  assert.deepEqual(
    {
      manMin: byOp['Worker A'].manMin,
      walkMin: byOp['Worker A'].walkMin,
      idleMin: byOp['Worker A'].idleMin,
      min: byOp['Worker A'].min,
    },
    { manMin: 5, walkMin: 1, idleMin: 4, min: 10 }
  );
  assert.deepEqual(
    {
      manMin: byOp['Worker B'].manMin,
      walkMin: byOp['Worker B'].walkMin,
      idleMin: byOp['Worker B'].idleMin,
      min: byOp['Worker B'].min,
    },
    { manMin: 9, walkMin: 2, idleMin: 0, min: 11 }
  );

  for (const total of totals) {
    assert.equal(total.manMin + total.walkMin + total.idleMin, total.min);
  }
});

test('categorized rows are excluded from regular totals and counted in their category buckets', () => {
  const study = {
    readingCount: 3,
    rows: [
      row('regular-man', 'Worker A', 'man', [5, 6, 7]),
      row('periodical-man', 'Worker A', 'man', [10, 12, 11], 'periodical'),
      row('changeover-idle', 'Worker A', 'idle', [20, 22, 21], 'changeover'),
    ],
  };
  const total = timeStudy.computeOperatorTotals(study)[0];

  assert.deepEqual(
    {
      min: total.min,
      max: total.max,
      average: total.average,
      rowCount: total.rowCount,
      manMin: total.manMin,
      walkMin: total.walkMin,
      idleMin: total.idleMin,
      periodicalMin: total.periodicalMin,
      changeoverMin: total.changeoverMin,
    },
    {
      min: 5,
      max: 7,
      average: 6,
      rowCount: 1,
      manMin: 5,
      walkMin: 0,
      idleMin: 0,
      periodicalMin: 10,
      changeoverMin: 20,
    }
  );
});

test('rows without a category preserve Phase 4A regular totals exactly', () => {
  const study = {
    readingCount: 3,
    rows: [
      row('A-man', 'Worker A', 'man', [5, 6, 7]),
      row('A-walk', 'Worker A', 'walk', [1, 2, 3]),
      row('A-idle', 'Worker A', 'idle', [4, 5, 6]),
      row('B-man', 'Worker B', 'man', [9, 10, 11]),
      row('B-walk', 'Worker B', 'walk', [2, 2, 2]),
    ],
  };
  const totals = timeStudy.computeOperatorTotals(study);

  assert.equal(study.rows.every(r => r.category === undefined), true);
  assert.deepEqual(
    totals.map(total => ({
      operator: total.operator,
      min: total.min,
      max: total.max,
      average: total.average,
      rowCount: total.rowCount,
      manMin: total.manMin,
      walkMin: total.walkMin,
      idleMin: total.idleMin,
    })),
    [
      { operator: 'Worker A', min: 10, max: 16, average: 13, rowCount: 3, manMin: 5, walkMin: 1, idleMin: 4 },
      { operator: 'Worker B', min: 11, max: 13, average: 12, rowCount: 2, manMin: 9, walkMin: 2, idleMin: 0 },
    ]
  );
});

test('mixed regular, periodical, and changeover rows stay isolated per operator', () => {
  const study = {
    readingCount: 3,
    rows: [
      row('A-man', 'Worker A', 'man', [5, 6, 7]),
      row('A-walk', 'Worker A', 'walk', [1, 2, 3]),
      row('A-periodical', 'Worker A', 'man', [10, 11, 12], 'periodical'),
      row('A-changeover', 'Worker A', 'idle', [20, 21, 22], 'changeover'),
      row('B-man', 'Worker B', 'man', [9, 10, 11]),
      row('B-periodical', 'Worker B', 'walk', [30, 31, 32], 'periodical'),
      row('B-changeover', 'Worker B', 'man', [40, 41, 42], 'changeover'),
    ],
  };
  const totals = timeStudy.computeOperatorTotals(study);
  const byOp = Object.fromEntries(totals.map(total => [total.operator, total]));

  assert.deepEqual(
    {
      min: byOp['Worker A'].min,
      max: byOp['Worker A'].max,
      average: byOp['Worker A'].average,
      rowCount: byOp['Worker A'].rowCount,
      manMin: byOp['Worker A'].manMin,
      walkMin: byOp['Worker A'].walkMin,
      idleMin: byOp['Worker A'].idleMin,
      periodicalMin: byOp['Worker A'].periodicalMin,
      changeoverMin: byOp['Worker A'].changeoverMin,
    },
    {
      min: 6,
      max: 10,
      average: 8,
      rowCount: 2,
      manMin: 5,
      walkMin: 1,
      idleMin: 0,
      periodicalMin: 10,
      changeoverMin: 20,
    }
  );
  assert.deepEqual(
    {
      min: byOp['Worker B'].min,
      max: byOp['Worker B'].max,
      average: byOp['Worker B'].average,
      rowCount: byOp['Worker B'].rowCount,
      manMin: byOp['Worker B'].manMin,
      walkMin: byOp['Worker B'].walkMin,
      idleMin: byOp['Worker B'].idleMin,
      periodicalMin: byOp['Worker B'].periodicalMin,
      changeoverMin: byOp['Worker B'].changeoverMin,
    },
    {
      min: 9,
      max: 11,
      average: 10,
      rowCount: 1,
      manMin: 9,
      walkMin: 0,
      idleMin: 0,
      periodicalMin: 30,
      changeoverMin: 40,
    }
  );
});

test('rowsForOperatorByCategory filters, orders kinds, and buckets machine rows under Auto M/C', () => {
  const withSeq = (entry, seq) => ({ ...entry, seq });
  const study = {
    readingCount: 1,
    rows: [
      withSeq(row('A idle', 'Worker A', 'idle', [3]), 50),
      withSeq(row('A walk', 'Worker A', 'walk', [2]), 40),
      withSeq(row('A man 2', 'Worker A', 'man', [5]), 20),
      withSeq(row('A periodical', 'Worker A', 'man', [7], 'periodical'), 10),
      withSeq(row('A man 1', 'Worker A', 'man', [4]), 5),
      withSeq(row('B regular', 'Worker B', 'man', [9]), 1),
      withSeq(row('machine via kind', 'Worker B', 'machine', [30]), 2),
      withSeq(row('machine via operator', 'Auto M/C', 'man', [31]), 3),
      withSeq(row('B changeover', 'Worker B', 'idle', [40], 'changeover'), 4),
    ],
  };

  assert.deepEqual(
    timeStudy.rowsForOperatorByCategory(study, 'Worker A', 'regular').map(r => r.jobElement),
    ['A man 1', 'A man 2', 'A walk', 'A idle']
  );
  assert.deepEqual(
    timeStudy.rowsForOperatorByCategory(study, 'Worker A', 'periodical').map(r => r.jobElement),
    ['A periodical']
  );
  assert.deepEqual(
    timeStudy.rowsForOperatorByCategory(study, 'Worker B', 'changeover').map(r => r.jobElement),
    ['B changeover']
  );
  assert.deepEqual(
    timeStudy.rowsForOperatorByCategory(study, 'Worker B', 'regular').map(r => r.jobElement),
    ['B regular']
  );
  assert.deepEqual(
    timeStudy.rowsForOperatorByCategory(study, 'Auto M/C', 'regular').map(r => r.jobElement),
    ['machine via operator', 'machine via kind']
  );
});

test('per-row category minima sum exactly to computeOperatorTotals aggregates', () => {
  const study = {
    readingCount: 3,
    rows: [
      row('A-man-1', 'Worker A', 'man', [5, 6, 7]),
      row('A-man-2', 'Worker A', 'man', [6, 7, 8]),
      row('A-walk', 'Worker A', 'walk', [2, 3, 4]),
      row('A-idle', 'Worker A', 'idle', [4, 5, 6]),
      row('A-periodical-1', 'Worker A', 'man', [10, 11, 12], 'periodical'),
      row('A-periodical-2', 'Worker A', 'walk', [11, 12, 13], 'periodical'),
      row('A-changeover', 'Worker A', 'idle', [20, 21, 22], 'changeover'),
      row('B-man', 'Worker B', 'man', [9, 10, 11]),
      row('B-walk', 'Worker B', 'walk', [3, 4, 5]),
      row('B-periodical', 'Worker B', 'man', [30, 31, 32], 'periodical'),
      row('B-changeover', 'Worker B', 'idle', [40, 41, 42], 'changeover'),
    ],
  };
  const totals = Object.fromEntries(
    timeStudy.computeOperatorTotals(study).map(total => [total.operator, total])
  );
  const sumMin = rows => rows.reduce((sum, item) => sum + timeStudy.computeRowStats(item).min, 0);

  for (const operator of ['Worker A', 'Worker B']) {
    const total = totals[operator];
    const regularRows = timeStudy.rowsForOperatorByCategory(study, operator, 'regular');
    const periodicalRows = timeStudy.rowsForOperatorByCategory(study, operator, 'periodical');
    const changeoverRows = timeStudy.rowsForOperatorByCategory(study, operator, 'changeover');

    assert.equal(sumMin(regularRows), total.min);
    assert.equal(sumMin(regularRows.filter(r => r.kind === 'man')), total.manMin);
    assert.equal(sumMin(regularRows.filter(r => r.kind === 'walk')), total.walkMin);
    assert.equal(sumMin(regularRows.filter(r => r.kind === 'idle')), total.idleMin);
    assert.equal(total.manMin + total.walkMin + total.idleMin, total.min);
    assert.equal(sumMin(periodicalRows), total.periodicalMin);
    assert.equal(sumMin(changeoverRows), total.changeoverMin);
  }
});

test('moveRowToOperator changes only the target row operator', () => {
  const target = { ...row('move me', 'Worker A', 'walk', [5, 6, 7], 'periodical'), seq: 7 };
  const untouched = { ...row('stay here', 'Worker B', 'idle', [8, 9, 10]), seq: 8 };
  const study = { readingCount: 3, rows: [target, untouched] };

  assert.strictEqual(
    timeStudy.moveRowToOperator(study, target.id, 'Worker A'),
    study,
    'moving to the current operator is a no-op'
  );

  const moved = timeStudy.moveRowToOperator(study, target.id, 'Worker C');

  assert.notStrictEqual(moved, study);
  assert.notStrictEqual(moved.rows[0], target);
  assert.deepEqual(moved.rows[0], { ...target, operator: 'Worker C' });
  assert.strictEqual(moved.rows[1], untouched, 'rows other than the target keep their original object');
  assert.equal(moved.rows[0].kind, target.kind);
  assert.equal(moved.rows[0].category, target.category);
  assert.deepEqual(moved.rows[0].readings, target.readings);
  assert.equal(moved.rows[0].id, target.id);
  assert.equal(moved.rows[0].seq, target.seq);
  assert.equal(moved.rows[0].jobElement, target.jobElement);
});

test('moveRowToOperator safely handles missing rows and rebalances operator totals', () => {
  const source = row('source work', 'Worker A', 'man', [5, 6, 7]);
  const destination = row('existing work', 'Worker B', 'walk', [9, 10, 11]);
  const unaffected = row('unaffected work', 'Worker C', 'idle', [2, 3, 4]);
  const study = { readingCount: 3, rows: [source, destination, unaffected] };

  assert.doesNotThrow(() => timeStudy.moveRowToOperator(study, 'missing-row', 'Worker B'));
  assert.strictEqual(
    timeStudy.moveRowToOperator(study, 'missing-row', 'Worker B'),
    study,
    'a missing row leaves the study unchanged'
  );

  const moved = timeStudy.moveRowToOperator(study, source.id, 'Worker B');
  const totals = Object.fromEntries(
    timeStudy.computeOperatorTotals(moved).map(total => [total.operator, total])
  );

  assert.equal(totals['Worker A'], undefined, 'the source operator no longer has a row');
  assert.equal(totals['Worker B'].min, 14, 'destination total includes the moved row');
  assert.equal(totals['Worker B'].manMin, 5);
  assert.equal(totals['Worker B'].walkMin, 9);
  assert.equal(totals['Worker C'].min, 2, 'an unrelated operator is unchanged');
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

test('importing from M4 copies each element duration into the first reading', () => {
  const steps = [
    { id: 's1', no: 1, description: 'pick', operator: 'Worker A', manualTime: 5, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 's2', no: 2, description: 'walk', operator: 'Worker A', manualTime: 0, machineTime: 0, walkingTime: 8, idleTime: 0, startTime: 0 },
    { id: 's3', no: 3, description: 'run',  operator: 'Auto M/C', manualTime: 0, machineTime: 40, walkingTime: 0, idleTime: 0, startTime: 0 },
  ];

  const study = timeStudy.timeStudyFromSteps(steps, 5, nextId);
  assert.equal(study.rows.length, 3);
  assert.equal(study.readingCount, 5);

  // Both modules store durations now, so the numbers come across unchanged.
  assert.equal(study.rows[0].readings[0], 5);
  assert.equal(study.rows[1].readings[0], 8);
  assert.equal(study.rows[2].readings[0], 40);

  assert.equal(study.rows[0].kind, 'man');
  assert.equal(study.rows[1].kind, 'walk');
  assert.equal(study.rows[2].kind, 'machine');
  assert.equal(study.rows[1].jobElement, 'walk');

  // unmeasured rounds stay blank
  assert.deepEqual(study.rows[0].readings.slice(1), [null, null, null, null]);
});

test('pushing to M4 writes the chosen reading straight into the matching column', () => {
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

  assert.equal(steps[0].manualTime, 5);
  assert.equal(steps[1].walkingTime, 3);
  assert.equal(steps[2].machineTime, 40);
  assert.equal(steps[2].operator, 'Auto M/C');

  // and the durations survive the round trip through the chart engine
  const calc = chartUtils.getCalculatedSteps(steps);
  assert.equal(calc[0].calcDuration, 5);
  assert.equal(calc[1].calcDuration, 3);
  assert.equal(calc[2].calcDuration, 40);
  assert.equal(calc[2].calcStart, 8, 'the machine still starts after the operator loads it');
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
