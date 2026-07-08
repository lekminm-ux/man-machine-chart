import type { LayoutElement, LayoutElementType, LayoutShape } from '@/types';

// ── Palette definition (single source of truth for defaults) ────────────────
export interface PaletteItem {
  type: LayoutElementType;
  label: string;
  icon: string;
  color: string;
  w: number;
  h: number;
  shape: LayoutShape;
  group: 'equipment' | 'shape';
}

export const ELEMENT_PALETTE: PaletteItem[] = [
  // Equipment
  { type: 'machine',    label: 'Machine',      icon: '⚙️', color: '#3b82f6', w: 140, h: 72, shape: 'rect',    group: 'equipment' },
  { type: 'table',      label: 'Table',        icon: '🗂️', color: '#6b7280', w: 120, h: 56, shape: 'rect',    group: 'equipment' },
  { type: 'rack',       label: 'Rack / Shelf', icon: '📦', color: '#10b981', w: 100, h: 56, shape: 'rect',    group: 'equipment' },
  { type: 'worker',     label: 'Worker Pos.',  icon: '👷', color: '#f59e0b', w: 64,  h: 64, shape: 'circle',  group: 'equipment' },
  { type: 'conveyor',   label: 'Conveyor',     icon: '➡️', color: '#8b5cf6', w: 200, h: 32, shape: 'rect',    group: 'equipment' },
  { type: 'robot',      label: 'Robot',        icon: '🦾', color: '#6366f1', w: 90,  h: 64, shape: 'rect',    group: 'equipment' },
  { type: 'jig',        label: 'Jig / Fixture',icon: '🧲', color: '#14b8a6', w: 96,  h: 52, shape: 'rect',    group: 'equipment' },
  { type: 'inspection', label: 'Inspection',   icon: '🔍', color: '#ec4899', w: 84,  h: 84, shape: 'diamond', group: 'equipment' },
  { type: 'buffer',     label: 'Buffer / WIP', icon: '📥', color: '#f97316', w: 96,  h: 56, shape: 'rect',    group: 'equipment' },
  { type: 'pallet',     label: 'Pallet',       icon: '🟫', color: '#a16207', w: 84,  h: 56, shape: 'rect',    group: 'equipment' },
  { type: 'door',       label: 'Door',         icon: '🚪', color: '#94a3b8', w: 44,  h: 64, shape: 'rect',    group: 'equipment' },
  { type: 'label',      label: 'Label',        icon: '🏷️', color: '#cbd5e1', w: 100, h: 36, shape: 'rect',    group: 'equipment' },
  // Basic shapes
  { type: 'shape_rect',    label: 'Box',     icon: '▭', color: '#64748b', w: 100, h: 64, shape: 'rect',    group: 'shape' },
  { type: 'shape_circle',  label: 'Circle',  icon: '⬤', color: '#64748b', w: 72,  h: 72, shape: 'circle',  group: 'shape' },
  { type: 'shape_diamond', label: 'Diamond', icon: '◆', color: '#64748b', w: 80,  h: 80, shape: 'diamond', group: 'shape' },
  { type: 'shape_ellipse', label: 'Ellipse', icon: '⬭', color: '#64748b', w: 110, h: 64, shape: 'ellipse', group: 'shape' },
];

const PALETTE_BY_TYPE: Record<string, PaletteItem> =
  Object.fromEntries(ELEMENT_PALETTE.map(p => [p.type, p]));

/** The shape an element should render as (explicit override, else the type default). */
export function shapeOf(el: Pick<LayoutElement, 'type' | 'shape'>): LayoutShape {
  return el.shape ?? PALETTE_BY_TYPE[el.type]?.shape ?? 'rect';
}

// ── Preset colours offered in the property panel ────────────────────────────
export const COLOR_PRESETS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#f59e0b', '#10b981', '#14b8a6', '#6b7280', '#94a3b8', '#111827',
];

// ── Geometry ────────────────────────────────────────────────────────────────
export interface Pt { x: number; y: number; }

export function elCenter(el: LayoutElement): Pt {
  return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
}

/**
 * Point where the ray from an element's centre toward `target` exits the
 * element's axis-aligned bounding box. Keeps connection endpoints on the box
 * edge instead of hidden under it.
 */
export function edgePoint(el: LayoutElement, target: Pt): Pt {
  const c = elCenter(el);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = el.width / 2;
  const hh = el.height / 2;
  // Scale so the ray touches the nearest vertical or horizontal edge.
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(scaleX, scaleY);
  return { x: c.x + dx * s, y: c.y + dy * s };
}

/** Points for a straight connection between two elements, clipped to edges. */
export function straightPath(from: LayoutElement, to: LayoutElement): { pts: Pt[] } {
  const p1 = edgePoint(from, elCenter(to));
  const p2 = edgePoint(to, elCenter(from));
  return { pts: [p1, p2] };
}

/**
 * Right-angle (orthogonal) path between two elements. Exits/enters on the
 * dominant axis and turns once at the midpoint.
 */
export function orthogonalPath(from: LayoutElement, to: LayoutElement): { pts: Pt[] } {
  const c1 = elCenter(from);
  const c2 = elCenter(to);
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // horizontal dominant: leave left/right edge, single vertical jog at mid-x
    const startX = c1.x + Math.sign(dx || 1) * (from.width / 2);
    const endX   = c2.x - Math.sign(dx || 1) * (to.width / 2);
    const midX   = (startX + endX) / 2;
    return { pts: [
      { x: startX, y: c1.y },
      { x: midX,   y: c1.y },
      { x: midX,   y: c2.y },
      { x: endX,   y: c2.y },
    ] };
  }
  // vertical dominant: leave top/bottom edge, single horizontal jog at mid-y
  const startY = c1.y + Math.sign(dy || 1) * (from.height / 2);
  const endY   = c2.y - Math.sign(dy || 1) * (to.height / 2);
  const midY   = (startY + endY) / 2;
  return { pts: [
    { x: c1.x, y: startY },
    { x: c1.x, y: midY },
    { x: c2.x, y: midY },
    { x: c2.x, y: endY },
  ] };
}

/** Right-angle route between two arbitrary points (horizontal-first jog). */
export function orthogonalPoints(a: Pt, b: Pt): Pt[] {
  const midX = (a.x + b.x) / 2;
  return [a, { x: midX, y: a.y }, { x: midX, y: b.y }, b];
}

/**
 * Resolve a connector to a list of points for rendering, whichever ends are
 * attached to elements (edge-clipped) or free floating points. Returns null if
 * an attached element is missing or a free end has no point.
 */
export interface ConnLike {
  fromId?: string; toId?: string;
  fromPt?: Pt; toPt?: Pt;
  routing?: 'straight' | 'orthogonal';
}
export function connectionPath(
  conn: ConnLike,
  getEl: (id: string) => LayoutElement | undefined,
): { pts: Pt[] } | null {
  const fromEl = conn.fromId ? getEl(conn.fromId) : undefined;
  const toEl = conn.toId ? getEl(conn.toId) : undefined;
  if (conn.fromId && !fromEl) return null;
  if (conn.toId && !toEl) return null;

  const fromRef: Pt | null = fromEl ? elCenter(fromEl) : conn.fromPt ?? null;
  const toRef: Pt | null = toEl ? elCenter(toEl) : conn.toPt ?? null;
  if (!fromRef || !toRef) return null;

  const start = fromEl ? edgePoint(fromEl, toRef) : fromRef;
  const end = toEl ? edgePoint(toEl, fromRef) : toRef;

  const pts = conn.routing === 'orthogonal' ? orthogonalPoints(start, end) : [start, end];
  return { pts };
}

/** Build an SVG polyline `d` from a list of points. */
export function pointsToPath(pts: Pt[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

/**
 * Triangle points for an arrowhead whose tip is at `tip`, pointing along the
 * direction from `prev` to `tip`.
 */
export function arrowHeadPoints(prev: Pt, tip: Pt, size = 9): string {
  const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
  const spread = Math.PI / 7;
  const p1 = {
    x: tip.x - size * Math.cos(angle - spread),
    y: tip.y - size * Math.sin(angle - spread),
  };
  const p2 = {
    x: tip.x - size * Math.cos(angle + spread),
    y: tip.y - size * Math.sin(angle + spread),
  };
  return `${tip.x},${tip.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`;
}

/** Point at the halfway distance along a polyline (for placing labels). */
export function polylineMidpoint(pts: Pt[]): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  let half = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (half <= seg) {
      const t = seg === 0 ? 0 : half / seg;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
      };
    }
    half -= seg;
  }
  return pts[pts.length - 1];
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export const DASH_ARRAY: Record<string, string | undefined> = {
  solid: undefined,
  dashed: '7 4',
  dotted: '2 4',
};
