'use client';

import React, { useState } from 'react';
import { useChartStore } from '@/store/useChartStore';
import { buildSummary, getMachineTime } from '@/lib/chart-utils';

export default function SummaryTable() {
  const activeFile = useChartStore(s => s.activeFile());

  if (!activeFile) return null;

  const { steps, header } = activeFile;
  const summary     = buildSummary(steps);
  const machineTime = getMachineTime(steps);
  const grandTotal  = summary.reduce((a, s) => a + s.lineTotal, 0);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-2.5">
        <h3 className="text-white font-semibold text-sm tracking-wide">LINE TOTAL SUMMARY</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200">
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Operator</th>
              <th className="px-4 py-2 text-center font-semibold text-gray-700">Man Time (s)</th>
              <th className="px-4 py-2 text-center font-semibold text-gray-700">Walk Time (s)</th>
              <th className="px-4 py-2 text-center font-semibold text-gray-700">Idle Time (s)</th>
              <th className="px-4 py-2 text-center font-semibold text-gray-700">Line Total (s)</th>
              <th className="px-4 py-2 text-center font-semibold text-gray-700">Utilization %</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row, i) => {
              const idleTime  = steps.filter(s => s.operator === row.operator).reduce((a, s) => a + s.idleTime, 0);
              const util      = header.cycleTime > 0 ? Math.min(100, Math.round((row.lineTotal / header.cycleTime) * 100)) : 0;
              const barColor  = util >= 80 ? 'bg-green-500' : util >= 50 ? 'bg-amber-400' : 'bg-red-400';

              return (
                <tr key={row.operator} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-2 font-medium text-gray-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    {row.operator}
                  </td>
                  <td className="px-4 py-2 text-center font-mono text-gray-700">{row.manTime}</td>
                  <td className="px-4 py-2 text-center font-mono text-emerald-700">{row.walkTime}</td>
                  <td className="px-4 py-2 text-center font-mono text-red-600">{idleTime}</td>
                  <td className="px-4 py-2 text-center font-mono font-semibold text-gray-900">{row.lineTotal}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${barColor} transition-all`} style={{ width: `${util}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-10 text-right">{util}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Machine row */}
            {machineTime > 0 && (
              <tr className="bg-blue-50">
                <td className="px-4 py-2 font-medium text-blue-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                  Auto M/C
                </td>
                <td className="px-4 py-2 text-center text-gray-400">—</td>
                <td className="px-4 py-2 text-center text-gray-400">—</td>
                <td className="px-4 py-2 text-center text-gray-400">—</td>
                <td className="px-4 py-2 text-center font-mono font-semibold text-blue-800">{machineTime}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(100, Math.round((machineTime / header.cycleTime) * 100))}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-blue-700 w-10 text-right">
                      {header.cycleTime > 0 ? Math.min(100, Math.round((machineTime / header.cycleTime) * 100)) : 0}%
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>

          {/* Grand total footer */}
          <tfoot>
            <tr className="bg-slate-700 text-white">
              <td className="px-4 py-2 font-bold text-sm">TOTAL</td>
              <td className="px-4 py-2 text-center font-mono font-bold">
                {summary.reduce((a, s) => a + s.manTime, 0)}
              </td>
              <td className="px-4 py-2 text-center font-mono font-bold">
                {summary.reduce((a, s) => a + s.walkTime, 0)}
              </td>
              <td className="px-4 py-2 text-center font-mono text-red-300 font-bold">
                {steps.reduce((a, s) => a + s.idleTime, 0)}
              </td>
              <td className="px-4 py-2 text-center font-mono font-bold">{grandTotal}</td>
              <td className="px-4 py-2 text-center text-xs text-slate-300">
                CT: {header.cycleTime}s
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
