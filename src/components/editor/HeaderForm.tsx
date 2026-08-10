'use client';

import React from 'react';
import { useChartStore } from '@/store/useChartStore';
import { computeCycleTime } from '@/lib/chart-utils';

const FIELD_CLASS = 'w-full border border-slate-300 rounded px-2 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder-slate-400 transition-colors shadow-sm';
const LABEL_CLASS = 'block text-sm font-bold text-slate-700 uppercase tracking-wide mb-1';

export default function HeaderForm() {
  const activeFile   = useChartStore(s => s.activeFile());
  const updateHeader = useChartStore(s => s.updateHeader);
  const closeRevision = useChartStore(s => s.closeRevision);
  const openNewRevision = useChartStore(s => s.openNewRevision);
  const syncStatus = useChartStore(s => s.syncStatus);

  if (!activeFile) return null;
  const h = activeFile.header;
  const isLocked = Boolean(activeFile.lockedAt);

  // Cycle Time = busiest actor's total time (max of Worker/Auto M/C sums)
  const cycleTime = computeCycleTime(activeFile.steps) || 0;

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm bg-white">
      <div className="bg-slate-50 border-b border-slate-300 px-4 py-2.5">
        <h3 className="text-slate-800 font-bold text-sm tracking-wide">PROCESS INFORMATION</h3>
      </div>

      <div className="p-4 bg-white">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
          {/* Process Name */}
          <div className="col-span-2">
            <label className={LABEL_CLASS}>Process Name</label>
            <input
              type="text"
              value={h.processName}
              onChange={e => updateHeader({ processName: e.target.value })}
              placeholder="e.g. Blow Molding"
              disabled={isLocked}
              className={`${FIELD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100`}
            />
          </div>

          {/* Part Number */}
          <div>
            <label className={LABEL_CLASS}>Part Number</label>
            <input
              type="text"
              value={h.partNumber}
              onChange={e => updateHeader({ partNumber: e.target.value })}
              placeholder="e.g. BM-SS-001"
              disabled={isLocked}
              className={`${FIELD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100`}
            />
          </div>

          {/* Part Name */}
          <div>
            <label className={LABEL_CLASS}>Part Name</label>
            <input
              type="text"
              value={h.partName || ''}
              onChange={e => updateHeader({ partName: e.target.value })}
              placeholder="e.g. Side Step Bar"
              disabled={isLocked}
              className={`${FIELD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100`}
            />
          </div>

          {/* Model */}
          <div>
            <label className={LABEL_CLASS}>Model</label>
            <input
              type="text"
              value={h.model}
              onChange={e => updateHeader({ model: e.target.value })}
              placeholder="e.g. Side Step LH, RH"
              disabled={isLocked}
              className={`${FIELD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100`}
            />
          </div>

          {/* Mold No */}
          <div>
            <label className={LABEL_CLASS}>Mold No.</label>
            <input
              type="text"
              value={h.moldNo || ''}
              onChange={e => updateHeader({ moldNo: e.target.value })}
              placeholder="e.g. M-1025"
              disabled={isLocked}
              className={`${FIELD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100`}
            />
          </div>

          {/* Cycle Time — Auto Calculated */}
          <div>
            <label className={LABEL_CLASS}>
              Cycle Time (s)
              <span className="ml-1 text-amber-600 normal-case font-normal">[Auto]</span>
            </label>
            <input
              type="number"
              readOnly
              value={cycleTime}
              className={`${FIELD_CLASS} font-mono bg-amber-50 text-amber-700 border-amber-200 cursor-not-allowed`}
              title="Auto-calculated from step timelines (parallel operators)"
            />
          </div>

          {/* Issue Date */}
          <div>
            <label className={LABEL_CLASS}>Issue Date</label>
            <input
              type="date"
              value={h.issueDate}
              onChange={e => updateHeader({ issueDate: e.target.value })}
              disabled={isLocked}
              className={`${FIELD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100`}
            />
          </div>

          {/* Rev No */}
          <div>
            <label className={LABEL_CLASS}>Rev. No.</label>
            <input
              type="text"
              value={h.revNo}
              onChange={e => updateHeader({ revNo: e.target.value })}
              placeholder="A"
              disabled={isLocked}
              className={isLocked ? `${FIELD_CLASS} bg-slate-100 cursor-not-allowed` : FIELD_CLASS}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {isLocked ? (
                <>
                  <span className="text-xs text-slate-600">
                    🔒 Locked {new Date(activeFile.lockedAt!).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => void openNewRevision()}
                    className="px-2.5 py-1 text-xs font-medium rounded border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    Open New Revision
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void closeRevision(h.revNo)}
                  disabled={h.revNo.trim() === ''}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-slate-400 text-slate-700 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Close Revision
                </button>
              )}
              {syncStatus === 'error' && (
                <span className="text-xs text-red-600">Revision action failed — please retry.</span>
              )}
            </div>
          </div>

          {/* Prepared By */}
          <div>
            <label className={LABEL_CLASS}>Prepared By</label>
            <input
              type="text"
              value={h.preparedBy}
              onChange={e => updateHeader({ preparedBy: e.target.value })}
              placeholder="IE Dept."
              disabled={isLocked}
              className={`${FIELD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100`}
            />
          </div>

          {/* Approved By */}
          <div>
            <label className={LABEL_CLASS}>Approved By</label>
            <input
              type="text"
              value={h.approvedBy}
              onChange={e => updateHeader({ approvedBy: e.target.value })}
              placeholder="Manager"
              disabled={isLocked}
              className={`${FIELD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100`}
            />
          </div>
        </div>

        {/* Info strip */}
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            { label: 'File',    value: activeFile.name },
            { label: 'Created', value: new Date(activeFile.createdAt).toLocaleDateString() },
            { label: 'Updated', value: new Date(activeFile.updatedAt).toLocaleDateString() },
          ].map(item => (
            <span key={item.label} className="text-xs bg-slate-50 text-slate-600 rounded px-2 py-1 border border-slate-200">
              <strong className="text-slate-800">{item.label}:</strong> {item.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
