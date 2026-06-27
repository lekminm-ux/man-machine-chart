'use client';

import React from 'react';
import { useChartStore } from '@/store/useChartStore';
import { getCalculatedSteps, buildSummary, getMachineTime, computeTotalDuration } from '@/lib/chart-utils';

export default function SummaryTable() {
  const activeFile = useChartStore(s => s.activeFile());

  if (!activeFile) return null;

  const { steps } = activeFile;

  // Cycle time and steps calculations
  const cycleTime   = computeTotalDuration(steps) || 1;
  const summary     = buildSummary(steps);
  const machineTime = getMachineTime(steps);
  const grandTotal  = summary.reduce((a, s) => a + s.lineTotal, 0);
  const calcSteps   = getCalculatedSteps(steps);

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden shadow-sm" style={{ borderColor: '#334155' }}>
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-2.5">
        <h3 className="text-slate-100 font-semibold text-sm tracking-wide">LINE TOTAL SUMMARY</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700">
              <th className="px-4 py-2 text-left font-semibold text-slate-350">Operator</th>
              <th className="px-4 py-2 text-center font-semibold text-slate-350">Man Time (s)</th>
              <th className="px-4 py-2 text-center font-semibold text-slate-350">Walk Time (s)</th>
              <th className="px-4 py-2 text-center font-semibold text-slate-350">Idle Time (s)</th>
              <th className="px-4 py-2 text-center font-semibold text-slate-350">Line Total (s)</th>
              <th className="px-4 py-2 text-center font-semibold text-slate-350">Utilization %</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row, i) => {
              // Sum the calculated active idle time for the operator (not the raw stop values entered by the user)
              const idleTime  = calcSteps.filter(s => s.operator === row.operator).reduce((a, s) => a + s.calcIdle, 0);
              const util      = cycleTime > 0 ? Math.min(100, Math.round((row.lineTotal / cycleTime) * 100)) : 0;
              const barColor  = util >= 80 ? 'bg-emerald-500' : util >= 50 ? 'bg-amber-500' : 'bg-red-500';

              return (
                <tr key={row.operator} className="border-b border-slate-800" style={{ background: i % 2 === 0 ? '#1a2235' : '#1e293b' }}>
                  <td className="px-4 py-2 font-medium text-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-450 inline-block" style={{ backgroundColor: '#60a5fa' }} />
                    {row.operator}
                  </td>
                  <td className="px-4 py-2 text-center font-mono text-slate-300">{row.manTime}</td>
                  <td className="px-4 py-2 text-center font-mono text-emerald-400">{row.walkTime}</td>
                  <td className="px-4 py-2 text-center font-mono text-red-400">{idleTime}</td>
                  <td className="px-4 py-2 text-center font-mono font-semibold text-slate-100">{row.lineTotal}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-850 rounded-full h-2" style={{ backgroundColor: '#0f172a' }}>
                        <div className={`h-2 rounded-full ${barColor} transition-all`} style={{ width: `${util}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-300 w-10 text-right">{util}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Machine row */}
            {machineTime > 0 && (
              <tr style={{ background: '#131e2f', borderBottom: '1px solid #1e293b' }}>
                <td className="px-4 py-2 font-medium text-blue-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  Auto M/C
                </td>
                <td className="px-4 py-2 text-center text-slate-600">—</td>
                <td className="px-4 py-2 text-center text-slate-600">—</td>
                <td className="px-4 py-2 text-center text-slate-600">—</td>
                <td className="px-4 py-2 text-center font-mono font-semibold text-blue-300">{machineTime}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-850 rounded-full h-2" style={{ backgroundColor: '#0f172a' }}>
                      <div
                        className="h-2 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(100, Math.round((machineTime / cycleTime) * 100))}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-blue-300 w-10 text-right">
                      {cycleTime > 0 ? Math.min(100, Math.round((machineTime / cycleTime) * 100)) : 0}%
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>

          {/* Grand total footer */}
          <tfoot>
            <tr className="bg-slate-900 border-t border-slate-700">
              <td className="px-4 py-2 font-bold text-sm text-slate-200">TOTAL</td>
              <td className="px-4 py-2 text-center font-mono font-bold text-slate-200">
                {summary.reduce((a, s) => a + s.manTime, 0)}
              </td>
              <td className="px-4 py-2 text-center font-mono font-bold text-slate-200">
                {summary.reduce((a, s) => a + s.walkTime, 0)}
              </td>
              {/* Grand total of calculated idle times */}
              <td className="px-4 py-2 text-center font-mono text-red-400 font-bold">
                {calcSteps.reduce((a, s) => a + s.calcIdle, 0)}
              </td>
              <td className="px-4 py-2 text-center font-mono font-bold text-slate-200">{grandTotal}</td>
              <td className="px-4 py-2 text-center text-xs text-amber-400 font-mono font-bold">
                CT: {cycleTime}s
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
