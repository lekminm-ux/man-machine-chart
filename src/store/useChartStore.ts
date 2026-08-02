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
} from '@/lib/storage';
import { computeCycleTime } from '@/lib/chart-utils';
import {
  DEFAULT_READING_COUNT, stepsFromTimeStudy, timeStudyFromSteps,
  type PushBasis,
} from '@/lib/time-study';
import { emptyMachineCapacity, machineCapacityFromTimeStudy } from '@/lib/machine-capacity';

// ── Sync status ─────────────────────────────────────────────────────────────
export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error';

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

// ── Helper: structural folder/file mutation with rollback-on-failure ────────
// Applies the local change immediately for responsiveness, but only keeps it
// once the paired cloud call actually confirms. Refuses to run at all while
// the cloud isn't confirmed ready (`cloudReady === false`), and restores the
// pre-mutation snapshot if the cloud call rejects — so a failed delete/move/
// rename/create never leaves an unconfirmed, orphaned local-only change
// standing in for what the user believes was saved to Production.
type Setter = (partial: Partial<ChartState>) => void;
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
    if (get().hydrated) return;
    // Load local immediately for instant render
    const local = loadLocalDatabase();
    set({ ...local, hydrated: true, cloudReady: false, syncStatus: 'syncing' });
    // Then fetch cloud data. `loadDatabaseFromCloud` never throws — it always
    // resolves to an explicit ok/not-ok result instead of silently standing
    // a local fallback in for a confirmed cloud read.
    const result = await loadDatabaseFromCloud();
    if (result.ok) {
      set({ ...result.db, hydrated: true, cloudReady: true, syncStatus: 'idle' });
    } else {
      console.warn('Cloud hydration unavailable, showing cached data only:', result.error);
      set({ ...result.fallback, hydrated: true, cloudReady: false, syncStatus: 'error' });
    }
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
    set(s => ({ ...s, activeFileId: id }));
    persistLocal({ ...get() });

    // Check if content is already loaded
    const existing = get().files.find(f => f.id === id);
    if (!existing || (existing as ChartFile & { _loaded?: boolean })._loaded === false) {
      set({ syncStatus: 'syncing' });
      // loadFileFromCloud never throws — it always resolves to an explicit
      // ok/not-ok result, so this can never fall through without setting a
      // final status the way the old try/catch around a swallowed-error
      // `null` return used to (that left syncStatus stuck on 'syncing').
      const result = await loadFileFromCloud(id);
      if (result.ok) {
        set(s => ({
          files: s.files.map(f => f.id === id ? { ...result.file, _loaded: true } as ChartFile : f),
          syncStatus: 'idle',
        }));
        persistLocal(get());
      } else {
        console.warn('openFile: cloud load failed, leaving cached content as-is:', result.error);
        set({ syncStatus: 'error' });
        // Deliberately untouched: `files` stays exactly as it was, so a
        // failed load never flips `_loaded` to true, never persists blank
        // content over what's cached, and saveActiveFile's `_loaded===false`
        // guard keeps blocking a save until a real load actually succeeds.
      }
    }
  },

  // ── Folders ─────────────────────────────────────────────────────────────────
  async createFolder(name, processType, parentId = null) {
    if (!get().cloudReady) { set({ syncStatus: 'error' }); return; }
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
    if (!get().cloudReady) { set({ syncStatus: 'error' }); return; }
    const s = get();
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const next: AppDatabase = { ...snapshot, folders: s.folders.map(f => f.id === id ? { ...f, name } : f) };
    await mutateWithRollback(set, snapshot, next, () => updateFolderCloud(id, { name }));
  },

  async moveFolder(id, newParentId) {
    if (!get().cloudReady) { set({ syncStatus: 'error' }); return; }
    const s = get();
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const next: AppDatabase = { ...snapshot, folders: s.folders.map(f => f.id === id ? { ...f, parentId: newParentId } : f) };
    await mutateWithRollback(set, snapshot, next, () => updateFolderCloud(id, { parentId: newParentId }));
  },

  async deleteFolder(id) {
    if (!get().cloudReady) { set({ syncStatus: 'error' }); return; }
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

    if (!s.cloudReady) {
      // Expand/collapse is harmless against a cached tree shown for review —
      // allowed locally, but no cloud write is attempted while the cloud
      // isn't confirmed ready.
      set(next);
      persistLocal(next);
      return;
    }

    const folder = next.folders.find(f => f.id === id);
    await mutateWithRollback(set, snapshot, next, () => updateFolderCloud(id, { expanded: !!folder?.expanded }));
  },

  // ── Files ────────────────────────────────────────────────────────────────────
  async createFile(folderId, name) {
    if (!get().cloudReady) { set({ syncStatus: 'error' }); return; }
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
    if (!get().cloudReady) { set({ syncStatus: 'error' }); return; }
    const s = get();
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const updatedAt = new Date().toISOString();
    const next: AppDatabase = { ...snapshot, files: s.files.map(f => f.id === id ? { ...f, name, updatedAt } : f) };
    const updatedFile = next.files.find(f => f.id === id);
    if (!updatedFile) return;
    await mutateWithRollback(set, snapshot, next, () => saveFileCloud(updatedFile));
  },

  async moveFile(id, newFolderId) {
    if (!get().cloudReady) { set({ syncStatus: 'error' }); return; }
    const s = get();
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const updatedAt = new Date().toISOString();
    const next: AppDatabase = { ...snapshot, files: s.files.map(f => f.id === id ? { ...f, folderId: newFolderId, updatedAt } : f) };
    const updatedFile = next.files.find(f => f.id === id);
    if (!updatedFile) return;
    await mutateWithRollback(set, snapshot, next, () => saveFileCloud(updatedFile));
  },

  async deleteFile(id) {
    if (!get().cloudReady) { set({ syncStatus: 'error' }); return; }
    const s = get();
    const snapshot: AppDatabase = { folders: s.folders, files: s.files, activeFileId: s.activeFileId };
    const files = s.files.filter(f => f.id !== id);
    const activeFileId = id === s.activeFileId ? (files[0]?.id ?? null) : s.activeFileId;
    const next: AppDatabase = { folders: s.folders, files, activeFileId };
    await mutateWithRollback(set, snapshot, next, () => deleteFileCloud(id));
  },

  async duplicateFile(id) {
    if (!get().cloudReady) { set({ syncStatus: 'error' }); return; }
    const s0 = get();
    const file = s0.files.find(f => f.id === id);
    if (!file) return;
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
    // Prevent saving if the file content has not loaded yet (prevents empty steps overwrite)
    if ((file as ChartFile & { _loaded?: boolean })._loaded === false) {
      console.warn('Save blocked: File content has not finished loading from the cloud.');
      return;
    }
    const updated = { ...file, updatedAt: new Date().toISOString() };
    set(s => {
      const next = { ...s, files: s.files.map(f => f.id === updated.id ? updated : f) };
      persistLocal(next);
      return next;
    });
    set({ syncStatus: 'syncing' });
    try {
      await saveFileCloud(updated);
      set({ syncStatus: 'saved' });
      setTimeout(() => set({ syncStatus: 'idle' }), 3000);
    } catch {
      set({ syncStatus: 'error' });
    }
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
