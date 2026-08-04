'use client';

// ============================================================
// Module 1 — Time Measurement Sheet (ตารางจับเวลา)
//
// A key-in grid that mirrors the paper form used on the floor. Timing itself is
// done with a real stopwatch; only the readings are typed in here. (An earlier
// version of this module was a stopwatch UI — that was a misreading of the
// blueprint slide, see docs/Master_Plan.html.)
// ============================================================

import React, { useMemo, useRef, useState } from 'react';
import { useChartStore } from '@/store/useChartStore';
import { ALL_WORKERS, type OperatorType, type TimeStudy, type TimeStudyKind } from '@/types';
import {
  DEFAULT_READING_COUNT, computeOperatorTotals, computeRowStats, computeTotals,
  isMachineRow, makeEmptyRow, parsePastedGrid, renumber, resizeReadings,
} from '@/lib/time-study';
import { Download, Plus, Send, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const READING_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

const KIND_OPTIONS: { value: TimeStudyKind; label: string; cls: string }[] = [
  { value: 'man',     label: 'คน',     cls: 'text-slate-700' },
  { value: 'machine', label: 'เครื่อง', cls: 'text-amber-700' },
  { value: 'walk',    label: 'เดิน',   cls: 'text-blue-700' },
  { value: 'idle',    label: 'รอ',     cls: 'text-rose-700' },
];

const CATEGORY_OPTIONS: { value: '' | 'periodical' | 'changeover'; label: string; cls: string }[] = [
  { value: '',           label: 'ปกติ',       cls: 'text-slate-700' },
  { value: 'periodical', label: 'ทำเป็นรอบ', cls: 'text-indigo-700' },
  { value: 'changeover', label: 'เปลี่ยนรุ่น', cls: 'text-violet-700' },
];

const ALL_OPERATORS: OperatorType[] = [...ALL_WORKERS, 'Auto M/C'];

function emptyStudy(readingCount = DEFAULT_READING_COUNT): TimeStudy {
  return { readingCount, rows: [] };
}

export default function Module1_TimeMeasurement() {
  const activeFile      = useChartStore(s => s.activeFile());
  const updateTimeStudy = useChartStore(s => s.updateTimeStudy);
  const importFromSteps = useChartStore(s => s.importTimeStudyFromSteps);
  const pushToSteps     = useChartStore(s => s.pushTimeStudyToSteps);

  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const study = activeFile?.timeStudy ?? emptyStudy();

  const totals    = useMemo(() => computeTotals(study), [study]);
  const perWorker = useMemo(() => computeOperatorTotals(study), [study]);

  if (!activeFile) {
    return <div className="p-8 text-center text-slate-500">เปิดไฟล์จากแถบด้านซ้ายก่อน จึงจะใช้ Module 1 ได้</div>;
  }

  const say = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 4000);
  };

  const commit = (next: TimeStudy) => updateTimeStudy(next);

  // ── row editing ───────────────────────────────────────────
  const addRow = () => {
    const last = study.rows[study.rows.length - 1];
    commit({
      ...study,
      rows: [
        ...study.rows,
        makeEmptyRow(uuidv4(), study.rows.length + 1, study.readingCount, last?.operator ?? 'Worker A'),
      ],
    });
  };

  /** Insert a blank row next to an existing one, keeping that row's operator. */
  const insertRow = (index: number, position: 'above' | 'below') => {
    const at = position === 'above' ? index : index + 1;
    const neighbour = study.rows[index];
    const rows = [...study.rows];
    rows.splice(at, 0, makeEmptyRow(uuidv4(), at + 1, study.readingCount, neighbour?.operator ?? 'Worker A'));
    commit({ ...study, rows: renumber(rows) });
  };

  const deleteRow = (id: string) =>
    commit({ ...study, rows: renumber(study.rows.filter(r => r.id !== id)) });

  const moveRow = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= study.rows.length) return;
    const rows = [...study.rows];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    commit({ ...study, rows: renumber(rows) });
  };

  const patchRow = (id: string, patch: Partial<(typeof study.rows)[number]>) =>
    commit({ ...study, rows: study.rows.map(r => (r.id === id ? { ...r, ...patch } : r)) });

  const setReading = (id: string, col: number, raw: string) => {
    const value = raw.trim() === '' ? null : Number(raw);
    if (value !== null && !Number.isFinite(value)) return;
    commit({
      ...study,
      rows: study.rows.map(r =>
        r.id === id ? { ...r, readings: r.readings.map((v, i) => (i === col ? value : v)) } : r
      ),
    });
  };

  const setReadingCount = (count: number) => commit(resizeReadings(study, count));

  /** Paste a block copied from Excel starting at the focused cell. */
  const handlePaste = (e: React.ClipboardEvent, rowIndex: number, colIndex: number) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return; // single value — let the browser handle it
    e.preventDefault();

    const grid = parsePastedGrid(text);
    if (grid.length === 0) return;

    const rows = [...study.rows];
    // grow the sheet if the pasted block is taller than what is on screen
    while (rows.length < rowIndex + grid.length) {
      rows.push(makeEmptyRow(uuidv4(), rows.length + 1, study.readingCount, rows[rows.length - 1]?.operator ?? 'Worker A'));
    }

    grid.forEach((line, r) => {
      const target = rows[rowIndex + r];
      const readings = [...target.readings];
      line.forEach((val, c) => {
        const col = colIndex + c;
        if (col < study.readingCount) readings[col] = val;
      });
      rows[rowIndex + r] = { ...target, readings };
    });

    commit({ ...study, rows: renumber(rows) });
    say(`วางข้อมูล ${grid.length} แถว × ${grid[0].length} คอลัมน์ เรียบร้อย`);
  };

  // ── cross-module actions ──────────────────────────────────
  const handleImport = () => {
    if (activeFile.steps.length === 0) {
      say('ไฟล์นี้ยังไม่มีข้อมูล step ใน M4 จึงไม่มีอะไรให้ดึง');
      return;
    }
    const msg = study.rows.length > 0
      ? `ตารางนี้มีข้อมูลอยู่แล้ว ${study.rows.length} แถว\nการดึงจาก M4 จะเขียนทับทั้งหมดด้วย ${activeFile.steps.length} แถวจาก M4\n\nยืนยันหรือไม่?`
      : `ดึง Job Element ${activeFile.steps.length} แถวจาก M4 มาตั้งต้นในตารางนี้?\nเวลาที่ได้จะไปอยู่ในช่อง 1st ส่วนรอบที่เหลือกรอกเพิ่มได้ทีหลัง`;
    if (!confirm(msg)) return;
    const n = importFromSteps();
    say(`ดึงมาแล้ว ${n} แถวจาก M4 — เวลาที่ได้อยู่ในช่อง 1st`);
  };

  const handlePush = () => {
    if (study.rows.length === 0) {
      say('ยังไม่มีข้อมูลในตาราง จึงยังส่งต่อไม่ได้');
      return;
    }
    if (!confirm(
      `ส่งข้อมูล ${study.rows.length} แถวไปให้ M2–M5 โดยใช้ค่า Min เป็นเวลามาตรฐาน\n\n` +
      `⚠️ step ทั้งหมดที่กรอกไว้ใน M4 (${activeFile.steps.length} แถว) จะถูกเขียนทับ\n\nยืนยันหรือไม่?`
    )) return;
    const n = pushToSteps('min');
    say(`ส่งข้อมูลแล้ว ${n} แถว — เปิด M3/M4/M5 เพื่อดูผลได้เลย`);
  };

  const labels = READING_LABELS.slice(0, study.readingCount);

  return (
    <div className="space-y-4">
      {/* ── toolbar ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">ตารางจับเวลา (Time Measurement Sheet)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              จับเวลาหน้างานด้วยนาฬิกาจริง แล้วกรอกตัวเลขลงตารางนี้ — ระบบคำนวณ Min / Max / Fluc / Aver ให้อัตโนมัติ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="text-xs font-bold text-slate-600">จำนวนรอบ</span>
              <select
                value={study.readingCount}
                onChange={e => setReadingCount(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>

            <button
              onClick={handleImport}
              className="flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              title="นำ step ที่กรอกไว้ใน M4 มาตั้งต้นในตารางนี้"
            >
              <Download size={14} /> ดึงข้อมูลจาก M4
            </button>

            <button
              onClick={handlePush}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors"
              title="ส่งค่า Min ของทุกแถวไปเป็นเวลามาตรฐานให้ M2–M5"
            >
              <Send size={14} /> ส่งข้อมูลไป M2–M5
            </button>
          </div>
        </div>

        {flash && (
          <div className="mt-3 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            {flash}
          </div>
        )}
      </div>

      {/* ── sheet ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-200 px-2 py-2 w-12 font-bold">Seq</th>
                <th className="border border-slate-200 px-1 py-2 w-16 font-bold">Insert</th>
                <th className="border border-slate-200 px-2 py-2 text-left font-bold min-w-[240px]">Job Element</th>
                <th className="border border-slate-200 px-2 py-2 w-28 font-bold">Worker</th>
                <th className="border border-slate-200 px-2 py-2 w-20 font-bold">ประเภท</th>
                <th className="border border-slate-200 px-2 py-2 w-24 font-bold">หมวดเวลา</th>
                {labels.map(l => (
                  <th key={l} className="border border-slate-200 px-1 py-2 w-16 font-bold">{l}</th>
                ))}
                <th className="border border-slate-200 px-2 py-2 w-16 font-bold bg-emerald-50 text-emerald-800">Min.</th>
                <th className="border border-slate-200 px-2 py-2 w-16 font-bold bg-rose-50 text-rose-800">Max.</th>
                <th className="border border-slate-200 px-2 py-2 w-16 font-bold bg-amber-50 text-amber-800">Fluc.</th>
                <th className="border border-slate-200 px-2 py-2 w-16 font-bold bg-blue-50 text-blue-800">Aver.</th>
                <th className="border border-slate-200 px-1 py-2 w-20 font-bold"></th>
              </tr>
            </thead>

            <tbody>
              {study.rows.map((row, rowIndex) => {
                const stats = computeRowStats(row);
                const machine = isMachineRow(row);
                return (
                  <tr key={row.id} className={machine ? 'bg-yellow-50' : 'hover:bg-slate-50'}>
                    <td className="border border-slate-200 px-2 py-1 text-center font-mono text-slate-500">{row.seq}</td>

                    <td className="border border-slate-200 px-1 py-1">
                      <div className="flex gap-0.5 justify-center">
                        <button
                          onClick={() => insertRow(rowIndex, 'above')}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 font-mono text-[9px] font-bold"
                          title="แทรกแถวเปล่าด้านบน"
                        >+▲</button>
                        <button
                          onClick={() => insertRow(rowIndex, 'below')}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 font-mono text-[9px] font-bold"
                          title="แทรกแถวเปล่าด้านล่าง"
                        >+▼</button>
                      </div>
                    </td>

                    <td className="border border-slate-200 px-1 py-1">
                      <input
                        value={row.jobElement}
                        onChange={e => patchRow(row.id, { jobElement: e.target.value })}
                        placeholder="รายละเอียดงาน…"
                        className="w-full bg-transparent px-1 py-0.5 text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 rounded"
                      />
                    </td>

                    <td className="border border-slate-200 px-1 py-1">
                      <select
                        value={row.operator}
                        onChange={e => {
                          const operator = e.target.value as OperatorType;
                          patchRow(row.id, {
                            operator,
                            ...(operator === 'Auto M/C' ? { kind: 'machine' as TimeStudyKind } : {}),
                          });
                        }}
                        className="w-full bg-transparent text-slate-700 font-semibold focus:outline-none focus:bg-white rounded px-0.5"
                      >
                        {ALL_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                    </td>

                    <td className="border border-slate-200 px-1 py-1">
                      <select
                        value={row.kind}
                        onChange={e => patchRow(row.id, { kind: e.target.value as TimeStudyKind })}
                        className={`w-full bg-transparent font-semibold focus:outline-none focus:bg-white rounded px-0.5 ${
                          KIND_OPTIONS.find(k => k.value === row.kind)?.cls ?? ''
                        }`}
                      >
                        {KIND_OPTIONS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                    </td>

                    <td className="border border-slate-200 px-1 py-1">
                      <select
                        value={row.category ?? ''}
                        onChange={e => patchRow(row.id, {
                          category: e.target.value === '' ? undefined : e.target.value as 'periodical' | 'changeover',
                        })}
                        className={`w-full bg-transparent font-semibold focus:outline-none focus:bg-white rounded px-0.5 ${
                          CATEGORY_OPTIONS.find(c => c.value === (row.category ?? ''))?.cls ?? ''
                        }`}
                      >
                        {CATEGORY_OPTIONS.map(c => <option key={c.value || 'regular'} value={c.value}>{c.label}</option>)}
                      </select>
                    </td>

                    {row.readings.slice(0, study.readingCount).map((val, col) => (
                      <td key={col} className="border border-slate-200 p-0">
                        <input
                          type="number"
                          step="0.01"
                          value={val ?? ''}
                          onChange={e => setReading(row.id, col, e.target.value)}
                          onPaste={e => handlePaste(e, rowIndex, col)}
                          className="w-full bg-transparent px-1 py-1 text-right font-mono text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 rounded"
                        />
                      </td>
                    ))}

                    <td className="border border-slate-200 px-2 py-1 text-right font-mono font-bold text-emerald-700 bg-emerald-50/60">
                      {stats.count ? stats.min.toFixed(2) : ''}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-mono text-rose-700 bg-rose-50/60">
                      {stats.count ? stats.max.toFixed(2) : ''}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-mono text-amber-700 bg-amber-50/60">
                      {stats.count ? stats.fluctuation.toFixed(2) : ''}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-mono text-blue-700 bg-blue-50/60">
                      {stats.count ? stats.average.toFixed(2) : ''}
                    </td>

                    <td className="border border-slate-200 px-1 py-1">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => moveRow(rowIndex, -1)} disabled={rowIndex === 0}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded disabled:opacity-30" title="เลื่อนขึ้น">
                          <ArrowUp size={12} />
                        </button>
                        <button onClick={() => moveRow(rowIndex, 1)} disabled={rowIndex === study.rows.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded disabled:opacity-30" title="เลื่อนลง">
                          <ArrowDown size={12} />
                        </button>
                        <button onClick={() => deleteRow(row.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="ลบแถว">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {study.rows.length === 0 && (
                <tr>
                  <td colSpan={study.readingCount + 11} className="border border-slate-200 px-4 py-10 text-center text-slate-500">
                    ยังไม่มีข้อมูล — กด <b>เพิ่มแถว</b> เพื่อกรอกเอง หรือ <b>ดึงข้อมูลจาก M4</b> เพื่อนำ step ที่มีอยู่แล้วมาตั้งต้น
                  </td>
                </tr>
              )}
            </tbody>

            {study.rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-800 text-white font-bold">
                  <td className="border border-slate-700 px-2 py-2 text-center" colSpan={6}>
                    TOTAL <span className="font-normal text-slate-300">(ไม่รวมแถวเครื่องจักร)</span>
                  </td>
                  {totals.perReading.map((v, i) => (
                    <td key={i} className="border border-slate-700 px-1 py-2 text-right font-mono">{v ? v.toFixed(2) : ''}</td>
                  ))}
                  <td className="border border-slate-700 px-2 py-2 text-right font-mono text-emerald-300">{totals.min.toFixed(2)}</td>
                  <td className="border border-slate-700 px-2 py-2 text-right font-mono text-rose-300">{totals.max.toFixed(2)}</td>
                  <td className="border border-slate-700 px-2 py-2 text-right font-mono text-amber-300">
                    {(totals.max - totals.min).toFixed(2)}
                  </td>
                  <td className="border border-slate-700 px-2 py-2 text-right font-mono text-blue-300">{totals.average.toFixed(2)}</td>
                  <td className="border border-slate-700"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center gap-3">
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            <Plus size={14} /> เพิ่มแถว
          </button>
          <span className="text-[11px] text-slate-500">
            เพิ่มได้ไม่จำกัด · คัดลอกช่วงเวลาจาก Excel แล้ววางลงช่องรอบแรกได้ทั้งบล็อก · แถวเครื่องจักรจะไฮไลต์สีเหลืองและไม่ถูกนับใน TOTAL
          </span>
        </div>
      </div>

      {/* ── cross-check panel ───────────────────────────── */}
      {study.rows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-1">สรุปตามผู้ปฏิบัติงาน</h3>
          <p className="text-[11px] text-slate-500 mb-3">
            ใช้ทวนสอบตัวเลขข้ามโมดูล — ค่า Min ของแต่ละคนคือความสูงแท่งที่จะไปโผล่ใน M5 และเวลาเครื่องคือเส้นประใน M3
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {perWorker.map(t => {
              const machine = t.operator === 'Auto M/C';
              return (
                <div key={t.operator}
                  className={`rounded-lg border p-3 ${machine ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`text-xs font-bold ${machine ? 'text-amber-800' : 'text-slate-700'}`}>{t.operator}</div>
                  <div className="text-[10px] text-slate-500 mb-1.5">{t.rowCount} งาน</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-mono font-black text-emerald-700">{t.min.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-500">s (Min)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    Max {t.max.toFixed(2)} · Aver {t.average.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
