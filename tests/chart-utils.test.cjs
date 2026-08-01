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
    return require(id);
  };

  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', 'require', '__filename', output)(
    cjsModule.exports, cjsModule, localRequire, filename
  );
  return cjsModule.exports;
}

const chartUtils = loadTypeScriptModule('src/lib/chart-utils.ts');

// ── helpers ────────────────────────────────────────────────────────────────
// Every number below is a DURATION — the length of that element. Nothing is
// ever subtracted from it ("กรอกเท่าไร คิดเท่านั้น", adopted 2026-08-01).
let seq = 0;
function man(description, operator, seconds, startTime = 0) {
  return { id: `s${++seq}`, no: seq, description, operator,
    manualTime: seconds, machineTime: 0, walkingTime: 0, idleTime: 0, startTime };
}
function walk(description, operator, seconds, startTime = 0) {
  return { id: `s${++seq}`, no: seq, description, operator,
    manualTime: 0, machineTime: 0, walkingTime: seconds, idleTime: 0, startTime };
}
function idle(description, operator, seconds, startTime = 0) {
  return { id: `s${++seq}`, no: seq, description, operator,
    manualTime: 0, machineTime: 0, walkingTime: 0, idleTime: seconds, startTime };
}
function machine(description, seconds, startTime = 0) {
  return { id: `s${++seq}`, no: seq, description, operator: 'Auto M/C',
    manualTime: 0, machineTime: seconds, walkingTime: 0, idleTime: 0, startTime };
}

// ── the entered number IS the duration ─────────────────────────────────────

test('an entered time is used as-is and never reduced by the previous step', () => {
  const steps = [walk('เดินไปหยิบชิ้นงาน', 'Worker A', 5), man('Work Unloading', 'Worker A', 100)];
  const calc = chartUtils.getCalculatedSteps(steps);

  assert.equal(calc[0].calcDuration, 5);
  assert.equal(calc[1].calcDuration, 100, 'keying 100 must give 100, not 95');
  assert.deepEqual([calc[1].calcStart, calc[1].calcEnd], [5, 105]);
});

test('Count on an operator row is manual + walk + idle', () => {
  const step = {
    id: 'combo', no: 1, description: 'work then walk', operator: 'Worker A',
    manualTime: 40, machineTime: 0, walkingTime: 8, idleTime: 3, startTime: 0,
  };
  const [calc] = chartUtils.getCalculatedSteps([step]);
  assert.equal(calc.calcDuration, 51);
  assert.equal(calc.calcManual, 40);
  assert.equal(calc.calcWalk, 8);
  assert.equal(calc.calcIdle, 3);
});

test('Count on a machine row is the machine time', () => {
  const [calc] = chartUtils.getCalculatedSteps([machine('Blow molding', 385)]);
  assert.equal(calc.calcDuration, 385);
  assert.equal(calc.calcMachine, 385);
});

test('operator elements chain one after another on that operator clock', () => {
  const steps = [
    man('Pick part', 'Worker A', 10),
    walk('Move to press', 'Worker A', 8),
  ];
  const calc = chartUtils.getCalculatedSteps(steps);
  assert.deepEqual(
    calc.map(s => ({ id: s.id, start: s.calcStart, end: s.calcEnd, dur: s.calcDuration })),
    [
      { id: calc[0].id, start: 0, end: 10, dur: 10 },
      { id: calc[1].id, start: 10, end: 18, dur: 8 },
    ],
  );
});

test('an explicit startTime moves the bar without shortening it', () => {
  const steps = [man('late job', 'Worker A', 30, 100)];
  const [calc] = chartUtils.getCalculatedSteps(steps);
  assert.equal(calc.calcStart, 100);
  assert.equal(calc.calcDuration, 30, 'the entered 30 s is not reduced by the start');
  assert.equal(calc.calcEnd, 130);
});

test('a zero-length step is harmless', () => {
  const steps = [man('ok', 'Worker A', 20), man('not measured yet', 'Worker A', 0)];
  const calc = chartUtils.getCalculatedSteps(steps);
  assert.equal(calc[1].calcDuration, 0);
  assert.equal(calc[1].calcStart, 20);
  assert.equal(chartUtils.computeTotalDuration(steps), 20);
});

// ── machines ───────────────────────────────────────────────────────────────

test('a machine starts when the operator element above it finishes loading', () => {
  const steps = [
    man('Work Unloading and Insert nut', 'Worker A', 62),
    machine('Blow molding', 388),
    man('Cutting scrap', 'Worker A', 150),
  ];
  const calc = chartUtils.getCalculatedSteps(steps);

  assert.equal(calc[1].calcStart, 62, 'the machine waits to be loaded');
  assert.equal(calc[1].calcDuration, 388);
  assert.equal(calc[1].calcEnd, 450);
  assert.equal(calc[2].calcStart, 62, 'the operator carries on in parallel');
});

test('two machines under the same load step run in parallel, not queued', () => {
  const steps = [man('load both', 'Worker A', 5), machine('m1', 40), machine('m2', 60)];
  const calc = chartUtils.getCalculatedSteps(steps);
  assert.equal(calc[1].calcStart, 5);
  assert.equal(calc[2].calcStart, 5);
  assert.deepEqual([calc[1].calcEnd, calc[2].calcEnd], [45, 65]);
});

test('computeTotalDuration is the latest end across every track', () => {
  const steps = [
    man('Load fixture', 'Worker A', 12),
    machine('Auto cycle', 30),
    idle('Inspect', 'Worker B', 20, 15),
  ];
  // machine: 12 -> 42 ; Worker B: 15 -> 35
  assert.equal(chartUtils.computeTotalDuration(steps), 42);
});

test('computeTotalDuration of an empty chart is 0', () => {
  assert.equal(chartUtils.computeTotalDuration([]), 0);
});

// ── summaries ──────────────────────────────────────────────────────────────

test('builds worker and machine summaries from the entered durations', () => {
  const steps = [
    man('Pick', 'Worker A', 9),
    walk('Walk', 'Worker A', 5),
    machine('Auto', 11),
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(chartUtils.buildSummary(steps))), [
    { operator: 'Worker A', manTime: 9, walkTime: 5, lineTotal: 14 },
  ]);
  assert.equal(chartUtils.getMachineTime(steps), 11);
});

test('getActiveWorkers lists only the workers in use, in order', () => {
  const steps = [man('a', 'Worker C', 5), machine('m', 10), man('b', 'Worker A', 5)];
  assert.deepEqual(chartUtils.getActiveWorkers(steps), ['Worker A', 'Worker C']);
});

// ── cycle time ─────────────────────────────────────────────────────────────

test('cycle time is the longest operator loop', () => {
  const steps = [
    man('a1', 'Worker A', 60),
    man('a2', 'Worker A', 40),
    man('b1', 'Worker B', 70),
  ];
  const detail = chartUtils.computeCycleDetail(steps);
  assert.equal(detail.cycleTime, 100);
  assert.equal(detail.driver, 'Worker A');
});

test('idle counts toward the operator own time', () => {
  const steps = [man('work', 'Worker A', 64), idle('wait', 'Worker A', 37), machine('auto', 90)];
  const detail = chartUtils.computeCycleDetail(steps);
  const a = detail.loops.find(l => l.operator === 'Worker A');
  assert.equal(a.ownTime, 101);
  assert.equal(chartUtils.computeCycleTime([]), 0);
});

test('BYD Side Step Rev.00: Worker A waits for the blow moulder', () => {
  // Real data. Worker A is busy 347 s; the machine is loaded at 62 and runs
  // 388 s, stopping at 450. Worker A cannot restart before then.
  const steps = [
    man('Work Unloading and Insert nut', 'Worker A', 62),
    machine('Blow molding', 388),
    man('Cutting scrap', 'Worker A', 150),
    man('check part Weight & nut insert', 'Worker A', 30),
    man('Send part', 'Worker A', 20),
    man('Prepare insert nut', 'Worker A', 85),
    man('Finishing Bari on part', 'Worker B', 228),
    man('Quality check', 'Worker B', 25),
  ];

  const detail = chartUtils.computeCycleDetail(steps);
  const a = detail.loops.find(l => l.operator === 'Worker A');

  assert.equal(a.ownTime, 347, '62 + 150 + 30 + 20 + 85');
  assert.equal(a.machineEnd, 450);
  assert.equal(a.waitForMachine, 103);
  assert.equal(detail.cycleTime, 450);
  assert.equal(detail.driver, 'Worker A');
});

test('a scrap crusher nobody waits for never sets the cycle', () => {
  const steps = [
    man('A load', 'Worker A', 65),
    machine('Blow molding', 320),          // 65 -> 385
    man('A rest of work', 'Worker A', 296), // A own = 361
    man('D push cart', 'Worker D', 70),
    man('D cut scrap', 'Worker D', 65),     // D is at 135
    machine('Crusher', 60),                 // 135 -> 195
    man('D bag it', 'Worker D', 120),       // D own = 255
  ];
  const detail = chartUtils.computeCycleDetail(steps);

  assert.equal(detail.loops.find(l => l.operator === 'Worker D').loop, 255);
  assert.equal(detail.cycleTime, 385);
  assert.equal(detail.driver, 'Worker A');
});

test('a late explicit start stretches the axis but not the cycle', () => {
  const steps = [
    man('a', 'Worker A', 411),
    man('b', 'Worker B', 415, 380),
    man('c', 'Worker C', 413, 413),
  ];
  assert.equal(chartUtils.computeCycleTime(steps), 415, 'the busiest person, not the axis');
  assert.equal(chartUtils.computeTotalDuration(steps), 826);
});

test('machine time typed on an operator row runs parallel to their own work', () => {
  // Worker D tends the crusher and logs its run on their own row: 414 s of
  // feeding plus a 388 s machine run that overlaps it.
  const steps = [
    { id: 'd1', no: 1, description: 'feed + crush', operator: 'Worker D',
      manualTime: 414, machineTime: 388, walkingTime: 0, idleTime: 0, startTime: 0 },
    man('other', 'Worker A', 450),
  ];
  const detail = chartUtils.computeCycleDetail(steps);
  const d = detail.loops.find(l => l.operator === 'Worker D');

  assert.equal(d.ownTime, 414, 'the machine run is not added to their own work');
  assert.equal(d.machineEnd, 388);
  assert.equal(d.loop, 414);
  assert.equal(detail.cycleTime, 450);
});

// ── segments ───────────────────────────────────────────────────────────────

test('buildSingleStepSegments pads empty space before and after the bar', () => {
  const steps = [man('a', 'Worker A', 10), man('b', 'Worker A', 20)];
  const calc = chartUtils.getCalculatedSteps(steps);
  const segs = chartUtils.buildSingleStepSegments(calc[1], 60);

  assert.deepEqual(segs.map(s => [s.type, s.start, s.duration]), [
    ['empty', 0, 10],
    ['manual', 10, 20],
    ['empty', 30, 30],
  ]);
});

test('formatSeconds switches to minutes past 60 s', () => {
  assert.equal(chartUtils.formatSeconds(45), '45s');
  assert.equal(chartUtils.formatSeconds(120), '2m');
  assert.equal(chartUtils.formatSeconds(125), '2m 5s');
});
