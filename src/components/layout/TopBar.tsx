'use client';

import React, { useState, useCallback } from 'react';
import { useChartStore } from '@/store/useChartStore';

export default function TopBar() {
  const activeFile     = useChartStore(s => s.activeFile());
  const saveActiveFile = useChartStore(s => s.saveActiveFile);
  const syncStatus     = useChartStore(s => s.syncStatus);
  const activeModule   = useChartStore(s => s.activeModule);
  const setActiveModule= useChartStore(s => s.setActiveModule);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  const isLocked = Boolean(activeFile?.lockedAt);

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

      const canvas = await withPatchedStylesheets(async () => {
        return html2canvas(container, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#0f172a',
          logging: false,
        });
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

      const canvas = await withPatchedStylesheets(async () => {
        return html2canvas(container, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#0f172a',
          logging: false,
        });
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

// Helper to patch stylesheets (converts Tailwind OKLCH/LAB colors to HSL so html2canvas doesn't throw)
function withPatchedStylesheets<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof window === 'undefined') return fn();
  const sheets = Array.from(document.styleSheets);
  const originalStates: { sheet: CSSStyleSheet; disabled: boolean }[] = [];
  const newStyleElements: HTMLStyleElement[] = [];

  for (const sheet of sheets) {
    try {
      const rules = sheet.cssRules || sheet.rules;
      if (!rules) continue;

      let rulesText = '';
      for (let i = 0; i < rules.length; i++) {
        rulesText += rules[i].cssText + '\n';
      }

      if (rulesText.includes('oklch(') || rulesText.includes('lab(')) {
        let patched = rulesText.replace(
          /oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/gi,
          (_, l, c, h, a) => {
            const lightness = l.endsWith('%') ? parseFloat(l) : parseFloat(l) * 100;
            const chroma = parseFloat(c);
            const hue = parseFloat(h);
            const saturation = Math.min(100, Math.max(0, chroma * 250));
            return a ? `hsla(${hue}, ${saturation}%, ${lightness}%, ${a})` : `hsl(${hue}, ${saturation}%, ${lightness}%)`;
          }
        );

        patched = patched.replace(
          /lab\(\s*([0-9.]+%?)\s+([0-9.-]+)\s+([0-9.-]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/gi,
          (_, l, __, ___, a) => {
            const lightness = l.endsWith('%') ? parseFloat(l) : parseFloat(l);
            return a ? `hsla(0, 0%, ${lightness}%, ${a})` : `hsl(0, 0%, ${lightness}%)`;
          }
        );

        const styleEl = document.createElement('style');
        styleEl.textContent = patched;
        document.head.appendChild(styleEl);
        newStyleElements.push(styleEl);

        originalStates.push({ sheet, disabled: sheet.disabled });
        sheet.disabled = true;
      }
    } catch (e) {
      // Ignore CORS errors
    }
  }

  return fn().finally(() => {
    for (const state of originalStates) {
      state.sheet.disabled = state.disabled;
    }
    for (const el of newStyleElements) {
      el.remove();
    }
  });
}

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-4 shadow-sm flex-shrink-0 z-10 relative">
      {/* App name */}
      <span className="font-bold text-slate-800 text-sm tracking-tight whitespace-nowrap">
        Machine-Chart Man-STD-Operation
      </span>

      {/* Active file breadcrumb */}
      {activeFile && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 border-l border-slate-200 pl-4">
          <span className="font-medium text-slate-700">{activeFile.name}</span>
          <span className="text-slate-400">·</span>
          <span>{activeFile.header.processName || 'Unnamed Process'}</span>
          <span className="bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 font-semibold ml-1">
            Rev. {activeFile.header.revNo}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Module Navigator */}
      <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
        {([
          { id: 1, name: '1: Time Sheet' },
          { id: 2, name: '2: Capacity' },
          { id: 3, name: '3: Gantt' },
          { id: 4, name: '4: Layout' },
          { id: 5, name: '5: Yamazumi' },
          { id: 6, name: '6: Kaizen' }
        ] as const).map(m => (
          <button
            key={m.id}
            onClick={() => setActiveModule(m.id)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              activeModule === m.id
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>

      <div className="flex-1" />

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
          {syncStatus === 'unconfirmed' && (
            <span className="text-amber-600" title="The write call reported success, but a fresh Cloud read-back did not confirm it — retry the save.">⚠ Save unconfirmed</span>
          )}
          {syncStatus === 'error' && (
            <span className="text-red-500">⚠ Sync Error</span>
          )}
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!activeFile || syncStatus === 'syncing' || isLocked}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            syncStatus === 'saved'
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
          }`}
        >
          {isLocked ? '🔒 Locked' : syncStatus === 'saved' ? '✓ Saved' : '☁ Save'}
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
