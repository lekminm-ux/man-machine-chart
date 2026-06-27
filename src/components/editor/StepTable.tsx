'use client';

import React, { useCallback } from 'react';
import { useChartStore } from '@/store/useChartStore';
import { getCalculatedSteps, buildSingleStepSegments, computeTotalDuration } from '@/lib/chart-utils';
import { TimelineRow } from '../chart/TimelineRow';
import type { ChartStep } from '@/types';
import { ALL_WORKERS } from '@/types';

const OPERATORS: ChartStep['operator'][] = [...ALL_WORKERS, 'Auto M/C'];
const ROW_HEIGHT = 48; // Fixed height in pixels for perfect alignment

const TIME_COLS = [
  { key: 'manualTime',  label: 'Manual (s)',  color: 'text-slate-200',  calcKey: 'calcManual' },
  { key: 'machineTime', label: 'Machine (s)', color: 'text-blue-400',   calcKey: 'calcMachine' },
  { key: 'walkingTime', label: 'Walk (s)',     color: 'text-emerald-400', calcKey: 'calcWalk' },
  { key: 'idleTime',    label: 'Idle (s)',     color: 'text-red-400',    calcKey: 'calcIdle' },
] as const;

export default function StepTable() {
  const activeFile   = useChartStore(s => s.activeFile());
  const addStep      = useChartStore(s => s.addStep);
  const updateStep   = useChartStore(s => s.updateStep);
  const deleteStep   = useChartStore(s => s.deleteStep);
  const reorderSteps = useChartStore(s => s.reorderSteps);
  const insertStep   = useChartStore(s => s.insertStep);

  if (!activeFile) return null;
  const { steps } = activeFile;

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

  // Time ticks calculation
  const tickInterval = totalDur > 100 ? 50 : totalDur > 50 ? 20 : totalDur > 20 ? 10 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= totalDur; t += tickInterval) ticks.push(t);
  if (ticks[ticks.length - 1] < totalDur) ticks.push(totalDur);

  function tX(t: number) {
    return 4 + (t / totalDur) * 492;
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
    <div className="border border-slate-750 rounded-lg overflow-hidden shadow-sm" style={{ borderColor: '#334155' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-2.5 flex items-center justify-between">
        <h3 className="text-slate-100 font-semibold text-sm tracking-wide">OPERATION STEPS & TIMELINE</h3>
        <button
          onClick={addStep}
          className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded transition-colors"
        >
          <span className="text-base leading-none">+</span> Add Step
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs table-fixed min-w-[1360px]">
          <colgroup>
            <col className="w-8" />
            <col className="min-w-[200px]" />
            <col className="w-28" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-[500px]" />
            <col className="w-16" /> {/* Insert Above/Below col */}
            <col className="w-14" />
            <col className="w-10" />
          </colgroup>
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700 h-10">
              <th className="px-2 py-1 text-center text-slate-500">#</th>
              <th className="px-3 py-1 text-left text-slate-300 font-semibold">Process Description</th>
              <th className="px-2 py-1 text-center text-slate-300 font-semibold">Operator / Machine</th>
              <th className="px-2 py-1 text-center text-slate-300 font-semibold">Start Time (s)</th>
              {TIME_COLS.map(c => (
                <th key={c.key} className={`px-2 py-1 text-center font-semibold ${c.color}`}>
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-1 text-center text-amber-400 font-semibold">Count (s)</th>
              {/* Timeline Header (Axis Ticks) */}
              <th className="p-0 text-center border-l border-slate-700 select-none">
                <div className="h-full flex flex-col justify-end py-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 block">Timeline Visualization</span>
                  <svg width={500} height={20} className="block mx-auto">
                    {ticks.map(t => {
                      const x = tX(t);
                      return (
                        <g key={t}>
                          <line x1={x} y1={0} x2={x} y2={6} stroke="#475569" strokeWidth={1} />
                          <text x={x} y={16} textAnchor="middle" fontSize={8} fill="#64748b" fontFamily="monospace">
                            {t}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </th>
              <th className="px-2 py-1 text-center text-slate-400 font-semibold">Insert</th>
              <th className="px-2 py-1 text-center text-slate-500">Move</th>
              <th className="px-2 py-1 text-center text-slate-500">Del</th>
            </tr>
          </thead>

          <tbody>
            {calcSteps.length === 0 && (
              <tr>
                <td colSpan={13} className="py-8 text-center text-slate-600 italic">
                  No steps yet — click &quot;Add Step&quot; to begin
                </td>
              </tr>
            )}

            {calcSteps.map((step, i) => {
              const isMachine = step.operator === 'Auto M/C';

              return (
                <tr
                  key={step.id}
                  className="border-b border-slate-800 transition-colors"
                  style={{ background: i % 2 === 0 ? '#1a2235' : '#1e293b', height: ROW_HEIGHT }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#273549')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#1a2235' : '#1e293b')}
                >
                  <td className="px-2 py-1.5 text-center text-slate-500 font-mono">{step.no}</td>

                  {/* Description */}
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={step.description}
                      onChange={e => handleChange(step.id, 'description', e.target.value)}
                      placeholder="Enter process description…"
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-650 focus:border-blue-500 focus:outline-none py-0.5 text-slate-200 transition-colors placeholder:text-slate-700 truncate"
                    />
                  </td>

                  {/* Operator */}
                  <td className="px-2 py-1.5">
                    <select
                      value={step.operator}
                      onChange={e => handleChange(step.id, 'operator', e.target.value as ChartStep['operator'])}
                      className={`w-full text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        isMachine
                          ? 'bg-blue-950 text-blue-300 border-blue-800'
                          : 'bg-slate-800 text-slate-200 border-slate-700'
                      }`}
                    >
                      {OPERATORS.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </td>

                  {/* Start Time */}
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      value={step.startTime === undefined || step.startTime === null || step.startTime === 0 ? '' : step.startTime}
                      onChange={e => handleChange(step.id, 'startTime', parseFloat(e.target.value) || 0)}
                      placeholder="Auto"
                      className="w-full text-center border border-slate-700 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-200 bg-slate-900 placeholder:text-slate-600"
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
                        className={`w-full text-center border border-slate-700 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono ${col.color} bg-slate-900`}
                      />
                    </td>
                  ))}

                  {/* Calculated Count (Duration) Column */}
                  <td className="px-2 py-1.5 text-center">
                    <span className="font-mono text-amber-400 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                      {step.calcDuration > 0 ? `${step.calcDuration}s` : '—'}
                    </span>
                  </td>

                  {/* Spanning cell: single timeline SVG for all rows (rendered on first row only) */}
                  {i === 0 && (
                    <td rowSpan={calcSteps.length} className="p-0 border-l border-slate-700 bg-slate-900/60 align-top select-none" style={{ width: 500 }}>
                      <svg width={500} height={calcSteps.length * ROW_HEIGHT} className="block">
                        {/* alternate row backgrounds */}
                        {calcSteps.map((_, ri) => (
                          <rect
                            key={ri}
                            x={0} y={ri * ROW_HEIGHT} width={500} height={ROW_HEIGHT}
                            fill={ri % 2 === 0 ? 'rgba(30, 41, 59, 0.2)' : 'rgba(15, 23, 42, 0.2)'}
                          />
                        ))}

                        {/* grid lines */}
                        {ticks.map(t => {
                          const x = tX(t);
                          return (
                            <line
                              key={t}
                              x1={x} y1={0} x2={x} y2={calcSteps.length * ROW_HEIGHT}
                              stroke="#334155" strokeWidth={0.5} strokeDasharray="2 2"
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
                              chartWidth={500}
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
                </tr>
              );
            })}
          </tbody>

          {/* Row total footer */}
          {calcSteps.length > 0 && (
            <tfoot>
              <tr className="bg-slate-900 border-t border-slate-700 h-10">
                <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold text-slate-500 text-right">TOTALS →</td>
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
                {/* Timeline Footer (Red Cycle Time Arrow) */}
                <td className="p-0 border-l border-slate-700 bg-slate-950/80 select-none" style={{ width: 500 }}>
                  <div className="h-full flex items-center py-1">
                    <svg width={500} height={28} className="block mx-auto">
                      <defs>
                        <marker id="arr-s" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse">
                          <path d="M0 0 L6 3 L0 6 Z" fill="#f87171" />
                        </marker>
                        <marker id="arr-e" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                          <path d="M0 0 L6 3 L0 6 Z" fill="#f87171" />
                        </marker>
                      </defs>
                      {/* Arrow line */}
                      <line
                        x1={tX(0)} y1={14}
                        x2={tX(totalDur)} y2={14}
                        stroke="#f87171" strokeWidth={2}
                        markerStart="url(#arr-s)" markerEnd="url(#arr-e)"
                      />
                      {/* Arrow label */}
                      <text
                        x={(tX(0) + tX(totalDur)) / 2} y={9}
                        textAnchor="middle" fontSize={8} fill="#f87171" fontWeight="700"
                      >
                        Cycle Time: {totalDur}s
                      </text>
                      {/* End caps */}
                      <line x1={tX(0)} y1={8} x2={tX(0)} y2={20} stroke="#f87171" strokeWidth={1.5} />
                      <line x1={tX(totalDur)} y1={8} x2={tX(totalDur)} y2={20} stroke="#f87171" strokeWidth={1.5} />
                    </svg>
                  </div>
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
