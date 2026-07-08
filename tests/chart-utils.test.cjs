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
  assert.equal(chartUtils.getMachineTime(steps), 25);
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

test('computeCycleTime = max per-actor total, not the timeline end', () => {
  // Mirrors the reported bug: Worker B/C start late (explicit startTime),
  // pushing the timeline end to 826s — but the cycle time must be the
  // busiest actor's total: max(411, 415, 413, 450) = 450.
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

  assert.equal(chartUtils.computeCycleTime(steps), 450);
  assert.equal(chartUtils.computeTotalDuration(steps), 826, 'timeline end stays 826 for the axis');
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
