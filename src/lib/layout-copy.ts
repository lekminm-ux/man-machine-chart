import type { LayoutDiagram, LayoutElement } from '@/types';

export interface LayoutCopyBounds { width: number; height: number; }

/** Snapshot only selected shapes and their internal connectors, never live references. */
export function captureLayoutSelection(layout: LayoutDiagram, ids: string[]): LayoutDiagram | null {
  const selected = new Set(ids);
  const elements = layout.elements.filter(el => selected.has(el.id));
  if (!elements.length) return null;
  const completeGroups = new Set(elements.filter(el => el.groupId &&
    layout.elements.every(member => member.groupId !== el.groupId || selected.has(member.id)))
    .map(el => el.groupId));
  return JSON.parse(JSON.stringify({
    elements: elements.map(el => completeGroups.has(el.groupId) ? el : { ...el, groupId: undefined, groupName: undefined }),
    connections: layout.connections.filter(conn => (conn.fromId || conn.toId) &&
      (conn.fromId ? selected.has(conn.fromId) : Boolean(conn.fromPt)) &&
      (conn.toId ? selected.has(conn.toId) : Boolean(conn.toPt))),
  }));
}

/** Create independent element, group and connector IDs, preserving relative geometry. */
export function cloneLayoutSelection(
  source: LayoutDiagram,
  destination: LayoutElement[],
  newId: () => string,
  offset: number,
  bounds: LayoutCopyBounds,
): LayoutDiagram {
  if (!source.elements.length) return { elements: [], connections: [] };
  const elementIds = new Map(source.elements.map(el => [el.id, newId()]));
  const groupIds = new Map<string, { id: string; name: string }>();
  const names = new Set(destination.map(el => el.groupName?.trim()).filter(Boolean));
  for (const el of source.elements) {
    if (!el.groupId || groupIds.has(el.groupId)) continue;
    const base = `${el.groupName?.trim() || 'Group'} - Copy`;
    let name = base;
    let number = 2;
    while (names.has(name)) name = `${base} ${number++}`;
    names.add(name);
    groupIds.set(el.groupId, { id: newId(), name });
  }

  const points = source.connections.flatMap(conn => [conn.fromPt, conn.toPt].filter(pt => pt !== undefined));
  const minX = Math.min(...source.elements.map(el => el.x), ...points.map(pt => pt.x));
  const minY = Math.min(...source.elements.map(el => el.y), ...points.map(pt => pt.y));
  const maxX = Math.max(...source.elements.map(el => el.x + el.width), ...points.map(pt => pt.x));
  const maxY = Math.max(...source.elements.map(el => el.y + el.height), ...points.map(pt => pt.y));
  // Move the whole copy by one delta. If it is wider than the viewport, anchor its left edge.
  const dx = Math.max(-minX, Math.min(offset, bounds.width - maxX));
  const dy = Math.max(-minY, Math.min(offset, bounds.height - maxY));
  return {
    elements: source.elements.map(el => {
      const group = el.groupId ? groupIds.get(el.groupId) : undefined;
      return { ...el, id: elementIds.get(el.id)!, x: el.x + dx, y: el.y + dy,
        groupId: group?.id, groupName: group?.name };
    }),
    connections: source.connections.map(conn => ({
      ...conn, id: newId(),
      fromId: conn.fromId ? elementIds.get(conn.fromId) : undefined,
      toId: conn.toId ? elementIds.get(conn.toId) : undefined,
      fromPt: conn.fromPt ? { x: conn.fromPt.x + dx, y: conn.fromPt.y + dy } : undefined,
      toPt: conn.toPt ? { x: conn.toPt.x + dx, y: conn.toPt.y + dy } : undefined,
    })),
  };
}
