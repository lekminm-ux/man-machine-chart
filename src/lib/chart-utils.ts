import type { ChartStep, OperatorType, WorkerSummary } from '@/types';
import { ALL_WORKERS } from '@/types';

/** Collect the unique workers (excluding Auto M/C) used in the steps */
export function getActiveWorkers(steps: ChartStep[]): OperatorType[] {
  const used = new Set(steps.filter(s => s.operator !== 'Auto M/C').map(s => s.operator));
  return ALL_WORKERS.filter(w => used.has(w));
}

/** Build a summary row per worker */
export function buildSummary(steps: ChartStep[]): WorkerSummary[] {
  const workers = getActiveWorkers(steps);
  return workers.map(op => {
    const workerSteps = steps.filter(s => s.operator === op);
    const manTime  = workerSteps.reduce((a, s) => a + s.manualTime,  0);
    const walkTime = workerSteps.reduce((a, s) => a + s.walkingTime, 0);
    return { operator: op, manTime, walkTime, lineTotal: manTime + walkTime };
  });
}

/** Total machine time */
export function getMachineTime(steps: ChartStep[]): number {
  return steps.filter(s => s.operator === 'Auto M/C').reduce((a, s) => a + s.machineTime, 0);
}

/** For each operator, build a time-sorted list of timeline segments */
export interface TimeSegment {
  type: 'manual' | 'machine' | 'walk' | 'idle';
  start: number; // seconds from cycle start
  duration: number;
  label?: string;
}

/**
 * Build per-row segments. Steps are processed sequentially; each step
 * advances the time cursor by its total duration (for all operators together).
 */
export function buildTimelineSegments(
  steps: ChartStep[],
  operatorOrMachine: OperatorType | 'Machine'
): TimeSegment[] {
  let cursor = 0;
  const segments: TimeSegment[] = [];

  for (const step of steps) {
    // Duration this step occupies on the shared time axis
    const stepDur = step.manualTime + step.machineTime + step.walkingTime + step.idleTime;
    if (stepDur === 0) continue;

    if (operatorOrMachine === 'Machine') {
      // Machine row: show machine time if Auto M/C step, else idle
      if (step.operator === 'Auto M/C' && step.machineTime > 0) {
        segments.push({ type: 'machine', start: cursor, duration: step.machineTime });
      } else {
        segments.push({ type: 'idle', start: cursor, duration: stepDur });
      }
      cursor += stepDur;
      continue;
    }

    // Worker row
    if (step.operator !== operatorOrMachine) {
      // Another actor's step — this worker waits
      segments.push({ type: 'idle', start: cursor, duration: stepDur });
      cursor += stepDur;
      continue;
    }

    // This worker's own step — emit segments in order
    if (step.manualTime > 0) {
      segments.push({ type: 'manual', start: cursor, duration: step.manualTime, label: step.description });
      cursor += step.manualTime;
    }
    if (step.walkingTime > 0) {
      segments.push({ type: 'walk', start: cursor, duration: step.walkingTime, label: 'Walk' });
      cursor += step.walkingTime;
    }
    if (step.idleTime > 0) {
      segments.push({ type: 'idle', start: cursor, duration: step.idleTime, label: 'Idle' });
      cursor += step.idleTime;
    }
    if (step.machineTime > 0) {
      segments.push({ type: 'machine', start: cursor, duration: step.machineTime });
      cursor += step.machineTime;
    }
  }

  return segments;
}

/** Compute total cycle duration = sum of ALL steps (shared timeline) */
export function computeTotalDuration(steps: ChartStep[]): number {
  return steps.reduce((sum, s) => {
    return sum + s.manualTime + s.machineTime + s.walkingTime + s.idleTime;
  }, 0);
}

export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}
