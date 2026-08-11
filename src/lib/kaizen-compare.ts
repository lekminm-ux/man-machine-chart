// ============================================================
// Module 6 — Kaizen Before/After comparison
//
// This module deliberately contains only pure calculations. Module 6 fetches
// two immutable Revision snapshots and passes their content here; it never
// compares the still-editable active chart.
// ============================================================

import type { OperatorType, RevisionSnapshotContent } from '@/types';
import { ALL_WORKERS } from '@/types';
import { computeCycleTime, getActiveWorkers, getCalculatedSteps } from './chart-utils';
import { computeOperatorTotals } from './time-study';
import { computeCapacitySummary } from './machine-capacity';

export interface OperatorBar {
  manual: number;
  walk: number;
  idle: number;
  total: number;
}

export interface OperatorComparisonRow {
  operator: OperatorType;
  before: OperatorBar | null;
  after: OperatorBar | null;
}

export interface RevisionMetrics {
  cycleTime: number;
  workerCount: number;
  walkTimeTotal: number;
  idleTimeTotal: number;
  /** null when this revision's machineCapacity has no rows. */
  capacityPerShift: number | null;
}

export interface ComparisonResult {
  before: RevisionMetrics;
  after: RevisionMetrics;
  /** null when before.cycleTime is 0 (nothing to compare against). */
  cycleTimeReductionPercent: number | null;
  /** One row per operator that has work in either revision, in ALL_WORKERS order. */
  operatorRows: OperatorComparisonRow[];
}

/**
 * Build the one-bar-per-worker data used by the comparison chart. Module 1 is
 * the standard-time source when it contains rows, matching Module 5; older
 * charts without a time study retain the Module 4 fallback.
 */
function operatorBars(content: RevisionSnapshotContent): Partial<Record<OperatorType, OperatorBar>> {
  const hasTimeStudy = (content.timeStudy?.rows?.length ?? 0) > 0;
  const bars: Partial<Record<OperatorType, OperatorBar>> = {};

  if (hasTimeStudy) {
    for (const total of computeOperatorTotals(content.timeStudy!)) {
      if (total.operator === 'Auto M/C') continue;
      bars[total.operator] = {
        manual: total.manMin,
        walk: total.walkMin,
        idle: total.idleMin,
        total: total.manMin + total.walkMin + total.idleMin,
      };
    }
    return bars;
  }

  const calculated = getCalculatedSteps(content.steps);
  for (const worker of getActiveWorkers(content.steps)) {
    const rows = calculated.filter(step => step.operator === worker);
    const manual = rows.reduce((sum, step) => sum + step.calcManual, 0);
    const walk = rows.reduce((sum, step) => sum + step.calcWalk, 0);
    const idle = rows.reduce((sum, step) => sum + step.calcIdle, 0);
    bars[worker] = { manual, walk, idle, total: manual + walk + idle };
  }
  return bars;
}

export function computeRevisionMetrics(content: RevisionSnapshotContent): RevisionMetrics {
  const bars = operatorBars(content);
  const workerCount = Object.keys(bars).length;
  const walkTimeTotal = Object.values(bars).reduce((sum, bar) => sum + (bar?.walk ?? 0), 0);
  const idleTimeTotal = Object.values(bars).reduce((sum, bar) => sum + (bar?.idle ?? 0), 0);
  const capacityPerShift = content.machineCapacity && content.machineCapacity.rows.length > 0
    ? computeCapacitySummary(content.machineCapacity).bottleneckCapacity
    : null;

  return {
    cycleTime: computeCycleTime(content.steps),
    workerCount,
    walkTimeTotal,
    idleTimeTotal,
    capacityPerShift,
  };
}

export function buildComparison(
  before: RevisionSnapshotContent,
  after: RevisionSnapshotContent,
): ComparisonResult {
  const beforeMetrics = computeRevisionMetrics(before);
  const afterMetrics = computeRevisionMetrics(after);
  const beforeBars = operatorBars(before);
  const afterBars = operatorBars(after);
  const operators = ALL_WORKERS.filter(operator => beforeBars[operator] || afterBars[operator]);

  return {
    before: beforeMetrics,
    after: afterMetrics,
    cycleTimeReductionPercent: beforeMetrics.cycleTime > 0
      ? Math.round(((beforeMetrics.cycleTime - afterMetrics.cycleTime) / beforeMetrics.cycleTime) * 1000) / 10
      : null,
    operatorRows: operators.map(operator => ({
      operator,
      before: beforeBars[operator] ?? null,
      after: afterBars[operator] ?? null,
    })),
  };
}
