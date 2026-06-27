'use client';

import React, { useCallback } from 'react';
import { useChartStore } from '@/store/useChartStore';
import type { ChartStep } from '@/types';
import { ALL_WORKERS } from '@/types';

const OPERATORS: ChartStep['operator'][] = [...ALL_WORKERS, 'Auto M/C'];

const TIME_COLS = [
  { key: 'manualTime',  label: 'Manual (s)',  color: 'text-slate-200' },
  { key: 'machineTime', label: 'Machine (s)', color: 'text-blue-400' },
  { key: 'walkingTime', label: 'Walk (s)',     color: 'text-emerald-400' },
  { key: 'idleTime',    label: 'Idle (s)',     color: 'text-red-400' },
] as const;

export default function StepTable() {
  const activeFile   = useChartStore(s => s.activeFile());
  const addStep      = useChartStore(s => s.addStep);
  const updateStep   = useChartStore(s => s.updateStep);
  const deleteStep   = useChartStore(s => s.deleteStep);
  const reorderSteps = useChartStore(s => s.reorderSteps);

  if (!activeFile) return null;
  const { steps } = activeFile;

  const handleChange = useCallback(
    (id: string, field: keyof ChartStep, value: string | number) => {
      updateStep(id, { [field]: value } as Partial<ChartStep>);
    },
    [updateStep]
  );

  const moveUp   = (i: number) => { if (i > 0) reorderSteps(i, i - 1); };
  const moveDown = (i: number) => { if (i < steps.length - 1) reorderSteps(i, i + 1); };

  return (
    <div className="border border-slate-750 rounded-lg overflow-hidden shadow-sm" style={{ borderColor: '#334155' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-2.5 flex items-center justify-between">
        <h3 className="text-slate-100 font-semibold text-sm tracking-wide">OPERATION STEPS</h3>
        <button
          onClick={addStep}
          className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded transition-colors"
        >
          <span className="text-base leading-none">+</span> Add Step
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700">
              <th className="px-2 py-2 text-center w-8 text-slate-500">#</th>
              <th className="px-3 py-2 text-left min-w-[200px] text-slate-300 font-semibold">Process Description</th>
              <th className="px-2 py-2 text-center min-w-[130px] text-slate-300 font-semibold">Operator / Machine</th>
              <th className="px-2 py-2 text-center w-16 text-slate-300 font-semibold">Start Time (s)</th>
              {TIME_COLS.map(c => (
                <th key={c.key} className={`px-2 py-2 text-center w-20 font-semibold ${c.color}`}>
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2 text-center w-16 text-slate-500">Move</th>
              <th className="px-2 py-2 text-center w-12 text-slate-500">Del</th>
            </tr>
          </thead>

          <tbody>
            {steps.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-600 italic">
                  No steps yet — click &quot;Add Step&quot; to begin
                </td>
              </tr>
            )}

            {steps.map((step, i) => {
              const isMachine = step.operator === 'Auto M/C';

              return (
                <tr
                  key={step.id}
                  className="border-b border-slate-800 transition-colors"
                  style={{ background: i % 2 === 0 ? '#1a2235' : '#1e293b' }}
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
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-blue-500 focus:outline-none py-0.5 text-slate-200 transition-colors placeholder:text-slate-700"
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
                  <td className="px-2 py-1.5 w-16">
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
          {steps.length > 0 && (
            <tfoot>
              <tr className="bg-slate-900 border-t border-slate-700">
                <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold text-slate-500 text-right">TOTALS →</td>
                {TIME_COLS.map(col => (
                  <td key={col.key} className={`px-2 py-1.5 text-center font-mono font-semibold ${col.color}`}>
                    {steps.reduce((a, s) => a + s[col.key], 0)}
                  </td>
                ))}
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
