'use client';

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  AppDatabase, ChartFile, ChartFolder, ChartStep,
  ChartHeader, ProcessType, LayoutElement, LayoutConnection,
} from '@/types';
import {
  loadLocalDatabase, saveLocalDatabase,
  loadDatabaseFromCloud, loadFileFromCloud,
  createFolderCloud, updateFolderCloud, deleteFolderCloud,
  createFileCloud, saveFileCloud, deleteFileCloud,
} from '@/lib/storage';

// ── Sync status ─────────────────────────────────────────────────────────────
export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error';

interface ChartState extends AppDatabase {
  hydrated: boolean;
  syncStatus: SyncStatus;

  // Hydration
  hydrate: () => Promise<void>;

  // Active file
  activeFile: () => ChartFile | null;
  openFile: (id: string) => Promise<void>;

  // Folder actions
  createFolder: (name: string, processType: ProcessType) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  toggleFolder: (id: string) => Promise<void>;

  // File actions
  createFile: (folderId: string, name: string) => Promise<void>;
  renameFile: (id: string, name: string) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  saveActiveFile: () => Promise<void>;

  // Header actions
  updateHeader: (partial: Partial<ChartHeader>) => void;

  // Step actions
  addStep: () => void;
  updateStep: (id: string, partial: Partial<ChartStep>) => void;
  deleteStep: (id: string) => void;
  reorderSteps: (from: number, to: number) => void;

  // Layout actions
  addLayoutElement: (el: Omit<LayoutElement, 'id'>) => void;
  updateLayoutElement: (id: string, partial: Partial<LayoutElement>) => void;
  deleteLayoutElement: (id: string) => void;
  addLayoutConnection: (conn: Omit<LayoutConnection, 'id'>) => void;
  deleteLayoutConnection: (id: string) => void;
}

const defaultHeader: ChartHeader = {
  processName: '', partNumber: '', model: '',
  cycleTime: 60,
  issueDate: new Date().toISOString().split('T')[0],
  revNo: 'A', preparedBy: '', approvedBy: '',
};

// ── Helper: persist local state ──────────────────────────────────────────────
function persistLocal(state: AppDatabase) {
  saveLocalDatabase({ folders: state.folders, files: state.files, activeFileId: state.activeFileId });
}

// ── Helper: recalculate cycle time from steps ───────────────────────────────
function recalcCycleTime(steps: ChartStep[]): number {
  if (steps.length === 0) return 60;
  const actorEndTimes: Record<string, number> = {};
  for (const step of steps) {
    const actor = step.operator;
    const lastEnd = actorEndTimes[actor] || 0;
    const start = step.startTime !== undefined && step.startTime !== null ? step.startTime : lastEnd;
    const stepDur = step.manualTime + step.machineTime + step.walkingTime + step.idleTime;
    actorEndTimes[actor] = start + stepDur;
  }
  const endTimes = Object.values(actorEndTimes);
  return endTimes.length > 0 ? Math.max(...endTimes) : 60;
}

export const useChartStore = create<ChartState>((set, get) => ({
  folders: [],
  files: [],
  activeFileId: null,
  hydrated: false,
  syncStatus: 'idle',

  // ── Hydrate ─────────────────────────────────────────────────────────────────
  async hydrate() {
    if (get().hydrated) return;
    // Load local immediately for instant render
    const local = loadLocalDatabase();
    set({ ...local, hydrated: true, syncStatus: 'syncing' });
    // Then fetch cloud data
    try {
      const db = await loadDatabaseFromCloud();
      set({ ...db, hydrated: true, syncStatus: 'idle' });
      persistLocal(db);
    } catch {
      set({ syncStatus: 'error' });
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
      try {
        const full = await loadFileFromCloud(id);
        if (full) {
          set(s => ({
            files: s.files.map(f => f.id === id ? { ...full, _loaded: true } as ChartFile : f),
            syncStatus: 'idle',
          }));
          persistLocal(get());
        }
      } catch {
        set({ syncStatus: 'error' });
      }
    }
  },

  // ── Folders ─────────────────────────────────────────────────────────────────
  async createFolder(name, processType) {
    const folder: ChartFolder = {
      id: uuidv4(), name, processType, expanded: true,
      createdAt: new Date().toISOString(),
    };
    set(s => {
      const next = { ...s, folders: [...s.folders, folder] };
      persistLocal(next);
      return next;
    });
    set({ syncStatus: 'syncing' });
    try {
      await createFolderCloud(folder);
      set({ syncStatus: 'saved' });
    } catch { set({ syncStatus: 'error' }); }
    setTimeout(() => set({ syncStatus: 'idle' }), 2000);
  },

  async renameFolder(id, name) {
    set(s => {
      const next = { ...s, folders: s.folders.map(f => f.id === id ? { ...f, name } : f) };
      persistLocal(next);
      return next;
    });
    set({ syncStatus: 'syncing' });
    try {
      await updateFolderCloud(id, { name });
      set({ syncStatus: 'saved' });
    } catch { set({ syncStatus: 'error' }); }
    setTimeout(() => set({ syncStatus: 'idle' }), 2000);
  },

  async deleteFolder(id) {
    set(s => {
      const files = s.files.filter(f => f.folderId !== id);
      const activeFileId = files.find(f => f.id === s.activeFileId) ? s.activeFileId : (files[0]?.id ?? null);
      const next = { ...s, folders: s.folders.filter(f => f.id !== id), files, activeFileId };
      persistLocal(next);
      return next;
    });
    set({ syncStatus: 'syncing' });
    try {
      await deleteFolderCloud(id);
      set({ syncStatus: 'saved' });
    } catch { set({ syncStatus: 'error' }); }
    setTimeout(() => set({ syncStatus: 'idle' }), 2000);
  },

  async toggleFolder(id) {
    set(s => {
      const next = { ...s, folders: s.folders.map(f => f.id === id ? { ...f, expanded: !f.expanded } : f) };
      persistLocal(next);
      return next;
    });
    try {
      const folder = get().folders.find(f => f.id === id);
      if (folder) await updateFolderCloud(id, { expanded: folder.expanded });
    } catch { /* non-critical */ }
  },

  // ── Files ────────────────────────────────────────────────────────────────────
  async createFile(folderId, name) {
    const file: ChartFile = {
      id: uuidv4(), name, folderId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      header: { ...defaultHeader },
      steps: [],
      layoutDiagram: { elements: [], connections: [] },
    };
    set(s => {
      const next = { ...s, files: [...s.files, file], activeFileId: file.id };
      persistLocal(next);
      return next;
    });
    set({ syncStatus: 'syncing' });
    try {
      await createFileCloud(file);
      set({ syncStatus: 'saved' });
    } catch { set({ syncStatus: 'error' }); }
    setTimeout(() => set({ syncStatus: 'idle' }), 2000);
  },

  async renameFile(id, name) {
    set(s => {
      const next = { ...s, files: s.files.map(f => f.id === id ? { ...f, name, updatedAt: new Date().toISOString() } : f) };
      persistLocal(next);
      return next;
    });
    set({ syncStatus: 'syncing' });
    try {
      const file = get().files.find(f => f.id === id);
      if (file) await saveFileCloud({ ...file, name });
      set({ syncStatus: 'saved' });
    } catch { set({ syncStatus: 'error' }); }
    setTimeout(() => set({ syncStatus: 'idle' }), 2000);
  },

  async deleteFile(id) {
    set(s => {
      const files = s.files.filter(f => f.id !== id);
      const activeFileId = id === s.activeFileId ? (files[0]?.id ?? null) : s.activeFileId;
      const next = { ...s, files, activeFileId };
      persistLocal(next);
      return next;
    });
    set({ syncStatus: 'syncing' });
    try {
      await deleteFileCloud(id);
      set({ syncStatus: 'saved' });
    } catch { set({ syncStatus: 'error' }); }
    setTimeout(() => set({ syncStatus: 'idle' }), 2000);
  },

  async saveActiveFile() {
    const file = get().activeFile();
    if (!file) return;
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
    } catch { set({ syncStatus: 'error' }); }
    setTimeout(() => set({ syncStatus: 'idle' }), 3000);
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
      const newConn: LayoutConnection = { ...conn, id: uuidv4() };
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
