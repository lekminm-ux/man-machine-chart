// ============================================================
// Module 3 — Standardized Work Combination Table (ตารางงานมาตรฐานผสม)
//
// Turns the Module 1 time sheet into a time-axis chart: for one cycle it shows
// when each operator is working, walking or waiting, and when each machine runs
// on its own — measured against Takt Time.
//
// Timing model (matches `=H11+G11+E11` in the `std.com table` sheet, where the
// start of a row is the previous row's start plus its man and walk time):
//
//   • Every operator has their own clock. A worker element starts when that
//     operator becomes free and pushes their clock forward.
//   • A machine element starts when the element right before it finishes — that
//     is the operator who loaded the part — and then runs on its own. It does
//     NOT push the operator's clock forward, because the operator walks away
//     and carries on while the machine runs. That parallelism is the whole
//     point of the chart.
//
// Blueprint edge cases (slide 7):
//   Rule 1  machine end > Takt  → cut the line at Takt and wrap it back to 0
//   Rule 2  operator cycle < Takt → show the waiting time to Takt
//   Rule 3  machines running at the same time → drawn on their own rows already
// ============================================================

import type { OperatorType, TimeStudy, TimeStudyKind } from '@/types';
import { computeRowStats, isMachineRow, round2 } from './time-study';

export interface CombinationSegment {
  start: number;
  end: number;
  /** true for the part drawn after wrapping back past Takt (Rule 1). */
  wrapped: boolean;
}

export interface CombinationRow {
  id: string;
  no: number;
  description: string;
  operator: OperatorType;
  kind: TimeStudyKind;
  start: number;
  duration: number;
  end: number;
  /** Drawing segments; more than one when the bar wraps at Takt. */
  segments: CombinationSegment[];
  /** True when this bar runs past Takt Time (Rule 1). */
  overrunsTakt: boolean;
}

export interface CombinationActor {
  operator: OperatorType;
  isMachine: boolean;
  /** Total time this actor is occupied in one cycle. */
  cycle: number;
  /** Idle time to Takt (Rule 2). 0 when the actor is at or over Takt. */
  wait: number;
  overTakt: boolean;
}

export interface CombinationResult {
  rows: CombinationRow[];
  actors: CombinationActor[];
  /** Longest actor track — the real cycle time of this station. */
  cycleTime: number;
  taktTime: number;
  /** Width of the drawn time axis. */
  axisMax: number;
}

/** Split a bar at Takt so the overrun can be drawn wrapped back to zero. */
function segmentsFor(start: number, end: number, takt: number): CombinationSegment[] {
  if (takt <= 0 || end <= takt) return [{ start, end, wrapped: false }];
  if (start >= takt) {
    return [{ start: round2(start - takt), end: round2(end - takt), wrapped: true }];
  }
  return [
    { start, end: takt, wrapped: false },
    { start: 0, end: round2(end - takt), wrapped: true },
  ];
}

/**
 * Build the combination table from the Module 1 sheet.
 * `taktTime` of 0 means "not set" — the Takt line and waiting times are then
 * left out rather than guessed.
 */
export function buildCombinationTable(study: TimeStudy, taktTime: number): CombinationResult {
  const operatorClock: Record<string, number> = {};
  let previousEnd = 0;

  const rows: CombinationRow[] = study.rows.map((row, i) => {
    const duration = computeRowStats(row).min;
    const machine = isMachineRow(row);
    const actor: OperatorType = machine ? 'Auto M/C' : row.operator;

    // A machine picks up from whatever finished immediately before it (the load
    // step); a worker picks up from their own clock.
    const start = machine ? previousEnd : (operatorClock[actor] ?? 0);
    const end = round2(start + duration);

    if (!machine) operatorClock[actor] = end;
    previousEnd = end;

    return {
      id: row.id,
      no: i + 1,
      description: row.jobElement,
      operator: actor,
      kind: machine ? 'machine' : row.kind,
      start: round2(start),
      duration,
      end,
      segments: duration > 0 ? segmentsFor(round2(start), end, taktTime) : [],
      overrunsTakt: taktTime > 0 && end > taktTime,
    };
  });

  // One track per actor. Machines are pooled under Auto M/C, matching M1 and M5.
  const byActor = new Map<OperatorType, CombinationRow[]>();
  for (const row of rows) {
    const list = byActor.get(row.operator);
    if (list) list.push(row);
    else byActor.set(row.operator, [row]);
  }

  const actors: CombinationActor[] = [...byActor.entries()].map(([operator, list]) => {
    const isMachine = operator === 'Auto M/C';
    // A worker's cycle is the sum of their own elements — a late start pushes
    // the axis out but does not make them busier.
    //
    // A machine's cycle is its END time: it cannot be unloaded before it stops,
    // and the operator who unloads it cannot begin the next cycle until then,
    // so the loading time in front of the run belongs to the cycle.
    const cycle = isMachine
      ? round2(Math.max(0, ...list.map(r => r.end)))
      : round2(list.reduce((a, r) => a + r.duration, 0));
    const wait = taktTime > 0 && cycle < taktTime ? round2(taktTime - cycle) : 0;
    return { operator, isMachine, cycle, wait, overTakt: taktTime > 0 && cycle > taktTime };
  });

  const cycleTime = round2(Math.max(0, ...actors.map(a => a.cycle)));
  const axisMax = round2(Math.max(cycleTime, taktTime, ...rows.map(r => r.end), 1));

  return { rows, actors, cycleTime, taktTime, axisMax };
}

/**
 * Nice round tick values for the time axis. The last tick is always at or past
 * `axisMax`, so the chart can scale to it and the axis ends on a round number.
 */
export function axisTicks(axisMax: number, target = 10): number[] {
  if (axisMax <= 0) return [0];
  const raw = axisMax / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= raw) ?? magnitude * 10;
  const last = Math.ceil(axisMax / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t < last - step * 0.001; t += step) ticks.push(round2(t));
  ticks.push(round2(last));
  return ticks;
}
