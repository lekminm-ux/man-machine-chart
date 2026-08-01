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
 * Work out where each step sits on the timeline.
 *
 * DURATION MODEL (adopted 2026-08-01 — "กรอกเท่าไร คิดเท่านั้น"):
 * every number typed into Manual / Machine / Walk / Idle is the LENGTH of that
 * element. Nothing is ever subtracted from it.
 *
 *   Count (operator row) = manual + walk + idle
 *   Count (machine row)  = machine
 *
 * Start times chain automatically:
 *   • an operator element begins when that operator's previous element ended;
 *   • an Auto M/C element begins when the operator element ABOVE it ended,
 *     because a person has to load the machine before it can run. Two machine
 *     rows under the same load therefore start together (blueprint Rule 3).
 * A non-zero `startTime` overrides the chained start — it only moves the bar,
 * it is never subtracted from the entered times.
 *
 * Machine time typed on an operator's own row is kept as a parallel machine
 * track: it does not lengthen that person's own work.
 */
export function getCalculatedSteps(steps: ChartStep[]): CalculatedStep[] {
  const actorLastEnd: Record<string, number> = {};
  let lastOperatorEnd = 0;

  return steps.map(step => {
    const actor = step.operator;
    const isMachine = actor === 'Auto M/C';

    // The row's own length — exactly what was keyed in.
    const duration = isMachine
      ? step.machineTime
      : step.manualTime + step.walkingTime + step.idleTime;

    const chainStart = isMachine ? lastOperatorEnd : (actorLastEnd[actor] || 0);
    const start = step.startTime !== undefined && step.startTime !== null && step.startTime !== 0
      ? step.startTime
      : chainStart;

    const end = start + duration;

    if (duration > 0) {
      actorLastEnd[actor] = end;
    }
    if (!isMachine) {
      lastOperatorEnd = end;
    }

    return {
      ...step,
      calcStart: start,
      calcEnd: end,
      calcDuration: duration,
      calcManual:  isMachine ? 0 : step.manualTime,
      calcMachine: step.machineTime,
      calcWalk:    isMachine ? 0 : step.walkingTime,
      calcIdle:    isMachine ? 0 : step.idleTime,
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

/** One operator's loop: their own work plus any wait for the machine they tend. */
export interface CycleLoop {
  operator: OperatorType;
  /** Σ manual + walk + idle — the person's own busy time. */
  ownTime: number;
  /** Latest stop time of the machines this person loads. 0 if they tend none. */
  machineEnd: number;
  /** The loop length: max(ownTime, machineEnd). */
  loop: number;
  /** Time spent waiting for their machine to finish. */
  waitForMachine: number;
}

export interface CycleDetail {
  cycleTime: number;
  /** The operator whose loop sets the cycle. */
  driver: OperatorType | null;
  loops: CycleLoop[];
}

/**
 * Cycle Time = the longest OPERATOR LOOP — how long it takes a person to get
 * back to the start of their own sequence.
 *
 * For each operator:
 *
 *   loop = max( their own work time , when the machine they load stops )
 *
 * The machine term only applies to machines that person actually tends (the
 * Auto M/C rows sitting directly under their element). A machine nobody has to
 * wait for — the scrap crusher, say — never sets the line's cycle, no matter
 * how late in the chart it runs. And an operator's own time is a SUM, not an
 * end time, so entering a late explicit startTime stretches the axis without
 * inflating the cycle.
 *
 * Worked example (BYD Side Step, corrected 2026-08-01): Worker A walks 5 s,
 * unloads and inserts nuts for 65 s, then blow molding runs while Worker A cuts
 * scrap, checks, sends and prepares nuts — 361 s of their own work. The machine
 * stops at 385, so Worker A waits 24 s and restarts at 385. Worker D's crusher
 * finishes long before Worker D does, so it never enters the picture. CT = 385,
 * set by Worker A.
 */
export function computeCycleDetail(steps: ChartStep[]): CycleDetail {
  if (steps.length === 0) return { cycleTime: 0, driver: null, loops: [] };

  const ownTime: Record<string, number> = {};
  const machineEnd: Record<string, number> = {};
  let lastOperator: OperatorType | null = null;

  for (const s of getCalculatedSteps(steps)) {
    if (s.operator === 'Auto M/C') {
      // Charged to whoever loaded it; a machine with no operator above it
      // stands on its own.
      const tender = lastOperator ?? 'Auto M/C';
      machineEnd[tender] = Math.max(machineEnd[tender] ?? 0, s.calcEnd);
      continue;
    }
    // Count for an operator row = manual + walk + idle.
    ownTime[s.operator] = (ownTime[s.operator] ?? 0) + s.calcManual + s.calcWalk + s.calcIdle;
    lastOperator = s.operator;
    // Machine time typed on a person's own row runs in parallel from the same
    // start, so it is charged to them without lengthening their own work.
    if (s.machineTime > 0) {
      machineEnd[s.operator] = Math.max(machineEnd[s.operator] ?? 0, s.calcStart + s.machineTime);
    }
  }

  const operators = [...new Set([...Object.keys(ownTime), ...Object.keys(machineEnd)])] as OperatorType[];
  const loops: CycleLoop[] = operators.map(operator => {
    const own = ownTime[operator] ?? 0;
    const mEnd = machineEnd[operator] ?? 0;
    const loop = Math.max(own, mEnd);
    return { operator, ownTime: own, machineEnd: mEnd, loop, waitForMachine: Math.max(0, mEnd - own) };
  });

  let driver: OperatorType | null = null;
  let cycleTime = 0;
  for (const l of loops) {
    if (l.loop > cycleTime) {
      cycleTime = l.loop;
      driver = l.operator;
    }
  }
  return { cycleTime, driver, loops };
}

/** Cycle Time only. See computeCycleDetail for the reasoning and the breakdown. */
export function computeCycleTime(steps: ChartStep[]): number {
  return computeCycleDetail(steps).cycleTime;
}

export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}
