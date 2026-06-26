'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useChartStore } from '@/store/useChartStore';
import type { LayoutElement, LayoutElementType } from '@/types';

// ─── Palette ─────────────────────────────────────────────────────────────────
const ELEMENT_PALETTE: { type: LayoutElementType; label: string; icon: string; color: string; w: number; h: number }[] = [
  { type: 'machine',   label: 'Machine',       icon: '⚙️',  color: '#3b82f6', w: 140, h: 72 },
  { type: 'table',     label: 'Table',         icon: '🗂️',  color: '#6b7280', w: 120, h: 56 },
  { type: 'rack',      label: 'Rack / Shelf',  icon: '📦',  color: '#10b981', w: 100, h: 56 },
  { type: 'worker',    label: 'Worker Pos.',   icon: '👷',  color: '#f59e0b', w: 64,  h: 64 },
  { type: 'conveyor',  label: 'Conveyor',      icon: '➡️',  color: '#8b5cf6', w: 200, h: 32 },
  { type: 'label',     label: 'Label',         icon: '🏷️',  color: '#374151', w: 100, h: 36 },
];

const CANVAS_W = 680;
const CANVAS_H = 380;

function ElementShape({
  el,
  selected,
  onMouseDown,
  onDoubleClick,
  onDelete,
}: {
  el: LayoutElement;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent | React.TouchEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onDelete: () => void;
}) {
  const { x, y, width: w, height: h, label, type, color } = el;
  const isWorker  = type === 'worker';
  const isConveyor = type === 'conveyor';

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: 'grab' }}
      onMouseDown={onMouseDown}
      onTouchStart={onMouseDown}
      onDoubleClick={onDoubleClick}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Shadow */}
      <rect x={3} y={3} width={w} height={h} rx={isWorker ? w / 2 : 6} fill="rgba(0,0,0,0.12)" />

      {/* Body */}
      {isWorker ? (
        <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2} fill={color} opacity={0.9} />
      ) : (
        <rect
          width={w} height={h} rx={6}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth={selected ? 2.5 : 1.5}
          strokeDasharray={selected ? undefined : undefined}
        />
      )}

      {/* Selection ring */}
      {selected && (
        <rect
          x={-3} y={-3} width={w + 6} height={h + 6} rx={8}
          fill="none" stroke="#2563eb" strokeWidth={2} strokeDasharray="4 2"
        />
      )}

      {/* Label */}
      <text
        x={w / 2} y={h / 2 + 4}
        textAnchor="middle"
        fontSize={isWorker ? 10 : isConveyor ? 10 : 11}
        fontWeight="600"
        fill={color}
        fontFamily="Inter, sans-serif"
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {label.length > 16 ? label.slice(0, 16) + '…' : label}
      </text>

      {/* Delete button (small red circle with 'x') on top-right of selected element */}
      {selected && (
        <g
          transform={`translate(${w - 6}, 6)`}
          style={{ cursor: 'pointer' }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <circle r="8" fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
          <path
            d="M -2.5 -2.5 L 2.5 2.5 M -2.5 2.5 L 2.5 -2.5"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
}

export default function LayoutDiagram() {
  const activeFile         = useChartStore(s => s.activeFile());
  const addEl              = useChartStore(s => s.addLayoutElement);
  const updateEl           = useChartStore(s => s.updateLayoutElement);
  const deleteEl           = useChartStore(s => s.deleteLayoutElement);
  const addConn            = useChartStore(s => s.addLayoutConnection);
  const deleteConn         = useChartStore(s => s.deleteLayoutConnection);

  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [editing, setEditing]               = useState<{ id: string; value: string } | null>(null);
  const [connectMode, setConnectMode]       = useState(false);
  const [connectFrom, setConnectFrom]       = useState<string | null>(null);

  const dragRef    = useRef<{ id: string; ox: number; oy: number; startX: number; startY: number } | null>(null);
  const svgRef     = useRef<SVGSVGElement>(null);
  // Keep a ref to the latest selectedId so keyboard/delete handlers always see current value
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  // Keyboard delete support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdRef.current && !editing) {
        deleteEl(selectedIdRef.current);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteEl, editing]);

  if (!activeFile) return null;
  const { elements, connections } = activeFile.layoutDiagram;

  const getEl = (id: string) => elements.find(e => e.id === id);

  // ── Drag ────────────────────────────────────────────────────────────────────
  const onMouseDownEl = useCallback(
    (e: React.MouseEvent | React.TouchEvent, el: LayoutElement) => {
      e.stopPropagation();
      if (connectMode) {
        if (!connectFrom) {
          setConnectFrom(el.id);
        } else if (connectFrom !== el.id) {
          addConn({ fromId: connectFrom, toId: el.id });
          setConnectFrom(null);
          setConnectMode(false);
        }
        return;
      }
      setSelectedId(el.id);

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const svgRect = svgRef.current!.getBoundingClientRect();
      dragRef.current = {
        id: el.id,
        ox: el.x,
        oy: el.y,
        startX: clientX - svgRect.left,
        startY: clientY - svgRect.top,
      };
    },
    [connectMode, connectFrom, addConn]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragRef.current) return;
      const svgRect = svgRef.current!.getBoundingClientRect();
      const dx = clientX - svgRect.left - dragRef.current.startX;
      const dy = clientY - svgRect.top - dragRef.current.startY;
      const nx = Math.max(0, dragRef.current.ox + dx);
      const ny = Math.max(0, dragRef.current.oy + dy);
      updateEl(dragRef.current.id, { x: nx, y: ny });
    },
    [updateEl]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleMove]
  );

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  // ── Double-click to edit ────────────────────────────────────────────────────
  const onDblClick = useCallback(
    (e: React.MouseEvent, el: LayoutElement) => {
      e.stopPropagation();
      setEditing({ id: el.id, value: el.label });
    },
    []
  );

  const commitEdit = () => {
    if (!editing) return;
    updateEl(editing.id, { label: editing.value });
    setEditing(null);
  };

  // ── Connection line midpoints ───────────────────────────────────────────────
  function elCenter(el: LayoutElement) {
    return { cx: el.x + el.width / 2, cy: el.y + el.height / 2 };
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-2.5 flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm tracking-wide">WORKSTATION LAYOUT DIAGRAM</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setConnectMode(m => !m); setConnectFrom(null); }}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
              connectMode ? 'bg-amber-400 text-white' : 'bg-slate-500 hover:bg-slate-400 text-white'
            }`}
          >
            {connectMode ? (connectFrom ? '→ Click target' : '→ Click source') : '↔ Connect'}
          </button>
          {selectedId && (
            <button
              // Use onMouseDown instead of onClick so it fires BEFORE the SVG's onClick
              // that would clear the selection, allowing the delete to always work
              onMouseDown={(e) => {
                e.stopPropagation();
                deleteEl(selectedId);
                setSelectedId(null);
              }}
              className="px-2 py-1 text-xs font-semibold rounded bg-red-500 hover:bg-red-400 text-white transition-colors"
            >
              ✕ Delete
            </button>
          )}
        </div>
      </div>

      {/* Palette */}
      <div className="bg-slate-50 border-b border-gray-200 px-4 py-2 flex flex-wrap gap-2">
        {ELEMENT_PALETTE.map(p => (
          <button
            key={p.type}
            onClick={() => addEl({ type: p.type, label: p.label, x: 60, y: 60, width: p.w, height: p.h, color: p.color })}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded text-xs font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm"
          >
            <span>{p.icon}</span> {p.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="overflow-auto bg-gray-50 p-2">
        <svg
          ref={svgRef}
          id="layout-diagram-svg"
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, display: 'block', cursor: 'default', touchAction: 'none' }}
          onMouseMove={onMouseMove}
          onTouchMove={onTouchMove}
          onMouseUp={onMouseUp}
          onTouchEnd={onMouseUp}
          onMouseLeave={onMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => { if (!connectMode) setSelectedId(null); }}
          onTouchStart={() => { if (!connectMode) setSelectedId(null); }}
        >
          {/* Grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />

          {/* Connections */}
          <defs>
            <marker id="conn-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M 0 0 L 6 3 L 0 6 Z" fill="#94a3b8" />
            </marker>
          </defs>
          {connections.map(c => {
            const from = getEl(c.fromId);
            const to   = getEl(c.toId);
            if (!from || !to) return null;
            const { cx: x1, cy: y1 } = elCenter(from);
            const { cx: x2, cy: y2 } = elCenter(to);
            return (
              <g key={c.id} onClick={e => { e.stopPropagation(); deleteConn(c.id); }}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#94a3b8" strokeWidth={2}
                  markerEnd="url(#conn-arrow)"
                  style={{ cursor: 'pointer' }}
                />
              </g>
            );
          })}

          {/* Elements */}
          {elements.map(el => (
            <ElementShape
              key={el.id}
              el={el}
              selected={selectedId === el.id}
              onMouseDown={e => onMouseDownEl(e, el)}
              onDoubleClick={e => onDblClick(e, el)}
              onDelete={() => {
                deleteEl(el.id);
                setSelectedId(null);
              }}
            />
          ))}

          {/* Hint text */}
          {elements.length === 0 && (
            <text x={CANVAS_W / 2} y={CANVAS_H / 2} textAnchor="middle" fill="#d1d5db" fontSize={14}>
              Click palette items above to add equipment
            </text>
          )}
        </svg>

        {/* Inline edit overlay */}
        {editing && (() => {
          const el = getEl(editing.id);
          if (!el) return null;
          return (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Edit label:</span>
              <input
                autoFocus
                type="text"
                value={editing.value}
                onChange={e => setEditing({ ...editing, value: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null); }}
                className="border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none"
              />
              <button onClick={commitEdit} className="px-2 py-1 text-xs bg-blue-500 text-white rounded">Save</button>
              <button onClick={() => setEditing(null)} className="px-2 py-1 text-xs bg-gray-200 rounded">Cancel</button>
            </div>
          );
        })()}

        {/* Tip */}
        <p className="text-xs text-gray-400 mt-2 px-1">
          Drag to move · Click to select then press <kbd className="bg-gray-100 border border-gray-300 rounded px-1">Del</kbd> or use ✕ Delete button · Double-click to rename · Use "↔ Connect" to draw arrows · Click an arrow to delete it
        </p>
      </div>
    </div>
  );
}
