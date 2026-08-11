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
    return require(id);
  };

  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', 'require', '__filename', output)(
    cjsModule.exports, cjsModule, localRequire, filename
  );
  return cjsModule.exports;
}

const chartUtils = loadTypeScriptModule('src/lib/chart-utils.ts');
const timeStudy = loadTypeScriptModule('src/lib/time-study.ts', {
  './chart-utils': chartUtils,
});
const machineCapacity = loadTypeScriptModule('src/lib/machine-capacity.ts', {
  './time-study': timeStudy,
});
const kaizen = loadTypeScriptModule('src/lib/kaizen-compare.ts', {
  './chart-utils': chartUtils,
  './time-study': timeStudy,
  './machine-capacity': machineCapacity,
});

const header = {
  processName: 'Fixture', partNumber: '', partName: '', model: '', moldNo: '',
  cycleTime: 60, issueDate: '', revNo: 'A', preparedBy: '', approvedBy: '',
};
const layoutDiagram = { elements: [], connections: [] };

function content(overrides = {}) {
  return { header: { ...header }, steps: [], layoutDiagram, ...overrides };
}

let id = 0;
function step(operator, manualTime = 0, machineTime = 0, walkingTime = 0, idleTime = 0) {
  id += 1;
  return {
    id: `step-${id}`,
    no: id,
    description: `step ${id}`,
    operator,
    manualTime,
    machineTime,
    walkingTime,
    idleTime,
    startTime: 0,
  };
}

function studyRow(operator, kind, readings, category) {
  id += 1;
  const row = {
    id: `study-${id}`,
    seq: id,
    jobElement: `job ${id}`,
    operator,
    kind,
    readings,
  };
  return category ? { ...row, category } : row;
}

test('computeRevisionMetrics uses steps for cycle time and falls back to steps for bar totals', () => {
  const result = kaizen.computeRevisionMetrics(content({
    steps: [
      step('Worker B', 5, 0, 2, 1),
      step('Worker A', 10),
    ],
  }));

  assert.equal(result.cycleTime, 10, 'cycle time is the longest operator loop, not the sum across workers');
  assert.equal(result.workerCount, 2);
  assert.equal(result.walkTimeTotal, 2);
  assert.equal(result.idleTimeTotal, 1);
});

test('timeStudy is preferred over steps for worker count, walk, and idle totals', () => {
  const result = kaizen.computeRevisionMetrics(content({
    steps: [step('Worker A', 100)],
    timeStudy: {
      readingCount: 1,
      rows: [
        studyRow('Worker B', 'man', [5]),
        studyRow('Worker B', 'walk', [2]),
        studyRow('Worker B', 'idle', [1]),
      ],
    },
  }));

  assert.equal(result.cycleTime, 100, 'cycle time remains the chart-step metric');
  assert.equal(result.workerCount, 1);
  assert.equal(result.walkTimeTotal, 2);
  assert.equal(result.idleTimeTotal, 1);
});

test('a timeStudy with zero rows uses the same step fallback as Module 5', () => {
  const result = kaizen.computeRevisionMetrics(content({
    steps: [step('Worker A', 7, 0, 3, 2)],
    timeStudy: { readingCount: 1, rows: [] },
  }));

  assert.deepEqual(
    { workerCount: result.workerCount, walk: result.walkTimeTotal, idle: result.idleTimeTotal },
    { workerCount: 1, walk: 3, idle: 2 },
  );
});

test('capacityPerShift is null without machine rows and a number when capacity is present', () => {
  assert.equal(kaizen.computeRevisionMetrics(content()).capacityPerShift, null);
  assert.equal(
    kaizen.computeRevisionMetrics(content({
      machineCapacity: {
        shiftGrossMinutes: 540,
        breakMinutes: 80,
        requiredPerShift: 0,
        rows: [],
      },
    })).capacityPerShift,
    null,
  );

  const result = kaizen.computeRevisionMetrics(content({
    machineCapacity: {
      shiftGrossMinutes: 540,
      breakMinutes: 80,
      requiredPerShift: 0,
      rows: [{
        id: 'machine-1', no: 1, processName: 'Process', machineNo: 'M1',
        manualTime: 10, autoTime: 10, changeQty: 0, changeTime: 0,
      }],
    },
  }));
  assert.equal(result.capacityPerShift, 1380);
});

test('cycleTimeReductionPercent is null for a zero baseline and signed/rounded otherwise', () => {
  const zeroBaseline = kaizen.buildComparison(content(), content({ steps: [step('Worker A', 10)] }));
  assert.equal(zeroBaseline.cycleTimeReductionPercent, null);

  const reduction = kaizen.buildComparison(
    content({ steps: [step('Worker A', 100)] }),
    content({ steps: [step('Worker A', 80)] }),
  );
  assert.equal(reduction.cycleTimeReductionPercent, 20);

  const increase = kaizen.buildComparison(
    content({ steps: [step('Worker A', 100)] }),
    content({ steps: [step('Worker A', 120)] }),
  );
  assert.equal(increase.cycleTimeReductionPercent, -20);

  const rounded = kaizen.buildComparison(
    content({ steps: [step('Worker A', 101)] }),
    content({ steps: [step('Worker A', 89)] }),
  );
  assert.equal(rounded.cycleTimeReductionPercent, 11.9);
});

test('operatorRows preserve ALL_WORKERS order, include one-sided workers, and exclude Auto M/C', () => {
  const comparison = kaizen.buildComparison(
    content({
      timeStudy: {
        readingCount: 1,
        rows: [
          studyRow('Worker B', 'man', [9]),
          studyRow('Worker A', 'man', [5]),
          studyRow('Auto M/C', 'machine', [30]),
        ],
      },
    }),
    content({
      timeStudy: {
        readingCount: 1,
        rows: [studyRow('Worker B', 'man', [7])],
      },
    }),
  );

  assert.deepEqual(comparison.operatorRows.map(row => row.operator), ['Worker A', 'Worker B']);
  assert.ok(comparison.operatorRows.find(row => row.operator === 'Worker A').before);
  assert.equal(comparison.operatorRows.find(row => row.operator === 'Worker A').after, null);
  assert.ok(comparison.operatorRows.find(row => row.operator === 'Worker B').before);
  assert.ok(comparison.operatorRows.find(row => row.operator === 'Worker B').after);
  assert.equal(comparison.operatorRows.some(row => row.operator === 'Auto M/C'), false);
});
