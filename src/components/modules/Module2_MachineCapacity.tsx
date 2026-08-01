'use client';

// ============================================================
// Module 2 — Machine Capacity Sheet (ใบแสดงความสามารถของเครื่องจักร)
//
// Mirrors the `Machine Capacity Sheet` tab of the source workbook and computes
// capacity with the standard TPS formula (see src/lib/machine-capacity.ts).
// ============================================================

import React, { useMemo, useRef, useState } from 'react';
import { useChartStore } from '@/store/useChartStore';
import type { MachineCapacity, MachineCapacityRow } from '@/types';
import {
  computeCapacityRow, computeCapacitySummary, emptyMachineCapacity,
  makeEmptyCapacityRow, netShiftSeconds, renumberCapacityRows,
} from '@/lib/machine-capacity';
import { AlertTriangle, Download, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

function Donut({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.min(percent, 999);
  const shown = Math.min(percent, 100);
  const over = percent > 100;
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const dash = (shown / 100) * circumference;
  const colour = over ? '#dc2626' : percent > 85 ? '#d97706' : '#059669';

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={colour} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="-mt-[86px] mb-[54px] text-center">
        <div className="text-2xl font-black font-mono" style={{ color: colour }}>
          {clamped.toFixed(0)}%
        </div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}

export default function Module2_MachineCapacity() {
  const activeFile  = useChartStore(s => s.activeFile());
  const updateMC    = useChartStore(s => s.updateMachineCapacity);
  const importFromM1 = useChartStore(s => s.importMachineCapacityFromTimeStudy);

  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mc: MachineCapacity = activeFile?.machineCapacity ?? emptyMachineCapacity();
  const summary = useMemo(() => computeCapacitySummary(mc), [mc]);
  const shiftSeconds = netShiftSeconds(mc);

  if (!activeFile) {
    return <div className="p-8 text-center text-slate-500">เปิดไฟล์จากแถบด้านซ้ายก่อน จึงจะใช้ Module 2 ได้</div>;
  }

  const say = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 4000);
  };

  const commit = (next: MachineCapacity) => updateMC(next);
  const patchRow = (id: string, patch: Partial<MachineCapacityRow>) =>
    commit({ ...mc, rows: mc.rows.map(r => (r.id === id ? { ...r, ...patch } : r)) });
  const num = (raw: string) => (raw.trim() === '' ? 0 : Number(raw));

  const addRow = () =>
    commit({ ...mc, rows: [...mc.rows, makeEmptyCapacityRow(uuidv4(), mc.rows.length + 1)] });

  const deleteRow = (id: string) =>
    commit({ ...mc, rows: renumberCapacityRows(mc.rows.filter(r => r.id !== id)) });

  const handleImport = () => {
    const machineRows = activeFile.timeStudy?.rows.filter(r => r.kind === 'machine' || r.operator === 'Auto M/C') ?? [];
    if (machineRows.length === 0) {
      say('ยังไม่มีแถวเครื่องจักรใน M1 — ไปกรอกที่ตารางจับเวลาก่อน หรือกดเพิ่มแถวที่นี่เอง');
      return;
    }
    if (mc.rows.length > 0 && !confirm(
      `ตารางนี้มีข้อมูลอยู่แล้ว ${mc.rows.length} แถว\n` +
      `การดึงจาก M1 จะเขียนทับด้วยแถวเครื่องจักร ${machineRows.length} แถว\n\nยืนยันหรือไม่?`
    )) return;
    const n = importFromM1();
    say(`ดึงมาแล้ว ${n} เครื่อง — Auto Time มาจากค่า Min ใน M1 ส่วน Manual Time กรอกเพิ่มเอง`);
  };

  const fmtMin = (s: number) => `${Math.round(s / 60)} นาที`;

  return (
    <div className="space-y-4">
      {/* ── shift settings ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">ใบแสดงความสามารถของเครื่องจักร (Machine Capacity Sheet)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              กำลังการผลิตต่อกะ = เวลาทำงานสุทธิ ÷ (เวลาทำครบ 1 ชิ้น + เวลาเปลี่ยนอุปกรณ์เฉลี่ยต่อชิ้น)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleImport}
              className="flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              title="นำแถวเครื่องจักรจากตารางจับเวลา M1 มาตั้งต้น"
            >
              <Download size={14} /> ดึงข้อมูลจาก M1
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {([
            { key: 'shiftGrossMinutes', label: 'เวลาต่อกะ (นาที)', hint: 'ยังไม่หักพัก' },
            { key: 'breakMinutes', label: 'เวลาพัก (นาที)', hint: 'พักเที่ยง 60 + ก่อน OT 20' },
            { key: 'requiredPerShift', label: 'ยอดที่ต้องผลิต/กะ (ชิ้น)', hint: 'ความต้องการลูกค้า' },
          ] as const).map(f => (
            <div key={f.key} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">{f.label}</label>
              <input
                type="number"
                min={0}
                value={mc[f.key]}
                onChange={e => commit({ ...mc, [f.key]: num(e.target.value) })}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">{f.hint}</p>
            </div>
          ))}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-[11px] font-bold text-blue-800 mb-1">เวลาทำงานสุทธิ</div>
            <div className="text-lg font-mono font-black text-blue-700">{fmtMin(shiftSeconds)}</div>
            <p className="text-[10px] text-blue-700/70 mt-1">{shiftSeconds.toLocaleString()} วินาที</p>
          </div>
        </div>

        {flash && (
          <div className="mt-3 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            {flash}
          </div>
        )}
      </div>

      {/* ── capacity table ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th rowSpan={2} className="border border-slate-200 px-2 py-2 w-12 font-bold">No.</th>
                <th rowSpan={2} className="border border-slate-200 px-2 py-2 text-left font-bold min-w-[200px]">Process Name</th>
                <th rowSpan={2} className="border border-slate-200 px-2 py-2 w-24 font-bold">Machine No.</th>
                <th colSpan={3} className="border border-slate-200 px-2 py-1.5 font-bold">Basic Time (วินาที)</th>
                <th colSpan={3} className="border border-slate-200 px-2 py-1.5 font-bold">Tool Change</th>
                <th rowSpan={2} className="border border-slate-200 px-2 py-2 w-28 font-bold bg-emerald-50 text-emerald-800">
                  Capacity<br /><span className="font-medium">ต่อกะ (ชิ้น)</span>
                </th>
                <th rowSpan={2} className="border border-slate-200 px-1 py-2 w-10 font-bold"></th>
              </tr>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-200 px-1 py-1.5 w-20 font-bold">Manual</th>
                <th className="border border-slate-200 px-1 py-1.5 w-20 font-bold">Auto</th>
                <th className="border border-slate-200 px-1 py-1.5 w-24 font-bold bg-slate-50">Completion</th>
                <th className="border border-slate-200 px-1 py-1.5 w-20 font-bold">ชิ้น/ครั้ง</th>
                <th className="border border-slate-200 px-1 py-1.5 w-20 font-bold">เวลา (วิ)</th>
                <th className="border border-slate-200 px-1 py-1.5 w-20 font-bold bg-slate-50">ต่อชิ้น</th>
              </tr>
            </thead>

            <tbody>
              {mc.rows.map(row => {
                const stats = computeCapacityRow(row, shiftSeconds);
                const isBottleneck = summary.bottleneckRowId === row.id;
                return (
                  <tr key={row.id} className={isBottleneck ? 'bg-rose-50' : 'hover:bg-slate-50'}>
                    <td className="border border-slate-200 px-2 py-1 text-center font-mono text-slate-500">{row.no}</td>

                    <td className="border border-slate-200 px-1 py-1">
                      <div className="flex items-center gap-1">
                        {isBottleneck && <AlertTriangle size={12} className="text-rose-600 flex-shrink-0" />}
                        <input
                          value={row.processName}
                          onChange={e => patchRow(row.id, { processName: e.target.value })}
                          placeholder="ชื่อกระบวนการ…"
                          className="w-full bg-transparent px-1 py-0.5 text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 rounded"
                        />
                      </div>
                    </td>

                    <td className="border border-slate-200 px-1 py-1">
                      <input
                        value={row.machineNo}
                        onChange={e => patchRow(row.id, { machineNo: e.target.value })}
                        placeholder="—"
                        className="w-full bg-transparent px-1 py-0.5 text-center text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 rounded"
                      />
                    </td>

                    {([
                      { key: 'manualTime' as const },
                      { key: 'autoTime' as const },
                    ]).map(f => (
                      <td key={f.key} className="border border-slate-200 p-0">
                        <input
                          type="number" step="0.01" min={0}
                          value={row[f.key] || ''}
                          onChange={e => patchRow(row.id, { [f.key]: num(e.target.value) })}
                          className="w-full bg-transparent px-1 py-1 text-right font-mono text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 rounded"
                        />
                      </td>
                    ))}

                    <td className="border border-slate-200 px-2 py-1 text-right font-mono font-bold text-slate-700 bg-slate-50">
                      {stats.completionTime ? stats.completionTime.toFixed(2) : ''}
                    </td>

                    {([
                      { key: 'changeQty' as const, step: '1' },
                      { key: 'changeTime' as const, step: '0.01' },
                    ]).map(f => (
                      <td key={f.key} className="border border-slate-200 p-0">
                        <input
                          type="number" step={f.step} min={0}
                          value={row[f.key] || ''}
                          onChange={e => patchRow(row.id, { [f.key]: num(e.target.value) })}
                          placeholder="—"
                          className="w-full bg-transparent px-1 py-1 text-right font-mono text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 rounded"
                        />
                      </td>
                    ))}

                    <td className="border border-slate-200 px-2 py-1 text-right font-mono text-slate-600 bg-slate-50">
                      {stats.changeTimePerUnit ? stats.changeTimePerUnit.toFixed(2) : '—'}
                    </td>

                    <td className={`border border-slate-200 px-2 py-1 text-right font-mono font-black ${
                      isBottleneck ? 'text-rose-700 bg-rose-100' : 'text-emerald-700 bg-emerald-50/60'
                    }`}>
                      {stats.capacity ? stats.capacity.toFixed(2) : ''}
                    </td>

                    <td className="border border-slate-200 px-1 py-1 text-center">
                      <button onClick={() => deleteRow(row.id)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="ลบแถว">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {mc.rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="border border-slate-200 px-4 py-10 text-center text-slate-500">
                    ยังไม่มีข้อมูล — กด <b>ดึงข้อมูลจาก M1</b> เพื่อนำเครื่องจักรจากตารางจับเวลามาตั้งต้น หรือ <b>เพิ่มแถว</b> เพื่อกรอกเอง
                  </td>
                </tr>
              )}
            </tbody>
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
            แถวคอขวด (ผลิตได้น้อยที่สุด) จะไฮไลต์สีแดง · ปล่อยช่อง Tool Change ว่างไว้ได้ถ้าไม่มีการเปลี่ยนอุปกรณ์
          </span>
        </div>
      </div>

      {/* ── bottleneck summary ──────────────────────────── */}
      {summary.bottleneckRowId && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Process Capacity Per Shift Of Bottle Neck Process</h3>
          <p className="text-[11px] text-slate-500 mb-4">กำลังการผลิตจริงของสายการผลิตถูกกำหนดโดยกระบวนการที่ช้าที่สุด</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
            <div className="flex justify-center">
              <Donut percent={summary.loadPercent} label="ภาระเทียบกำลังผลิต" />
            </div>

            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <div className="text-[11px] font-bold text-rose-800">คอขวด</div>
                <div className="text-sm font-semibold text-rose-900 mt-0.5 truncate">
                  {mc.rows.find(r => r.id === summary.bottleneckRowId)?.processName || '(ไม่มีชื่อ)'}
                </div>
                <div className="text-2xl font-mono font-black text-rose-700 mt-1">
                  {summary.bottleneckCapacity.toFixed(0)} <span className="text-xs font-normal">ชิ้น/กะ</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-[11px] font-bold text-slate-600">Takt Time</div>
                <div className="text-2xl font-mono font-black text-slate-800 mt-1">
                  {summary.taktTime ? summary.taktTime.toFixed(2) : '—'}
                  <span className="text-xs font-normal"> วิ/ชิ้น</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {summary.taktTime ? 'เวลาทำงานสุทธิ ÷ ยอดที่ต้องผลิต' : 'ใส่ยอดที่ต้องผลิตเพื่อคำนวณ'}
                </p>
              </div>

              {summary.shortfall ? (
                <div className="col-span-2 bg-rose-100 border border-rose-300 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle size={18} className="text-rose-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-black text-rose-900">Bottleneck Alert — ผลิตไม่ทันความต้องการ</div>
                    <p className="text-[11px] text-rose-800 mt-0.5">
                      ต้องการ {mc.requiredPerShift.toLocaleString()} ชิ้น/กะ แต่ผลิตได้จริง {summary.bottleneckCapacity.toFixed(0)} ชิ้น/กะ
                      — ขาดอีก {(mc.requiredPerShift - summary.bottleneckCapacity).toFixed(0)} ชิ้น
                    </p>
                  </div>
                </div>
              ) : mc.requiredPerShift > 0 ? (
                <div className="col-span-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="text-xs font-black text-emerald-900">กำลังการผลิตเพียงพอ</div>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    ผลิตได้ {summary.bottleneckCapacity.toFixed(0)} ชิ้น/กะ · ต้องการ {mc.requiredPerShift.toLocaleString()} ชิ้น/กะ
                    — เหลือกำลังอีก {(summary.bottleneckCapacity - mc.requiredPerShift).toFixed(0)} ชิ้น
                  </p>
                </div>
              ) : (
                <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600">
                  ใส่ <b>ยอดที่ต้องผลิต/กะ</b> ด้านบน เพื่อให้ระบบเทียบกำลังการผลิตกับความต้องการและแจ้งเตือนคอขวด
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
