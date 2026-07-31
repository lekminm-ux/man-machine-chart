'use client';

import React, { useState } from 'react';
import { useChartStore } from '@/store/useChartStore';
import { ALL_WORKERS } from '@/types';
import { getCalculatedSteps, type CalculatedStep } from '@/lib/chart-utils';
import { BarChart3 } from 'lucide-react';

export default function Module5_YamazumiChart() {
  const activeFile = useChartStore(s => s.activeFile());
  const updateTimeMeasurement = useChartStore(s => s.updateTimeMeasurement);

  const [localTaktTime, setLocalTaktTime] = useState<number>(
    activeFile?.timeMeasurement?.taktTime || 60
  );

  if (!activeFile) {
    return <div className="p-8 text-center text-slate-500">Please open a file from the sidebar to use Module 5.</div>;
  }

  const handleSaveTaktTime = () => {
    updateTimeMeasurement({ taktTime: localTaktTime });
  };

  // Group steps by operator.
  // Step fields hold STOP times, not durations, so bar heights must come from
  // getCalculatedSteps — summing the raw fields double-counts every step after
  // the first and makes M5 disagree with M1 and M4.
  const operatorSteps: Record<string, CalculatedStep[]> = {};
  ALL_WORKERS.forEach(w => operatorSteps[w] = []);
  getCalculatedSteps(activeFile.steps).forEach(step => {
    if (operatorSteps[step.operator]) {
      operatorSteps[step.operator].push(step);
    }
  });

  // Filter out operators that have no tasks
  const activeOperators = ALL_WORKERS.filter(w => operatorSteps[w].length > 0);

  // Calculate operator totals
  const operatorTotals = activeOperators.map(op => {
    const total = operatorSteps[op].reduce((acc, step) => acc + step.calcManual + step.calcWalk + step.calcIdle, 0);
    return { op, total };
  });

  // Find max total time for scaling the chart height
  const maxTotalTime = Math.max(localTaktTime, ...operatorTotals.map(t => t.total), 0);

  // Chart rendering constants
  const CHART_HEIGHT = 400;
  const Y_MAX = Math.ceil((maxTotalTime + 10) / 10) * 10; // Round up to nearest 10

  const pxPerSec = CHART_HEIGHT / Y_MAX;

  return (
    <div className="flex-1 flex flex-col items-center bg-slate-50 min-h-screen p-8">
      <div className="w-full max-w-5xl space-y-6">
        <header className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Module 5: Auto-Yamazumi Chart</h1>
            <p className="text-sm text-slate-500">Workload balancing and Takt Time comparison</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded-lg px-3 py-1.5 border border-slate-200">
              <span className="text-sm font-bold text-slate-600 mr-2">Takt Time (s):</span>
              <input
                type="number"
                value={localTaktTime}
                onChange={e => setLocalTaktTime(Number(e.target.value))}
                className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleSaveTaktTime}
              className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors shadow-sm"
            >
              Update Benchmark
            </button>
          </div>
        </header>

        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative">
          <div className="flex justify-between mb-8 border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="text-blue-500" /> Operator Workload Distribution
            </h2>
            <div className="flex gap-4 text-sm font-medium">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-800 rounded-sm"></div> Manual Work</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Walking</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Idle</div>
            </div>
          </div>

          <div className="relative mt-8" style={{ height: CHART_HEIGHT + 60, paddingLeft: 40, paddingBottom: 40 }}>
            {/* Y Axis Labels */}
            {Array.from({ length: 6 }).map((_, i) => {
              const val = (Y_MAX / 5) * (5 - i);
              return (
                <div key={i} className="absolute left-0 w-full flex items-center" style={{ top: i * (CHART_HEIGHT / 5) }}>
                  <span className="text-xs text-slate-400 font-mono w-8 text-right pr-2 -translate-y-1/2">{val}</span>
                  <div className="flex-1 h-px bg-slate-100"></div>
                </div>
              );
            })}

            {/* Takt Time Benchmark Line */}
            <div 
              className="absolute left-10 right-0 z-10 flex items-center pointer-events-none" 
              style={{ bottom: localTaktTime * pxPerSec + 40 }}
            >
              <div className="flex-1 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 shadow-sm uppercase tracking-wide">
                Takt Time ({localTaktTime}s)
              </span>
            </div>

            {/* Bars Container */}
            <div className="absolute left-10 right-0 bottom-[40px] h-full flex justify-around items-end pt-10">
              {activeOperators.map(op => {
                const steps = operatorSteps[op];
                return (
                  <div key={op} className="relative w-24 flex flex-col items-center group">
                    {/* The Stacked Bar */}
                    <div className="w-16 relative flex flex-col-reverse shadow-sm rounded-t-sm overflow-hidden" style={{ height: maxTotalTime * pxPerSec }}>
                      {steps.map((step) => {
                        const hManual = step.calcManual * pxPerSec;
                        const hWalk = step.calcWalk * pxPerSec;
                        const hIdle = step.calcIdle * pxPerSec;

                        return (
                          <React.Fragment key={step.id}>
                            {hManual > 0 && (
                              <div 
                                className="w-full bg-slate-800 border-b border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer relative"
                                style={{ height: hManual }}
                                title={`${step.description} (Manual: ${step.calcManual}s)`}
                              >
                                {hManual > 15 && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white opacity-0 group-hover:opacity-100 truncate px-1">{step.calcManual}s</span>}
                              </div>
                            )}
                            {hWalk > 0 && (
                              <div 
                                className="w-full bg-emerald-500 border-b border-emerald-600 hover:bg-emerald-400 transition-colors cursor-pointer relative"
                                style={{ height: hWalk }}
                                title={`${step.description} (Walk: ${step.calcWalk}s)`}
                              ></div>
                            )}
                            {hIdle > 0 && (
                              <div 
                                className="w-full bg-red-500 border-b border-red-600 hover:bg-red-400 transition-colors cursor-pointer relative"
                                style={{ height: hIdle }}
                                title={`${step.description} (Idle: ${step.calcIdle}s)`}
                              ></div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    
                    {/* Total Time Label above bar */}
                    <div className="absolute -top-6 text-sm font-bold text-slate-700 font-mono">
                      {operatorTotals.find(t => t.op === op)?.total}s
                    </div>
                    
                    {/* Operator Label below bar */}
                    <div className="absolute -bottom-8 font-bold text-sm text-slate-600 whitespace-nowrap">
                      {op}
                    </div>
                  </div>
                );
              })}
              
              {activeOperators.length === 0 && (
                <div className="w-full h-full flex items-center justify-center text-slate-400 italic">
                  No operator tasks defined yet. Add steps in Module 4.
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
