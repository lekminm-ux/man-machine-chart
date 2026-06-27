'use client';

import React from 'react';
import { useChartStore } from '@/store/useChartStore';
import { computeTotalDuration } from '@/lib/chart-utils';

const FIELD_CLASS = 'w-full border border-slate-750 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-900 text-slate-200 placeholder-slate-600 transition-colors';
const LABEL_CLASS = 'block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1';

export default function HeaderForm() {
  const activeFile   = useChartStore(s => s.activeFile());
  const updateHeader = useChartStore(s => s.updateHeader);

  if (!activeFile) return null;
  const h = activeFile.header;

  // Cycle time is computed automatically from step timelines (parallel per-operator)
  const cycleTime = computeTotalDuration(activeFile.steps) || 0;

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-2.5">
        <h3 className="text-slate-100 font-semibold text-sm tracking-wide">PROCESS INFORMATION</h3>
      </div>

      <div className="p-4 bg-slate-850" style={{ background: '#1a2235' }}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
          {/* Process Name */}
          <div className="col-span-2">
            <label className={LABEL_CLASS}>Process Name</label>
            <input
              type="text"
              value={h.processName}
              onChange={e => updateHeader({ processName: e.target.value })}
              placeholder="e.g. Blow Molding"
              className={FIELD_CLASS}
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
              className={FIELD_CLASS}
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
              className={FIELD_CLASS}
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
              className={FIELD_CLASS}
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
              className={FIELD_CLASS}
            />
          </div>

          {/* Cycle Time — Auto Calculated */}
          <div>
            <label className={LABEL_CLASS}>
              Cycle Time (s)
              <span className="ml-1 text-amber-400 normal-case font-normal">[Auto]</span>
            </label>
            <input
              type="number"
              readOnly
              value={cycleTime}
              className={`${FIELD_CLASS} font-mono bg-slate-900 text-amber-400 cursor-not-allowed`}
              style={{ borderColor: '#334155' }}
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
              className={FIELD_CLASS}
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
              className={FIELD_CLASS}
            />
          </div>

          {/* Prepared By */}
          <div>
            <label className={LABEL_CLASS}>Prepared By</label>
            <input
              type="text"
              value={h.preparedBy}
              onChange={e => updateHeader({ preparedBy: e.target.value })}
              placeholder="IE Dept."
              className={FIELD_CLASS}
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
              className={FIELD_CLASS}
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
            <span key={item.label} className="text-xs bg-slate-900 text-slate-400 rounded px-2 py-1 border border-slate-700">
              <strong className="text-slate-350">{item.label}:</strong> {item.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
