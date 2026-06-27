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
}

function tX(t: number, totalDur: number, chartW: number, noLabel?: boolean): number {
  const lw = noLabel ? 0 : LABEL_WIDTH;
  const plotW = chartW - lw;
  return lw + (t / totalDur) * plotW;
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

export function TimelineRow({ segments, totalDuration, chartWidth, rowY, noLabel }: Props) {
  const cy = rowY + ROW_HEIGHT / 2;

  return (
    <g>
      {segments.map((seg, i) => {
        const x1 = tX(seg.start,              totalDuration, chartWidth, noLabel);
        const x2 = tX(seg.start + seg.duration, totalDuration, chartWidth, noLabel);
        const w  = Math.max(x2 - x1, 1);

        switch (seg.type) {
          /* ── Manual: thick solid light bar on dark background ──────── */
          case 'manual':
            return (
              <g key={i}>
                <line
                  x1={x1} y1={cy} x2={x2} y2={cy}
                  stroke="#e2e8f0" strokeWidth={MANUAL_W} strokeLinecap="butt"
                />
                {w > 22 && (
                  <text
                    x={(x1 + x2) / 2} y={cy - 11}
                    textAnchor="middle" fontSize={8.5} fill="#fbbf24"
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
                    textAnchor="middle" fontSize={8.5} fill="#60a5fa"
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
                  stroke="#34d399" strokeWidth={2.5}
                  fill="none" strokeLinecap="round" strokeLinejoin="round"
                />
                {w > 26 && (
                  <text
                    x={(x1 + x2) / 2} y={cy - 11}
                    textAnchor="middle" fontSize={8.5} fill="#34d399"
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
                  fill="rgba(239,68,68,0.08)" stroke="#f87171" strokeWidth={1.5}
                  strokeDasharray="4 2" rx={2}
                />
                {w > 24 && (
                  <text
                    x={(x1 + x2) / 2} y={cy + 4}
                    textAnchor="middle" fontSize={8.5} fill="#f87171" fontWeight="600"
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
