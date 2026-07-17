'use client';

import React, { useCallback, useState } from 'react';
import { useChartStore } from '@/store/useChartStore';
import { getCalculatedSteps, buildSingleStepSegments, computeTotalDuration, computeCycleTime } from '@/lib/chart-utils';
import { TimelineRow } from '../chart/TimelineRow';
import type { ChartStep } from '@/types';
import { ALL_WORKERS } from '@/types';

const OPERATORS: ChartStep['operator'][] = [...ALL_WORKERS, 'Auto M/C'];
const ROW_HEIGHT = 48; // Fixed height in pixels for perfect alignment

const TIME_COLS = [
  { key: 'manualTime',  label: 'Manual (s)',  color: 'text-slate-700',  calcKey: 'calcManual' },
  { key: 'machineTime', label: 'Machine (s)', color: 'text-blue-600',   calcKey: 'calcMachine' },
  { key: 'walkingTime', label: 'Walk (s)',     color: 'text-emerald-600', calcKey: 'calcWalk' },
  { key: 'idleTime',    label: 'Idle (s)',     color: 'text-red-600',    calcKey: 'calcIdle' },
] as const;

function getWorkerBorder(operator: string) {
  if (operator === 'Worker A') return 'border-l-4 border-orange-500';
  if (operator === 'Worker B') return 'border-l-4 border-blue-500';
  if (operator === 'Worker C') return 'border-l-4 border-green-500';
  if (operator === 'Worker D') return 'border-l-4 border-purple-500';
  if (operator === 'Auto M/C') return 'border-l-4 border-slate-500';
  return 'border-l-4 border-transparent';
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
  // Cycle Time = busiest actor's total (max of Worker/Auto M/C sums),
  // not the timeline end — a late-starting step must not inflate it.
  const cycleTime = computeCycleTime(steps);

  // Timeline width expands to 850px when inputs are hidden (originally 500px)
  const timelineWidth = hideInputs ? 850 : 500;

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
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
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
        <table className={`w-full text-xs table-fixed ${hideInputs ? 'min-w-[1250px]' : 'min-w-[1440px]'}`}>
          {/* No inline whitespace inside <colgroup> — a stray text node there
              triggers a React hydration error. */}
          {hideInputs ? (
            <colgroup>
              <col className="min-w-[250px]" />{/* Process Description */}
              <col className="w-28" />{/* Operator / Machine */}
              <col className="w-20" />{/* Position */}
              <col className="w-16" />{/* Count */}
              <col style={{ width: timelineWidth }} />{/* Timeline Visualization */}
            </colgroup>
          ) : (
            <colgroup>
              <col className="w-8" />{/* # */}
              <col className="w-16" />{/* Insert */}
              <col className="w-14" />{/* Move */}
              <col className="w-10" />{/* Del */}
              <col className="min-w-[200px]" />{/* Process Description */}
              <col className="w-28" />{/* Operator / Machine */}
              <col className="w-20" />{/* Position */}
              <col className="w-16" />{/* Start Time */}
              <col className="w-16" />{/* Manual */}
              <col className="w-16" />{/* Machine */}
              <col className="w-16" />{/* Walk */}
              <col className="w-16" />{/* Idle */}
              <col className="w-16" />{/* Count */}
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
              <th className="px-2 py-1 text-center text-amber-400 font-semibold">Count (s)</th>
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
                <td colSpan={hideInputs ? 5 : 14} className="py-8 text-center text-slate-500 italic font-semibold">
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
                      className={`w-full text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        isMachine
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'bg-white text-slate-800 border-slate-300'
                      }`}
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

                  {/* Calculated Count (Duration) Column */}
                  <td className="px-2 py-1.5 text-center">
                    <span className="font-mono text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      {step.calcDuration > 0 ? `${step.calcDuration}s` : '—'}
                    </span>
                  </td>

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
                  </>
                )}

                {/* Timeline Footer (Red Cycle Time Arrow) */}
                <td className="p-0 border-l border-slate-700 bg-slate-950/80 select-none" style={{ width: timelineWidth }}>
                  <div className="h-full flex items-center py-1">
                    <svg width={timelineWidth} height={28} className="block mx-auto">
                      <defs>
                        <marker id="arr-s" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse">
                          <path d="M0 0 L6 3 L0 6 Z" fill="#f87171" />
                        </marker>
                        <marker id="arr-e" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                          <path d="M0 0 L6 3 L0 6 Z" fill="#f87171" />
                        </marker>
                      </defs>
                      {/* Arrow line — spans the cycle time (max per-actor total), not the timeline end */}
                      <line
                        x1={tX(0)} y1={14}
                        x2={tX(Math.min(cycleTime, totalDur))} y2={14}
                        stroke="#f87171" strokeWidth={2}
                        markerStart="url(#arr-s)" markerEnd="url(#arr-e)"
                      />
                      {/* Arrow label */}
                      <text
                        x={(tX(0) + tX(Math.min(cycleTime, totalDur))) / 2} y={9}
                        textAnchor="middle" fontSize={8} fill="#f87171" fontWeight="700"
                      >
                        Cycle Time: {cycleTime}s
                      </text>
                      {/* End caps */}
                      <line x1={tX(0)} y1={8} x2={tX(0)} y2={20} stroke="#f87171" strokeWidth={1.5} />
                      <line x1={tX(Math.min(cycleTime, totalDur))} y1={8} x2={tX(Math.min(cycleTime, totalDur))} y2={20} stroke="#f87171" strokeWidth={1.5} />
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
