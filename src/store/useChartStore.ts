'use client';

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  AppDatabase, ChartFile, ChartFolder, ChartStep,
  ChartHeader, ProcessType, LayoutElement, LayoutConnection,
} from '@/types';
import { loadDatabase, saveDatabase } from '@/lib/storage';

interface ChartState extends AppDatabase {
  // ── Hydration ──────────────────────────────────────────
  hydrated: boolean;
  hydrate: () => void;

  // ── Active file helpers ─────────────────────────────────
  activeFile: () => ChartFile | null;

  // ── Folder actions ──────────────────────────────────────
  createFolder: (name: string, processType: ProcessType) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  toggleFolder: (id: string) => void;

  // ── File actions ────────────────────────────────────────
  createFile: (folderId: string, name: string) => void;
  openFile: (id: string) => void;
  renameFile: (id: string, name: string) => void;
  deleteFile: (id: string) => void;
  saveActiveFile: () => void;

  // ── Header actions ──────────────────────────────────────
  updateHeader: (partial: Partial<ChartHeader>) => void;

  // ── Step actions ────────────────────────────────────────
  addStep: () => void;
  updateStep: (id: string, partial: Partial<ChartStep>) => void;
  deleteStep: (id: string) => void;
  reorderSteps: (from: number, to: number) => void;

  // ── Layout actions ──────────────────────────────────────
  addLayoutElement: (el: Omit<LayoutElement, 'id'>) => void;
  updateLayoutElement: (id: string, partial: Partial<LayoutElement>) => void;
  deleteLayoutElement: (id: string) => void;
  addLayoutConnection: (conn: Omit<LayoutConnection, 'id'>) => void;
  deleteLayoutConnection: (id: string) => void;
}

function persist(state: AppDatabase) {
  saveDatabase({
    folders: state.folders,
    files: state.files,
    activeFileId: state.activeFileId,
  });
}

const defaultHeader: ChartHeader = {
  processName: '',
  partNumber: '',
  model: '',
  cycleTime: 60,
  issueDate: new Date().toISOString().split('T')[0],
  revNo: 'A',
  preparedBy: '',
  approvedBy: '',
};

export const useChartStore = create<ChartState>((set, get) => ({
  folders: [],
  files: [],
  activeFileId: null,
  hydrated: false,

  hydrate() {
    if (get().hydrated) return;
    const db = loadDatabase();
    set({ ...db, hydrated: true });
  },

  activeFile() {
    const { files, activeFileId } = get();
    return files.find(f => f.id === activeFileId) ?? null;
  },

  // ── Folder ──────────────────────────────────────────────
  createFolder(name, processType) {
    const folder: ChartFolder = {
      id: uuidv4(), name, processType, expanded: true,
      createdAt: new Date().toISOString(),
    };
    set(s => {
      const next = { ...s, folders: [...s.folders, folder] };
      persist(next);
      return next;
    });
  },

  renameFolder(id, name) {
    set(s => {
      const next = { ...s, folders: s.folders.map(f => f.id === id ? { ...f, name } : f) };
      persist(next);
      return next;
    });
  },

  deleteFolder(id) {
    set(s => {
      const files = s.files.filter(f => f.folderId !== id);
      const activeFileId = files.find(f => f.id === s.activeFileId) ? s.activeFileId : (files[0]?.id ?? null);
      const next = { ...s, folders: s.folders.filter(f => f.id !== id), files, activeFileId };
      persist(next);
      return next;
    });
  },

  toggleFolder(id) {
    set(s => {
      const next = { ...s, folders: s.folders.map(f => f.id === id ? { ...f, expanded: !f.expanded } : f) };
      persist(next);
      return next;
    });
  },

  // ── File ────────────────────────────────────────────────
  createFile(folderId, name) {
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
      persist(next);
      return next;
    });
  },

  openFile(id) {
    set(s => {
      const next = { ...s, activeFileId: id };
      persist(next);
      return next;
    });
  },

  renameFile(id, name) {
    set(s => {
      const next = { ...s, files: s.files.map(f => f.id === id ? { ...f, name, updatedAt: new Date().toISOString() } : f) };
      persist(next);
      return next;
    });
  },

  deleteFile(id) {
    set(s => {
      const files = s.files.filter(f => f.id !== id);
      const activeFileId = id === s.activeFileId ? (files[0]?.id ?? null) : s.activeFileId;
      const next = { ...s, files, activeFileId };
      persist(next);
      return next;
    });
  },

  saveActiveFile() {
    set(s => {
      const next = {
        ...s,
        files: s.files.map(f => f.id === s.activeFileId ? { ...f, updatedAt: new Date().toISOString() } : f),
      };
      persist(next);
      return next;
    });
  },

  // ── Header ──────────────────────────────────────────────
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
      persist(next);
      return next;
    });
  },

  // ── Steps ────────────────────────────────────────────────
  addStep() {
    set(s => {
      if (!s.activeFileId) return s;
      const file = s.files.find(f => f.id === s.activeFileId)!;
      const newStep: ChartStep = {
        id: uuidv4(),
        no: file.steps.length + 1,
        description: '',
        operator: 'Worker A',
        manualTime: 0,
        machineTime: 0,
        walkingTime: 0,
        idleTime: 0,
      };
      const steps = [...file.steps, newStep];
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId ? { ...f, steps, updatedAt: new Date().toISOString() } : f
        ),
      };
      persist(next);
      return next;
    });
  },

  updateStep(id, partial) {
    set(s => {
      if (!s.activeFileId) return s;
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? {
                ...f,
                steps: f.steps.map(step => step.id === id ? { ...step, ...partial } : step),
                updatedAt: new Date().toISOString(),
              }
            : f
        ),
      };
      persist(next);
      return next;
    });
  },

  deleteStep(id) {
    set(s => {
      if (!s.activeFileId) return s;
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? {
                ...f,
                steps: f.steps
                  .filter(step => step.id !== id)
                  .map((step, i) => ({ ...step, no: i + 1 })),
                updatedAt: new Date().toISOString(),
              }
            : f
        ),
      };
      persist(next);
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
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId ? { ...f, steps: reindexed, updatedAt: new Date().toISOString() } : f
        ),
      };
      persist(next);
      return next;
    });
  },

  // ── Layout ──────────────────────────────────────────────
  addLayoutElement(el) {
    set(s => {
      if (!s.activeFileId) return s;
      const newEl: LayoutElement = { ...el, id: uuidv4() };
      const next = {
        ...s,
        files: s.files.map(f =>
          f.id === s.activeFileId
            ? {
                ...f,
                layoutDiagram: {
                  ...f.layoutDiagram,
                  elements: [...f.layoutDiagram.elements, newEl],
                },
                updatedAt: new Date().toISOString(),
              }
            : f
        ),
      };
      persist(next);
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
            ? {
                ...f,
                layoutDiagram: {
                  ...f.layoutDiagram,
                  elements: f.layoutDiagram.elements.map(el => el.id === id ? { ...el, ...partial } : el),
                },
                updatedAt: new Date().toISOString(),
              }
            : f
        ),
      };
      persist(next);
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
      persist(next);
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
            ? {
                ...f,
                layoutDiagram: {
                  ...f.layoutDiagram,
                  connections: [...f.layoutDiagram.connections, newConn],
                },
                updatedAt: new Date().toISOString(),
              }
            : f
        ),
      };
      persist(next);
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
            ? {
                ...f,
                layoutDiagram: {
                  ...f.layoutDiagram,
                  connections: f.layoutDiagram.connections.filter(c => c.id !== id),
                },
                updatedAt: new Date().toISOString(),
              }
            : f
        ),
      };
      persist(next);
      return next;
    });
  },
}));
