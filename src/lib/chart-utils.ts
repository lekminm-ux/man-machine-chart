import type { ChartStep, OperatorType, WorkerSummary } from '@/types';
import { ALL_WORKERS } from '@/types';

export interface CalculatedStep extends ChartStep {
  calcStart: number;
  calcEnd: number;
  calcDuration: number;
  calcManual: number;
  calcMachine: number;
  calcWalk: number;
  calcIdle: number;
}

/** 
 * Calculate active start times and category durations on-the-fly.
 * In this model:
 * - Start Time is either manually entered or falls back to the previous step's end time for that operator.
 * - The entered time (Manual, Machine, Walk, Idle) represents the STOP (END) time of the step.
 * - The actual duration of the step is: (Stop Time - Start Time)
 */
export function getCalculatedSteps(steps: ChartStep[]): CalculatedStep[] {
  const actorLastEnd: Record<string, number> = {};

  return steps.map(step => {
    const actor = step.operator;
    const lastEnd = actorLastEnd[actor] || 0;

    // Start time is either explicit or sequential lastEnd
    const start = step.startTime !== undefined && step.startTime !== null && step.startTime !== 0
      ? step.startTime
      : lastEnd;

    // Stop time is the maximum of the input categories
    const stopVal = Math.max(step.manualTime, step.machineTime, step.walkingTime, step.idleTime);

    // Duration is Stop - Start
    let duration = 0;
    if (stopVal > start) {
      duration = stopVal - start;
    } else if (stopVal > 0 && start === 0) {
      duration = stopVal;
    }

    const end = start + duration;

    // Update the timeline tracking for this actor
    if (duration > 0) {
      actorLastEnd[actor] = end;
    }

    // Distribute duration back to the active category
    let calcManual = 0;
    let calcMachine = 0;
    let calcWalk = 0;
    let calcIdle = 0;

    if (step.manualTime === stopVal) calcManual = duration;
    else if (step.machineTime === stopVal) calcMachine = duration;
    else if (step.walkingTime === stopVal) calcWalk = duration;
    else if (step.idleTime === stopVal) calcIdle = duration;

    return {
      ...step,
      calcStart: start,
      calcEnd: end,
      calcDuration: duration,
      calcManual,
      calcMachine,
      calcWalk,
      calcIdle,
    };
  });
}

/** Collect the unique workers (excluding Auto M/C) used in the steps */
export function getActiveWorkers(steps: ChartStep[]): OperatorType[] {
  const used = new Set(steps.filter(s => s.operator !== 'Auto M/C').map(s => s.operator));
  return ALL_WORKERS.filter(w => used.has(w));
}

/** Build a summary row per worker */
export function buildSummary(steps: ChartStep[]): WorkerSummary[] {
  const workers = getActiveWorkers(steps);
  const calcSteps = getCalculatedSteps(steps);
  return workers.map(op => {
    const workerSteps = calcSteps.filter(s => s.operator === op);
    const manTime  = workerSteps.reduce((a, s) => a + s.calcManual,  0);
    const walkTime = workerSteps.reduce((a, s) => a + s.calcWalk, 0);
    return { operator: op, manTime, walkTime, lineTotal: manTime + walkTime };
  });
}

/** Total machine time */
export function getMachineTime(steps: ChartStep[]): number {
  const calcSteps = getCalculatedSteps(steps);
  return calcSteps.filter(s => s.operator === 'Auto M/C').reduce((a, s) => a + s.calcMachine, 0);
}

/** For each operator, build a time-sorted list of timeline segments */
export interface TimeSegment {
  type: 'manual' | 'machine' | 'walk' | 'idle' | 'empty';
  start: number; // seconds from cycle start
  duration: number;
  label?: string;
  operator?: string;
}

/** Build segments for a single step (renders empty space before and after the active step) */
export function buildSingleStepSegments(
  step: CalculatedStep,
  cycleTime: number
): TimeSegment[] {
  const segments: TimeSegment[] = [];
  const start = step.calcStart;
  const duration = step.calcDuration;

  // 1. Empty segment before the step starts
  if (start > 0) {
    segments.push({ type: 'empty', start: 0, duration: start, operator: step.operator });
  }

  // 2. Active segments for this step
  const isMachine = step.operator === 'Auto M/C' || step.calcMachine > 0;
  if (isMachine) {
    if (duration > 0) {
      segments.push({ type: 'machine', start, duration, operator: step.operator });
    }
  } else {
    if (step.calcManual > 0) {
      segments.push({ type: 'manual', start, duration, label: step.description, operator: step.operator });
    }
    if (step.calcWalk > 0) {
      segments.push({ type: 'walk', start, duration, label: 'Walk', operator: step.operator });
    }
    if (step.calcIdle > 0) {
      segments.push({ type: 'idle', start, duration, label: 'Idle', operator: step.operator });
    }
  }

  const stepEnd = start + duration;
  const totalDur = Math.max(cycleTime, stepEnd);

  // 3. Empty segment after the step ends
  if (totalDur > stepEnd) {
    segments.push({ type: 'empty', start: stepEnd, duration: totalDur - stepEnd, operator: step.operator });
  }

  return segments;
}

/**
 * Timeline extent = maximum end time across all operators/machines.
 * Used for the chart's time axis only — NOT the cycle time (a step that
 * starts late pushes the axis out, but does not lengthen anyone's cycle).
 */
export function computeTotalDuration(steps: ChartStep[]): number {
  if (steps.length === 0) return 0;
  const calcSteps = getCalculatedSteps(steps);
  const endTimes = calcSteps.map(s => s.calcEnd);
  return Math.max(...endTimes, 0);
}

/**
 * Cycle Time = the earliest moment the next cycle can start.
 *
 * Two kinds of track are compared and the longest one wins:
 *
 *   • Operator tracks — Σ (manual + walk + idle). A person's own busy time.
 *     Deliberately NOT their end time: entering steps with late explicit start
 *     times pushes the chart axis out without making anyone busier.
 *
 *   • Machine tracks — the auto-run's END time, i.e. when it was loaded plus
 *     how long it runs. A machine cannot be unloaded before it finishes, and
 *     the operator who unloads it cannot begin the next cycle until then, so
 *     the loading time in front of the run is part of the cycle.
 *
 * Worked example (BYD Side Step, corrected 2026-08-01): Worker A loads for 65 s,
 * Blow molding then runs 385 s and ends at 450. Worker A's own elements only add
 * up to 356 s and fit inside that run. The cycle is 450 s — the machine's end —
 * because Worker A cannot unload before it. Counting only the 385 s run gave the
 * wrong answer.
 */
export function computeCycleTime(steps: ChartStep[]): number {
  if (steps.length === 0) return 0;
  const operatorBusy: Record<string, number> = {};
  let machineEnd = 0;
  for (const s of getCalculatedSteps(steps)) {
    operatorBusy[s.operator] = (operatorBusy[s.operator] ?? 0) + s.calcManual + s.calcWalk + s.calcIdle;
    if (s.calcMachine > 0) machineEnd = Math.max(machineEnd, s.calcEnd);
  }
  return Math.max(0, machineEnd, ...Object.values(operatorBusy));
}

export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}
