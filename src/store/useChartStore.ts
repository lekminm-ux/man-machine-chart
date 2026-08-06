'use client';

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  AppDatabase, ChartFile, ChartFolder, ChartStep,
  ChartHeader, ProcessType, LayoutElement, LayoutConnection,
  TimeStudy, MachineCapacity,
} from '@/types';
import {
  loadLocalDatabase, saveLocalDatabase,
  loadDatabaseFromCloud, loadFileFromCloud,
  createFolderCloud, updateFolderCloud, deleteFolderCloud,
  createFileCloud, saveFileCloud, deleteFileCloud,
  closeRevisionCloud, openRevisionCloud,
  chartFileContent,
} from '@/lib/storage';
import { computeCycleTime } from '@/lib/chart-utils';
import {
  DEFAULT_READING_COUNT, stepsFromTimeStudy, timeStudyFromSteps,
  type PushBasis,
} from '@/lib/time-study';
import { emptyMachineCapacity, machineCapacityFromTimeStudy } from '@/lib/machine-capacity';

// ── Sync status ─────────────────────────────────────────────────────────────
// 'unconfirmed' is distinct from 'error': the write call itself reported
// success, but an independent fresh Cloud read either failed or didn't match
// what was just sent — so the save must not be shown as 'saved', but it also
// isn't a known outright failure.
export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error' | 'unconfirmed';

interface ChartState extends AppDatabase {
  hydrated: boolean;
  /**
   * True only after a cloud read has actually confirmed a Production
   * snapshot. `hydrated` alone just means "hydration was attempted" — a
   * failed cloud load still sets `hydrated: true` (so the loading spinner
   * clears and cached data can be reviewed) but leaves `cloudReady: false`,
   * which blocks every structural/save action from writing over Production
   * with a state it never actually confirmed.
   */
  cloudReady: boolean;
  syncStatus: SyncStatus;
  activeModule: 1 | 2 | 3 | 4 | 5;

  setActiveModule: (m: 1 | 2 | 3 | 4 | 5) => void;

  // Hydration
  hydrate: () => Promise<void>;

  // Active file
  activeFile: () => ChartFile | null;
  openFile: (id: string) => Promise<void>;

  // Folder actions
  createFolder: (name: string, processType: ProcessType, parentId?: string | null) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  toggleFolder: (id: string) => Promise<void>;
  moveFolder: (id: string, newParentId: string | null) => Promise<void>;

  // File actions
  createFile: (folderId: string, name: string) => Promise<void>;
  moveFile: (id: string, newFolderId: string) => Promise<void>;
  renameFile: (id: string, name: string) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  saveActiveFile: () => Promise<void>;
  closeRevision: (revNo: string) => Promise<void>;
  openNewRevision: () => Promise<void>;
  duplicateFile: (id: string) => Promise<void>;

  // Header actions
  updateHeader: (partial: Partial<ChartHeader>) => void;
  updateTimeMeasurement: (partial: Partial<import('@/types').TimeMeasurement>) => void;

  // Module 1 — time measurement sheet
  updateTimeStudy: (study: TimeStudy) => void;
  /** Seed the sheet from the steps already typed into Module 4. */
  importTimeStudyFromSteps: () => number;
  /** Overwrite Module 4 steps (and therefore M3/M5) from the sheet. */
  pushTimeStudyToSteps: (basis?: PushBasis) => number;

  // Module 2 — machine capacity sheet
  updateMachineCapacity: (mc: MachineCapacity) => void;
  /** Seed one process per machine row in the Module 1 sheet. */
  importMachineCapacityFromTimeStudy: () => number;

  // Step actions
  addStep: () => void;
  updateStep: (id: string, partial: Partial<ChartStep>) => void;
  deleteStep: (id: string) => void;
  reorderSteps: (from: number, to: number) => void;
  insertStep: (targetIndex: number, position: 'above' | 'below') => void;
  updateOperatorPosition: (operator: string, position: string) => void;

  // Layout actions
  addLayoutElement: (el: Omit<LayoutElement, 'id'>) => void;
  updateLayoutElement: (id: string, partial: Partial<LayoutElement>) => void;
  deleteLayoutElement: (id: string) => void;
  addLayoutConnection: (conn: Omit<LayoutConnection, 'id'> & { id?: string }) => void;
  updateLayoutConnection: (id: string, partial: Partial<LayoutConnection>) => void;
  deleteLayoutConnection: (id: string) => void;
}

const defaultHeader: ChartHeader = {
  processName: '', partNumber: '', partName: '', model: '', moldNo: '',
  cycleTime: 60,
  issueDate: new Date().toISOString().split('T')[0],
  revNo: 'A', preparedBy: '', approvedBy: '',
  operatorPositions: {
    'Worker A': '',
    'Worker B': '',
    'Worker C': '',
    'Worker D': '',
    'Worker E': '',
    'Worker F': '',
    'Worker G': '',
    'Worker H': '',
    'Worker I': '',
    'Worker J': '',
  },
};

// ── Helper: persist local state ──────────────────────────────────────────────
function persistLocal(state: AppDatabase) {
  saveLocalDatabase({ folders: state.folders, files: state.files, activeFileId: state.activeFileId });
}

// Module-scoped re-entrancy guard for hydrate(), separate from the `hydrated`
// state field. `hydrated` is deliberately not set until the Cloud result is
// known (so the editor stays gated on a pending request), so it can no longer
// double as an immediate "hydration already started" guard. Without this,
// React StrictMode's dev-only double effect-invocation (editor/page.tsx's
// `useEffect(() => { hydrate(); }, [])` has no cleanup) would start two
// independent Cloud hydrations before either one's `hydrated` flip could stop
// the second.
let hydrating = false;

// ── Helper: compare the persisted portion of two chart files ────────────────
// Used to verify a save's fresh Cloud read-back actually matches what was
// just sent. Reuses storage.ts's chartFileContent so this checks exactly the
// same field list that actually gets written — id/name/folderId/updatedAt
// plus every content field (header/steps/layoutDiagram/timeMeasurement/
// timeStudy/machineCapacity), not a hand-picked subset that can silently
// drift out of sync with what's really persisted. Both sides go through the
// same JSON round trip the API itself uses (stringify to store, parse to
// read back), so key ordering is consistent.
function chartContentMatches(a: ChartFile, b: ChartFile): boolean {
  const pick = (f: ChartFile) => JSON.stringify({
    id: f.id, name: f.name, folderId: f.folderId, updatedAt: f.updatedAt,
    ...chartFileContent(f),
  });
  return pick(a) === pick(b);
}

// ── Helper: refuse a Cloud-mutating action against an unready/unsynced target ──
// Two independent reasons an action must never reach the Cloud API:
//   (1) the cloud itself isn't confirmed ready (Phase 0B gate), or
//   (2) any of the given ids — the record itself, or a parent/folder it's
//       being attached to — belongs to a `_unsynced` record, one Cloud has
//       never seen. Sending such an id to an UPDATE/DELETE, or attaching a
//       new row under it via parentId/folderId, cannot possibly succeed —
//       the API's own zero-row guard is a fallback, not a substitute for
//       never sending that call in the first place.
// Returns true (after setting syncStatus:'error') when the caller must stop.
type Setter = (partial: Partial<ChartState>) => void;
function blockCloudMutation(
  set: Setter,
  state: ChartState,
  actionName: string,
  ...ids: (string | null | undefined)[]
): boolean {
  if (!state.cloudReady) {
    set({ syncStatus: 'error' });
    console.warn(`${actionName} blocked: cloud is not confirmed ready.`);
    return true;
  }
  for (const id of ids) {
    if (!id) continue;
    const record = state.folders.find(r => r.id === id) ?? state.files.find(r => r.id === id);
    if ((record as { _unsynced?: boolean } | undefined)?._unsynced) {
      set({ syncStatus: 'error' });
      console.warn(`${actionName} blocked: "${id}" is local-only and has never been confirmed in Cloud.`);
      return true;
    }
  }
  return false;
}

// ── Helper: refuse a full-payload mutation against unloaded placeholder content ──
// `_loaded === false` means this record's steps/layoutDiagram/module fields are
// still the blank lazy-load placeholder (see loadDatabaseFromCloud), never the
// real Cloud content — a metadata-only list entry the file was never actually
// opened for in this session. Sending it through saveFileCloud/createFileCloud
// would PUT that blank content over whatever the real chart currently holds.
function blockUnloadedFile(set: Setter, actionName: string, file: ChartFile): boolean {
  if ((file as ChartFile & { _loaded?: boolean })._loaded === false) {
    set({ syncStatus: 'error' });
    console.warn(`${actionName} blocked: file content has not finished loading from the cloud.`);
    return true;
  }
  return false;
}

// ── Helper: refuse a full-payload mutation against an unconfirmed draft ─────
// `_unconfirmed === true` means the last save's fresh Cloud read-back never
// proved the write (or hasn't been retried yet) — the file has real, loaded
// content, but Cloud's own copy of it is unverified. Renaming/moving/
// duplicating it would still build a full-payload PUT/POST from that
// unverified draft. Deliberately NOT used by `saveActiveFile`: Save is the
// explicit retry path that resolves an unconfirmed draft, so it must stay
// available precisely when `_unconfirmed` is true.
function blockUnconfirmedFile(set: Setter, actionName: string, file: ChartFile): boolean {
  if ((file as ChartFile & { _unconfirmed?: boolean })._unconfirmed) {
    set({ syncStatus: 'error' });
    console.warn(`${actionName} blocked: this file has an unconfirmed save pending — retry Save first.`);
    return true;
  }
  return false;
}

function blockLockedFile(set: Setter, actionName: string, file: ChartFile): boolean {
  if (file.lockedAt) {
    set({ syncStatus: 'error' });
    console.warn(`${actionName} blocked: this revision is locked — open a new revision to keep editing.`);
    return true;
  }
  return false;
}

// ── Helper: structural folder/file mutation with rollback-on-failure ────────
// Applies the local change immediately for responsiveness, but only keeps it
// once the paired cloud call actually confirms. Refuses to run at all while
// the cloud isn't confirmed ready (`cloudReady === false`), and restores the
// pre-mutation snapshot if the cloud call rejects — so a failed delete/move/
// rename/create never leaves an unconfirmed, orphaned local-only change
// standing in for what the user believes was saved to Production.
async function mutateWithRollback(
  set: Setter,
  snapshot: AppDatabase,
  next: AppDatabase,
  cloudCall: () => Promise<void>,
): Promise<void> {
  set(next);
  persistLocal(next);
  set({ syncStatus: 'syncing' });
  try {
    await cloudCall();
    set({ syncStatus: 'saved' });
    setTimeout(() => set({ syncStatus: 'idle' }), 2000);
  } catch {
    set(snapshot);
    persistLocal(snapshot);
    set({ syncStatus: 'error' });
  }
}

// ── Helper: recalculate cycle time from steps ───────────────────────────────
// Cycle Time = the busiest actor's total time (max of each Worker's and the
// Auto M/C's summed durations) — not the timeline end, so a step that starts
// late (explicit startTime) doesn't inflate the cycle.
function recalcCycleTime(steps: ChartStep[]): number {
  if (steps.length === 0) return 60;
  const total = computeCycleTime(steps);
  return total > 0 ? total : 60;
}

export const useChartStore = create<ChartState>((set, get) => ({
  folders: [],
  files: [],
  activeFileId: null,
  hydrated: false,
  cloudReady: false,
  syncStatus: 'idle',
  activeModule: 4,

  setActiveModule: (m) => set({ activeModule: m }),

  // ── Hydration ─────────────────────────────────────────────────────────────────
  async hydrate() {
    if (get().hydrated || hydrating) return;
    hydrating = true;
    // Load local data into state immediately so it's ready the instant Cloud
    // resolves, but deliberately do NOT set `hydrated` yet. The editor
    // (editor/page.tsx) gates its entire render on `hydrated` — flipping it
    // true here, before Cloud is even asked, would let a cached local file
    // (possibly `_unconfirmed` or a stale `_loaded:false` placeholder) render
    // as if it were the confirmed active document during the pending
    // request. `cloudReady` already correctly stays false during this
    // window; `hydrated` must too.
    const local = loadLocalDatabase();
    set({ ...local, cloudReady: false, syncStatus: 'syncing' });
    // Then fetch cloud data. `loadDatabaseFromCloud` never throws — it always
    // resolves to an explicit ok/not-ok result instead of silently standing
    // a local fallback in for a confirmed cloud read. Either branch below is
    // the point `hydrated` becomes true: a known failure still counts as "the
    // Cloud result is known" (and correctly falls back to reviewable cached
    // data with cloudReady:false, per the Continuous Usability Gate).
    const result = await loadDatabaseFromCloud();
    if (result.ok) {
      const db = result.db;
      // An active file that isn't confirmed loaded — a stale cache reset, an
      // _unconfirmed draft, or a local-only _unsynced file — must never be
      // silently shown as the active Cloud document on reload/reopen.
      // `loadDatabaseFromCloud`'s merge already collapses an _unconfirmed
      // draft to _loaded:false, but `_unconfirmed` is also checked directly
      // here rather than relying solely on that cross-module conversion.
      // Its data stays in `files` untouched for recovery; the editor falls
      // back to the existing "no file open" state until the user re-opens it
      // through openFile()'s verified path.
      const wasActive = db.files.find(f => f.id === db.activeFileId) as (ChartFile & { _loaded?: boolean; _unsynced?: boolean; _unconfirmed?: boolean }) | undefined;
      const activeFileId = wasActive && (wasActive._loaded === false || wasActive._unsynced || wasActive._unconfirmed) ? null : db.activeFileId;
      const next: AppDatabase = { ...db, activeFileId };
      set({ ...next, hydrated: true, cloudReady: true, syncStatus: 'idle' });
      if (activeFileId !== db.activeFileId) persistLocal(next);
    } else {
      console.warn('Cloud hydration unavailable, showing cached data only:', result.error);
      set({ ...result.fallback, hydrated: true, cloudReady: false, syncStatus: 'error' });
    }
    hydrating = false;
  },

  activeFile() {
    const { files, activeFileId } = get();
    const file = files.find(f => f.id === activeFileId) ?? null;
    if (!file) return null;
    const computedCT = recalcCycleTime(file.steps);
    if (file.header.cycleTime !== computedCT) {
      return {
        ...file,
        header: { ...file.header, cycleTime: computedCT },
      };
    }
    return file;
  },

  // ── Open file (lazy load content from cloud) ────────────────────────────────
  async openFile(id) {
    // A file can become the active document immediately only if it's
    // local-only (`_unsynced` — Cloud has no row to fetch in the first
    // place), or if it's both loaded AND not `_unconfirmed`. An `_unconfirmed`
    // file has real content but its last save's Cloud read-back never proved
    // the write — same as an unloaded placeholder, it must not be trusted
    // without a fresh GET. Anything else must prove its content with a fresh
    // Cloud GET before it may become active — so `activeFileId` is
    // deliberately NOT set here up front. Setting it optimistically would let
    // an in-flight (or failed) fetch show placeholder/unconfirmed/stale
    // content as if it were the confirmed active file.
    const existing = get().files.find(f => f.id === id) as (ChartFile & { _loaded?: boolean; _unsynced?: boolean; _unconfirmed?: boolean }) | undefined;
    if (existing && (existing._unsynced || (existing._loaded !== false && !existing._unconfirmed))) {
      set(s => ({ ...s, activeFileId: id }));
      persistLocal(get());
      return;
    }

    set({ syncStatus: 'syncing' });
    // loadFileFromCloud never throws — it always resolves to an explicit
    // ok/not-ok result, so this can never fall through without setting a
    // final status the way the old try/catch around a swallowed-error
    // `null` return used to (that left syncStatus stuck on 'syncing').
    const result = await loadFileFromCloud(id);
    if (result.ok) {
      set(s => ({
        files: s.files.map(f => f.id === id ? { ...result.file, _loaded: true } as ChartFile : f),
        activeFileId: id,
        syncStatus: 'idle',
      }));
      persistLocal(get());
    } else {
      console.warn('openFile: cloud load failed, retaining the previous selection:', result.error);
      set({ syncStatus: 'error' });
      // Deliberately untouched: `files` and `activeFileId` stay exactly as
      // they were, so a failed load never flips `_loaded` to true, never
      // persists blank content over what's cached, never swaps the active
      // selection to an unverified target, and saveActiveFile's
      // `_loaded===false` guard keeps blocking a save until a real load
      // actually succeeds.
    }
  },

  // ── Folders ─────────────────────────────────────────────────────────────────
  async createFolder(name, processType, parentId = null) {
    if (blockCloudMutation(set, get(), 'createFolder', parentId)) return;
    const s = get();
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const folder: ChartFolder = {
      id: uuidv4(), parentId, name, processType, expanded: true,
      createdAt: new Date().toISOString(),
    };
    const next: AppDatabase = { ...snapshot, folders: [...s.folders, folder] };
    await mutateWithRollback(set, snapshot, next, () => createFolderCloud(folder));
  },

  async renameFolder(id, name) {
    if (blockCloudMutation(set, get(), 'renameFolder', id)) return;
    const s = get();
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const next: AppDatabase = { ...snapshot, folders: s.folders.map(f => f.id === id ? { ...f, name } : f) };
    await mutateWithRollback(set, snapshot, next, () => updateFolderCloud(id, { name }));
  },

  async moveFolder(id, newParentId) {
    if (blockCloudMutation(set, get(), 'moveFolder', id, newParentId)) return;
    const s = get();
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const next: AppDatabase = { ...snapshot, folders: s.folders.map(f => f.id === id ? { ...f, parentId: newParentId } : f) };
    await mutateWithRollback(set, snapshot, next, () => updateFolderCloud(id, { parentId: newParentId }));
  },

  async deleteFolder(id) {
    if (blockCloudMutation(set, get(), 'deleteFolder', id)) return;
    const s = get();
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const files = s.files.filter(f => f.folderId !== id);
    const activeFileId = files.find(f => f.id === s.activeFileId) ? s.activeFileId : (files[0]?.id ?? null);
    const next: AppDatabase = { folders: s.folders.filter(f => f.id !== id), files, activeFileId };
    await mutateWithRollback(set, snapshot, next, () => deleteFolderCloud(id));
  },

  async toggleFolder(id) {
    const s = get();
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const next: AppDatabase = { ...snapshot, folders: s.folders.map(f => f.id === id ? { ...f, expanded: !f.expanded } : f) };

    const target = s.folders.find(f => f.id === id) as (ChartFolder & { _unsynced?: boolean }) | undefined;
    if (!s.cloudReady || target?._unsynced) {
      // Expand/collapse is harmless against a cached tree shown for review,
      // or against a folder Cloud has never seen — allowed locally either
      // way, but no cloud write is attempted: while the cloud isn't
      // confirmed ready nothing should write, and an _unsynced folder's id
      // has no matching Cloud row to update in the first place.
      set(next);
      persistLocal(next);
      return;
    }

    const folder = next.folders.find(f => f.id === id);
    await mutateWithRollback(set, snapshot, next, () => updateFolderCloud(id, { expanded: !!folder?.expanded }));
  },

  // ── Files ────────────────────────────────────────────────────────────────────
  async createFile(folderId, name) {
    if (blockCloudMutation(set, get(), 'createFile', folderId)) return;
    const s = get();
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const file: ChartFile = {
      id: uuidv4(), name, folderId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      header: { ...defaultHeader },
      steps: [],
      layoutDiagram: { elements: [], connections: [] },
    };
    const next: AppDatabase = { ...snapshot, files: [...s.files, file], activeFileId: file.id };
    await mutateWithRollback(set, snapshot, next, () => createFileCloud(file));
  },

  async renameFile(id, name) {
    const file = get().files.find(f => f.id === id);
    if (blockCloudMutation(set, get(), 'renameFile', id, file?.folderId)) return;
    if (!file) return;
    if (blockUnloadedFile(set, 'renameFile', file)) return;
    if (blockUnconfirmedFile(set, 'renameFile', file)) return;
    const s = get();
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const updatedAt = new Date().toISOString();
    const next: AppDatabase = { ...snapshot, files: s.files.map(f => f.id === id ? { ...f, name, updatedAt } : f) };
    const updatedFile = next.files.find(f => f.id === id);
    if (!updatedFile) return;
    await mutateWithRollback(set, snapshot, next, async () => {
      const result = await saveFileCloud(updatedFile, updatedAt);
      if (!result.ok) throw new Error(result.error);
    });
  },

  async moveFile(id, newFolderId) {
    if (blockCloudMutation(set, get(), 'moveFile', id, newFolderId)) return;
    const s = get();
    const file = s.files.find(f => f.id === id);
    if (!file) return;
    if (blockUnloadedFile(set, 'moveFile', file)) return;
    if (blockUnconfirmedFile(set, 'moveFile', file)) return;
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const updatedAt = new Date().toISOString();
    const next: AppDatabase = { ...snapshot, files: s.files.map(f => f.id === id ? { ...f, folderId: newFolderId, updatedAt } : f) };
    const updatedFile = next.files.find(f => f.id === id);
    if (!updatedFile) return;
    await mutateWithRollback(set, snapshot, next, async () => {
      const result = await saveFileCloud(updatedFile, updatedAt);
      if (!result.ok) throw new Error(result.error);
    });
  },

  async deleteFile(id) {
    if (blockCloudMutation(set, get(), 'deleteFile', id)) return;
    const s = get();
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const files = s.files.filter(f => f.id !== id);
    const activeFileId = id === s.activeFileId ? (files[0]?.id ?? null) : s.activeFileId;
    const next: AppDatabase = { folders: s.folders, files, activeFileId };
    await mutateWithRollback(set, snapshot, next, () => deleteFileCloud(id));
  },

  async duplicateFile(id) {
    const s0 = get();
    const file = s0.files.find(f => f.id === id);
    if (blockCloudMutation(set, s0, 'duplicateFile', id, file?.folderId)) return;
    if (!file) return;
    if (blockUnloadedFile(set, 'duplicateFile', file)) return;
    if (blockUnconfirmedFile(set, 'duplicateFile', file)) return;
    const snapshot: AppDatabase = { folders: s0.folders, files: s0.files, activeFileId: s0.activeFileId };

    // Clone steps with new UUIDs
    const newSteps = file.steps.map(step => ({
      ...step,
      id: uuidv4(),
    }));

    // Clone layout diagram elements and connections with new IDs to prevent collisions
    const newElements = file.layoutDiagram.elements.map(el => ({ ...el, id: uuidv4() }));
    const elIdMap: Record<string, string> = {};
    file.layoutDiagram.elements.forEach((el, index) => {
      elIdMap[el.id] = newElements[index].id;
    });
    const newConnections = file.layoutDiagram.connections.map(conn => ({
      ...conn,
      id: uuidv4(),
      // Free-arrow ends (fromPt/toPt) have no id and copy through untouched.
      fromId: conn.fromId ? (elIdMap[conn.fromId] || conn.fromId) : undefined,
      toId: conn.toId ? (elIdMap[conn.toId] || conn.toId) : undefined,
    }));

    const duplicatedFile: ChartFile = {
      ...file,
      id: uuidv4(),
      name: `${file.name} - Copy`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: newSteps,
      layoutDiagram: {
        elements: newElements,
        connections: newConnections,
      },
    };

    const next: AppDatabase = { ...snapshot, files: [...s0.files, duplicatedFile], activeFileId: duplicatedFile.id };
    await mutateWithRollback(set, snapshot, next, () => createFileCloud(duplicatedFile));
  },

  async saveActiveFile() {
    if (!get().cloudReady) {
      set({ syncStatus: 'error' });
      console.warn('Save blocked: cloud is not confirmed ready.');
      return;
    }
    const file = get().activeFile();
    if (!file) return;
    if (blockCloudMutation(set, get(), 'saveActiveFile', file.id, file.folderId)) return;
    if (blockUnloadedFile(set, 'saveActiveFile', file)) return;
    if (blockLockedFile(set, 'saveActiveFile', file)) return;
    const savedAt = new Date().toISOString();
    // Marked _unconfirmed up front, optimistically, before we know the
    // outcome — the safe default. It's only cleared once a fresh read-back
    // actually proves the write. That way even a hard crash between here and
    // the eventual result leaves the persisted local copy correctly flagged,
    // and hydrate()'s merge (storage.ts) refuses to ever treat an
    // _unconfirmed file as trusted Cloud content no matter what its
    // updatedAt says.
    const draft = { ...file, updatedAt: savedAt, _unconfirmed: true } as ChartFile;
    // Update the local view immediately for a responsive editor, but this is
    // not what makes the save "done" — syncStatus only becomes 'saved' after
    // the write is independently confirmed by reading it back from Cloud.
    set(s => {
      const next = { ...s, files: s.files.map(f => f.id === draft.id ? draft : f) };
      persistLocal(next);
      return next;
    });
    set({ syncStatus: 'syncing' });

    const writeResult = await saveFileCloud(draft, savedAt);
    if (!writeResult.ok) {
      set({ syncStatus: 'error' });
      console.warn('saveActiveFile: cloud write failed:', writeResult.error);
      return;
    }

    // The write call reporting success is not proof by itself — read the
    // chart back fresh from Cloud and compare the complete payload before
    // claiming 'saved'. A failed or mismatched read-back leaves the save
    // 'unconfirmed', distinct from a known write failure — the draft (still
    // marked _unconfirmed from above) stays in place, retryable, and is
    // never presented as saved.
    const readBack = await loadFileFromCloud(draft.id);
    if (!readBack.ok || !chartContentMatches(draft, readBack.file)) {
      set({ syncStatus: 'unconfirmed' });
      console.warn('saveActiveFile: save could not be confirmed by a fresh Cloud read-back.');
      return;
    }

    set(s => {
      const next = { ...s, files: s.files.map(f => f.id === draft.id ? { ...readBack.file, _loaded: true, _unconfirmed: false } as ChartFile : f) };
      persistLocal(next);
      return next;
    });
    set({ syncStatus: 'saved' });
    setTimeout(() => set(s => s.syncStatus === 'saved' ? { syncStatus: 'idle' } : {}), 3000);
  },

  async closeRevision(revNo) {
    const file = get().activeFile();
    if (!file) return;
    if (blockCloudMutation(set, get(), 'closeRevision', file.id, file.folderId)) return;
    if (blockUnloadedFile(set, 'closeRevision', file)) return;
    if (blockUnconfirmedFile(set, 'closeRevision', file)) return;
    if (blockLockedFile(set, 'closeRevision', file)) return;
    if (!revNo.trim()) {
      set({ syncStatus: 'error' });
      console.warn('closeRevision blocked: Rev No. is required.');
      return;
    }

    await get().saveActiveFile();
    const savedFile = get().files.find(f => f.id === file.id) as (ChartFile & { _loaded?: boolean; _unconfirmed?: boolean }) | undefined;
    if (!savedFile || savedFile._unconfirmed || savedFile._loaded === false) {
      set({ syncStatus: 'error' });
      console.warn('closeRevision blocked: the save before closing did not get confirmed — retry Save first.');
      return;
    }

    const result = await closeRevisionCloud(savedFile.id, revNo.trim());
    if (!result.ok) {
      set({ syncStatus: 'error' });
      console.warn('closeRevision: cloud close failed:', result.error);
      return;
    }

    set(s => {
      const next = {
        ...s,
        files: s.files.map(f => f.id === savedFile.id ? { ...f, lockedAt: result.snapshot.closedAt } : f),
      };
      persistLocal(next);
      return { ...next, syncStatus: 'idle' };
    });
  },

  async openNewRevision() {
    const file = get().activeFile();
    if (!file) return;
    if (blockCloudMutation(set, get(), 'openNewRevision', file.id, file.folderId)) return;
    if (blockUnloadedFile(set, 'openNewRevision', file)) return;
    if (!file.lockedAt) {
      set({ syncStatus: 'error' });
      console.warn('openNewRevision blocked: this chart is not currently locked.');
      return;
    }

    const result = await openRevisionCloud(file.id);
    if (!result.ok) {
      set({ syncStatus: 'error' });
      console.warn('openNewRevision: cloud open failed:', result.error);
      return;
    }

    set(s => {
      const next = {
        ...s,
        files: s.files.map(f => f.id === file.id ? { ...f, lockedAt: null } : f),
      };
      persistLocal(next);
      return { ...next, syncStatus: 'idle' };
    });
  },

  // ── Header (local only — auto-saved on saveActiveFile) ───────────────────────
  updateHeader(partial) {
    set(s => {
      if (!s.activeFileId) return s;
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? { ...f, header: { ...f.header, ...partial }, updatedAt: new Date().toISOString() }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  updateTimeMeasurement(partial) {
    set(s => {
      if (!s.activeFileId) return s;
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? { ...f, timeMeasurement: { ...(f.timeMeasurement || { laps: [], minTime: 0, maxTime: 0, avgTime: 0, fluctuation: 0, taktTime: 0 }), ...partial }, updatedAt: new Date().toISOString() }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  // ── Module 1: time measurement sheet ─────────────────────────────────────────
  updateTimeStudy(study) {
    set(s => {
      if (!s.activeFileId) return s;
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? { ...f, timeStudy: study, updatedAt: new Date().toISOString() }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  importTimeStudyFromSteps() {
    const state = get();
    const file = state.files.find(f => f.id === state.activeFileId);
    if (!file) return 0;

    const readingCount = file.timeStudy?.readingCount ?? DEFAULT_READING_COUNT;
    const study = timeStudyFromSteps(file.steps, readingCount, uuidv4);
    get().updateTimeStudy(study);
    return study.rows.length;
  },

  pushTimeStudyToSteps(basis: PushBasis = 'min') {
    const state = get();
    const file = state.files.find(f => f.id === state.activeFileId);
    if (!file?.timeStudy) return 0;

    const steps = stepsFromTimeStudy(file.timeStudy, basis, uuidv4);
    const cycleTime = recalcCycleTime(steps);
    set(s => {
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? { ...f, steps, header: { ...f.header, cycleTime }, updatedAt: new Date().toISOString() }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
    return steps.length;
  },

  // ── Module 2: machine capacity sheet ─────────────────────────────────────────
  updateMachineCapacity(mc) {
    set(s => {
      if (!s.activeFileId) return s;
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? { ...f, machineCapacity: mc, updatedAt: new Date().toISOString() }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  importMachineCapacityFromTimeStudy() {
    const state = get();
    const file = state.files.find(f => f.id === state.activeFileId);
    if (!file?.timeStudy) return 0;

    const base = file.machineCapacity ?? emptyMachineCapacity();
    const seeded = machineCapacityFromTimeStudy(file.timeStudy, base, uuidv4);
    get().updateMachineCapacity(seeded);
    return seeded.rows.length;
  },

  // ── Steps (local only — auto-saved on saveActiveFile) ────────────────────────
  addStep() {
    set(s => {
      if (!s.activeFileId) return s;
      const file = s.files.find(f => f.id === s.activeFileId)!;
      const newStep: ChartStep = {
        id: uuidv4(), no: file.steps.length + 1,
        description: '', operator: 'Worker A',
        manualTime: 0, machineTime: 0, walkingTime: 0, idleTime: 0,
        startTime: 0,
      };
      const updatedSteps = [...file.steps, newStep];
      const cycleTime = recalcCycleTime(updatedSteps);
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? {
                ...f,
                steps: updatedSteps,
                header: { ...f.header, cycleTime },
                updatedAt: new Date().toISOString()
              }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  updateStep(id, partial) {
    set(s => {
      if (!s.activeFileId) return s;
      const file = s.files.find(f => f.id === s.activeFileId)!;
      const updatedSteps = file.steps.map(step => step.id === id ? { ...step, ...partial } : step);
      const cycleTime = recalcCycleTime(updatedSteps);
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? {
                ...f,
                steps: updatedSteps,
                header: { ...f.header, cycleTime },
                updatedAt: new Date().toISOString()
              }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  deleteStep(id) {
    set(s => {
      if (!s.activeFileId) return s;
      const file = s.files.find(f => f.id === s.activeFileId)!;
      const updatedSteps = file.steps.filter(step => step.id !== id).map((step, i) => ({ ...step, no: i + 1 }));
      const cycleTime = recalcCycleTime(updatedSteps);
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? {
                ...f,
                steps: updatedSteps,
                header: { ...f.header, cycleTime },
                updatedAt: new Date().toISOString()
              }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  reorderSteps(from, to) {
    set(s => {
      if (!s.activeFileId) return s;
      const file = s.files.find(f => f.id === s.activeFileId)!;
      const steps = [...file.steps];
      const [moved] = steps.splice(from, 1);
      steps.splice(to, 0, moved);
      const reindexed = steps.map((step, i) => ({ ...step, no: i + 1 }));
      const cycleTime = recalcCycleTime(reindexed);
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? {
                ...f,
                steps: reindexed,
                header: { ...f.header, cycleTime },
                updatedAt: new Date().toISOString()
              }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  insertStep(targetIndex, position) {
    set(s => {
      if (!s.activeFileId) return s;
      const file = s.files.find(f => f.id === s.activeFileId)!;
      const newStep: ChartStep = {
        id: uuidv4(), no: 0,
        description: '', operator: 'Worker A',
        manualTime: 0, machineTime: 0, walkingTime: 0, idleTime: 0,
        startTime: 0,
      };

      const updatedSteps = [...file.steps];
      const insertAt = position === 'above' ? targetIndex : targetIndex + 1;
      updatedSteps.splice(insertAt, 0, newStep);

      const reindexed = updatedSteps.map((step, i) => ({ ...step, no: i + 1 }));
      const cycleTime = recalcCycleTime(reindexed);

      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? {
                ...f,
                steps: reindexed,
                header: { ...f.header, cycleTime },
                updatedAt: new Date().toISOString()
              }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  updateOperatorPosition(operator, position) {
    set(s => {
      if (!s.activeFileId) return s;
      const file = s.files.find(f => f.id === s.activeFileId)!;
      const currentPositions = file.header.operatorPositions || {};
      const updatedPositions = { ...currentPositions, [operator]: position };

      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? {
                ...f,
                header: {
                  ...f.header,
                  operatorPositions: updatedPositions,
                },
                updatedAt: new Date().toISOString()
              }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  // ── Layout (local only — auto-saved on saveActiveFile) ────────────────────────
  addLayoutElement(el) {
    set(s => {
      if (!s.activeFileId) return s;
      const newEl: LayoutElement = { ...el, id: uuidv4() };
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? { ...f, layoutDiagram: { ...f.layoutDiagram, elements: [...f.layoutDiagram.elements, newEl] }, updatedAt: new Date().toISOString() }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  updateLayoutElement(id, partial) {
    set(s => {
      if (!s.activeFileId) return s;
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? { ...f, layoutDiagram: { ...f.layoutDiagram, elements: f.layoutDiagram.elements.map(el => el.id === id ? { ...el, ...partial } : el) }, updatedAt: new Date().toISOString() }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  deleteLayoutElement(id) {
    set(s => {
      if (!s.activeFileId) return s;
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? {
                ...f,
                layoutDiagram: {
                  elements: f.layoutDiagram.elements.filter(el => el.id !== id),
                  connections: f.layoutDiagram.connections.filter(c => c.fromId !== id && c.toId !== id),
                },
                updatedAt: new Date().toISOString(),
              }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  addLayoutConnection(conn) {
    set(s => {
      if (!s.activeFileId) return s;
      const newConn: LayoutConnection = { ...conn, id: conn.id ?? uuidv4() };
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? { ...f, layoutDiagram: { ...f.layoutDiagram, connections: [...f.layoutDiagram.connections, newConn] }, updatedAt: new Date().toISOString() }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  updateLayoutConnection(id, partial) {
    set(s => {
      if (!s.activeFileId) return s;
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? { ...f, layoutDiagram: { ...f.layoutDiagram, connections: f.layoutDiagram.connections.map(c => c.id === id ? { ...c, ...partial } : c) }, updatedAt: new Date().toISOString() }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },

  deleteLayoutConnection(id) {
    set(s => {
      if (!s.activeFileId) return s;
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? { ...f, layoutDiagram: { ...f.layoutDiagram, connections: f.layoutDiagram.connections.filter(c => c.id !== id) }, updatedAt: new Date().toISOString() }
            : f
        ),
      };
      persistLocal(next);
      return next;
    });
  },
}));
