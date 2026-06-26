'use client';

import React, { useState, useCallback } from 'react';
import { useChartStore } from '@/store/useChartStore';

export default function TopBar() {
  const activeFile     = useChartStore(s => s.activeFile());
  const saveActiveFile = useChartStore(s => s.saveActiveFile);
  const syncStatus     = useChartStore(s => s.syncStatus);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);

  const handleSave = () => {
    saveActiveFile();
  };

  const handleExportPNG = useCallback(async () => {
    if (!activeFile) return;
    setExporting('png');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const container = document.getElementById('chart-export-region');
      if (!container) {
        alert('Export region not found. Please open a chart first.');
        return;
      }
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `${activeFile.name}_MM_Chart.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('PNG export failed:', err);
      alert(`PNG export failed: ${String(err)}`);
    } finally {
      setExporting(null);
    }
  }, [activeFile]);

  const handleExportPDF = useCallback(async () => {
    if (!activeFile) return;
    setExporting('pdf');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const container = document.getElementById('chart-export-region');
      if (!container) {
        alert('Export region not found. Please open a chart first.');
        return;
      }

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      const aspectRatio = canvas.height / canvas.width;
      const imgH = pdfW * aspectRatio;
      const finalH = Math.min(imgH, pdfH);
      const finalW = finalH / aspectRatio;
      pdf.addImage(imgData, 'PNG', (pdfW - finalW) / 2, 0, finalW, finalH);

      // Use Blob + createObjectURL for reliable download trigger
      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeFile.name}_MM_Chart.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 200);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert(`PDF export failed: ${String(err)}`);
    } finally {
      setExporting(null);
    }
  }, [activeFile]);

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shadow-sm flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mr-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xs font-black shadow">
          M
        </div>
        <span className="font-bold text-gray-800 text-sm tracking-tight hidden sm:inline">
          Man-Machine Chart
        </span>
        <span className="text-xs text-gray-400 font-medium hidden md:inline">Standard Operation</span>
      </div>

      {/* Active file breadcrumb */}
      {activeFile && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 border-l border-gray-200 pl-4">
          <span className="font-medium text-gray-800">{activeFile.name}</span>
          <span className="text-gray-300">·</span>
          <span>{activeFile.header.processName || 'Unnamed Process'}</span>
          <span className="bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 font-semibold ml-1">
            Rev. {activeFile.header.revNo}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {/* Sync status indicator */}
        <div className="text-xs font-medium mr-1">
          {syncStatus === 'syncing' && (
            <span className="text-amber-500 flex items-center gap-1">
              <span className="inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              Syncing…
            </span>
          )}
          {syncStatus === 'saved' && (
            <span className="text-emerald-500">✓ Saved to Cloud</span>
          )}
          {syncStatus === 'error' && (
            <span className="text-red-500">⚠ Sync Error</span>
          )}
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!activeFile || syncStatus === 'syncing'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            syncStatus === 'saved'
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
              : 'bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-40'
          }`}
        >
          {syncStatus === 'saved' ? '✓ Saved' : '☁ Save'}
        </button>

        {/* Export PNG */}
        <button
          onClick={handleExportPNG}
          disabled={!activeFile || !!exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-colors"
        >
          {exporting === 'png' ? '…' : '🖼 PNG'}
        </button>

        {/* Export PDF */}
        <button
          onClick={handleExportPDF}
          disabled={!activeFile || !!exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 transition-colors"
        >
          {exporting === 'pdf' ? '…' : '📄 PDF'}
        </button>
      </div>
    </header>
  );
}
