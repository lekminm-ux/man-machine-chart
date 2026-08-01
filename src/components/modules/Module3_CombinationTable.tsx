'use client';

// ============================================================
// Module 3 — Standardized Work Combination Table (ตารางงานมาตรฐานผสม)
//
// Time-axis chart of one cycle: solid line = operator work, dashed = machine
// auto-run, wave = walking, red line = Takt, blue line = Cycle Time.
// The timing model lives in src/lib/combination-table.ts.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useChartStore } from '@/store/useChartStore';
import { axisTicks, buildCombinationTable, type CombinationRow } from '@/lib/combination-table';
import { computeCapacitySummary } from '@/lib/machine-capacity';
import { AlertTriangle, ArrowDown } from 'lucide-react';

const LABEL_W = 250;   // px reserved for the job element column
const ROW_H = 26;
const PAD_R = 40;

const KIND_LABEL: Record<string, string> = {
  man: 'คน', machine: 'เครื่อง', walk: 'เดิน', idle: 'รอ',
};

/** A walking element is drawn as a wave, the way the paper form does it. */
function wavePath(x1: number, x2: number, y: number): string {
  const width = x2 - x1;
  const step = Math.max(6, Math.min(14, width / 3));
  let d = `M ${x1} ${y}`;
  let up = true;
  for (let x = x1; x < x2; x += step) {
    const nx = Math.min(x + step, x2);
    d += ` Q ${(x + nx) / 2} ${y + (up ? -6 : 6)} ${nx} ${y}`;
    up = !up;
  }
  return d;
}

export default function Module3_CombinationTable() {
  const activeFile = useChartStore(s => s.activeFile());
  const [taktOverride, setTaktOverride] = useState<number | null>(null);

  const study = activeFile?.timeStudy;
  const mc = activeFile?.machineCapacity;

  // Takt comes from Module 2's demand figure unless it is typed in here.
  const taktFromM2 = useMemo(
    () => (mc ? computeCapacitySummary(mc).taktTime : 0),
    [mc]
  );
  const takt = taktOverride ?? taktFromM2;

  const result = useMemo(
    () => buildCombinationTable(study ?? { readingCount: 0, rows: [] }, takt),
    [study, takt]
  );

  if (!activeFile) {
    return <div className="p-8 text-center text-slate-500">เปิดไฟล์จากแถบด้านซ้ายก่อน จึงจะใช้ Module 3 ได้</div>;
  }

  if (!study || study.rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
        <h2 className="text-base font-bold text-slate-700">ตารางงานมาตรฐานผสม (Standardized Work Combination Table)</h2>
        <p className="text-sm text-slate-500 mt-2">
          โมดูลนี้วาดกราฟจากข้อมูลใน <b>M1 ตารางจับเวลา</b> — ไปกรอกเวลาที่ M1 ก่อน แล้วกลับมาที่นี่
        </p>
      </div>
    );
  }

  const ticks = axisTicks(result.axisMax);
  const scaleMax = ticks[ticks.length - 1] || 1;
  const chartW = 900;
  const toX = (seconds: number) => (seconds / scaleMax) * chartW;

  const chartH = result.rows.length * ROW_H + 8;

  return (
    <div className="space-y-4">
      {/* ── controls ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">ตารางงานมาตรฐานผสม (Standardized Work Combination Table)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              เส้นทึบ = คนทำงาน · เส้นประ = เครื่องทำงานเอง · เส้นคลื่น = เดิน · เส้นแดง = Takt Time · เส้นน้ำเงิน = Cycle Time
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <span className="text-xs font-bold text-slate-600">Takt Time (วิ)</span>
            <input
              type="number" min={0} step="0.01"
              value={takt || ''}
              placeholder="—"
              onChange={e => setTaktOverride(e.target.value.trim() === '' ? 0 : Number(e.target.value))}
              className="w-24 bg-white border border-slate-300 rounded px-2 py-0.5 text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-500"
            />
            {taktOverride !== null && (
              <button onClick={() => setTaktOverride(null)}
                className="text-[10px] font-bold text-blue-600 hover:underline">ใช้ค่าจาก M2</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-[11px] font-bold text-blue-800">Cycle Time</div>
            <div className="text-xl font-mono font-black text-blue-700">{result.cycleTime.toFixed(2)}<span className="text-xs font-normal"> วิ</span></div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
            <div className="text-[11px] font-bold text-rose-800">Takt Time</div>
            <div className="text-xl font-mono font-black text-rose-700">
              {takt ? takt.toFixed(2) : '—'}<span className="text-xs font-normal"> วิ</span>
            </div>
            <p className="text-[10px] text-rose-700/70 mt-0.5">
              {taktOverride !== null ? 'กรอกเอง' : taktFromM2 ? 'มาจาก M2' : 'ยังไม่ได้ตั้งค่า'}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-[11px] font-bold text-slate-600">จำนวนงาน</div>
            <div className="text-xl font-mono font-black text-slate-800">{result.rows.length}</div>
          </div>
          <div className={`rounded-lg p-3 border ${
            takt && result.cycleTime > takt ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
          }`}>
            <div className={`text-[11px] font-bold ${takt && result.cycleTime > takt ? 'text-rose-800' : 'text-emerald-800'}`}>
              สถานะ
            </div>
            <div className={`text-sm font-bold mt-1 ${takt && result.cycleTime > takt ? 'text-rose-700' : 'text-emerald-700'}`}>
              {!takt ? 'ใส่ Takt เพื่อเทียบ' : result.cycleTime > takt ? 'เกิน Takt' : 'อยู่ใน Takt'}
            </div>
          </div>
        </div>
      </div>

      {/* ── chart ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto p-4">
          <svg
            width={LABEL_W + chartW + PAD_R}
            height={chartH + 46}
            className="min-w-full"
            role="img"
            aria-label="Standardized work combination chart"
          >
            {/* axis ticks */}
            {ticks.map(t => (
              <g key={t}>
                <line
                  x1={LABEL_W + toX(t)} y1={30} x2={LABEL_W + toX(t)} y2={30 + chartH}
                  stroke="#e2e8f0" strokeWidth={1}
                />
                <text x={LABEL_W + toX(t)} y={22} textAnchor="middle" fontSize={10} fill="#64748b">{t}</text>
              </g>
            ))}
            <text x={LABEL_W + chartW + 4} y={22} fontSize={9} fill="#94a3b8">วินาที</text>

            {/* Takt line (red) */}
            {takt > 0 && takt <= scaleMax && (
              <g>
                <line
                  x1={LABEL_W + toX(takt)} y1={26} x2={LABEL_W + toX(takt)} y2={30 + chartH}
                  stroke="#dc2626" strokeWidth={2}
                />
                <rect x={LABEL_W + toX(takt) - 26} y={2} width={52} height={14} rx={7} fill="#dc2626" />
                <text x={LABEL_W + toX(takt)} y={12} textAnchor="middle" fontSize={9} fill="#fff" fontWeight="bold">T.T.</text>
              </g>
            )}

            {/* Cycle time line (blue) */}
            {result.cycleTime > 0 && result.cycleTime <= scaleMax && (
              <g>
                <line
                  x1={LABEL_W + toX(result.cycleTime)} y1={26} x2={LABEL_W + toX(result.cycleTime)} y2={30 + chartH}
                  stroke="#2563eb" strokeWidth={2} strokeDasharray="1 0"
                />
                <rect x={LABEL_W + toX(result.cycleTime) - 26} y={2} width={52} height={14} rx={7} fill="#2563eb" />
                <text x={LABEL_W + toX(result.cycleTime)} y={12} textAnchor="middle" fontSize={9} fill="#fff" fontWeight="bold">C.T.</text>
              </g>
            )}

            {/* rows */}
            {result.rows.map((row: CombinationRow, i: number) => {
              const y = 30 + i * ROW_H + ROW_H / 2;
              const colour = row.kind === 'machine' ? '#2563eb' : row.kind === 'walk' ? '#0891b2' : '#334155';
              return (
                <g key={row.id}>
                  <text x={4} y={y + 3} fontSize={10} fill="#64748b">{row.no}</text>
                  <text x={22} y={y + 3} fontSize={10} fill="#1e293b">
                    {row.description.length > 30 ? row.description.slice(0, 29) + '…' : row.description || '—'}
                  </text>
                  <text x={LABEL_W - 46} y={y + 3} fontSize={9} fill="#94a3b8">{KIND_LABEL[row.kind]}</text>
                  <text x={LABEL_W - 6} y={y + 3} fontSize={9} textAnchor="end" fill="#64748b" fontFamily="monospace">
                    {row.duration ? row.duration.toFixed(1) : ''}
                  </text>

                  {row.segments.map((seg, si) => {
                    const x1 = LABEL_W + toX(seg.start);
                    const x2 = LABEL_W + toX(seg.end);
                    if (row.kind === 'walk') {
                      return (
                        <path key={si} d={wavePath(x1, x2, y)} stroke={colour} strokeWidth={2} fill="none" />
                      );
                    }
                    return (
                      <line
                        key={si}
                        x1={x1} y1={y} x2={x2} y2={y}
                        stroke={colour}
                        strokeWidth={row.kind === 'machine' ? 3 : 5}
                        strokeDasharray={row.kind === 'machine' ? '7 4' : undefined}
                        strokeLinecap="round"
                        opacity={seg.wrapped ? 0.75 : 1}
                      />
                    );
                  })}

                  {/* Rule 1 marker: the bar was cut at Takt and wrapped back to 0 */}
                  {row.overrunsTakt && takt > 0 && (
                    <text x={LABEL_W + toX(Math.min(takt, scaleMax)) + 4} y={y - 6} fontSize={9} fill="#dc2626" fontWeight="bold">↩</text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-4 text-[11px] text-slate-600">
          <span className="flex items-center gap-1.5"><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="#334155" strokeWidth="5" strokeLinecap="round" /></svg> คนทำงาน</span>
          <span className="flex items-center gap-1.5"><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="#2563eb" strokeWidth="3" strokeDasharray="7 4" /></svg> เครื่องทำงานเอง</span>
          <span className="flex items-center gap-1.5"><svg width="26" height="14"><path d={wavePath(0, 26, 7)} stroke="#0891b2" strokeWidth="2" fill="none" /></svg> เดิน</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-0.5 h-3 bg-red-600" /> Takt Time</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-0.5 h-3 bg-blue-600" /> Cycle Time</span>
          <span className="flex items-center gap-1.5"><span className="text-red-600 font-bold">↩</span> เกิน Takt แล้ววนกลับ (Rule 1)</span>
        </div>
      </div>

      {/* ── per-actor summary: Rule 2 waiting time ──────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-1">สรุปภาระงานและเวลารอ</h3>
        <p className="text-[11px] text-slate-500 mb-3">
          เวลารอคือช่องว่างจนถึง Takt Time — ใช้หาว่าคนไหนยังรับงานเพิ่มได้ (Rule 2 ใน blueprint)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {result.actors.map(a => (
            <div key={a.operator}
              className={`rounded-lg border p-3 ${
                a.overTakt ? 'bg-rose-50 border-rose-200'
                  : a.isMachine ? 'bg-amber-50 border-amber-200'
                  : 'bg-slate-50 border-slate-200'
              }`}>
              <div className={`text-xs font-bold ${a.overTakt ? 'text-rose-800' : a.isMachine ? 'text-amber-800' : 'text-slate-700'}`}>
                {a.operator}
              </div>
              <div className="text-xl font-mono font-black text-slate-800 mt-1">
                {a.cycle.toFixed(2)}<span className="text-[10px] font-normal"> วิ</span>
              </div>
              {a.overTakt ? (
                <div className="flex items-center gap-1 text-[10px] font-bold text-rose-700 mt-1">
                  <AlertTriangle size={11} /> เกิน Takt {(a.cycle - takt).toFixed(2)} วิ
                </div>
              ) : a.wait > 0 ? (
                <div className="flex items-center gap-1 text-[10px] font-bold text-blue-700 mt-1">
                  <ArrowDown size={11} /> รอ {a.wait.toFixed(2)} วิ
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 mt-1">{takt ? 'พอดี Takt' : 'ยังไม่ได้ตั้ง Takt'}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
