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
}

function tX(t: number, totalDur: number, chartW: number): number {
  const plotW = chartW - LABEL_WIDTH;
  return LABEL_WIDTH + (t / totalDur) * plotW;
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

export function TimelineRow({ segments, totalDuration, chartWidth, rowY }: Props) {
  const cy = rowY + ROW_HEIGHT / 2;

  return (
    <g>
      {segments.map((seg, i) => {
        const x1 = tX(seg.start,              totalDuration, chartWidth);
        const x2 = tX(seg.start + seg.duration, totalDuration, chartWidth);
        const w  = Math.max(x2 - x1, 1);

        switch (seg.type) {
          /* ── Manual: thick solid black bar ─────────────────────────── */
          case 'manual':
            return (
              <g key={i}>
                <line
                  x1={x1} y1={cy} x2={x2} y2={cy}
                  stroke="#111827" strokeWidth={MANUAL_W} strokeLinecap="butt"
                />
                {w > 22 && (
                  <text
                    x={(x1 + x2) / 2} y={cy - 11}
                    textAnchor="middle" fontSize={8.5} fill="#374151"
                    fontFamily="Inter,sans-serif"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {seg.label && seg.label.length > 16
                      ? seg.label.slice(0, 16) + '…'
                      : (seg.label ?? '')}
                  </text>
                )}
              </g>
            );

          /* ── Auto M/C: thin line + vertical end markers ─────────────── */
          case 'machine':
            return (
              <g key={i}>
                <line x1={x1} y1={cy} x2={x2} y2={cy} stroke="#1d4ed8" strokeWidth={AUTO_W} />
                <line x1={x1} y1={cy - 10} x2={x1} y2={cy + 10} stroke="#1d4ed8" strokeWidth={2} />
                <line x1={x2} y1={cy - 10} x2={x2} y2={cy + 10} stroke="#1d4ed8" strokeWidth={2} />
                {w > 42 && (
                  <text
                    x={(x1 + x2) / 2} y={cy - 14}
                    textAnchor="middle" fontSize={8.5} fill="#1d4ed8"
                    fontFamily="Inter,sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    Auto
                  </text>
                )}
              </g>
            );

          /* ── Walk: zigzag ────────────────────────────────────────────── */
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
                    textAnchor="middle" fontSize={8.5} fill="#059669"
                    fontFamily="Inter,sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    Walk
                  </text>
                )}
              </g>
            );

          /* ── Idle: dashed hollow box + red text ──────────────────────── */
          case 'idle':
            return (
              <g key={i}>
                <rect
                  x={x1} y={cy - 13} width={Math.max(w, 2)} height={26}
                  fill="none" stroke="#ef4444" strokeWidth={1.5}
                  strokeDasharray="4 2" rx={2}
                />
                {w > 24 && (
                  <text
                    x={(x1 + x2) / 2} y={cy + 4}
                    textAnchor="middle" fontSize={8.5} fill="#ef4444" fontWeight="600"
                    fontFamily="Inter,sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    {w > 50 ? (seg.label ?? 'Idle') : 'I'}
                  </text>
                )}
              </g>
            );

          default:
            return null;
        }
      })}
    </g>
  );
}
