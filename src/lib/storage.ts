'use client';
// ============================================================
// storage.ts — Cloud (Cloudflare D1) + localStorage fallback
// ============================================================

import type { AppDatabase, ChartFile, ChartFolder } from '@/types';

const LS_KEY = 'mm_chart_db_v2';

// ── localStorage helpers (offline cache) ──────────────────────────────────
export function loadLocalDatabase(): AppDatabase {
  if (typeof window === 'undefined') return { folders: [], files: [], activeFileId: null };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as AppDatabase;
  } catch { /* ignore */ }
  return { folders: [], files: [], activeFileId: null };
}

export function saveLocalDatabase(db: AppDatabase): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch { /* ignore */ }
}

// ── Cloud API helpers ──────────────────────────────────────────────────────
async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Load entire database from cloud ───────────────────────────────────────
export async function loadDatabaseFromCloud(): Promise<AppDatabase> {
  try {
    const [folders, files]: [ChartFolder[], Omit<ChartFile, 'header' | 'steps' | 'layoutDiagram'>[]] =
      await Promise.all([
        apiFetch('/api/folders'),
        apiFetch('/api/files'),
      ]);

    // We have metadata for files; load full content lazily when file is opened
    const partialFiles = files.map(f => ({
      ...f,
      header: { processName: '', partNumber: '', partName: '', model: '', moldNo: '', cycleTime: 60, issueDate: '', revNo: 'A', preparedBy: '', approvedBy: '' },
      steps: [],
      layoutDiagram: { elements: [], connections: [] },
      _loaded: false,
    })) as (ChartFile & { _loaded: boolean })[];

    const local = loadLocalDatabase();
    const db: AppDatabase = {
      folders: folders.map(f => ({ ...f, expanded: Boolean(f.expanded) })),
      files: partialFiles,
      activeFileId: local.activeFileId ?? null,
    };
    saveLocalDatabase(db);
    return db;
  } catch (err) {
    console.warn('Cloud load failed, using localStorage:', err);
    return loadLocalDatabase();
  }
}

// ── Load single file content from cloud ───────────────────────────────────
export async function loadFileFromCloud(id: string): Promise<ChartFile | null> {
  try {
    const row = await apiFetch(`/api/files?id=${encodeURIComponent(id)}`);
    const { content, ...meta } = row;
    return { ...meta, ...content } as ChartFile;
  } catch (err) {
    console.warn('File cloud load failed:', err);
    return null;
  }
}

// ── Folder cloud actions ───────────────────────────────────────────────────
export async function createFolderCloud(folder: ChartFolder): Promise<void> {
  await apiFetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(folder),
  });
}

export async function updateFolderCloud(id: string, patch: Partial<ChartFolder>): Promise<void> {
  await apiFetch('/api/folders', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...patch }),
  });
}

export async function deleteFolderCloud(id: string): Promise<void> {
  await apiFetch(`/api/folders?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── File cloud actions ─────────────────────────────────────────────────────
export async function createFileCloud(file: ChartFile): Promise<void> {
  const { header, steps, layoutDiagram, ...meta } = file;
  await apiFetch('/api/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...meta, content: { header, steps, layoutDiagram } }),
  });
}

export async function saveFileCloud(file: ChartFile): Promise<void> {
  const { header, steps, layoutDiagram, ...meta } = file;
  await apiFetch('/api/files', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...meta,
      updatedAt: new Date().toISOString(),
      content: { header, steps, layoutDiagram },
    }),
  });
}

export async function deleteFileCloud(id: string): Promise<void> {
  await apiFetch(`/api/files?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}
