'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { emptyKaizenSheet, useChartStore } from '@/store/useChartStore';
import type { KaizenDetailRow, KaizenSheet, RevisionSnapshot, RevisionSnapshotMeta } from '@/types';
import {
  getRevisionSnapshotCloud,
  listRevisionSnapshotsCloud,
} from '@/lib/storage';
import {
  buildComparison,
  type ComparisonResult,
  type OperatorBar,
} from '@/lib/kaizen-compare';

const CHART_HEIGHT = 320;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatSeconds(value: number): string {
  return `${formatNumber(value)}s`;
}

function metricChangeClass(delta: number | null, improvingWhen: 'down' | 'up'): string {
  if (delta === null || delta === 0) return 'text-slate-500';
  const improving = improvingWhen === 'down' ? delta < 0 : delta > 0;
  return improving ? 'text-emerald-600' : 'text-red-600';
}

function StackedBar({ bar, yMax }: { bar: OperatorBar | null; yMax: number }) {
  const pxPerSec = CHART_HEIGHT / yMax;
  if (!bar) {
    return (
      <div
        className="w-14 border-2 border-dashed border-slate-300 rounded-t-sm flex items-center justify-center text-xs text-slate-400"
        style={{ height: CHART_HEIGHT }}
        aria-label="No work in this revision"
      >
        —
      </div>
    );
  }

  return (
    <div
      className="w-14 relative bg-slate-50 border border-slate-200 rounded-t-sm overflow-visible"
      style={{ height: CHART_HEIGHT }}
      aria-label={`${formatSeconds(bar.total)} total`}
    >
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col-reverse"
        style={{ height: bar.total * pxPerSec }}
      >
        {bar.manual > 0 && <div className="w-full bg-slate-800" style={{ height: bar.manual * pxPerSec }} title={`Manual: ${formatSeconds(bar.manual)}`} />}
        {bar.walk > 0 && <div className="w-full bg-emerald-500" style={{ height: bar.walk * pxPerSec }} title={`Walk: ${formatSeconds(bar.walk)}`} />}
        {bar.idle > 0 && <div className="w-full bg-red-500" style={{ height: bar.idle * pxPerSec }} title={`Idle: ${formatSeconds(bar.idle)}`} />}
      </div>
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-700 font-mono whitespace-nowrap">
        {formatSeconds(bar.total)}
      </div>
    </div>
  );
}

export default function Module6_Kaizen() {
  const activeFile = useChartStore(s => s.activeFile());
  const updateKaizen = useChartStore(s => s.updateKaizen);
  const [snapshots, setSnapshots] = useState<RevisionSnapshotMeta[]>([]);
  const snapshotCacheRef = useRef<Record<string, RevisionSnapshot>>({});
  const [revisionFileId, setRevisionFileId] = useState<string | null>(null);
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);

  const activeFileId = activeFile?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    const loadRevisionList = async () => {
      // Defer the reset into the async callback so changing charts does not
      // synchronously cascade state updates from the effect body.
      await Promise.resolve();
      if (cancelled) return;
      setSnapshots([]);
      snapshotCacheRef.current = {};
      setRevisionFileId(null);
      setBeforeId('');
      setAfterId('');
      setComparison(null);
      setRevisionError(null);
      setContentError(null);

      if (!activeFileId) {
        setRevisionLoading(false);
        return;
      }

      setRevisionLoading(true);
      const result = await listRevisionSnapshotsCloud(activeFileId);
      if (cancelled) return;
      setRevisionLoading(false);
      if (!result.ok) {
        setRevisionError(result.error);
        return;
      }
      setSnapshots(result.snapshots);
      setRevisionFileId(activeFileId);
      if (result.snapshots.length >= 2) {
        setAfterId(result.snapshots[0].id);
        setBeforeId(result.snapshots[1].id);
      }
    };

    void loadRevisionList();

    return () => { cancelled = true; };
  }, [activeFileId]);

  useEffect(() => {
    if (!activeFileId || revisionFileId !== activeFileId || !beforeId || !afterId || beforeId === afterId) {
      return;
    }

    let cancelled = false;
    const loadSelectedSnapshots = async () => {
      setContentLoading(true);
      setContentError(null);

      const nextCache = { ...snapshotCacheRef.current };
      for (const id of [beforeId, afterId]) {
        if (nextCache[id]) continue;
        const result = await getRevisionSnapshotCloud(id);
        if (!result.ok) {
          if (!cancelled) {
            setContentLoading(false);
            setContentError(result.error);
            setComparison(null);
          }
          return;
        }
        nextCache[id] = result.snapshot;
      }

      if (cancelled) return;
      snapshotCacheRef.current = nextCache;
      setComparison(buildComparison(nextCache[beforeId].content, nextCache[afterId].content));
      setContentLoading(false);
    };

    void loadSelectedSnapshots();
    return () => { cancelled = true; };
  }, [activeFileId, revisionFileId, beforeId, afterId]);

  if (!activeFile) {
    return <div className="p-8 text-center text-slate-500">Please open a file from the sidebar to use Module 6.</div>;
  }

  const isLocked = Boolean(activeFile.lockedAt);
  const kaizen = activeFile.kaizen ?? emptyKaizenSheet();
  const patchKaizen = (partial: Partial<KaizenSheet>) => updateKaizen({ ...kaizen, ...partial });
  const patchDetail = (id: string, partial: Partial<KaizenDetailRow>) =>
    patchKaizen({ details: kaizen.details.map(row => (row.id === id ? { ...row, ...partial } : row)) });
  const addDetail = () => patchKaizen({
    details: [
      ...kaizen.details,
      { id: uuidv4(), detail: '', priority: null, response: '', eva: '' },
    ],
  });
  const deleteDetail = (id: string) =>
    patchKaizen({ details: kaizen.details.filter(row => row.id !== id) });

  const yMax = Math.max(
    10,
    Math.ceil(Math.max(
      ...(comparison?.operatorRows.flatMap(row => [row.before?.total ?? 0, row.after?.total ?? 0]) ?? [0]),
      0,
    ) / 10) * 10,
  );
  const beforeMeta = snapshots.find(snapshot => snapshot.id === beforeId);
  const afterMeta = snapshots.find(snapshot => snapshot.id === afterId);
  const hasDistinctSelection = Boolean(
    activeFileId && revisionFileId === activeFileId && beforeId && afterId && beforeId !== afterId,
  );

  const renderMetricRow = (
    label: string,
    before: number | null,
    after: number | null,
    formatter: (value: number) => string,
    improvingWhen: 'down' | 'up',
    customChange?: string,
  ) => {
    const delta = before !== null && after !== null ? after - before : null;
    const changeDelta = customChange === '—' ? null : delta;
    return (
      <tr key={label}>
        <th className="text-left font-semibold text-slate-700">{label}</th>
        <td className="text-right font-mono">{before === null ? '—' : formatter(before)}</td>
        <td className="text-right font-mono">{after === null ? '—' : formatter(after)}</td>
        <td className={`text-right font-mono font-semibold ${metricChangeClass(changeDelta, improvingWhen)}`}>
          {customChange ?? (delta === null ? '—' : `${delta > 0 ? '+' : ''}${formatter(delta)}`)}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center bg-slate-50 min-h-screen p-8">
      <div className="w-full max-w-6xl space-y-6">
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Kaizen Sheet</h2>
              <p className="text-sm text-slate-500">Record the current chart problem, response, and improvement result.</p>
            </div>
            {isLocked && (
              <span className="ml-auto text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                This Revision is locked — the Kaizen Sheet is read-only.
              </span>
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Problem and Solution</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold text-slate-600">
              Problem
              <textarea
                rows={4}
                value={kaizen.problem}
                onChange={event => patchKaizen({ problem: event.target.value })}
                disabled={isLocked}
                placeholder="Describe the problem…"
                className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-600">
              Solution
              <textarea
                rows={4}
                value={kaizen.solution}
                onChange={event => patchKaizen({ solution: event.target.value })}
                disabled={isLocked}
                placeholder="Describe the solution…"
                className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Before and After</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold text-slate-600">
              Before
              <textarea
                rows={4}
                value={kaizen.beforeNote}
                onChange={event => patchKaizen({ beforeNote: event.target.value })}
                disabled={isLocked}
                placeholder="Describe the before state — photo attachment coming in a later phase."
                className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-600">
              After
              <textarea
                rows={4}
                value={kaizen.afterNote}
                onChange={event => patchKaizen({ afterNote: event.target.value })}
                disabled={isLocked}
                placeholder="Describe the after state — photo attachment coming in a later phase."
                className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Kaizen Details</h3>
            <p className="text-xs text-slate-500 mt-0.5">Add as many improvement details as this Kaizen needs.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="border border-slate-200 px-3 py-2 text-left min-w-[260px]">Detail</th>
                  <th className="border border-slate-200 px-3 py-2 text-left w-28">Priority</th>
                  <th className="border border-slate-200 px-3 py-2 text-left min-w-[220px]">Response</th>
                  <th className="border border-slate-200 px-3 py-2 text-left min-w-[220px]">Eva</th>
                  <th className="border border-slate-200 px-2 py-2 w-12" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {kaizen.details.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="border border-slate-200 p-1">
                      <input
                        value={row.detail}
                        onChange={event => patchDetail(row.id, { detail: event.target.value })}
                        disabled={isLocked}
                        placeholder="Detail…"
                        className="w-full bg-transparent px-2 py-1.5 text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="border border-slate-200 p-1">
                      <select
                        value={row.priority === null ? '' : String(row.priority)}
                        onChange={event => patchDetail(row.id, { priority: event.target.value === '' ? null : Number(event.target.value) })}
                        disabled={isLocked}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="">—</option>
                        {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </td>
                    <td className="border border-slate-200 p-1">
                      <input
                        value={row.response}
                        onChange={event => patchDetail(row.id, { response: event.target.value })}
                        disabled={isLocked}
                        placeholder="Response…"
                        className="w-full bg-transparent px-2 py-1.5 text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="border border-slate-200 p-1">
                      <input
                        value={row.eva}
                        onChange={event => patchDetail(row.id, { eva: event.target.value })}
                        disabled={isLocked}
                        placeholder="Evaluation…"
                        className="w-full bg-transparent px-2 py-1.5 text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="border border-slate-200 p-1 text-center">
                      <button
                        type="button"
                        onClick={() => deleteDetail(row.id)}
                        disabled={isLocked}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete detail"
                        aria-label="Delete detail"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {kaizen.details.length === 0 && (
                  <tr>
                    <td colSpan={5} className="border border-slate-200 px-4 py-8 text-center text-slate-500">
                      No details yet — add the first improvement detail below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={addDetail}
              disabled={isLocked}
              className="flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <Plus size={14} /> Add Detail
            </button>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Result and Action Owner</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block md:col-span-3 text-sm font-semibold text-slate-600">
              Result
              <textarea
                rows={4}
                value={kaizen.result}
                onChange={event => patchKaizen({ result: event.target.value })}
                disabled={isLocked}
                placeholder="Describe the overall result…"
                className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-600">
              Responsible Person
              <input
                value={kaizen.responsiblePerson}
                onChange={event => patchKaizen({ responsiblePerson: event.target.value })}
                disabled={isLocked}
                placeholder="Name…"
                className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-600">
              Due Date
              <input
                type="date"
                value={kaizen.dueDate}
                onChange={event => patchKaizen({ dueDate: event.target.value })}
                disabled={isLocked}
                className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>
          </div>
        </section>

        <header className="flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Kaizen Before / After Comparison</h2>
            <p className="text-sm text-slate-500">Compare two closed Revision snapshots only.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 font-semibold text-slate-600">
              Before
              <select
                value={beforeId}
                disabled={revisionLoading || snapshots.length < 2}
                onChange={event => setBeforeId(event.target.value)}
                className="border border-slate-300 rounded-md px-2 py-1 bg-white font-normal disabled:opacity-50"
              >
                {snapshots.map(snapshot => (
                  <option key={snapshot.id} value={snapshot.id} disabled={snapshot.id === afterId}>
                    {snapshot.revNo} · {formatDate(snapshot.closedAt)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 font-semibold text-slate-600">
              After
              <select
                value={afterId}
                disabled={revisionLoading || snapshots.length < 2}
                onChange={event => setAfterId(event.target.value)}
                className="border border-slate-300 rounded-md px-2 py-1 bg-white font-normal disabled:opacity-50"
              >
                {snapshots.map(snapshot => (
                  <option key={snapshot.id} value={snapshot.id} disabled={snapshot.id === beforeId}>
                    {snapshot.revNo} · {formatDate(snapshot.closedAt)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {revisionLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center gap-3 text-slate-500">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Loading closed Revisions…
          </div>
        )}

        {revisionError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">Could not load closed Revisions: {revisionError}</div>}

        {!revisionLoading && !revisionError && snapshots.length < 2 && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">
            Close at least two Revisions for this chart before opening a Before/After comparison.
            The editable current chart is intentionally not used as either side.
          </div>
        )}

        {contentLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-3 text-slate-500">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Loading the selected snapshot contents…
          </div>
        )}

        {hasDistinctSelection && contentError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">Could not load the selected Revision: {contentError}</div>}

        {hasDistinctSelection && comparison && !contentLoading && (
          <>
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <BarChart3 className="text-blue-500" size={20} />
                <h3 className="font-bold text-slate-800">Revision Metrics</h3>
                <span className="ml-auto text-xs text-slate-500">{beforeMeta?.revNo ?? beforeId} → {afterMeta?.revNo ?? afterId}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr><th className="px-5 py-3 text-left">Metric</th><th className="px-5 py-3 text-right">Before</th><th className="px-5 py-3 text-right">After</th><th className="px-5 py-3 text-right">Change</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {renderMetricRow(
                      'Cycle Time', comparison.before.cycleTime, comparison.after.cycleTime,
                      formatSeconds, 'down',
                      comparison.cycleTimeReductionPercent === null ? '—' : formatPercent(-comparison.cycleTimeReductionPercent),
                    )}
                    {renderMetricRow('Worker Count', comparison.before.workerCount, comparison.after.workerCount, formatNumber, 'down')}
                    {renderMetricRow('Walk Time Total', comparison.before.walkTimeTotal, comparison.after.walkTimeTotal, formatSeconds, 'down')}
                    {renderMetricRow('Idle Time Total', comparison.before.idleTimeTotal, comparison.after.idleTimeTotal, formatSeconds, 'down')}
                    {renderMetricRow('Capacity / Shift', comparison.before.capacityPerShift, comparison.after.capacityPerShift, formatNumber, 'up')}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-slate-800">Overlaid Yamazumi</h3>
                  <p className="text-xs text-slate-500">Standard-time totals from each frozen Revision; one shared Y axis.</p>
                </div>
                <div className="flex gap-4 text-xs font-medium text-slate-600">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-slate-800 rounded-sm" />Manual</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-500 rounded-sm" />Walk</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-500 rounded-sm" />Idle</span>
                </div>
              </div>

              <div className="relative mt-8" style={{ height: CHART_HEIGHT + 85, paddingLeft: 42, paddingBottom: 45 }}>
                {Array.from({ length: 6 }).map((_, index) => {
                  const value = (yMax / 5) * (5 - index);
                  return (
                    <div key={value} className="absolute left-0 right-0 flex items-center" style={{ top: index * (CHART_HEIGHT / 5) }}>
                      <span className="text-xs text-slate-400 font-mono w-8 text-right pr-2 -translate-y-1/2">{formatNumber(value)}</span>
                      <div className="flex-1 h-px bg-slate-100" />
                    </div>
                  );
                })}
                <div className="absolute left-11 right-0 bottom-[45px] flex justify-around items-end" style={{ height: CHART_HEIGHT }}>
                  {comparison.operatorRows.map(row => (
                    <div key={row.operator} className="flex flex-col items-center gap-2 min-w-32">
                      <div className="flex items-end gap-2 h-full">
                        <StackedBar bar={row.before} yMax={yMax} />
                        <StackedBar bar={row.after} yMax={yMax} />
                      </div>
                      <div className="text-xs font-bold text-slate-600 whitespace-nowrap">{row.operator}</div>
                      <div className="text-[10px] text-slate-400">Before · After</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
