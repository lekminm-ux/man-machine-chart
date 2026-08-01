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
      return require(id);
    },
  };

  vm.runInNewContext(output, sandbox, { filename });
  return cjsModule.exports;
}

const chartUtils = loadTypeScriptModule('src/lib/chart-utils.ts');

test('calculates sequential operator steps from stop-time inputs', () => {
  const steps = [
    {
      id: 'manual-1',
      no: 1,
      description: 'Pick part',
      operator: 'Worker A',
      manualTime: 10,
      machineTime: 0,
      walkingTime: 0,
      idleTime: 0,
      startTime: 0,
    },
    {
      id: 'walk-1',
      no: 2,
      description: 'Move to press',
      operator: 'Worker A',
      manualTime: 0,
      machineTime: 0,
      walkingTime: 18,
      idleTime: 0,
      startTime: 0,
    },
  ];

  const calculated = chartUtils.getCalculatedSteps(steps);

  assert.deepEqual(
    calculated.map((step) => ({
      id: step.id,
      calcStart: step.calcStart,
      calcEnd: step.calcEnd,
      calcDuration: step.calcDuration,
      calcManual: step.calcManual,
      calcWalk: step.calcWalk,
    })),
    [
      { id: 'manual-1', calcStart: 0, calcEnd: 10, calcDuration: 10, calcManual: 10, calcWalk: 0 },
      { id: 'walk-1', calcStart: 10, calcEnd: 18, calcDuration: 8, calcManual: 0, calcWalk: 8 },
    ],
  );
});

test('computeTotalDuration (timeline axis extent) is the maximum parallel end time', () => {
  const steps = [
    {
      id: 'worker-a',
      no: 1,
      description: 'Load fixture',
      operator: 'Worker A',
      manualTime: 12,
      machineTime: 0,
      walkingTime: 0,
      idleTime: 0,
      startTime: 0,
    },
    {
      id: 'machine',
      no: 2,
      description: 'Auto cycle',
      operator: 'Auto M/C',
      manualTime: 0,
      machineTime: 30,
      walkingTime: 0,
      idleTime: 0,
      startTime: 0,
    },
    {
      id: 'worker-b',
      no: 3,
      description: 'Inspect',
      operator: 'Worker B',
      manualTime: 0,
      machineTime: 0,
      walkingTime: 0,
      idleTime: 20,
      startTime: 15,
    },
  ];

  assert.equal(chartUtils.computeTotalDuration(steps), 30);
});

test('builds worker and machine summaries from calculated durations', () => {
  const steps = [
    {
      id: 'manual',
      no: 1,
      description: 'Pick',
      operator: 'Worker A',
      manualTime: 9,
      machineTime: 0,
      walkingTime: 0,
      idleTime: 0,
      startTime: 0,
    },
    {
      id: 'walk',
      no: 2,
      description: 'Walk',
      operator: 'Worker A',
      manualTime: 0,
      machineTime: 0,
      walkingTime: 14,
      idleTime: 0,
      startTime: 0,
    },
    {
      id: 'machine',
      no: 3,
      description: 'Auto',
      operator: 'Auto M/C',
      manualTime: 0,
      machineTime: 25,
      walkingTime: 0,
      idleTime: 0,
      startTime: 0,
    },
  ];

  assert.deepEqual(JSON.parse(JSON.stringify(chartUtils.buildSummary(steps))), [
    { operator: 'Worker A', manTime: 9, walkTime: 5, lineTotal: 14 },
  ]);
  // The machine is loaded when Worker A finishes at 14 and stops at 25, so it
  // runs for 11 s — not 25, which would assume it started before anyone loaded it.
  assert.equal(chartUtils.getMachineTime(steps), 11);
});

test('a stop reading earlier than the start yields a zero-length step', () => {
  const steps = [
    { id: 'a', no: 1, description: 'ok', operator: 'Worker A',
      manualTime: 20, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 'b', no: 2, description: 'bad input', operator: 'Worker A',
      manualTime: 5, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 0 },
  ];
  const calc = chartUtils.getCalculatedSteps(steps);
  assert.equal(calc[1].calcDuration, 0);
  assert.equal(calc[1].calcManual, 0, 'no category time is credited for invalid input');
  assert.equal(chartUtils.computeTotalDuration(steps), 20);
});

test('computeTotalDuration of an empty chart is 0', () => {
  assert.equal(chartUtils.computeTotalDuration([]), 0);
});

test('a late-starting operator stretches the axis but not the cycle', () => {
  // Worker B/C are entered with late explicit start times, pushing the timeline
  // end out to 826 s. That must not inflate the cycle: nobody got busier.
  const mk = (id, operator, dur, start) => ({
    id, no: 0, description: id, operator,
    manualTime: operator === 'Auto M/C' ? 0 : start + dur,
    machineTime: operator === 'Auto M/C' ? start + dur : 0,
    walkingTime: 0, idleTime: 0, startTime: start,
  });
  const steps = [
    mk('a', 'Worker A', 411, 0),
    mk('m', 'Auto M/C', 450, 62),
    mk('b', 'Worker B', 415, 380),
    mk('c', 'Worker C', 413, 413),
  ];

  // The machine is loaded at 62 and runs 450 s, so it stops at 512 and nobody
  // can start the next cycle before then.
  assert.equal(chartUtils.computeCycleTime(steps), 512);
  assert.equal(chartUtils.computeTotalDuration(steps), 826, 'timeline end stays 826 for the axis');
});

test('a machine starts when the operator above it finishes loading', () => {
  // Real BYD Side Step Rev.00 data. Blow molding has no explicit start time; it
  // must pick up from Worker A's unloading step, not from zero.
  const steps = [
    { id: 'u', no: 1, description: 'Work Unloading and Insert nut', operator: 'Worker A',
      manualTime: 62, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 'blow', no: 2, description: 'Blow molding', operator: 'Auto M/C',
      manualTime: 0, machineTime: 450, walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 'c', no: 3, description: 'Cutting scrap', operator: 'Worker A',
      manualTime: 213, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 63 },
    { id: 'k', no: 4, description: 'check', operator: 'Worker A',
      manualTime: 244, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 214 },
    { id: 's', no: 5, description: 'send', operator: 'Worker A',
      manualTime: 265, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 245 },
    { id: 'p', no: 6, description: 'prepare nut', operator: 'Worker A',
      manualTime: 351, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 266 },
  ];

  const calc = chartUtils.getCalculatedSteps(steps);
  assert.equal(calc[1].calcStart, 62, 'the machine starts when loading ends');
  assert.equal(calc[1].calcDuration, 388);
  assert.equal(calc[1].calcEnd, 450);

  const detail = chartUtils.computeCycleDetail(steps);
  assert.equal(detail.cycleTime, 450);
  assert.equal(detail.driver, 'Worker A');
  const a = detail.loops.find(l => l.operator === 'Worker A');
  assert.equal(a.ownTime, 347, 'Worker A is only busy for 347 s');
  assert.equal(a.machineEnd, 450);
  assert.equal(a.waitForMachine, 103, 'and waits 103 s for the machine');
});

test('a scrap crusher nobody waits for never sets the cycle', () => {
  // Worker D feeds a crusher that finishes well before Worker D does. The main
  // line is Worker A on the blow moulder, so Worker A must set the cycle.
  const steps = [
    { id: 'a1', no: 1, description: 'load', operator: 'Worker A',
      manualTime: 65, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 'blow', no: 2, description: 'Blow molding', operator: 'Auto M/C',
      manualTime: 0, machineTime: 385, walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 'a2', no: 3, description: 'rest of A', operator: 'Worker A',
      manualTime: 361, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 'd1', no: 4, description: 'push cart', operator: 'Worker D',
      manualTime: 70, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 'd2', no: 5, description: 'cut scrap', operator: 'Worker D',
      manualTime: 135, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 'cru', no: 6, description: 'Crusher', operator: 'Auto M/C',
      manualTime: 0, machineTime: 195, walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 'd3', no: 7, description: 'bag it', operator: 'Worker D',
      manualTime: 255, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 0 },
  ];

  const calc = chartUtils.getCalculatedSteps(steps);
  assert.equal(calc[5].calcStart, 135, 'the crusher follows Worker D, not the blow moulder');
  assert.equal(calc[5].calcEnd, 195);

  const detail = chartUtils.computeCycleDetail(steps);
  assert.equal(detail.driver, 'Worker A');
  assert.equal(detail.cycleTime, 385);
  assert.equal(detail.loops.find(l => l.operator === 'Worker D').loop, 255);
});

test('computeCycleTime sums multiple steps per actor and includes idle', () => {
  const steps = [
    { id: '1', no: 1, description: 'work', operator: 'Worker A',
      manualTime: 64, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: '2', no: 2, description: 'wait', operator: 'Worker A',
      manualTime: 0, machineTime: 0, walkingTime: 0, idleTime: 101, startTime: 0 },
    { id: '3', no: 3, description: 'auto', operator: 'Auto M/C',
      manualTime: 0, machineTime: 101, walkingTime: 0, idleTime: 0, startTime: 11 },
  ];
  // Worker A: 64 work + 37 idle = 101; machine: 90 → CT = 101
  assert.equal(chartUtils.computeCycleTime(steps), 101);
  assert.equal(chartUtils.computeCycleTime([]), 0);
});

test('a worker who tends a machine keeps machine time on a separate track', () => {
  // Reproduces the Rev.00 bug: the crusher runs under operator "Worker D".
  // Manual+idle fills the 450s cycle; the 388s machine run is a parallel
  // track, so Worker D contributes 450 — NOT 414+388+36 = 838.
  const steps = [
    // Worker D manual feeding until t=414
    { id: 'd1', no: 1, description: 'feed', operator: 'Worker D',
      manualTime: 414, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 0 },
    // Worker D waits for the cycle to finish (idle stop reading 450)
    { id: 'd2', no: 2, description: 'wait', operator: 'Worker D',
      manualTime: 0, machineTime: 0, walkingTime: 0, idleTime: 450, startTime: 0 },
    // The crusher auto-runs 388s, also logged under Worker D
    { id: 'd3', no: 3, description: 'crush', operator: 'Worker D',
      manualTime: 0, machineTime: 388, walkingTime: 0, idleTime: 0, startTime: 0 },
    // Another worker on a 450s cycle
    { id: 'a1', no: 4, description: 'work', operator: 'Worker A',
      manualTime: 391, machineTime: 0, walkingTime: 0, idleTime: 0, startTime: 0 },
    { id: 'a2', no: 5, description: 'wait', operator: 'Worker A',
      manualTime: 0, machineTime: 0, walkingTime: 0, idleTime: 450, startTime: 0 },
  ];
  assert.equal(chartUtils.computeCycleTime(steps), 450);
});
