import type { ChartFile, LayoutDiagram } from '@/types';

export const LAYOUT_HISTORY_LIMIT = 100;
export interface LayoutHistory {
  past: LayoutDiagram[];
  future: LayoutDiagram[];
  current: LayoutDiagram;
  pending?: LayoutDiagram;
  pendingKind?: 'pointer' | 'property';
  revision: string;
}
export const snapshotLayout = (layout: LayoutDiagram): LayoutDiagram => JSON.parse(JSON.stringify(layout));
export const sameLayout = (a: LayoutDiagram, b: LayoutDiagram) => JSON.stringify(a) === JSON.stringify(b);

/** Discard stale history after an external reload or revision boundary. */
export function historyFor(file: ChartFile, history?: LayoutHistory): LayoutHistory {
  const revision = JSON.stringify([file.header.revNo, file.lockedAt ?? null]);
  return history && history.revision === revision && sameLayout(history.current, file.layoutDiagram)
    ? history : { past: [], future: [], current: snapshotLayout(file.layoutDiagram), revision };
}

export function recordLayout(history: LayoutHistory, after: LayoutDiagram): LayoutHistory {
  return {
    ...history, current: snapshotLayout(after),
    past: history.pending ? history.past : [...history.past, history.current].slice(-LAYOUT_HISTORY_LIMIT),
    future: history.pending ? history.future : [],
  };
}

export function finishLayoutEdit(history: LayoutHistory): LayoutHistory {
  if (!history.pending) return history;
  const pending = history.pending;
  const rest = { ...history, pending: undefined, pendingKind: undefined };
  return sameLayout(pending, history.current) ? rest : {
    ...rest, past: [...history.past, pending].slice(-LAYOUT_HISTORY_LIMIT), future: [],
  };
}
