'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useChartStore } from '@/store/useChartStore';
import type { LayoutElement, LayoutConnection, ConnStyle, ConnArrow, ConnRouting } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import {
  ELEMENT_PALETTE, COLOR_PRESETS, shapeOf, defaultTextColor, expandGroupedSelection,
  elCenter, edgePoint, connectionPath, pointsToPath,
  arrowHeadPoints, polylineMidpoint, DASH_ARRAY, type Pt,
} from '@/lib/layout-utils';

const CANVAS_W = 2000; // logical maximum boundary
const CANVAS_H = 1000;
const MIN_SIZE = 24;
const HANDLE = 7;

type Corner = 'nw' | 'ne' | 'sw' | 'se';

// ────────────────────────────────────────────────────────────────────────────
//  Element shape (body + label + selection UI)
// ────────────────────────────────────────────────────────────────────────────
function ElementShape({
  el,
  selected,
  hovered,
  linkTarget,
  processHint,
  onPointerDown,
  onDoubleClick,
  onResizeStart,
  onRotateStart,
  onLinkStart,
  onHoverChange,
}: {
  el: LayoutElement;
  selected: boolean;
  hovered: boolean;
  linkTarget: boolean;
  processHint?: 'injection' | 'blow';
  onPointerDown: (e: React.MouseEvent | React.TouchEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent | React.TouchEvent, corner: Corner) => void;
  onRotateStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onLinkStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onHoverChange: (hovering: boolean) => void;
}) {
  const { width: w, height: h, label, color = '#64748b' } = el;
  const shape = shapeOf(el);
  const rotation = el.rotation ?? 0;
  const fontSize = el.fontSize ?? 11;
  const fontWeight = el.fontBold === false ? '500' : '700';
  const isWorker = el.type === 'worker';
  const iconKind = el.type === 'injection_machine' ? 'injection'
    : el.type === 'blow_molding_machine' ? 'blow'
    : el.type === 'machine' ? (/injection|ฉีด/i.test(label) ? 'injection' : /blow|เป่า/i.test(label) ? 'blow' : processHint)
    : undefined;
  const isProcessMachine = Boolean(iconKind);
  const textColor = el.textColor ?? defaultTextColor(color);

  const body = (() => {
    const common = { fill: color, fillOpacity: 0.88, stroke: color, strokeWidth: selected ? 2.5 : 1.5 };
    switch (shape) {
      case 'circle':
        return <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2} {...common} />;
      case 'ellipse':
        return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...common} />;
      case 'diamond':
        return <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} {...common} />;
      default:
        return <rect width={w} height={h} rx={6} {...common} />;
    }
  })();

  const corners: { corner: Corner; cx: number; cy: number; cursor: string }[] = [
    { corner: 'nw', cx: 0, cy: 0, cursor: 'nwse-resize' },
    { corner: 'ne', cx: w, cy: 0, cursor: 'nesw-resize' },
    { corner: 'sw', cx: 0, cy: h, cursor: 'nesw-resize' },
    { corner: 'se', cx: w, cy: h, cursor: 'nwse-resize' },
  ];

  // Edge-midpoint connection points (Excel-style): hover to reveal, drag to link.
  const linkDots = [
    { cx: w / 2, cy: 0 },
    { cx: w, cy: h / 2 },
    { cx: w / 2, cy: h },
    { cx: 0, cy: h / 2 },
  ];

  return (
    <g
      transform={`translate(${el.x}, ${el.y})`}
      onMouseDown={onPointerDown}
      onTouchStart={onPointerDown}
      onDoubleClick={onDoubleClick}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {/* Rotated visual content (shadow + body + label) */}
      <g transform={`rotate(${rotation}, ${w / 2}, ${h / 2})`} style={{ cursor: 'grab' }}>
        {isWorker ? (
          <>
            <rect width={w} height={h} fill="transparent" />
            <circle cx={w / 2} cy={h * 0.20} r={Math.min(w, h) * 0.10} fill={color} />
            <path d={`M ${w / 2} ${h * 0.32} L ${w / 2} ${h * 0.59} M ${w * 0.26} ${h * 0.40} L ${w * 0.74} ${h * 0.40} M ${w / 2} ${h * 0.59} L ${w * 0.30} ${h * 0.77} M ${w / 2} ${h * 0.59} L ${w * 0.70} ${h * 0.77}`}
              fill="none" stroke={color} strokeWidth={Math.max(5, w * 0.085)} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <rect x={3} y={3} width={w} height={h} rx={shape === 'circle' ? w / 2 : 6} fill="rgba(0,0,0,0.18)" />
            {body}
          </>
        )}
        {isProcessMachine && (
          <g transform={`translate(${w * 0.13}, ${h * 0.10}) scale(${w * 0.0074}, ${h * 0.012})`}
            fill="none" stroke={textColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
            {iconKind === 'injection' ? (
              <>
                <path d="M 3 4 H 25 L 19 16 H 9 Z" />
                <rect x={2} y={18} width={46} height={17} rx={2} />
                <path d="M 9 26 H 42 M 19 22 L 25 30 L 31 22 L 37 30" />
                <path d="M 49 26 H 61 M 56 21 L 62 26 L 56 31" />
                <rect x={64} y={12} width={8} height={30} />
                <rect x={82} y={12} width={8} height={30} />
                <path d="M 72 16 H 82 M 72 38 H 82" />
              </>
            ) : (
              <>
                <rect x={2} y={5} width={40} height={13} rx={2} />
                <path d="M 9 11 H 38 M 18 7 L 24 16 L 30 7" />
                <path d="M 42 11 H 51 V 20 H 62 M 57 16 L 62 21 L 57 26" />
                <path d="M 65 11 H 75 V 23 M 70 16 V 26" />
                <path d="M 55 24 L 66 24 L 64 41 L 57 41 Z M 84 24 L 73 24 L 75 41 L 82 41 Z" />
                <path d="M 66 31 H 73 M 66 36 H 73" />
              </>
            )}
          </g>
        )}
        <text
          x={w / 2} y={isWorker || isProcessMachine ? h - 5 : h / 2 + fontSize / 3}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight={fontWeight}
          fill={isWorker ? (el.textColor ?? '#0f172a') : textColor}
          fontFamily="Inter, sans-serif"
          pointerEvents="none"
          style={{ userSelect: 'none' }}
        >
          {label.length > 20 ? label.slice(0, 20) + '…' : label}
        </text>
      </g>

      {/* Axis-aligned selection UI (not rotated) */}
      {selected && (
        <>
          <rect
            x={-4} y={-4} width={w + 8} height={h + 8} rx={8}
            fill="none" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 2"
          />
          {/* Rotate handle */}
          <line x1={w / 2} y1={-4} x2={w / 2} y2={-20} stroke="#2563eb" strokeWidth={1.5} />
          <circle
            cx={w / 2} cy={-24} r={6}
            fill="#2563eb" stroke="#fff" strokeWidth={1.2}
            style={{ cursor: 'grab' }}
            onMouseDown={(e) => onRotateStart(e)}
            onTouchStart={(e) => onRotateStart(e)}
          />
          {/* Resize handles */}
          {corners.map(({ corner, cx, cy, cursor }) => (
            <rect
              key={corner}
              x={cx - HANDLE / 2} y={cy - HANDLE / 2}
              width={HANDLE} height={HANDLE} rx={1.5}
              fill="#fff" stroke="#2563eb" strokeWidth={1.5}
              style={{ cursor }}
              onMouseDown={(e) => onResizeStart(e, corner)}
              onTouchStart={(e) => onResizeStart(e, corner)}
            />
          ))}
        </>
      )}

      {/* Drop-target highlight while linking */}
      {linkTarget && (
        <rect
          x={-4} y={-4} width={w + 8} height={h + 8} rx={8}
          fill="#22c55e" fillOpacity={0.12} stroke="#22c55e" strokeWidth={2}
          pointerEvents="none"
        />
      )}

      {/* Excel-style connection points — appear on hover, drag to draw an arrow */}
      {hovered && !selected && (
        <>
          <rect x={-3} y={-3} width={w + 6} height={h + 6} rx={7} fill="none" stroke="#38bdf8" strokeWidth={1} strokeDasharray="3 2" pointerEvents="none" />
          {linkDots.map((d, i) => (
            <g key={i} style={{ cursor: 'crosshair' }}
               onMouseDown={onLinkStart} onTouchStart={onLinkStart}>
              {/* larger invisible hit area for easy grabbing */}
              <circle cx={d.cx} cy={d.cy} r={9} fill="transparent" />
              <circle cx={d.cx} cy={d.cy} r={4.5} fill="#38bdf8" stroke="#fff" strokeWidth={1.3} />
            </g>
          ))}
        </>
      )}
    </g>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//  Connection rendering
// ────────────────────────────────────────────────────────────────────────────
function ConnectionShape({
  conn, pts, selected, onSelect, onBodyDown,
}: {
  conn: LayoutConnection;
  pts: Pt[];
  selected: boolean;
  onSelect: () => void;
  onBodyDown?: (e: React.MouseEvent | React.TouchEvent) => void;
}) {
  const color = conn.color ?? '#64748b';
  const arrow: ConnArrow = conn.arrow ?? 'end';
  const style: ConnStyle = conn.style ?? 'solid';

  const d = pointsToPath(pts);
  const mid = polylineMidpoint(pts);

  const last = pts[pts.length - 1];
  const prevLast = pts[pts.length - 2] ?? pts[0];
  const first = pts[0];
  const secondFirst = pts[1] ?? pts[pts.length - 1];
  const isFree = !conn.fromId || !conn.toId; // draggable body only for free arrows

  return (
    <g
      onMouseDown={(e) => { e.stopPropagation(); onSelect(); onBodyDown?.(e); }}
      onTouchStart={(e) => { e.stopPropagation(); onSelect(); onBodyDown?.(e); }}
      onClick={(e) => e.stopPropagation()}
      style={{ cursor: isFree ? 'move' : 'pointer' }}
    >
      {/* Fat transparent hit area for easy clicking */}
      <path d={d} stroke="transparent" strokeWidth={14} fill="none" />
      {/* Visible line */}
      <path
        d={d}
        stroke={color}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray={DASH_ARRAY[style]}
        fill="none"
      />
      {/* Arrowheads (manual polygons so colour + export are reliable) */}
      {(arrow === 'end' || arrow === 'both') && (
        <polygon points={arrowHeadPoints(prevLast, last)} fill={color} />
      )}
      {arrow === 'both' && (
        <polygon points={arrowHeadPoints(secondFirst, first)} fill={color} />
      )}
      {/* Label */}
      {conn.label && (
        <g pointerEvents="none">
          <rect
            x={mid.x - conn.label.length * 4 - 6} y={mid.y - 10}
            width={conn.label.length * 8 + 12} height={20} rx={4}
            fill="#0f172a" stroke={color} strokeWidth={1} opacity={0.95}
          />
          <text x={mid.x} y={mid.y + 4.5} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#f8fafc" fontFamily="Inter, sans-serif">
            {conn.label}
          </text>
        </g>
      )}
      {selected && (
        <circle cx={mid.x} cy={mid.y} r={4} fill="#2563eb" stroke="#fff" strokeWidth={1} pointerEvents="none" />
      )}
    </g>
  );
}

// Draggable endpoint handles for a selected connector. Attached ends show a
// static grey dot; free ends show a blue draggable dot.
function ConnEndpoints({
  pts, fromAttached, toAttached, onGrab,
}: {
  pts: Pt[];
  fromAttached: boolean;
  toAttached: boolean;
  onGrab: (e: React.MouseEvent | React.TouchEvent, end: 'from' | 'to') => void;
}) {
  const ends: { pt: Pt; end: 'from' | 'to'; attached: boolean }[] = [
    { pt: pts[0], end: 'from', attached: fromAttached },
    { pt: pts[pts.length - 1], end: 'to', attached: toAttached },
  ];
  return (
    <>
      {ends.map(({ pt, end, attached }) => (
        <g
          key={end}
          style={{ cursor: attached ? 'default' : 'grab' }}
          onMouseDown={(e) => { if (!attached) onGrab(e, end); }}
          onTouchStart={(e) => { if (!attached) onGrab(e, end); }}
        >
          <circle cx={pt.x} cy={pt.y} r={10} fill="transparent" />
          <circle cx={pt.x} cy={pt.y} r={5} fill={attached ? '#94a3b8' : '#2563eb'} stroke="#fff" strokeWidth={1.5} />
        </g>
      ))}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//  Main component
// ────────────────────────────────────────────────────────────────────────────
export default function LayoutDiagram() {
  const activeFile   = useChartStore(s => s.activeFile());
  const addEl        = useChartStore(s => s.addLayoutElement);
  const updateEl     = useChartStore(s => s.updateLayoutElement);
  const updateMany   = useChartStore(s => s.updateLayoutElements);
  const deleteMany   = useChartStore(s => s.deleteLayoutElements);
  const addConn      = useChartStore(s => s.addLayoutConnection);
  const updateConn   = useChartStore(s => s.updateLayoutConnection);
  const deleteConn   = useChartStore(s => s.deleteLayoutConnection);

  const [selectedIds, setSelectedIds]       = useState<string[]>([]);
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [connectMode, setConnectMode]       = useState(false);
  const [connectFrom, setConnectFrom]       = useState<string | null>(null);
  const [hoveredId, setHoveredId]           = useState<string | null>(null);
  // Excel-style drag-to-connect: live rubber-band from a source element to the cursor.
  const [linking, setLinking]               = useState<{ sourceId: string; x: number; y: number; targetId: string | null } | null>(null);

  const dragRef   = useRef<{ positions: { id: string; x: number; y: number; width: number; height: number }[]; startX: number; startY: number } | null>(null);
  const marqueeRef = useRef<{ x: number; y: number; additive: boolean } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const resizeRef = useRef<{ id: string; corner: Corner; ox: number; oy: number; ow: number; oh: number; startX: number; startY: number } | null>(null);
  const rotateRef = useRef<{ id: string; cx: number; cy: number } | null>(null);
  // Free-arrow endpoint / body dragging
  const connDragRef = useRef<
    | { id: string; end: 'from' | 'to'; }
    | { id: string; end: 'body'; ofrom: Pt; oto: Pt; startX: number; startY: number }
    | null
  >(null);
  const svgRef    = useRef<SVGSVGElement>(null);

  // Keyboard delete for whichever item is selected
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const isLocked = Boolean(activeFile?.lockedAt);
      if (isLocked) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          updateMany(Object.fromEntries(selectedIds.map(id => [id, { groupId: undefined }])));
        } else if (selectedIds.length > 1) {
          const groupId = uuidv4();
          updateMany(Object.fromEntries(selectedIds.map(id => [id, { groupId }])));
        }
        return;
      }
      if (e.key === 'Escape') { setSelectedIds([]); setSelectedConnId(null); return; }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (selectedIds.length) { deleteMany(selectedIds); setSelectedIds([]); }
      else if (selectedConnId) { deleteConn(selectedConnId); setSelectedConnId(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteMany, deleteConn, updateMany, selectedIds, selectedConnId, activeFile?.lockedAt]);

  const pointer = useCallback((clientX: number, clientY: number): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }, []);

  if (!activeFile) return null;
  const isLocked = Boolean(activeFile.lockedAt);
  const { elements, connections } = activeFile.layoutDiagram;
  const getEl = (id: string) => elements.find(e => e.id === id);
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selectedEl = selectedId ? getEl(selectedId) : null;
  const selectedConn = selectedConnId ? connections.find(c => c.id === selectedConnId) : null;
  const selectedConnPts = selectedConn ? (connectionPath(selectedConn, getEl)?.pts ?? null) : null;
  const processHint = /injection|ฉีด/i.test(activeFile.header.processName) ? 'injection'
    : /blow|เป่า/i.test(activeFile.header.processName) ? 'blow' : undefined;

  // ── Element pointer down (move / connect) ──────────────────────────────────
  const onElementPointerDown = (e: React.MouseEvent | React.TouchEvent, el: LayoutElement) => {
    if (isLocked) return;
    e.stopPropagation();
    if (connectMode) {
      if (!connectFrom) {
        setConnectFrom(el.id);
      } else if (connectFrom !== el.id) {
        addConn({ fromId: connectFrom, toId: el.id, routing: 'straight', arrow: 'end', style: 'solid' });
        setConnectFrom(null);
        setConnectMode(false);
      }
      return;
    }
    const clicked = expandGroupedSelection(elements, [el.id]);
    if ('altKey' in e && e.altKey) {
      setSelectedIds([el.id]);
      setSelectedConnId(null);
      return;
    }
    const multi = 'shiftKey' in e && (e.shiftKey || e.ctrlKey || e.metaKey);
    if (multi) {
      setSelectedIds(current => clicked.every(id => current.includes(id))
        ? current.filter(id => !clicked.includes(id))
        : expandGroupedSelection(elements, [...current, ...clicked]));
      return;
    }
    const movingIds = selectedIds.length > 1 && selectedIds.includes(el.id) ? selectedIds : clicked;
    setSelectedIds(movingIds);
    setSelectedConnId(null);
    const c = 'touches' in e ? e.touches[0] : e;
    const p = pointer(c.clientX, c.clientY);
    dragRef.current = {
      positions: elements.filter(item => movingIds.includes(item.id)).map(item => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height })),
      startX: p.x, startY: p.y,
    };
  };

  const onResizeStart = (e: React.MouseEvent | React.TouchEvent, el: LayoutElement, corner: Corner) => {
    if (isLocked) return;
    e.stopPropagation();
    const c = 'touches' in e ? e.touches[0] : e;
    const p = pointer(c.clientX, c.clientY);
    resizeRef.current = { id: el.id, corner, ox: el.x, oy: el.y, ow: el.width, oh: el.height, startX: p.x, startY: p.y };
  };

  const onRotateStart = (e: React.MouseEvent | React.TouchEvent, el: LayoutElement) => {
    if (isLocked) return;
    e.stopPropagation();
    rotateRef.current = { id: el.id, cx: el.x + el.width / 2, cy: el.y + el.height / 2 };
  };

  // ── Start an Excel-style connection drag from an element ────────────────────
  const onLinkStart = (e: React.MouseEvent | React.TouchEvent, el: LayoutElement) => {
    if (isLocked) return;
    e.stopPropagation();
    const c = 'touches' in e ? e.touches[0] : e;
    const p = pointer(c.clientX, c.clientY);
    setSelectedIds([]);
    setSelectedConnId(null);
    setLinking({ sourceId: el.id, x: p.x, y: p.y, targetId: null });
  };

  // Topmost element (by draw order) whose box contains the point, excluding one id.
  const elementAt = (p: Pt, excludeId: string): LayoutElement | undefined => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.id === excludeId) continue;
      if (p.x >= el.x && p.x <= el.x + el.width && p.y >= el.y && p.y <= el.y + el.height) return el;
    }
    return undefined;
  };

  // ── Free-floating arrow (belongs to no element) ─────────────────────────────
  const addFreeArrow = () => {
    if (isLocked) return;
    const id = uuidv4();
    addConn({
      id,
      fromPt: { x: 220, y: 150 },
      toPt: { x: 400, y: 150 },
      arrow: 'end', style: 'solid', routing: 'straight', color: '#e2e8f0',
    });
    setSelectedConnId(id);
    setSelectedIds([]);
  };

  const onConnEndpointDown = (e: React.MouseEvent | React.TouchEvent, id: string, end: 'from' | 'to') => {
    if (isLocked) return;
    e.stopPropagation();
    connDragRef.current = { id, end };
  };

  const onConnBodyDown = (e: React.MouseEvent | React.TouchEvent, conn: LayoutConnection) => {
    if (isLocked) return;
    // Only free arrows (both ends floating) can be moved as a whole.
    if (conn.fromId || conn.toId || !conn.fromPt || !conn.toPt) return;
    const c = 'touches' in e ? e.touches[0] : e;
    const p = pointer(c.clientX, c.clientY);
    connDragRef.current = { id: conn.id, end: 'body', ofrom: conn.fromPt, oto: conn.toPt, startX: p.x, startY: p.y };
  };

  // ── Unified move handler ───────────────────────────────────────────────────
  const handleMove = (clientX: number, clientY: number) => {
    const p = pointer(clientX, clientY);

    if (linking) {
      const target = elementAt(p, linking.sourceId);
      setLinking({ ...linking, x: p.x, y: p.y, targetId: target ? target.id : null });
      return;
    }

    if (connDragRef.current) {
      const cd = connDragRef.current;
      const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
      if (cd.end === 'body') {
        const dx = p.x - cd.startX;
        const dy = p.y - cd.startY;
        updateConn(cd.id, {
          fromPt: { x: clamp(cd.ofrom.x + dx, CANVAS_W), y: clamp(cd.ofrom.y + dy, CANVAS_H) },
          toPt: { x: clamp(cd.oto.x + dx, CANVAS_W), y: clamp(cd.oto.y + dy, CANVAS_H) },
        });
      } else {
        const pt = { x: clamp(p.x, CANVAS_W), y: clamp(p.y, CANVAS_H) };
        updateConn(cd.id, cd.end === 'from' ? { fromPt: pt } : { toPt: pt });
      }
      return;
    }

    if (rotateRef.current) {
      const { id, cx, cy } = rotateRef.current;
      const deg = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90;
      updateEl(id, { rotation: Math.round(deg / 5) * 5 });
      return;
    }

    if (resizeRef.current) {
      const r = resizeRef.current;
      const dx = p.x - r.startX;
      const dy = p.y - r.startY;
      let nx = r.ox, ny = r.oy, nw = r.ow, nh = r.oh;
      if (r.corner.includes('e')) nw = r.ow + dx;
      if (r.corner.includes('s')) nh = r.oh + dy;
      if (r.corner.includes('w')) { nw = r.ow - dx; nx = r.ox + dx; }
      if (r.corner.includes('n')) { nh = r.oh - dy; ny = r.oy + dy; }
      if (nw < MIN_SIZE) { if (r.corner.includes('w')) nx = r.ox + (r.ow - MIN_SIZE); nw = MIN_SIZE; }
      if (nh < MIN_SIZE) { if (r.corner.includes('n')) ny = r.oy + (r.oh - MIN_SIZE); nh = MIN_SIZE; }
      updateEl(r.id, { x: Math.max(0, nx), y: Math.max(0, ny), width: Math.round(nw), height: Math.round(nh) });
      return;
    }

    if (dragRef.current) {
      const d = dragRef.current;
      const dx = Math.max(-Math.min(...d.positions.map(item => item.x)), Math.min(CANVAS_W - Math.max(...d.positions.map(item => item.x + item.width)), p.x - d.startX));
      const dy = Math.max(-Math.min(...d.positions.map(item => item.y)), Math.min(CANVAS_H - Math.max(...d.positions.map(item => item.y + item.height)), p.y - d.startY));
      updateMany(Object.fromEntries(d.positions.map(item => [item.id, { x: Math.round(item.x + dx), y: Math.round(item.y + dy) }])));
      return;
    }

    if (marqueeRef.current) {
      const start = marqueeRef.current;
      setMarquee({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) });
    }
  };

  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX, e.clientY);
  const onTouchMove = (e: React.TouchEvent) => { if (e.touches.length) handleMove(e.touches[0].clientX, e.touches[0].clientY); };
  const endPointer  = () => {
    if (linking) {
      if (linking.targetId && linking.targetId !== linking.sourceId) {
        addConn({ fromId: linking.sourceId, toId: linking.targetId, routing: 'straight', arrow: 'end', style: 'solid' });
      }
      setLinking(null);
    }
    if (marqueeRef.current && marquee) {
      const ids = elements.filter(el => el.x < marquee.x + marquee.width && el.x + el.width > marquee.x && el.y < marquee.y + marquee.height && el.y + el.height > marquee.y).map(el => el.id);
      setSelectedIds(current => expandGroupedSelection(elements, marqueeRef.current?.additive ? [...current, ...ids] : ids));
    }
    marqueeRef.current = null;
    setMarquee(null);
    dragRef.current = null; resizeRef.current = null; rotateRef.current = null; connDragRef.current = null;
  };

  const onCanvasDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target !== e.currentTarget && (e.target as Element).id !== 'layout-grid-background') return;
    if (connectMode) return;
    const p = pointer(e.clientX, e.clientY);
    if (!e.shiftKey) setSelectedIds([]);
    setSelectedConnId(null);
    if (!isLocked) marqueeRef.current = { ...p, additive: e.shiftKey };
  };

  const groupSelected = () => {
    if (isLocked || selectedIds.length < 2) return;
    const groupId = uuidv4();
    updateMany(Object.fromEntries(selectedIds.map(id => [id, { groupId }])));
  };
  const ungroupSelected = () => {
    if (isLocked || !selectedIds.length) return;
    updateMany(Object.fromEntries(selectedIds.map(id => [id, { groupId: undefined }])));
  };

  const addFromPalette = (type: string) => {
    if (isLocked) return;
    const p = ELEMENT_PALETTE.find(x => x.type === type)!;
    addEl({ type: p.type, label: p.label, x: 70, y: 70, width: p.w, height: p.h, color: p.color, shape: p.shape });
  };

  const equipment = ELEMENT_PALETTE.filter(p => p.group === 'equipment');
  const shapes    = ELEMENT_PALETTE.filter(p => p.group === 'shape');

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
      {/* Header */}
      <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
        <h3 className="text-slate-700 font-bold text-sm tracking-wide">WORKSTATION LAYOUT DIAGRAM</h3>
        <div className="flex items-center gap-2">
          <button onClick={groupSelected} disabled={isLocked || selectedIds.length < 2}
            className="px-2 py-1 text-xs font-semibold rounded bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Group selected shapes and move them together">Group ({selectedIds.length})</button>
          <button onClick={ungroupSelected} disabled={isLocked || !selectedIds.some(id => getEl(id)?.groupId)}
            className="px-2 py-1 text-xs font-semibold rounded border border-slate-300 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Separate the selected group">Ungroup</button>
          <button
            onClick={addFreeArrow}
            disabled={isLocked}
            className="px-2 py-1 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
            title="Add a free-floating arrow you can place anywhere"
          >
            ➘ Free Arrow
          </button>
          <button
            onClick={() => { setConnectMode(m => !m); setConnectFrom(null); }}
            disabled={isLocked}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors cursor-pointer shadow-sm border disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 ${
              connectMode ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
            title="Alternative: click this, then click two boxes"
          >
            {connectMode ? (connectFrom ? '→ Click target' : '→ Click source') : '↔ Connect boxes'}
          </button>
        </div>
      </div>

      {/* Palette */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider w-14">Equip.</span>
          {equipment.map(p => (
            <button
              key={p.type}
              onClick={() => addFromPalette(p.type)}
              disabled={isLocked}
              className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              title={`Add ${p.label}`}
            >
              <span>{p.icon}</span> {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider w-14">Shapes</span>
          {shapes.map(p => (
            <button
              key={p.type}
              onClick={() => addFromPalette(p.type)}
              disabled={isLocked}
              className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              title={`Add ${p.label}`}
            >
              <span>{p.icon}</span> {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="overflow-auto bg-slate-100 p-2">
        <svg
          ref={svgRef}
          id="layout-diagram-svg"
          width="100%"
          height={600}
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, display: 'block', cursor: isLocked ? 'not-allowed' : 'default', opacity: isLocked ? 0.7 : 1, touchAction: 'none' }}
          onMouseMove={onMouseMove}
          onMouseDown={onCanvasDown}
          onTouchMove={onTouchMove}
          onMouseUp={endPointer}
          onTouchEnd={endPointer}
          onMouseLeave={endPointer}
          onContextMenu={(e) => e.preventDefault()}
        >
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect id="layout-grid-background" width="100%" height="100%" fill="url(#grid)" />

          {/* Connections (under elements) */}
          {connections.map(c => {
            const path = connectionPath(c, getEl);
            if (!path) return null;
            return (
              <ConnectionShape
                key={c.id}
                conn={c}
                pts={path.pts}
                selected={selectedConnId === c.id}
                onSelect={() => { setSelectedConnId(c.id); setSelectedIds([]); }}
                onBodyDown={(e) => onConnBodyDown(e, c)}
              />
            );
          })}

          {/* Elements */}
          {elements.map(el => (
            <ElementShape
              key={el.id}
              el={el}
              selected={selectedIds.includes(el.id)}
              hovered={hoveredId === el.id && !linking && !connectMode}
              linkTarget={linking?.targetId === el.id}
              processHint={processHint}
              onPointerDown={e => onElementPointerDown(e, el)}
              onDoubleClick={() => { setSelectedIds(expandGroupedSelection(elements, [el.id])); setSelectedConnId(null); }}
              onResizeStart={(e, corner) => onResizeStart(e, el, corner)}
              onRotateStart={e => onRotateStart(e, el)}
              onLinkStart={e => onLinkStart(e, el)}
              onHoverChange={hovering => setHoveredId(hovering ? el.id : (cur => cur === el.id ? null : cur))}
            />
          ))}

          {marquee && <rect x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height}
            fill="#2563eb" fillOpacity={0.12} stroke="#2563eb" strokeDasharray="5 3" pointerEvents="none" />}

          {/* Live rubber-band while drawing a connection */}
          {linking && getEl(linking.sourceId) && (() => {
            const src = getEl(linking.sourceId)!;
            const start = edgePoint(src, { x: linking.x, y: linking.y });
            const end = linking.targetId && getEl(linking.targetId)
              ? edgePoint(getEl(linking.targetId)!, elCenter(src))
              : { x: linking.x, y: linking.y };
            return (
              <g pointerEvents="none">
                <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#38bdf8" strokeWidth={2} strokeDasharray="5 3" />
                <polygon points={arrowHeadPoints(start, end)} fill="#38bdf8" />
              </g>
            );
          })()}

          {/* Endpoint handles for the selected connector (on top of elements) */}
          {selectedConn && selectedConnPts && (
            <ConnEndpoints
              pts={selectedConnPts}
              fromAttached={!!selectedConn.fromId}
              toAttached={!!selectedConn.toId}
              onGrab={(e, end) => onConnEndpointDown(e, selectedConn.id, end)}
            />
          )}

          {/* Connect-source highlight (click-click fallback mode) */}
          {connectFrom && getEl(connectFrom) && (() => {
            const c = elCenter(getEl(connectFrom)!);
            return <circle cx={c.x} cy={c.y} r={8} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="3 2" />;
          })()}

          {elements.length === 0 && !connectMode && (
            <text x="50%" y="50%" textAnchor="middle" fill="#94a3b8" fontSize={14}>
              Drag items from the palette above to build layout
            </text>
          )}
        </svg>

        {/* ── Element property panel ─────────────────────────────────────────── */}
        {selectedIds.length > 1 && (
          <div className={PANEL}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">{selectedIds.length} elements selected</span>
              <button onClick={() => { deleteMany(selectedIds); setSelectedIds([]); }} disabled={isLocked}
                className="px-2 py-0.5 text-xs font-semibold rounded bg-red-600 text-white disabled:opacity-50">✕ Delete selected</button>
            </div>
            <p className="text-xs text-slate-600">Drag any selected element to move all. Group with Ctrl+G and ungroup with Ctrl+Shift+G. Alt-click a group member to edit its properties.</p>
          </div>
        )}
        {selectedEl && (
          <ElementPanel
            el={selectedEl}
            onChange={(patch) => updateEl(selectedEl.id, patch)}
            onDelete={() => { deleteMany([selectedEl.id]); setSelectedIds([]); }}
            disabled={isLocked}
          />
        )}

        {/* ── Connection property panel ──────────────────────────────────────── */}
        {selectedConn && (
          <ConnectionPanel
            conn={selectedConn}
            onChange={(patch) => updateConn(selectedConn.id, patch)}
            onDelete={() => { deleteConn(selectedConn.id); setSelectedConnId(null); }}
            disabled={isLocked}
          />
        )}

        {!selectedIds.length && !selectedConn && (
          <p className="text-xs text-slate-500 mt-2 px-1 leading-relaxed">
            <b className="text-blue-600">Connect boxes (Excel-style):</b> hover a box, then drag a blue dot onto another box.
            <br />
            <b className="text-blue-600">Free arrow:</b> click <b>➘ Free Arrow</b>, then drag its blue endpoints anywhere · edit colour, solid/dashed, and arrowheads in the panel.
            <br />
            Drag on empty canvas to select many · Shift-click to add · Group to keep them together · Alt-click one group member to edit ·
            drag body to move · drag a corner to resize · drag the top dot to rotate ·
            press <kbd className="bg-slate-100 border border-slate-300 text-slate-600 px-1 rounded shadow-sm">Del</kbd> to remove
          </p>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//  Property panels
// ────────────────────────────────────────────────────────────────────────────
const PANEL = 'mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5';
const ROW = 'flex items-center gap-2 flex-wrap';
const LBL = 'text-[10px] font-bold text-slate-600 uppercase tracking-wider w-16 shrink-0';
const INPUT = 'bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none';

function Swatches({ value, onPick, disabled }: { value?: string; onPick: (c: string) => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {COLOR_PRESETS.map(c => (
        <button
          key={c}
          onClick={() => onPick(c)}
          disabled={disabled}
          className="w-5 h-5 rounded border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: c, borderColor: value === c ? '#fff' : 'rgba(255,255,255,0.2)', outline: value === c ? '2px solid #2563eb' : 'none' }}
          title={c}
        />
      ))}
      <input
        type="color"
        value={value ?? '#64748b'}
        onChange={e => onPick(e.target.value)}
        disabled={disabled}
        className="w-6 h-6 bg-transparent border border-slate-300 rounded cursor-pointer p-0 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Custom colour"
      />
    </div>
  );
}

function ElementPanel({
  el, onChange, onDelete, disabled,
}: {
  el: LayoutElement;
  onChange: (patch: Partial<LayoutElement>) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <div className={PANEL}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800">Element</span>
        <button onClick={onDelete} disabled={disabled} className="px-2 py-0.5 text-xs font-semibold rounded bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100">✕ Delete</button>
      </div>

      <div className={ROW}>
        <span className={LBL}>Label</span>
        <input
          type="text"
          value={el.label}
          onChange={e => onChange({ label: e.target.value })}
          disabled={disabled}
          className={`${INPUT} flex-1 min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100`}
          placeholder="Name…"
        />
      </div>

      <div className={ROW}>
        <span className={LBL}>Shape</span>
        <Swatches value={el.color} onPick={c => onChange({ color: c })} disabled={disabled} />
      </div>

      <div className={ROW}>
        <span className={LBL}>Text</span>
        <Swatches value={el.textColor ?? (el.type === 'worker' ? '#0f172a' : defaultTextColor(el.color ?? '#64748b'))}
          onPick={c => onChange({ textColor: c })} disabled={disabled} />
        {el.textColor && <button onClick={() => onChange({ textColor: undefined })} disabled={disabled}
          className="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-700 disabled:opacity-50">Auto</button>}
      </div>

      <div className={ROW}>
        <span className={LBL}>Font</span>
        <select value={el.fontSize ?? 11} onChange={e => onChange({ fontSize: Number(e.target.value) })} disabled={disabled} className={`${INPUT} disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100`}>
          {[9, 10, 11, 12, 14, 16, 18, 22].map(s => <option key={s} value={s}>{s}px</option>)}
        </select>
        <button
          onClick={() => onChange({ fontBold: el.fontBold === false })}
          disabled={disabled}
          className={`px-2 py-1 text-xs rounded border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 ${el.fontBold === false ? 'bg-white border-slate-300 text-slate-600' : 'bg-blue-600 border-blue-600 text-white shadow-sm'}`}
        >
          <b>B</b> Bold
        </button>
      </div>

      <div className={ROW}>
        <span className={LBL}>Size</span>
        <input type="number" min={MIN_SIZE} value={Math.round(el.width)} onChange={e => onChange({ width: Math.max(MIN_SIZE, Number(e.target.value) || MIN_SIZE) })} disabled={disabled} className={`${INPUT} w-16 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100`} title="Width" />
        <span className="text-slate-500 text-xs">×</span>
        <input type="number" min={MIN_SIZE} value={Math.round(el.height)} onChange={e => onChange({ height: Math.max(MIN_SIZE, Number(e.target.value) || MIN_SIZE) })} disabled={disabled} className={`${INPUT} w-16 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100`} title="Height" />
      </div>

      <div className={ROW}>
        <span className={LBL}>Rotate</span>
        <input
          type="range" min={0} max={360} step={5}
          value={el.rotation ?? 0}
          onChange={e => onChange({ rotation: Number(e.target.value) })}
          disabled={disabled}
          className="flex-1 min-w-[100px] accent-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span className="text-xs text-slate-600 font-mono w-10 text-right">{el.rotation ?? 0}°</span>
        <button onClick={() => onChange({ rotation: 0 })} disabled={disabled} className="px-2 py-1 text-xs rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100">Reset</button>
      </div>
    </div>
  );
}

function ConnectionPanel({
  conn, onChange, onDelete, disabled,
}: {
  conn: LayoutConnection;
  onChange: (patch: Partial<LayoutConnection>) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const seg = (active: boolean) =>
    `px-2 py-1 text-xs rounded border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 ${active ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm'}`;
  const isFree = !conn.fromId || !conn.toId;

  return (
    <div className={PANEL}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800">
          {isFree ? 'Free Arrow' : 'Connection'}
          {isFree && <span className="ml-2 font-normal text-slate-500">drag the blue endpoints to reposition</span>}
        </span>
        <button onClick={onDelete} disabled={disabled} className="px-2 py-0.5 text-xs font-semibold rounded bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100">✕ Delete</button>
      </div>

      <div className={ROW}>
        <span className={LBL}>Label</span>
        <input
          type="text"
          value={conn.label ?? ''}
          onChange={e => onChange({ label: e.target.value })}
          disabled={disabled}
          className={`${INPUT} flex-1 min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100`}
          placeholder="e.g. Walk 5s"
        />
      </div>

      <div className={ROW}>
        <span className={LBL}>Colour</span>
        <Swatches value={conn.color} onPick={c => onChange({ color: c })} disabled={disabled} />
      </div>

      <div className={ROW}>
        <span className={LBL}>Line</span>
        {(['solid', 'dashed', 'dotted'] as ConnStyle[]).map(s => (
          <button key={s} onClick={() => onChange({ style: s })} disabled={disabled} className={seg((conn.style ?? 'solid') === s)}>{s}</button>
        ))}
      </div>

      <div className={ROW}>
        <span className={LBL}>Arrow</span>
        {([['end', 'End →'], ['both', '↔ Both'], ['none', 'None']] as [ConnArrow, string][]).map(([v, t]) => (
          <button key={v} onClick={() => onChange({ arrow: v })} disabled={disabled} className={seg((conn.arrow ?? 'end') === v)}>{t}</button>
        ))}
      </div>

      <div className={ROW}>
        <span className={LBL}>Path</span>
        {([['straight', 'Straight'], ['orthogonal', 'Right-angle']] as [ConnRouting, string][]).map(([v, t]) => (
          <button key={v} onClick={() => onChange({ routing: v })} disabled={disabled} className={seg((conn.routing ?? 'straight') === v)}>{t}</button>
        ))}
      </div>
    </div>
  );
}
