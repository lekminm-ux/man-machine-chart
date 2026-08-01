'use client';

import React, { useEffect, useState } from 'react';
import { useChartStore } from '@/store/useChartStore';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import HeaderForm from '@/components/editor/HeaderForm';
import StepTable from '@/components/editor/StepTable';
import SummaryTable from '@/components/editor/SummaryTable';
import LayoutDiagram from '@/components/layout-diagram/LayoutDiagram';
import Module1_TimeMeasurement from '@/components/modules/Module1_TimeMeasurement';
import Module2_MachineCapacity from '@/components/modules/Module2_MachineCapacity';
import Module5_YamazumiChart from '@/components/modules/Module5_YamazumiChart';

export default function EditorPage() {
  const hydrate      = useChartStore(s => s.hydrate);
  const hydrated     = useChartStore(s => s.hydrated);
  const activeFile   = useChartStore(s => s.activeFile());
  const activeModule = useChartStore(s => s.activeModule);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    hydrate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-600 font-semibold text-sm">กำลังโหลดระบบ…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 text-slate-800">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (can be collapsed to save space) */}
        {!sidebarCollapsed && <Sidebar />}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-slate-100">
          {!activeFile ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
              <div className="text-6xl opacity-40">📊</div>
              <h2 className="text-xl font-semibold text-slate-600">No Project Selected</h2>
              <p className="text-sm text-slate-500">Open an existing project or create a new one from the sidebar.</p>
            </div>
          ) : (
            <div id="chart-export-region" className="p-6 space-y-6 w-full mx-auto max-w-[1920px]">

              {/* ── Document header ────────────────────────────────── */}
              <div className="rounded-xl shadow-md border border-slate-200 overflow-hidden bg-white">
                {/* Title strip */}
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Collapsible Sidebar Button */}
                    <button
                      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                      className="p-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 hover:text-slate-900 rounded transition-colors mr-1 cursor-pointer select-none text-xs font-semibold shadow-sm"
                      title={sidebarCollapsed ? "Expand Project Files" : "Collapse Project Files"}
                    >
                      {sidebarCollapsed ? '📂 FILES' : '📁 HIDE'}
                    </button>
                    <div>
                      <h1 className="text-slate-800 font-black text-lg tracking-tight leading-none">
                        {activeModule === 1 && 'MODULE 1: DIGITAL TIME MEASUREMENT'}
                        {activeModule === 2 && 'MODULE 2: MACHINE CAPACITY ENGINE'}
                        {activeModule === 3 && 'MODULE 3: DYNAMIC COMBINATION TABLE'}
                        {activeModule === 4 && 'MODULE 4: STANDARDIZED WORK CHART'}
                        {activeModule === 5 && 'MODULE 5: AUTO-YAMAZUMI CHART'}
                      </h1>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-700 text-xs font-bold">Rev. {activeFile.header.revNo}</p>
                    <p className="text-slate-500 text-[10px] mt-0.5 font-medium">{activeFile.header.issueDate}</p>
                  </div>
                </div>

                {/* Header form */}
                <div className="p-4">
                  <HeaderForm />
                </div>
              </div>

              {activeModule === 4 && (
                <>
                  {/* ── Step Table & Integrated Timeline ────────────────── */}
                  <StepTable />

                  {/* ── Layout Diagram (Full Width) ──── */}
                  <div className="w-full">
                    <LayoutDiagram />
                  </div>

                  {/* ── Line Total Summary ──── */}
                  <div className="w-full">
                    <SummaryTable />
                  </div>
                </>
              )}

              {activeModule === 1 && <Module1_TimeMeasurement />}
              {activeModule === 2 && <Module2_MachineCapacity />}
              {activeModule === 5 && <Module5_YamazumiChart />}

              {activeModule === 3 && (
                <div className="w-full h-64 bg-white rounded-xl shadow-sm border border-dashed border-slate-300 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-4xl block mb-2 opacity-50">🚧</span>
                    <h3 className="text-slate-700 font-bold">Module {activeModule}</h3>
                    <p className="text-slate-500 text-sm mt-1">This module is part of upcoming sprints.</p>
                  </div>
                </div>
              )}

              {/* ── Approval section ───────────────────────────────── */}
              <div className="rounded-xl shadow-md border border-slate-200 p-4 bg-white">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Prepared By', value: activeFile.header.preparedBy },
                    { label: 'Approved By', value: activeFile.header.approvedBy },
                    { label: 'Date', value: activeFile.header.issueDate },
                  ].map(item => (
                    <div key={item.label} className="text-center">
                      <div className="h-10 border-b border-slate-300 mb-1" />
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{item.label}</p>
                      <p className="text-sm text-slate-800 font-semibold mt-0.5">{item.value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
