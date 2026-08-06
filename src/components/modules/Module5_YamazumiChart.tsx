'use client';

import React, { useState } from 'react';
import { useChartStore } from '@/store/useChartStore';
import { ALL_WORKERS, type OperatorType } from '@/types';
import { getCalculatedSteps, type CalculatedStep } from '@/lib/chart-utils';
import {
  computeOperatorTotals,
  computeRowStats,
  moveRowToOperator,
  rowsForOperatorByCategory,
} from '@/lib/time-study';
import { BarChart3 } from 'lucide-react';

const PERIODICAL_PATTERN = 'repeating-linear-gradient(45deg, rgba(30, 41, 59, 0.7) 0 3px, rgba(148, 163, 184, 0.45) 3px 7px)';
const CHANGEOVER_PATTERN = 'linear-gradient(90deg, rgba(30, 41, 59, 0.6) 0 1px, transparent 1px 8px), linear-gradient(0deg, rgba(30, 41, 59, 0.6) 0 1px, transparent 1px 8px)';

export default function Module5_YamazumiChart() {
  const activeFile = useChartStore(s => s.activeFile());
  const updateTimeMeasurement = useChartStore(s => s.updateTimeMeasurement);
  const updateTimeStudy = useChartStore(s => s.updateTimeStudy);

  const [localTaktTime, setLocalTaktTime] = useState<number>(
    activeFile?.timeMeasurement?.taktTime || 60
  );
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [draggingOverOperator, setDraggingOverOperator] = useState<OperatorType | null>(null);

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

  const hasTimeStudy = (activeFile.timeStudy?.rows?.length ?? 0) > 0;
  const timeStudyTotals = hasTimeStudy ? computeOperatorTotals(activeFile.timeStudy!) : [];
  const timeStudyByOperator = new Map(timeStudyTotals.map(total => [total.operator, total]));
  const hasCategorizedTime = hasTimeStudy && activeFile.timeStudy!.rows.some(row => row.category !== undefined);

  // Use Module 1 as the source of truth when it has rows. Keep the existing
  // Module 4 calculation path intact for charts that have never used Module 1.
  const activeOperators = hasTimeStudy
    ? ALL_WORKERS.filter(operator => timeStudyByOperator.has(operator))
    : ALL_WORKERS.filter(w => operatorSteps[w].length > 0);

  const handleRowDragStart = (event: React.DragEvent<HTMLDivElement>, rowId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', rowId);
    setDraggingRowId(rowId);
  };

  const handleRowDragEnd = () => {
    setDraggingRowId(null);
    setDraggingOverOperator(null);
  };

  const handleOperatorDragOver = (event: React.DragEvent<HTMLDivElement>, operator: OperatorType) => {
    if (!hasTimeStudy) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDraggingOverOperator(operator);
  };

  const handleOperatorDrop = (event: React.DragEvent<HTMLDivElement>, newOperator: OperatorType) => {
    event.preventDefault();
    setDraggingRowId(null);
    setDraggingOverOperator(null);
    if (!hasTimeStudy || !activeFile.timeStudy) return;

    const rowId = event.dataTransfer.getData('text/plain') || draggingRowId;
    if (!rowId) return;

    const row = activeFile.timeStudy.rows.find(item => item.id === rowId);
    if (!row || row.operator === newOperator) return;

    updateTimeStudy(moveRowToOperator(activeFile.timeStudy, rowId, newOperator));
  };

  const displayedOperators = hasTimeStudy && draggingRowId !== null
    ? ALL_WORKERS
    : activeOperators;

  const operatorTotals = activeOperators.map(op => {
    if (hasTimeStudy) {
      const total = timeStudyByOperator.get(op);
      return {
        op,
        total: total?.min ?? 0,
        totalMin: total?.min ?? 0,
        totalMax: total?.max ?? 0,
        totalAverage: total?.average ?? 0,
        manMin: total?.manMin ?? 0,
        walkMin: total?.walkMin ?? 0,
        idleMin: total?.idleMin ?? 0,
        periodicalMin: total?.periodicalMin ?? 0,
        changeoverMin: total?.changeoverMin ?? 0,
      };
    }

    const total = operatorSteps[op].reduce((acc, step) => acc + step.calcManual + step.calcWalk + step.calcIdle, 0);
    return {
      op,
      total,
      totalMin: total,
      totalMax: total,
      totalAverage: total,
      manMin: 0,
      walkMin: 0,
      idleMin: 0,
      periodicalMin: 0,
      changeoverMin: 0,
    };
  });

  // Find max total time for scaling the chart height
  const maxTotalTime = Math.max(
    localTaktTime,
    ...operatorTotals.map(t => hasTimeStudy
      ? t.totalMax + t.periodicalMin + t.changeoverMin
      : t.totalMax),
    0
  );

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
              {hasTimeStudy && (
                <>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm border border-slate-500"
                      style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(71, 85, 105, 0.45) 0 3px, rgba(226, 232, 240, 0.7) 3px 6px)' }}
                    ></div>
                    Max
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-violet-700 rounded-full"></div>
                    Average
                  </div>
                  {hasCategorizedTime && (
                    <>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm border border-slate-500"
                          style={{ backgroundImage: PERIODICAL_PATTERN }}
                        ></div>
                        Periodical
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm border border-slate-500"
                          style={{ backgroundImage: CHANGEOVER_PATTERN, backgroundSize: '8px 8px' }}
                        ></div>
                        Changeover
                      </div>
                    </>
                  )}
                </>
              )}
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
              {displayedOperators.map(op => {
                const hasRowsForOperator = activeOperators.includes(op);
                const isDropTarget = draggingRowId !== null && draggingOverOperator === op;

                if (hasTimeStudy && !hasRowsForOperator) {
                  return (
                    <div
                      key={op}
                      onDragOver={event => handleOperatorDragOver(event, op)}
                      onDrop={event => handleOperatorDrop(event, op)}
                      className={`relative w-24 flex flex-col items-center ${isDropTarget ? 'rounded-lg bg-blue-50/70 ring-2 ring-blue-400' : ''}`}
                    >
                      <div
                        className="w-16 relative flex items-center justify-center border-2 border-dashed border-slate-300 rounded-t-sm text-xs text-slate-400"
                        style={{ height: maxTotalTime * pxPerSec }}
                      >
                        No work yet
                      </div>
                      <div className="absolute -bottom-8 font-bold text-sm text-slate-600 whitespace-nowrap">
                        {op}
                      </div>
                    </div>
                  );
                }

                const steps = operatorSteps[op];
                const total = operatorTotals.find(t => t.op === op);
                const totalMin = total?.totalMin ?? 0;
                const totalMax = total?.totalMax ?? 0;
                const totalAverage = total?.totalAverage ?? 0;
                const periodicalMin = total?.periodicalMin ?? 0;
                const changeoverMin = total?.changeoverMin ?? 0;
                const regularRows = hasTimeStudy
                  ? rowsForOperatorByCategory(activeFile.timeStudy!, op, 'regular')
                  : [];
                const periodicalRows = hasTimeStudy
                  ? rowsForOperatorByCategory(activeFile.timeStudy!, op, 'periodical')
                  : [];
                const changeoverRows = hasTimeStudy
                  ? rowsForOperatorByCategory(activeFile.timeStudy!, op, 'changeover')
                  : [];
                return (
                  <div
                    key={op}
                    onDragOver={hasTimeStudy ? event => handleOperatorDragOver(event, op) : undefined}
                    onDrop={hasTimeStudy ? event => handleOperatorDrop(event, op) : undefined}
                    className={`relative w-24 flex flex-col items-center group ${isDropTarget ? 'rounded-lg bg-blue-50/70 ring-2 ring-blue-400' : ''}`}
                  >
                    {/* The Stacked Bar */}
                    {hasTimeStudy ? (
                      <div className="w-16 relative shadow-sm rounded-t-sm" style={{ height: maxTotalTime * pxPerSec }}>
                        <div
                          className="absolute bottom-0 left-0 right-0 flex flex-col-reverse overflow-hidden rounded-t-sm"
                          style={{ height: totalMin * pxPerSec }}
                        >
                          {regularRows.map(row => {
                            const rowMin = computeRowStats(row).min;
                            if (rowMin <= 0) return null;

                            let className = 'w-full bg-slate-800 border-b border-slate-700';
                            if (row.kind === 'walk') {
                              className = 'w-full bg-emerald-500 border-b border-emerald-600';
                            } else if (row.kind === 'idle') {
                              className = 'w-full bg-red-500 border-b border-red-600';
                            }

                            return (
                              <div
                                key={row.id}
                                data-row-id={row.id}
                                className={`${className} ${draggingRowId === row.id ? 'cursor-grabbing opacity-60' : 'cursor-grab'}`}
                                style={{ height: rowMin * pxPerSec }}
                                title={`${row.jobElement}: ${rowMin}s`}
                                draggable={hasTimeStudy}
                                onDragStart={event => handleRowDragStart(event, row.id)}
                                onDragEnd={handleRowDragEnd}
                              />
                            );
                          })}
                        </div>

                        {totalMax > totalMin && (
                          <div
                            className="absolute left-0 right-0 border border-slate-500/80"
                            style={{
                              bottom: totalMin * pxPerSec,
                              height: (totalMax - totalMin) * pxPerSec,
                              backgroundImage: 'repeating-linear-gradient(135deg, rgba(71, 85, 105, 0.35) 0 4px, rgba(226, 232, 240, 0.55) 4px 8px)',
                            }}
                            title={`Max overlay: ${totalMax}s (Min: ${totalMin}s)`}
                          />
                        )}

                        {totalAverage > 0 && (
                          <div
                            className="absolute -left-1 -right-1 z-20 h-1 bg-violet-700 rounded-full shadow-sm"
                            style={{ bottom: totalAverage * pxPerSec, transform: 'translateY(50%)' }}
                            title={`Average: ${totalAverage}s`}
                          />
                        )}

                        {periodicalMin > 0 && (
                          <div
                            className="absolute left-0 right-0 z-10 flex flex-col-reverse overflow-hidden border border-slate-700/80"
                            style={{
                              bottom: totalMax * pxPerSec,
                              height: periodicalMin * pxPerSec,
                              backgroundColor: '#334155',
                            }}
                          >
                            {periodicalRows.map(row => {
                              const rowMin = computeRowStats(row).min;
                              if (rowMin <= 0) return null;

                              return (
                                <div
                                  key={row.id}
                                  data-row-id={row.id}
                                  className={`w-full border-b border-slate-700/80 ${draggingRowId === row.id ? 'cursor-grabbing opacity-60' : 'cursor-grab'}`}
                                  style={{
                                    height: rowMin * pxPerSec,
                                    backgroundColor: '#334155',
                                    backgroundImage: PERIODICAL_PATTERN,
                                  }}
                                  title={`${row.jobElement}: ${rowMin}s`}
                                  draggable={hasTimeStudy}
                                  onDragStart={event => handleRowDragStart(event, row.id)}
                                  onDragEnd={handleRowDragEnd}
                                />
                              );
                            })}
                          </div>
                        )}

                        {changeoverMin > 0 && (
                          <div
                            className="absolute left-0 right-0 z-10 flex flex-col-reverse overflow-hidden border border-slate-700/80 rounded-t-sm"
                            style={{
                              bottom: (totalMax + periodicalMin) * pxPerSec,
                              height: changeoverMin * pxPerSec,
                            }}
                          >
                            {changeoverRows.map(row => {
                              const rowMin = computeRowStats(row).min;
                              if (rowMin <= 0) return null;

                              return (
                                <div
                                  key={row.id}
                                  data-row-id={row.id}
                                  className={`w-full border-b border-slate-700/80 ${draggingRowId === row.id ? 'cursor-grabbing opacity-60' : 'cursor-grab'}`}
                                  style={{
                                    height: rowMin * pxPerSec,
                                    backgroundColor: '#334155',
                                    backgroundImage: CHANGEOVER_PATTERN,
                                    backgroundSize: '8px 8px',
                                  }}
                                  title={`${row.jobElement}: ${rowMin}s`}
                                  draggable={hasTimeStudy}
                                  onDragStart={event => handleRowDragStart(event, row.id)}
                                  onDragEnd={handleRowDragEnd}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
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
                    )}
                    
                    {/* Total Time Label above bar */}
                    {hasTimeStudy ? (
                      <div className="absolute -top-9 text-center text-sm font-bold text-slate-700 font-mono whitespace-nowrap">
                        <div>Max {totalMax}s</div>
                        <div className="text-[10px] font-normal text-slate-500">Min {totalMin}s · Avg {totalAverage}s</div>
                      </div>
                    ) : (
                      <div className="absolute -top-6 text-sm font-bold text-slate-700 font-mono">
                        {total?.total}s
                      </div>
                    )}
                    
                    {/* Operator Label below bar */}
                    <div className="absolute -bottom-8 font-bold text-sm text-slate-600 whitespace-nowrap">
                      {op}
                    </div>
                  </div>
                );
              })}
              
              {displayedOperators.length === 0 && (
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
