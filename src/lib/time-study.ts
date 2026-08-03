// ============================================================
// Module 1 — Time Measurement Sheet (ตารางจับเวลา)
//
// Mirrors the paper/Excel form used on the shop floor
// (`JOB_C CAP_1` in 3 TEN SET Line SUV_Rev.01.xlsx, rows 8–45):
//
//   Min.   =MIN(C8:G8)
//   Max.   =MAX(C8:G8)
//   Aver.  =AVERAGE(C8:G8)
//   Fluc.  = Max - Min          (blank on the sheet, defined in the blueprint)
//   TOTAL  =SUM(C8:C44)-C25     ← the machine row is subtracted out
//
// The last formula is the important one: time the machine runs on its own is
// not part of the operator's workload, so machine rows never count toward the
// operator totals.
// ============================================================

import type {
  ChartStep,
  OperatorType,
  TimeStudy,
  TimeStudyKind,
  TimeStudyRow,
  TimeStudyRowStats,
} from '@/types';
import { getCalculatedSteps } from './chart-utils';

export const DEFAULT_READING_COUNT = 10;

/** Readings that have actually been measured (blank cells are ignored, like Excel). */
function measured(readings: (number | null)[]): number[] {
  return readings.filter((r): r is number => typeof r === 'number' && !Number.isNaN(r));
}

/** Round to 2 decimals — the sheet records hundredths of a second. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Min / Max / Fluctuation / Average of one job element. */
export function computeRowStats(row: TimeStudyRow): TimeStudyRowStats {
  const vals = measured(row.readings);
  if (vals.length === 0) {
    return { min: 0, max: 0, fluctuation: 0, average: 0, count: 0 };
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const average = vals.reduce((a, b) => a + b, 0) / vals.length;
  return {
    min: round2(min),
    max: round2(max),
    fluctuation: round2(max - min),
    average: round2(average),
    count: vals.length,
  };
}

export function isMachineRow(row: TimeStudyRow): boolean {
  return row.kind === 'machine' || row.operator === 'Auto M/C';
}

export interface TimeStudyTotals {
  /** Per reading column, machine rows excluded — `=SUM(C8:C44)-C25`. */
  perReading: number[];
  min: number;
  max: number;
  average: number;
  /** Machine rows only, kept separate the way the sheet highlights them. */
  machineMin: number;
  machineMax: number;
  machineAverage: number;
}

/** Column totals of the sheet. Machine rows are excluded from the operator totals. */
export function computeTotals(study: TimeStudy): TimeStudyTotals {
  const perReading = Array.from({ length: study.readingCount }, (_, i) =>
    round2(
      study.rows
        .filter(r => !isMachineRow(r))
        .reduce((sum, r) => sum + (r.readings[i] ?? 0), 0)
    )
  );

  const sumBy = (rows: TimeStudyRow[], pick: (s: TimeStudyRowStats) => number) =>
    round2(rows.reduce((sum, r) => sum + pick(computeRowStats(r)), 0));

  const workerRows = study.rows.filter(r => !isMachineRow(r));
  const machineRows = study.rows.filter(isMachineRow);

  return {
    perReading,
    min: sumBy(workerRows, s => s.min),
    max: sumBy(workerRows, s => s.max),
    average: sumBy(workerRows, s => s.average),
    machineMin: sumBy(machineRows, s => s.min),
    machineMax: sumBy(machineRows, s => s.max),
    machineAverage: sumBy(machineRows, s => s.average),
  };
}

export interface OperatorTotal {
  operator: OperatorType;
  min: number;
  max: number;
  average: number;
  rowCount: number;
  manMin: number;
  walkMin: number;
  idleMin: number;
}

/**
 * Totals per operator. Machine rows are reported under `Auto M/C` so the
 * operator columns stay comparable with the Module 5 Yamazumi bars.
 */
export function computeOperatorTotals(study: TimeStudy): OperatorTotal[] {
  const byOperator = new Map<OperatorType, TimeStudyRow[]>();
  for (const row of study.rows) {
    const key: OperatorType = isMachineRow(row) ? 'Auto M/C' : row.operator;
    const list = byOperator.get(key);
    if (list) list.push(row);
    else byOperator.set(key, [row]);
  }

  return [...byOperator.entries()].map(([operator, rows]) => {
    const stats = rows.map(computeRowStats);
    const sumStats = (pick: (row: TimeStudyRow, stats: TimeStudyRowStats) => boolean) =>
      round2(stats.reduce((sum, rowStats, index) =>
        sum + (pick(rows[index], rowStats) ? rowStats.min : 0), 0));

    return {
      operator,
      min: round2(stats.reduce((a, s) => a + s.min, 0)),
      max: round2(stats.reduce((a, s) => a + s.max, 0)),
      average: round2(stats.reduce((a, s) => a + s.average, 0)),
      rowCount: rows.length,
      manMin: sumStats(row => row.kind === 'man'),
      walkMin: sumStats(row => row.kind === 'walk'),
      idleMin: sumStats(row => row.kind === 'idle'),
    };
  });
}

/** An empty row ready for typing. */
export function makeEmptyRow(
  id: string,
  seq: number,
  readingCount: number,
  operator: OperatorType = 'Worker A'
): TimeStudyRow {
  return {
    id,
    seq,
    jobElement: '',
    operator,
    kind: 'man',
    readings: Array.from({ length: readingCount }, () => null),
  };
}

/** Grow or shrink every row so it matches the sheet's column count. */
export function resizeReadings(study: TimeStudy, readingCount: number): TimeStudy {
  return {
    readingCount,
    rows: study.rows.map(r => ({
      ...r,
      readings: Array.from({ length: readingCount }, (_, i) => r.readings[i] ?? null),
    })),
  };
}

/** Renumber Seq 1..n after an insert, delete or move. */
export function renumber(rows: TimeStudyRow[]): TimeStudyRow[] {
  return rows.map((r, i) => ({ ...r, seq: i + 1 }));
}

// ── Bridge: Module 4 step table ⇄ Module 1 sheet ────────────────────────────
//
// The two modules store time differently and mixing them up corrupts every
// downstream number:
//   • Module 4 `ChartStep` fields are STOP (clock) readings — the duration of a
//     step is stopTime − startTime.
//   • Module 1 readings are DURATIONS of a single job element.
// Both directions therefore go through `getCalculatedSteps`, the same helper the
// chart itself uses, instead of copying the raw numbers across.

function kindOfCalculatedStep(step: {
  operator: OperatorType;
  calcManual: number;
  calcMachine: number;
  calcWalk: number;
  calcIdle: number;
}): TimeStudyKind {
  if (step.operator === 'Auto M/C' || step.calcMachine > 0) return 'machine';
  if (step.calcWalk > 0) return 'walk';
  if (step.calcIdle > 0) return 'idle';
  return 'man';
}

/**
 * Seed the sheet from step data that was already typed into Module 4.
 * Each step becomes one row whose 1st reading is the step's calculated
 * duration; the remaining rounds stay blank for the user to fill in later.
 */
export function timeStudyFromSteps(
  steps: ChartStep[],
  readingCount: number = DEFAULT_READING_COUNT,
  makeId: () => string = () => Math.random().toString(36).slice(2)
): TimeStudy {
  const rows = getCalculatedSteps(steps).map((step, i) => {
    const readings: (number | null)[] = Array.from({ length: readingCount }, () => null);
    readings[0] = step.calcDuration > 0 ? round2(step.calcDuration) : null;
    return {
      id: makeId(),
      seq: i + 1,
      jobElement: step.description,
      operator: step.operator,
      kind: kindOfCalculatedStep(step),
      readings,
    };
  });
  return { readingCount, rows };
}

export type PushBasis = 'min' | 'average' | 'max';

/**
 * Turn the sheet back into Module 4 steps.
 *
 * Both modules store durations now, so the chosen reading drops straight into
 * the matching column. `startTime` is left at 0 so `getCalculatedSteps` chains
 * the rows exactly as it does for hand-typed data.
 */
export function stepsFromTimeStudy(
  study: TimeStudy,
  basis: PushBasis = 'min',
  makeId: () => string = () => Math.random().toString(36).slice(2)
): ChartStep[] {
  return study.rows.map((row, i) => {
    const stats = computeRowStats(row);
    const duration = basis === 'max' ? stats.max : basis === 'average' ? stats.average : stats.min;

    const machine = isMachineRow(row);
    const kind = machine ? 'machine' : row.kind;
    return {
      id: makeId(),
      no: i + 1,
      description: row.jobElement,
      operator: (machine ? 'Auto M/C' : row.operator) as OperatorType,
      manualTime: kind === 'man' ? duration : 0,
      machineTime: kind === 'machine' ? duration : 0,
      walkingTime: kind === 'walk' ? duration : 0,
      idleTime: kind === 'idle' ? duration : 0,
      startTime: 0,
    };
  });
}

/**
 * Parse a block copied out of Excel (tab separated columns, newline separated
 * rows) into a numeric grid. Empty cells stay `null`.
 */
export function parsePastedGrid(text: string): (number | null)[][] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line =>
      line.split('\t').map(cell => {
        const trimmed = cell.trim().replace(/,/g, '');
        if (trimmed === '') return null;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : null;
      })
    );
}
