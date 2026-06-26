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
 * Build per-row segments. Steps are processed sequentially per operator/machine;
 * each operator has their own timeline based on start times and durations, allowing parallel execution.
 */
export function buildTimelineSegments(
  steps: ChartStep[],
  operatorOrMachine: OperatorType | 'Machine',
  cycleTime: number
): TimeSegment[] {
  // 1. Filter steps for this operator/machine
  const actorSteps = steps.filter(s => {
    if (operatorOrMachine === 'Machine') {
      return s.operator === 'Auto M/C';
    }
    return s.operator === operatorOrMachine;
  });

  const segments: TimeSegment[] = [];
  let lastEnd = 0;

  // 2. Process each step for this actor
  for (let i = 0; i < actorSteps.length; i++) {
    const step = actorSteps[i];
    
    // Determine start time for this step
    const start = step.startTime !== undefined && step.startTime !== null ? step.startTime : lastEnd;
    
    // If there is a gap between the last end and this start, fill it with idle time
    if (start > lastEnd) {
      segments.push({ type: 'idle', start: lastEnd, duration: start - lastEnd, label: 'Idle' });
    }

    const isMachine = operatorOrMachine === 'Machine' || step.operator === 'Auto M/C';
    let currentStart = start;

    if (isMachine) {
      if (step.machineTime > 0) {
        segments.push({ type: 'machine', start: currentStart, duration: step.machineTime });
        currentStart += step.machineTime;
      }
    } else {
      if (step.manualTime > 0) {
        segments.push({ type: 'manual', start: currentStart, duration: step.manualTime, label: step.description });
        currentStart += step.manualTime;
      }
      if (step.walkingTime > 0) {
        segments.push({ type: 'walk', start: currentStart, duration: step.walkingTime, label: 'Walk' });
        currentStart += step.walkingTime;
      }
      if (step.idleTime > 0) {
        segments.push({ type: 'idle', start: currentStart, duration: step.idleTime, label: 'Idle' });
        currentStart += step.idleTime;
      }
      if (step.machineTime > 0) {
        segments.push({ type: 'machine', start: currentStart, duration: step.machineTime });
        currentStart += step.machineTime;
      }
    }

    lastEnd = currentStart;
  }

  // 3. Fill the remaining time up to total cycle time with idle
  const totalDur = Math.max(cycleTime, lastEnd);
  if (totalDur > lastEnd) {
    segments.push({ type: 'idle', start: lastEnd, duration: totalDur - lastEnd, label: 'Idle' });
  }

  return segments;
}

/** Compute total cycle duration = maximum end time across all operators/machines */
export function computeTotalDuration(steps: ChartStep[]): number {
  if (steps.length === 0) return 0;
  
  const actorEndTimes: Record<string, number> = {};
  
  for (const step of steps) {
    const actor = step.operator;
    const lastEnd = actorEndTimes[actor] || 0;
    const start = step.startTime !== undefined && step.startTime !== null ? step.startTime : lastEnd;
    const stepDur = step.manualTime + step.machineTime + step.walkingTime + step.idleTime;
    actorEndTimes[actor] = start + stepDur;
  }
  
  const endTimes = Object.values(actorEndTimes);
  return endTimes.length > 0 ? Math.max(...endTimes) : 0;
}

export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}
