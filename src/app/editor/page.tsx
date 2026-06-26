'use client';

import React, { useEffect } from 'react';
import { useChartStore } from '@/store/useChartStore';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import HeaderForm from '@/components/editor/HeaderForm';
import StepTable from '@/components/editor/StepTable';
import SummaryTable from '@/components/editor/SummaryTable';
import ManMachineChart from '@/components/chart/ManMachineChart';
import LayoutDiagram from '@/components/layout-diagram/LayoutDiagram';

export default function EditorPage() {
  const hydrate      = useChartStore(s => s.hydrate);
  const hydrated     = useChartStore(s => s.hydrated);
  const activeFile   = useChartStore(s => s.activeFile());

  useEffect(() => {
    hydrate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-300 text-sm">Loading Man-Machine Chart…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {!activeFile ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
              <div className="text-6xl">📊</div>
              <h2 className="text-xl font-semibold text-gray-500">No Chart Selected</h2>
              <p className="text-sm">Open an existing chart or create a new one from the sidebar.</p>
            </div>
          ) : (
            <div id="chart-export-region" className="p-6 space-y-6 max-w-[1400px] mx-auto">

              {/* ── Document header ────────────────────────────────── */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Title strip */}
                <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-blue-900 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h1 className="text-white font-black text-lg tracking-tight">
                      MAN-MACHINE CHART
                    </h1>
                    <p className="text-blue-200 text-xs font-medium mt-0.5">Standard Operation Layout</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-300 text-xs">Rev. {activeFile.header.revNo}</p>
                    <p className="text-slate-400 text-xs">{activeFile.header.issueDate}</p>
                  </div>
                </div>

                {/* Header form */}
                <div className="p-4">
                  <HeaderForm />
                </div>
              </div>

              {/* ── Step Table ─────────────────────────────────────── */}
              <StepTable />

              {/* ── Chart ─────────────────────────────────────────── */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    Timeline Visualization
                  </h2>
                  <span className="text-xs text-gray-400 bg-gray-100 rounded px-2 py-1">
                    Cycle Time: {activeFile.header.cycleTime}s
                  </span>
                </div>
                <ManMachineChart />
              </div>

              {/* ── Summary + Layout (2 column on large screens) ──── */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <SummaryTable />
                <LayoutDiagram />
              </div>

              {/* ── Approval section ───────────────────────────────── */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Prepared By', value: activeFile.header.preparedBy },
                    { label: 'Approved By', value: activeFile.header.approvedBy },
                    { label: 'Date', value: activeFile.header.issueDate },
                  ].map(item => (
                    <div key={item.label} className="text-center">
                      <div className="h-10 border-b border-gray-300 mb-1" />
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{item.label}</p>
                      <p className="text-sm text-gray-700 font-medium mt-0.5">{item.value || '—'}</p>
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
