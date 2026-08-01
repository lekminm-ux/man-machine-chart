'use client';

import React from 'react';
import type { TimeSegment } from '@/lib/chart-utils';

// ─── Shared constants (exported for use in ManMachineChart) ───────────────────
export const ROW_HEIGHT   = 54;
export const LABEL_WIDTH  = 130;
export const TICK_HEIGHT  = 22;

const MANUAL_W = 14;
const AUTO_W   = 3;

interface Props {
  segments:      TimeSegment[];
  totalDuration: number;
  chartWidth:    number; // full SVG width (including label)
  rowY:          number;
  noLabel?:      boolean;
  /** Print the duration on the bar and the start/end at its ends. */
  showTimes?:    boolean;
}


function tX(t: number, totalDur: number, chartW: number, noLabel?: boolean): number {
  const lw = noLabel ? 0 : LABEL_WIDTH;
  const padding = 24; // 24px padding so the scale doesn't touch the borders
  const plotW = chartW - lw - (padding * 2);
  return lw + padding + (t / totalDur) * plotW;
}

function walkPath(x1: number, x2: number, cy: number): string {
  const len  = x2 - x1;
  if (len <= 2) return `M${x1} ${cy} L${x2} ${cy}`;
  const amp   = 5;
  const steps = Math.max(2, Math.round(len / 9));
  let d = `M${x1} ${cy}`;
  for (let i = 0; i <= steps; i++) {
    const px = x1 + (i / steps) * len;
    const py = cy + (i % 2 === 0 ? -amp : amp);
    d += ` L${px} ${py}`;
  }
  return d + ` L${x2} ${cy}`;
}

export function TimelineRow({ segments, totalDuration, chartWidth, rowY, noLabel, showTimes }: Props) {
  const cy = rowY + ROW_HEIGHT / 2;

  return (
    <g>
      {/* Where the numbers come from: duration on the bar, start/end at its ends */}
      {showTimes && segments.map((seg, i) => {
        if (seg.type === 'empty' || seg.duration <= 0) return null;
        const x1 = tX(seg.start, totalDuration, chartWidth, noLabel);
        const x2 = tX(seg.start + seg.duration, totalDuration, chartWidth, noLabel);
        const w = x2 - x1;
        const colour = seg.type === 'machine' ? '#1d4ed8'
          : seg.type === 'walk' ? '#065f46'
          : seg.type === 'idle' ? '#991b1b' : '#0f172a';
        return (
          <g key={`t${i}`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {w > 30 && (
              <text x={(x1 + x2) / 2} y={cy + 20} textAnchor="middle"
                fontSize={10.5} fontWeight="800" fill={colour} fontFamily="Consolas,monospace">
                {seg.duration}s
              </text>
            )}
            {w > 64 && (
              <>
                <text x={x1 + 1} y={cy + 20} textAnchor="start"
                  fontSize={9} fill="#94a3b8" fontFamily="Consolas,monospace">
                  {seg.start}
                </text>
                <text x={x2 - 1} y={cy + 20} textAnchor="end"
                  fontSize={9} fill="#94a3b8" fontFamily="Consolas,monospace">
                  {seg.start + seg.duration}
                </text>
              </>
            )}
          </g>
        );
      })}
      {segments.map((seg, i) => {
        const x1 = tX(seg.start,              totalDuration, chartWidth, noLabel);
        const x2 = tX(seg.start + seg.duration, totalDuration, chartWidth, noLabel);
        const w  = Math.max(x2 - x1, 1);

        switch (seg.type) {
          /* ── Manual: solid blue bar (STD activity color) ──────── */
          case 'manual':
            return (
              <g key={i}>
                <line
                  x1={x1} y1={cy} x2={x2} y2={cy}
                  stroke="#3b82f6" strokeWidth={MANUAL_W} strokeLinecap="butt"
                  opacity={0.85}
                />
                {w > 22 && (
                  <text
                    x={(x1 + x2) / 2} y={cy - 12}
                    textAnchor="middle" fontSize={11} fill="#1e3a5f"
                    fontWeight="bold"
                    fontFamily="Inter,sans-serif"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {seg.label && seg.label.length > 20
                      ? seg.label.slice(0, 20) + '…'
                      : (seg.label ?? '')}
                  </text>
                )}
              </g>
            );

          /* ── Auto M/C: thin blue line + vertical end markers ──────── */
          case 'machine':
            return (
              <g key={i}>
                <line x1={x1} y1={cy} x2={x2} y2={cy} stroke="#60a5fa" strokeWidth={AUTO_W} />
                <line x1={x1} y1={cy - 10} x2={x1} y2={cy + 10} stroke="#60a5fa" strokeWidth={2} />
                <line x1={x2} y1={cy - 10} x2={x2} y2={cy + 10} stroke="#60a5fa" strokeWidth={2} />
                {w > 42 && (
                  <text
                    x={(x1 + x2) / 2} y={cy - 14}
                    textAnchor="middle" fontSize={11} fill="#3b82f6"
                    fontWeight="bold"
                    fontFamily="Inter,sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    Auto
                  </text>
                )}
              </g>
            );

          /* ── Walk: green zigzag ──────────────────────────────────── */
          case 'walk':
            return (
              <g key={i}>
                <path
                  d={walkPath(x1, x2, cy)}
                  stroke="#059669" strokeWidth={2.5}
                  fill="none" strokeLinecap="round" strokeLinejoin="round"
                />
                {w > 26 && (
                  <text
                    x={(x1 + x2) / 2} y={cy - 11}
                    textAnchor="middle" fontSize={10} fill="#065f46"
                    fontWeight="bold"
                    fontFamily="Inter,sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    Walk
                  </text>
                )}
              </g>
            );

          /* ── Idle: red dashed hollow box ────────────────────────── */
          case 'idle':
            return (
              <g key={i}>
                <rect
                  x={x1} y={cy - 13} width={Math.max(w, 2)} height={26}
                  fill="rgba(220,38,38,0.1)" stroke="#dc2626" strokeWidth={1.5}
                  strokeDasharray="4 2" rx={2}
                />
                {w > 24 && (
                  <text
                    x={(x1 + x2) / 2} y={cy + 4}
                    textAnchor="middle" fontSize={10} fill="#991b1b" fontWeight="bold"
                    fontFamily="Inter,sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    {w > 50 ? (seg.label ?? 'Idle') : 'I'}
                  </text>
                )}
              </g>
            );

          case 'empty':
            return null;

          default:
            return null;
        }
      })}
    </g>
  );
}
