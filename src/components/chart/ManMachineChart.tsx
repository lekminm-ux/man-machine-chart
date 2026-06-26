'use client';

import React, { useRef } from 'react';
import { useChartStore } from '@/store/useChartStore';
import { buildTimelineSegments, getActiveWorkers, computeTotalDuration } from '@/lib/chart-utils';
import { TimelineRow, ROW_HEIGHT, LABEL_WIDTH, TICK_HEIGHT } from './TimelineRow';
import type { OperatorType } from '@/types';

// ─── Legend ──────────────────────────────────────────────────────────────────
const LEGEND = [
  { label: 'Manual Time', color: '#111827', dash: false, thick: true  },
  { label: 'Auto M/C',    color: '#1d4ed8', dash: false, thick: false },
  { label: 'Walk',        color: '#059669', dash: false, thick: false },
  { label: 'Idle',        color: '#ef4444', dash: true,  thick: false },
];

const HEADER_H = 30;

function niceTickInterval(totalDur: number, pixelWidth: number): number {
  const maxTicks = Math.floor(pixelWidth / 55);
  const candidates = [1, 2, 5, 10, 15, 20, 30, 60, 90, 120, 180, 300, 600];
  for (const c of candidates) {
    if (totalDur / c <= maxTicks) return c;
  }
  return Math.ceil(totalDur / maxTicks / 10) * 10;
}

export default function ManMachineChart() {
  const svgRef     = useRef<SVGSVGElement>(null);
  const activeFile = useChartStore(s => s.activeFile());

  if (!activeFile) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No file selected.
      </div>
    );
  }

  const { steps, header } = activeFile;

  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm italic">
        Add steps in the Operation Steps table to see the chart.
      </div>
    );
  }

  const workers    = getActiveWorkers(steps);
  const hasMachine = steps.some(s => s.operator === 'Auto M/C');

  const rows: Array<{ label: string; op: OperatorType | 'Machine' }> = [
    ...(hasMachine ? [{ label: 'Machine', op: 'Machine' as const }] : []),
    ...workers.map(w => ({ label: w, op: w as OperatorType })),
  ];

  const rawDur   = computeTotalDuration(steps);
  const totalDur = Math.max(rawDur, header.cycleTime, 10);

  const SVG_W   = 900;
  const AXIS_H  = TICK_HEIGHT;
  const chartTop = HEADER_H + AXIS_H;
  const chartH   = rows.length * ROW_HEIGHT;
  const arrowY   = chartTop + chartH + 20;
  const SVG_H    = arrowY + 22;

  const tickInterval = niceTickInterval(totalDur, SVG_W - LABEL_WIDTH);
  const ticks: number[] = [];
  for (let t = 0; t <= totalDur; t += tickInterval) ticks.push(t);
  if (ticks[ticks.length - 1] < totalDur) ticks.push(totalDur);

  function tX(t: number) {
    return LABEL_WIDTH + (t / totalDur) * (SVG_W - LABEL_WIDTH - 8);
  }

  return (
    <div className="overflow-x-auto">
      {/* Legend */}
      <div className="flex flex-wrap gap-5 mb-4 px-1">
        {LEGEND.map(l => (
          <div key={l.label} className="flex items-center gap-2 text-xs">
            {l.thick ? (
              <div style={{ width: 28, height: 8, background: l.color, borderRadius: 2 }} />
            ) : l.dash ? (
              <div style={{ width: 28, height: 0, border: `1.5px dashed ${l.color}` }} />
            ) : (
              <div style={{ width: 28, height: 3, background: l.color, borderRadius: 1 }} />
            )}
            <span className="text-gray-600 font-medium">{l.label}</span>
          </div>
        ))}
      </div>

      <svg
        ref={svgRef}
        id="mm-chart-svg"
        width={SVG_W}
        height={SVG_H}
        style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#fff', display: 'block' }}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      >
        {/* ── Chart header ─────────────────────────────────────── */}
        <rect x={0} y={0} width={SVG_W} height={HEADER_H} fill="#1e3a5f" rx={0} />
        <text x={SVG_W / 2} y={HEADER_H - 9} textAnchor="middle" fill="white" fontSize={13} fontWeight="700">
          MAN-MACHINE CHART — {header.processName.toUpperCase() || 'NEW PROCESS'} | {header.model || '—'}
        </text>
        <text x={12} y={HEADER_H - 9} fill="#93c5fd" fontSize={10}>
          Cycle: {header.cycleTime}s
        </text>
        <text x={SVG_W - 12} y={HEADER_H - 9} textAnchor="end" fill="#93c5fd" fontSize={10}>
          Rev. {header.revNo}
        </text>

        {/* ── Vertical grid lines + time axis ──────────────────── */}
        {ticks.map(t => {
          const x = tX(t);
          return (
            <g key={t}>
              <line x1={x} y1={HEADER_H} x2={x} y2={chartTop + chartH} stroke="#e2e8f0" strokeWidth={1} />
              <text x={x} y={HEADER_H + AXIS_H - 3} textAnchor="middle" fontSize={9} fill="#94a3b8">
                {t}s
              </text>
            </g>
          );
        })}

        {/* ── Rows ─────────────────────────────────────────────── */}
        {rows.map((row, ri) => {
          const rowY       = chartTop + ri * ROW_HEIGHT;
          const segs       = buildTimelineSegments(steps, row.op);
          const isMachRow  = row.op === 'Machine';

          return (
            <g key={row.label}>
              {/* Row background */}
              <rect
                x={0} y={rowY} width={SVG_W} height={ROW_HEIGHT}
                fill={ri % 2 === 0 ? '#f8fafc' : '#f0f4f8'}
              />
              {/* Label area */}
              <rect
                x={0} y={rowY} width={LABEL_WIDTH} height={ROW_HEIGHT}
                fill={isMachRow ? '#dbeafe' : '#ecfdf5'}
              />
              {/* Top border */}
              <line x1={0} y1={rowY} x2={SVG_W} y2={rowY} stroke="#e2e8f0" strokeWidth={1} />
              {/* Vertical separator */}
              <line x1={LABEL_WIDTH} y1={rowY} x2={LABEL_WIDTH} y2={rowY + ROW_HEIGHT} stroke="#94a3b8" strokeWidth={1} />

              {/* Row label */}
              <text
                x={LABEL_WIDTH - 10} y={rowY + ROW_HEIGHT / 2 + 4}
                textAnchor="end" fontSize={11}
                fontWeight={isMachRow ? '800' : '600'}
                fill={isMachRow ? '#1d4ed8' : '#1f2937'}
              >
                {row.label}
              </text>

              {/* Timeline symbols */}
              <TimelineRow
                segments={segs}
                totalDuration={totalDur}
                chartWidth={SVG_W - 8}
                rowY={rowY}
              />
            </g>
          );
        })}

        {/* Bottom border */}
        <line x1={0} y1={chartTop + chartH} x2={SVG_W} y2={chartTop + chartH} stroke="#64748b" strokeWidth={1.5} />

        {/* ── Cycle Time Arrow ──────────────────────────────────── */}
        <defs>
          <marker id="arr-s" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 Z" fill="#dc2626" />
          </marker>
          <marker id="arr-e" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0 0 L8 4 L0 8 Z" fill="#dc2626" />
          </marker>
        </defs>

        {/* Arrow line */}
        <line
          x1={tX(0)} y1={arrowY}
          x2={tX(header.cycleTime)} y2={arrowY}
          stroke="#dc2626" strokeWidth={2.5}
          markerStart="url(#arr-s)" markerEnd="url(#arr-e)"
        />
        {/* Arrow label */}
        <text
          x={(tX(0) + tX(header.cycleTime)) / 2} y={arrowY - 6}
          textAnchor="middle" fontSize={11} fill="#dc2626" fontWeight="700"
        >
          Cycle Time: {header.cycleTime}s
        </text>
        {/* End caps */}
        <line x1={tX(0)} y1={arrowY - 7} x2={tX(0)} y2={arrowY + 7} stroke="#dc2626" strokeWidth={2} />
        <line x1={tX(header.cycleTime)} y1={arrowY - 7} x2={tX(header.cycleTime)} y2={arrowY + 7} stroke="#dc2626" strokeWidth={2} />
      </svg>
    </div>
  );
}
