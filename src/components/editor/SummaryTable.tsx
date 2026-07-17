'use client';

import React from 'react';
import { useChartStore } from '@/store/useChartStore';
import { getCalculatedSteps, buildSummary, getMachineTime, computeCycleTime } from '@/lib/chart-utils';

export default function SummaryTable() {
  const activeFile             = useChartStore(s => s.activeFile());
  const updateOperatorPosition = useChartStore(s => s.updateOperatorPosition);

  if (!activeFile) return null;

  const { steps, header } = activeFile;

  // Cycle Time = busiest actor's total (max of Worker/Auto M/C sums)
  const cycleTime   = computeCycleTime(steps) || 1;
  const summary     = buildSummary(steps);
  const machineTime = getMachineTime(steps);
  const grandTotal  = summary.reduce((a, s) => a + s.lineTotal, 0);
  const calcSteps   = getCalculatedSteps(steps);

  const positions = header.operatorPositions || {};

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5">
        <h3 className="text-slate-700 font-bold text-sm tracking-wide">LINE TOTAL SUMMARY</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2 text-left font-bold text-slate-700">Position</th>
              <th className="px-4 py-2 text-left font-bold text-slate-700">Operator</th>
              <th className="px-4 py-2 text-center font-bold text-slate-700">Man Time (s)</th>
              <th className="px-4 py-2 text-center font-bold text-slate-700">Walk Time (s)</th>
              <th className="px-4 py-2 text-center font-bold text-slate-700">Idle Time (s)</th>
              <th className="px-4 py-2 text-center font-bold text-slate-700">Line Total (s)</th>
              <th className="px-4 py-2 text-center font-bold text-slate-700">Utilization %</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row, i) => {
              // Sum the calculated active idle time for the operator (not the raw stop values entered by the user)
              const idleTime  = calcSteps.filter(s => s.operator === row.operator).reduce((a, s) => a + s.calcIdle, 0);
              const util      = cycleTime > 0 ? Math.min(100, Math.round((row.lineTotal / cycleTime) * 100)) : 0;
              const barColor  = util >= 80 ? 'bg-emerald-500' : util >= 50 ? 'bg-amber-500' : 'bg-red-500';
              const currentPos = positions[row.operator] || '';

              return (
                <tr key={row.operator} className="border-b border-slate-200" style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  {/* Operator Position Column (Editable in Summary Table too!) */}
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={currentPos}
                      onChange={e => updateOperatorPosition(row.operator, e.target.value)}
                      placeholder="e.g. OP-1"
                      className="w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none py-0.5 text-slate-800 text-xs font-bold placeholder:text-slate-400"
                    />
                  </td>
                  <td className="px-4 py-2 font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    {row.operator}
                  </td>
                  <td className="px-4 py-2 text-center font-mono text-slate-700">{row.manTime}</td>
                  <td className="px-4 py-2 text-center font-mono text-emerald-600">{row.walkTime}</td>
                  <td className="px-4 py-2 text-center font-mono text-red-600">{idleTime}</td>
                  <td className="px-4 py-2 text-center font-mono font-bold text-slate-800">{row.lineTotal}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${barColor} transition-all`} style={{ width: `${util}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-600 w-10 text-right">{util}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Machine row */}
            {machineTime > 0 && (
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <td className="px-4 py-2 text-blue-400 font-semibold text-xs">—</td>
                <td className="px-4 py-2 font-bold text-blue-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Auto M/C
                </td>
                <td className="px-4 py-2 text-center text-slate-400">—</td>
                <td className="px-4 py-2 text-center text-slate-400">—</td>
                <td className="px-4 py-2 text-center text-slate-400">—</td>
                <td className="px-4 py-2 text-center font-mono font-bold text-blue-600">{machineTime}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(100, Math.round((machineTime / cycleTime) * 100))}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-blue-600 w-10 text-right">
                      {cycleTime > 0 ? Math.min(100, Math.round((machineTime / cycleTime) * 100)) : 0}%
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>

          {/* Grand total footer */}
          <tfoot>
            <tr className="bg-slate-100 border-t border-slate-300">
              <td colSpan={2} className="px-4 py-2 font-black text-sm text-slate-800">TOTAL</td>
              <td className="px-4 py-2 text-center font-mono font-bold text-slate-800">
                {summary.reduce((a, s) => a + s.manTime, 0)}
              </td>
              <td className="px-4 py-2 text-center font-mono font-bold text-slate-800">
                {summary.reduce((a, s) => a + s.walkTime, 0)}
              </td>
              {/* Grand total of calculated idle times */}
              <td className="px-4 py-2 text-center font-mono text-red-600 font-bold">
                {calcSteps.reduce((a, s) => a + s.calcIdle, 0)}
              </td>
              <td className="px-4 py-2 text-center font-mono font-bold text-slate-800">{grandTotal}</td>
              <td className="px-4 py-2 text-center text-xs text-amber-700 font-mono font-bold bg-amber-50 rounded">
                CT: {cycleTime}s
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
