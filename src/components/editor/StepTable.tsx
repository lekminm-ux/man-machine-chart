'use client';

import React, { useCallback } from 'react';
import { useChartStore } from '@/store/useChartStore';
import type { ChartStep } from '@/types';
import { ALL_WORKERS } from '@/types';

const OPERATORS: ChartStep['operator'][] = [...ALL_WORKERS, 'Auto M/C'];

const TIME_COLS = [
  { key: 'manualTime',  label: 'Manual (s)', color: 'text-gray-800' },
  { key: 'machineTime', label: 'Machine (s)', color: 'text-blue-700' },
  { key: 'walkingTime', label: 'Walk (s)',    color: 'text-emerald-700' },
  { key: 'idleTime',    label: 'Idle (s)',    color: 'text-red-600' },
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
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-2.5 flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm tracking-wide">OPERATION STEPS</h3>
        <button
          onClick={addStep}
          className="flex items-center gap-1.5 px-3 py-1 bg-blue-500 hover:bg-blue-400 text-white text-xs font-semibold rounded transition-colors"
        >
          <span className="text-base leading-none">+</span> Add Step
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200">
              <th className="px-2 py-2 text-center w-8 text-gray-500">#</th>
              <th className="px-3 py-2 text-left min-w-[200px] text-gray-700 font-semibold">Process Description</th>
              <th className="px-2 py-2 text-center min-w-[120px] text-gray-700 font-semibold">Operator / Machine</th>
              <th className="px-2 py-2 text-center w-16 text-gray-700 font-semibold">Start Time (s)</th>
              {TIME_COLS.map(c => (
                <th key={c.key} className={`px-2 py-2 text-center w-20 font-semibold ${c.color}`}>
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2 text-center w-16 text-gray-500">Move</th>
              <th className="px-2 py-2 text-center w-12 text-gray-500">Del</th>
            </tr>
          </thead>

          <tbody>
            {steps.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-gray-400 italic">
                  No steps yet — click "Add Step" to begin
                </td>
              </tr>
            )}

            {steps.map((step, i) => {
              const rowTotal = step.manualTime + step.machineTime + step.walkingTime + step.idleTime;
              const isMachine = step.operator === 'Auto M/C';

              return (
                <tr
                  key={step.id}
                  className={`border-b border-gray-100 transition-colors ${
                    i % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                  } hover:bg-blue-50`}
                >
                  <td className="px-2 py-1.5 text-center text-gray-400 font-mono">{step.no}</td>

                  {/* Description */}
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={step.description}
                      onChange={e => handleChange(step.id, 'description', e.target.value)}
                      placeholder="Enter process description…"
                      className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none py-0.5 text-gray-800 transition-colors placeholder:text-gray-300"
                    />
                  </td>

                  {/* Operator */}
                  <td className="px-2 py-1.5">
                    <select
                      value={step.operator}
                      onChange={e => handleChange(step.id, 'operator', e.target.value as ChartStep['operator'])}
                      className={`w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                        isMachine ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-800'
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
                      className="w-full text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-gray-700 bg-white"
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
                        className={`w-full text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono ${col.color} bg-white`}
                      />
                    </td>
                  ))}

                  {/* Move buttons */}
                  <td className="px-1 py-1.5">
                    <div className="flex gap-0.5 justify-center">
                      <button
                        onClick={() => moveUp(i)}
                        disabled={i === 0}
                        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors"
                        title="Move up"
                      >▲</button>
                      <button
                        onClick={() => moveDown(i)}
                        disabled={i === steps.length - 1}
                        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors"
                        title="Move down"
                      >▼</button>
                    </div>
                  </td>

                  {/* Delete */}
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => deleteStep(step.id)}
                      className="text-red-400 hover:text-red-600 transition-colors text-sm leading-none"
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
              <tr className="bg-slate-100 border-t border-gray-300">
                <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold text-gray-600 text-right">TOTALS →</td>
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
