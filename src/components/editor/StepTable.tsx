'use client';

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useChartStore } from '@/store/useChartStore';
import { getCalculatedSteps, buildSingleStepSegments, computeTotalDuration, computeCycleDetail } from '@/lib/chart-utils';
import { TimelineRow } from '../chart/TimelineRow';
import type { ChartStep } from '@/types';
import { ALL_WORKERS } from '@/types';

const OPERATORS: ChartStep['operator'][] = [...ALL_WORKERS, 'Auto M/C'];
const ROW_HEIGHT = 48; // Fixed height in pixels for perfect alignment

const TIME_COLS = [
  { key: 'manualTime',  label: 'Manual (s)',  color: 'text-slate-900',  calcKey: 'calcManual' },
  { key: 'machineTime', label: 'Machine (s)', color: 'text-blue-800',   calcKey: 'calcMachine' },
  { key: 'walkingTime', label: 'Walk (s)',     color: 'text-emerald-800', calcKey: 'calcWalk' },
  { key: 'idleTime',    label: 'Idle (s)',     color: 'text-red-800',    calcKey: 'calcIdle' },
] as const;

// The timeline column fills whatever width is left over after the other
// columns, so the graph stays beside the table instead of being scrolled
// out of view. These sums must mirror the <col> widths declared in the two
// colgroups below, or the estimate drifts from what's actually rendered.
const FIXED_COLS_WIDTH_EXPANDED = 40 + 64 + 64 + 48 + 250 + 128 + 96 + 80 * 5 + 80; // # Insert Move Del Description Operator Position StartTime+4xTime Count
const FIXED_COLS_WIDTH_COMPACT  = 300 + 128 + 96 + 80; // Description Operator Position Count
const START_END_COL_WIDTH = 96;
const MIN_TIMELINE_WIDTH = 480;
const MAX_TIMELINE_WIDTH = 1800;
const TIMELINE_SAFETY_MARGIN = 24;

function getWorkerBorder(operator: string) {
  if (operator === 'Worker A') return 'border-l-4 border-orange-500';
  if (operator === 'Worker B') return 'border-l-4 border-blue-500';
  if (operator === 'Worker C') return 'border-l-4 border-green-500';
  if (operator === 'Worker D') return 'border-l-4 border-purple-500';
  if (operator === 'Auto M/C') return 'border-l-4 border-slate-500';
  return 'border-l-4 border-transparent';
}

function getWorkerBgClass(operator: string) {
  if (operator === 'Worker A') return 'bg-orange-100 text-orange-900 border-orange-300 font-bold';
  if (operator === 'Worker B') return 'bg-blue-100 text-blue-900 border-blue-300 font-bold';
  if (operator === 'Worker C') return 'bg-green-100 text-green-900 border-green-300 font-bold';
  if (operator === 'Worker D') return 'bg-purple-100 text-purple-900 border-purple-300 font-bold';
  if (operator === 'Auto M/C') return 'bg-blue-50 text-blue-700 border-blue-300 font-bold';
  return 'bg-white text-slate-800 border-slate-300';
}

export default function StepTable() {
  const activeFile             = useChartStore(s => s.activeFile());
  const addStep                = useChartStore(s => s.addStep);
  const updateStep             = useChartStore(s => s.updateStep);
  const deleteStep             = useChartStore(s => s.deleteStep);
  const reorderSteps           = useChartStore(s => s.reorderSteps);
  const insertStep             = useChartStore(s => s.insertStep);
  const updateOperatorPosition = useChartStore(s => s.updateOperatorPosition);

  // Toggle state to hide/show yellow highlighted inputs
  const [hideInputs, setHideInputs] = useState(false);
  // Start → End is off by default: the same numbers already print on the
  // bar ends via TimelineRow's showTimes, so collapsing it by default
  // leaves more room for the graph.
  const [showStartEnd, setShowStartEnd] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Measure synchronously first so the graph is sized correctly on the
    // very first paint, instead of waiting on ResizeObserver's async callback.
    setContainerWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!activeFile) return null;
  const { steps, header } = activeFile;

  // Process calculated values on-the-fly
  const calcSteps = getCalculatedSteps(steps);

  const handleChange = useCallback(
    (id: string, field: keyof ChartStep, value: string | number) => {
      updateStep(id, { [field]: value } as Partial<ChartStep>);
    },
    [updateStep]
  );

  const moveUp   = (i: number) => { if (i > 0) reorderSteps(i, i - 1); };
  const moveDown = (i: number) => { if (i < steps.length - 1) reorderSteps(i, i + 1); };

  const totalCalcDuration = calcSteps.reduce((a, s) => a + s.calcDuration, 0);
  const rawDur = computeTotalDuration(steps);
  const totalDur = Math.max(rawDur, 10);
  // Cycle Time = the longest operator loop: their own work, or the wait for the
  // machine they load, whichever is longer. Never the timeline end.
  const cycleDetail = computeCycleDetail(steps);
  const cycleTime = cycleDetail.cycleTime;
  const cycleDriver = cycleDetail.loops.find(l => l.operator === cycleDetail.driver);

  // Timeline width fills whatever space is left after the visible columns.
  // Falls back to the old fixed defaults for the one frame before the
  // ResizeObserver reports a real measurement.
  const fixedColsWidth = (hideInputs ? FIXED_COLS_WIDTH_COMPACT : FIXED_COLS_WIDTH_EXPANDED)
    + (showStartEnd ? START_END_COL_WIDTH : 0);
  const timelineWidth = containerWidth === 0
    ? (hideInputs ? 1200 : 600)
    : Math.round(Math.min(
        MAX_TIMELINE_WIDTH,
        Math.max(MIN_TIMELINE_WIDTH, containerWidth - fixedColsWidth - TIMELINE_SAFETY_MARGIN)
      ));
  // table-layout:fixed only honours each <col>'s exact pixel width when the
  // <table> itself has an explicit width equal to their sum — leaving it
  // "auto" lets the browser shrink columns toward their content instead.
  const tableWidth = fixedColsWidth + timelineWidth;

  // Time ticks calculation
  const tickInterval = totalDur > 100 ? 50 : totalDur > 50 ? 20 : totalDur > 20 ? 10 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= totalDur; t += tickInterval) ticks.push(t);
  if (ticks[ticks.length - 1] < totalDur) ticks.push(totalDur);

  function tX(t: number) {
    const padding = 24;
    return padding + (t / totalDur) * (timelineWidth - (padding * 2));
  }

  // Generate connection paths between consecutive manual/walk/idle steps of each operator
  const connectionPaths: Array<{ id: string; d: string }> = [];
  const operators = Array.from(new Set(calcSteps.map(s => s.operator)));

  for (const op of operators) {
    const opRows = calcSteps
      .map((step, originalIdx) => ({ step, originalIdx }))
      .filter(item => {
        const step = item.step;
        const isMachStep = step.operator === 'Auto M/C' || step.calcMachine > 0;
        return step.operator === op && !isMachStep;
      });

    for (let k = 0; k < opRows.length - 1; k++) {
      const stepA = opRows[k].step;
      const idxA = opRows[k].originalIdx;

      const stepB = opRows[k + 1].step;
      const idxB = opRows[k + 1].originalIdx;

      const x1 = tX(stepA.calcEnd);
      const y1 = idxA * ROW_HEIGHT + ROW_HEIGHT / 2;

      const x2 = tX(stepB.calcStart);
      const y2 = idxB * ROW_HEIGHT + ROW_HEIGHT / 2;

      const midY = (y1 + y2) / 2;
      const d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;

      connectionPaths.push({
        id: `${stepA.id}-${stepB.id}`,
        d,
      });
    }
  }

  return (
    <div ref={containerRef} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* ── Table Toolbar ─────────────────────────────── */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-slate-700 font-bold text-sm tracking-wide">STANDARD WORK SHEET (STEP-BY-STEP)</h3>
          <button
            onClick={addStep}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
          >
            + Add Step
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Start → End Column Toggle Button */}
          <button
            onClick={() => setShowStartEnd(!showStartEnd)}
            className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded shadow-sm transition-colors"
          >
            {showStartEnd ? '🕐 Hide Start→End' : '🕐 Show Start→End'}
          </button>
          {/* Hide/Show Inputs Toggle Button */}
          <button
            onClick={() => setHideInputs(!hideInputs)}
            className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded shadow-sm transition-colors"
          >
            {hideInputs ? '👁️ Show Inputs' : '👁️ Hide Inputs'}
          </button>
          <button
            onClick={addStep}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
          >
            <span className="text-base leading-none">+</span> Add Step
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm table-fixed" style={{ width: tableWidth }}>
          {/* No inline whitespace inside <colgroup> — a stray text node there
              triggers a React hydration error. */}
          {hideInputs ? (
            <colgroup>
              <col className="min-w-[300px]" />{/* Process Description */}
              <col className="w-32" />{/* Operator / Machine */}
              <col className="w-24" />{/* Position */}
              <col className="w-20" />{/* Count */}
              {showStartEnd && <col className="w-24" />}{/* Start → End */}
              <col style={{ width: timelineWidth }} />{/* Timeline Visualization */}
            </colgroup>
          ) : (
            <colgroup>
              <col className="w-10" />{/* # */}
              <col className="w-16" />{/* Insert */}
              <col className="w-16" />{/* Move */}
              <col className="w-12" />{/* Del */}
              <col className="min-w-[250px]" />{/* Process Description */}
              <col className="w-32" />{/* Operator / Machine */}
              <col className="w-24" />{/* Position */}
              <col className="w-20" />{/* Start Time */}
              <col className="w-20" />{/* Manual */}
              <col className="w-20" />{/* Machine */}
              <col className="w-20" />{/* Walk */}
              <col className="w-20" />{/* Idle */}
              <col className="w-20" />{/* Count */}
              {showStartEnd && <col className="w-24" />}{/* Start → End */}
              <col style={{ width: timelineWidth }} />{/* Timeline Visualization */}
            </colgroup>
          )}
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 h-10">
              {!hideInputs && (
                <>
                  <th className="px-2 py-1 text-center text-slate-500">#</th>
                  <th className="px-2 py-1 text-center text-slate-600 font-bold">Insert</th>
                  <th className="px-2 py-1 text-center text-slate-500">Move</th>
                  <th className="px-2 py-1 text-center text-slate-500">Del</th>
                </>
              )}
              <th className="px-3 py-1 text-left text-slate-700 font-bold">Process Description</th>
              <th className="px-2 py-1 text-center text-slate-700 font-bold">Operator / Machine</th>
              <th className="px-2 py-1 text-center text-slate-700 font-bold">Position</th>
              {!hideInputs && (
                <>
                  <th className="px-2 py-1 text-center text-slate-700 font-bold">Start Time (s)</th>
                  {TIME_COLS.map(c => (
                    <th key={c.key} className={`px-2 py-1 text-center font-semibold ${c.color}`}>
                      {c.label}
                    </th>
                  ))}
                </>
              )}
              <th className="px-2 py-1 text-center text-slate-900 font-bold" title="เวลารวมของแถวนี้ — ใช้คำนวณ Cycle Time">Count (s)</th>
              {showStartEnd && (
                <th className="px-2 py-1 text-center text-slate-500 font-bold whitespace-nowrap" title="ช่วงเวลาที่ขั้นตอนนี้อยู่บนไทม์ไลน์">Start → End</th>
              )}
              {/* Timeline Header (Axis Ticks) */}
              <th className="p-0 text-center border-l border-slate-200 select-none" style={{ width: timelineWidth }}>
                <div className="h-full flex flex-col justify-end py-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1 block">Timeline Visualization</span>
                  <svg width={timelineWidth} height={20} className="block mx-auto">
                    {ticks.map(t => {
                      const x = tX(t);
                      return (
                        <g key={t}>
                          <line x1={x} y1={0} x2={x} y2={6} stroke="#cbd5e1" strokeWidth={1} />
                          <text x={x} y={16} textAnchor="middle" fontSize={8} fill="#64748b" fontFamily="monospace">
                            {t}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {calcSteps.length === 0 && (
              <tr>
                <td colSpan={hideInputs ? (showStartEnd ? 5 : 4) : (showStartEnd ? 14 : 13)} className="py-8 text-center text-slate-500 italic font-semibold">
                  No steps yet — click "Add Step" to begin
                </td>
              </tr>
            )}

            {calcSteps.map((step, i) => {
              const isMachine = step.operator === 'Auto M/C';
              const currentPos = isMachine ? 'M/C' : (header.operatorPositions?.[step.operator] || '');

              return (
                <tr
                  key={step.id}
                  className="border-b border-slate-200 transition-colors"
                  style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc', height: ROW_HEIGHT }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#ffffff' : '#f8fafc')}
                >
                  {!hideInputs && (
                    <>
                      <td className={`px-2 py-1.5 text-center text-slate-500 font-mono ${getWorkerBorder(step.operator)}`}>{step.no}</td>

                      {/* Insert Actions Above/Below */}
                      <td className="px-1 py-1.5 text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => insertStep(i, 'above')}
                            className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 font-mono text-[9px] font-bold"
                            title="Insert blank step above"
                          >+▲</button>
                          <button
                            onClick={() => insertStep(i, 'below')}
                            className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 font-mono text-[9px] font-bold"
                            title="Insert blank step below"
                          >+▼</button>
                        </div>
                      </td>

                      {/* Move buttons */}
                      <td className="px-1 py-1.5">
                        <div className="flex gap-0.5 justify-center">
                          <button
                            onClick={() => moveUp(i)}
                            disabled={i === 0}
                            className="p-0.5 text-slate-500 hover:text-slate-200 disabled:opacity-20 transition-colors"
                            title="Move up"
                          >▲</button>
                          <button
                            onClick={() => moveDown(i)}
                            disabled={i === steps.length - 1}
                            className="p-0.5 text-slate-500 hover:text-slate-200 disabled:opacity-20 transition-colors"
                            title="Move down"
                          >▼</button>
                        </div>
                      </td>

                      {/* Delete */}
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => deleteStep(step.id)}
                          className="text-red-500 hover:text-red-400 transition-colors text-sm leading-none"
                          title="Delete step"
                        >✕</button>
                      </td>
                    </>
                  )}

                  {/* Description */}
                  <td className={`px-3 py-1.5 ${hideInputs ? getWorkerBorder(step.operator) : ''}`}>
                    <input
                      type="text"
                      value={step.description}
                      onChange={e => handleChange(step.id, 'description', e.target.value)}
                      placeholder="Enter process description…"
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none py-0.5 text-slate-800 font-medium transition-colors placeholder:text-slate-400 truncate"
                    />
                  </td>

                  {/* Operator */}
                  <td className="px-2 py-1.5">
                    <select
                      value={step.operator}
                      onChange={e => handleChange(step.id, 'operator', e.target.value as ChartStep['operator'])}
                      className={`w-full text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${getWorkerBgClass(step.operator)}`}
                    >
                      {OPERATORS.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </td>

                  {/* Operator Position */}
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={currentPos}
                      disabled={isMachine}
                      onChange={e => updateOperatorPosition(step.operator, e.target.value)}
                      placeholder="e.g. OP-1"
                      className="w-full text-center border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-800 bg-white placeholder:text-slate-400 disabled:opacity-55 disabled:bg-slate-100"
                    />
                  </td>

                  {!hideInputs && (
                    <>
                      {/* Start Time */}
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min={0}
                          value={step.startTime === undefined || step.startTime === null || step.startTime === 0 ? '' : step.startTime}
                          onChange={e => handleChange(step.id, 'startTime', parseFloat(e.target.value) || 0)}
                          placeholder="Auto"
                          className="w-full text-center border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-800 bg-white placeholder:text-slate-400"
                        />
                      </td>

                      {/* Time columns */}
                      {TIME_COLS.map(col => (
                        <td key={col.key} className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            value={step[col.key] === 0 ? '' : step[col.key]}
                            onChange={e => handleChange(step.id, col.key, parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className={`w-full text-center border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono ${col.color} bg-white`}
                          />
                        </td>
                      ))}
                    </>
                  )}

                  {/* Count = the row's total time; feeds the cycle time */}
                  <td className="px-2 py-1.5 text-center">
                    <span className="font-mono text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      {step.calcDuration > 0 ? `${step.calcDuration}s` : '—'}
                    </span>
                  </td>

                  {/* Where the bar sits on the timeline */}
                  {showStartEnd && (
                    <td className="px-2 py-1.5 text-center whitespace-nowrap">
                      <span className="font-mono text-[11px] text-slate-500">
                        {step.calcDuration > 0 ? `${step.calcStart} → ${step.calcEnd}` : '—'}
                      </span>
                    </td>
                  )}

                  {/* Spanning cell: single timeline SVG for all rows (rendered on first row only) */}
                  {i === 0 && (
                    <td rowSpan={calcSteps.length} className="p-0 border-l border-slate-200 bg-slate-50 align-top select-none" style={{ width: timelineWidth }}>
                      <svg width={timelineWidth} height={calcSteps.length * ROW_HEIGHT} className="block">
                        {/* alternate row backgrounds */}
                        {calcSteps.map((_, ri) => (
                          <rect
                            key={ri}
                            x={0} y={ri * ROW_HEIGHT} width={timelineWidth} height={ROW_HEIGHT}
                            fill={ri % 2 === 0 ? 'transparent' : 'rgba(241, 245, 249, 0.5)'}
                          />
                        ))}

                        {/* grid lines */}
                        {ticks.map(t => {
                          const x = tX(t);
                          return (
                            <line
                              key={t}
                              x1={x} y1={0} x2={x} y2={calcSteps.length * ROW_HEIGHT}
                              stroke="#cbd5e1" strokeWidth={0.5} strokeDasharray="2 2"
                            />
                          );
                        })}

                        {/* Cycle time guide — the moment the next cycle can start */}
                        {cycleTime > 0 && (
                          <g>
                            <rect
                              x={tX(Math.min(cycleTime, totalDur))} y={0}
                              width={Math.max(0, timelineWidth - tX(Math.min(cycleTime, totalDur)))}
                              height={calcSteps.length * ROW_HEIGHT}
                              fill="rgba(239, 68, 68, 0.05)"
                            />
                            <line
                              x1={tX(Math.min(cycleTime, totalDur))} y1={0}
                              x2={tX(Math.min(cycleTime, totalDur))} y2={calcSteps.length * ROW_HEIGHT}
                              stroke="#ef4444" strokeWidth={2.5}
                            />
                          </g>
                        )}

                        {/* Timeline Row segments */}
                        {calcSteps.map((s, ri) => {
                          const rowY = ri * ROW_HEIGHT;
                          const segs = buildSingleStepSegments(s, totalDur);
                          return (
                            <TimelineRow
                              key={s.id}
                              segments={segs}
                              totalDuration={totalDur}
                              chartWidth={timelineWidth}
                              rowY={rowY}
                              noLabel
                              showTimes
                            />
                          );
                        })}

                        {/* Connection lines */}
                        {connectionPaths.map(path => (
                          <path
                            key={path.id}
                            d={path.d}
                            stroke="#64748b"
                            strokeWidth="1.5"
                            fill="none"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            strokeDasharray="2 2"
                          />
                        ))}
                      </svg>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>

          {/* Row total footer */}
          {calcSteps.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 h-10">
                {hideInputs ? (
                  <>
                    <td colSpan={3} className="px-3 py-1.5 text-xs font-semibold text-slate-500 text-right">TOTALS →</td>
                    {/* Count Column Total */}
                    <td className="px-2 py-1.5 text-center font-mono font-bold text-amber-700">
                      {totalCalcDuration}s
                    </td>
                    {showStartEnd && <td />}
                  </>
                ) : (
                  <>
                    <td colSpan={8} className="px-3 py-1.5 text-xs font-semibold text-slate-500 text-right">TOTALS →</td>
                    {TIME_COLS.map(col => (
                      <td key={col.key} className={`px-2 py-1.5 text-center font-mono font-semibold ${col.color}`}>
                        {/* Sum the calculated active durations instead of raw user-typed stop times */}
                        {calcSteps.reduce((a, s) => a + (s[col.calcKey] as number), 0)}
                      </td>
                    ))}
                    {/* Count Column Total */}
                    <td className="px-2 py-1.5 text-center font-mono font-bold text-amber-400">
                      {totalCalcDuration}s
                    </td>
                    {showStartEnd && <td />}
                  </>
                )}

                {/* Timeline Footer — bold cycle time measure */}
                <td className="p-0 border-l border-slate-700 bg-slate-950/80 select-none" style={{ width: timelineWidth }}>
                  <div className="h-full flex items-center py-1">
                    <svg width={timelineWidth} height={44} className="block mx-auto">
                      <defs>
                        <marker id="ct-arrow-start" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto-start-reverse">
                          <path d="M0 0 L10 5 L0 10 Z" fill="#ef4444" />
                        </marker>
                        <marker id="ct-arrow-end" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                          <path d="M0 0 L10 5 L0 10 Z" fill="#ef4444" />
                        </marker>
                      </defs>

                      {(() => {
                        const xEnd = tX(Math.min(cycleTime, totalDur));
                        const y = 28;
                        const label = cycleDetail.driver
                          ? `CYCLE TIME  ${cycleTime}s  ·  ${cycleDetail.driver}${
                              cycleDriver && cycleDriver.waitForMachine > 0
                                ? ` (งาน ${cycleDriver.ownTime}s + รอเครื่อง ${cycleDriver.waitForMachine}s)`
                                : ''
                            }`
                          : `CYCLE TIME  ${cycleTime}s`;
                        const labelW = Math.max(120, label.length * 7.4);
                        const labelX = Math.min(Math.max((tX(0) + xEnd) / 2, labelW / 2 + 2), timelineWidth - labelW / 2 - 2);
                        return (
                          <>
                            {/* end posts */}
                            <line x1={tX(0)} y1={y - 12} x2={tX(0)} y2={y + 8} stroke="#ef4444" strokeWidth={3} />
                            <line x1={xEnd} y1={y - 12} x2={xEnd} y2={y + 8} stroke="#ef4444" strokeWidth={3} />
                            {/* measure bar */}
                            <line
                              x1={tX(0)} y1={y} x2={xEnd} y2={y}
                              stroke="#ef4444" strokeWidth={4}
                              markerStart="url(#ct-arrow-start)" markerEnd="url(#ct-arrow-end)"
                            />
                            {/* label chip */}
                            <rect
                              x={labelX - labelW / 2} y={2} width={labelW} height={18} rx={9}
                              fill="#ef4444"
                            />
                            <text
                              x={labelX} y={15} textAnchor="middle"
                              fontSize={11} fill="#fff" fontWeight="800" letterSpacing="0.5"
                            >
                              {label}
                            </text>
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
