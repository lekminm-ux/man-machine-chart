'use client';

import React from 'react';
import { useChartStore } from '@/store/useChartStore';

const FIELD_CLASS = 'w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-800 transition-colors';
const LABEL_CLASS = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';

export default function HeaderForm() {
  const activeFile   = useChartStore(s => s.activeFile());
  const updateHeader = useChartStore(s => s.updateHeader);

  if (!activeFile) return null;
  const h = activeFile.header;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-2.5">
        <h3 className="text-white font-semibold text-sm tracking-wide">PROCESS INFORMATION</h3>
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

          {/* Cycle Time */}
          <div>
            <label className={LABEL_CLASS}>Cycle Time (s)</label>
            <input
              type="number"
              min={1}
              value={h.cycleTime}
              onChange={e => updateHeader({ cycleTime: parseFloat(e.target.value) || 60 })}
              className={`${FIELD_CLASS} font-mono`}
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
            <span key={item.label} className="text-xs bg-slate-100 text-gray-600 rounded px-2 py-1">
              <strong>{item.label}:</strong> {item.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
