// ============================================================
// Module 2 — Machine Capacity Sheet (ใบแสดงความสามารถของเครื่องจักร)
//
// Standard TPS production-capacity-by-process calculation (工程別能力表):
//
//              available working time per shift
//   capacity = ──────────────────────────────────────────────
//              completion time + tool-change time per unit
//
//   completion time         = manual time + auto time
//   tool-change time / unit = tool-change time ÷ units between changes
//
// The source workbook has a hard-coded `=39*8.66` in this cell which does not
// reconcile with its own Completion Time of 50.67 s, so it is not reproduced —
// the user asked for the standard formula instead (decision 2026-08-01).
//
// Shift time is entered as gross minutes minus break minutes, because the two
// differ per plant. At Summit Auto Seats the breaks are 80 min (60 lunch +
// 20 before overtime).
// ============================================================

import type {
  MachineCapacity,
  MachineCapacityRow,
  TimeStudy,
} from '@/types';
import { computeRowStats, isMachineRow, round2 } from './time-study';

/** 09:00-hour shift before breaks. Editable in the UI. */
export const DEFAULT_SHIFT_GROSS_MINUTES = 540;
/** 60 min lunch + 20 min before overtime. */
export const DEFAULT_BREAK_MINUTES = 80;

export function emptyMachineCapacity(): MachineCapacity {
  return {
    shiftGrossMinutes: DEFAULT_SHIFT_GROSS_MINUTES,
    breakMinutes: DEFAULT_BREAK_MINUTES,
    requiredPerShift: 0,
    rows: [],
  };
}

/** Working seconds available in one shift, after breaks. */
export function netShiftSeconds(mc: MachineCapacity): number {
  const minutes = Math.max(0, mc.shiftGrossMinutes - mc.breakMinutes);
  return minutes * 60;
}

export interface CapacityRowStats {
  /** manual + auto, seconds per unit */
  completionTime: number;
  /** tool-change seconds charged to each unit */
  changeTimePerUnit: number;
  /** seconds one unit really costs the machine */
  effectiveTime: number;
  /** units this process can produce in one shift */
  capacity: number;
}

export function computeCapacityRow(row: MachineCapacityRow, shiftSeconds: number): CapacityRowStats {
  const completionTime = round2(row.manualTime + row.autoTime);
  const changeTimePerUnit = row.changeQty > 0 ? round2(row.changeTime / row.changeQty) : 0;
  const effectiveTime = round2(completionTime + changeTimePerUnit);
  const capacity = effectiveTime > 0 ? round2(shiftSeconds / effectiveTime) : 0;
  return { completionTime, changeTimePerUnit, effectiveTime, capacity };
}

export interface CapacitySummary {
  shiftSeconds: number;
  /** Lowest capacity across processes — the line's real output. */
  bottleneckCapacity: number;
  bottleneckRowId: string | null;
  /** Seconds per unit the customer demand implies. 0 when demand is unset. */
  taktTime: number;
  /** Demand ÷ bottleneck capacity, as a percentage. 0 when demand is unset. */
  loadPercent: number;
  /** True when the line cannot meet demand. */
  shortfall: boolean;
}

export function computeCapacitySummary(mc: MachineCapacity): CapacitySummary {
  const shiftSeconds = netShiftSeconds(mc);
  const active = mc.rows.filter(r => r.manualTime + r.autoTime > 0);

  let bottleneckCapacity = 0;
  let bottleneckRowId: string | null = null;
  for (const row of active) {
    const { capacity } = computeCapacityRow(row, shiftSeconds);
    if (bottleneckRowId === null || capacity < bottleneckCapacity) {
      bottleneckCapacity = capacity;
      bottleneckRowId = row.id;
    }
  }

  const taktTime = mc.requiredPerShift > 0 ? round2(shiftSeconds / mc.requiredPerShift) : 0;
  const loadPercent =
    mc.requiredPerShift > 0 && bottleneckCapacity > 0
      ? round2((mc.requiredPerShift / bottleneckCapacity) * 100)
      : 0;

  return {
    shiftSeconds,
    bottleneckCapacity,
    bottleneckRowId,
    taktTime,
    loadPercent,
    shortfall: mc.requiredPerShift > 0 && bottleneckCapacity > 0 && bottleneckCapacity < mc.requiredPerShift,
  };
}

export function makeEmptyCapacityRow(id: string, no: number): MachineCapacityRow {
  return {
    id,
    no,
    processName: '',
    machineNo: '',
    manualTime: 0,
    autoTime: 0,
    changeQty: 0,
    changeTime: 0,
  };
}

export function renumberCapacityRows(rows: MachineCapacityRow[]): MachineCapacityRow[] {
  return rows.map((r, i) => ({ ...r, no: i + 1 }));
}

/**
 * Seed the sheet from Module 1: every machine row there becomes one process,
 * with its Min reading as the auto time. Manual time is left at 0 because the
 * time sheet does not record which operator element belongs to which machine —
 * the user fills that in.
 */
export function machineCapacityFromTimeStudy(
  study: TimeStudy,
  base: MachineCapacity,
  makeId: () => string = () => Math.random().toString(36).slice(2)
): MachineCapacity {
  const rows = study.rows
    .filter(isMachineRow)
    .map((row, i) => ({
      id: makeId(),
      no: i + 1,
      processName: row.jobElement,
      machineNo: '',
      manualTime: 0,
      autoTime: computeRowStats(row).min,
      changeQty: 0,
      changeTime: 0,
    }));
  return { ...base, rows };
}
