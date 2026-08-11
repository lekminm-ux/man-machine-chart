'use client';
// ============================================================
// storage.ts — Cloud (Cloudflare D1) + localStorage fallback
// ============================================================

import type { AppDatabase, ChartFile, ChartFolder } from '@/types';
import type { RevisionSnapshot, RevisionSnapshotContent, RevisionSnapshotMeta } from '@/types';
import { v4 as uuidv4 } from 'uuid';

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
// A cloud load either confirms a hydrated Production state (`ok: true`) or it
// doesn't — `ok: false` carries the local/cached data separately, as a
// `fallback` for display/review only, so a caller can never mistake "the
// cloud read failed, here's what's cached" for "the cloud is confirmed synced".
export type CloudLoadResult =
  | { ok: true; db: AppDatabase }
  | { ok: false; error: string; fallback: AppDatabase };

export async function loadDatabaseFromCloud(): Promise<CloudLoadResult> {
  try {
    const [folders, files]: [ChartFolder[], Omit<ChartFile, 'header' | 'steps' | 'layoutDiagram'>[]] =
      await Promise.all([
        apiFetch('/api/folders'),
        apiFetch('/api/files'),
      ]);

    const local = loadLocalDatabase();
    const cloudFileIds = new Set(files.map(f => f.id));

    // We have metadata for files; load full content lazily when file is opened
    // Merge cloud files metadata with local loaded files. Cloud is
    // authoritative once hydration succeeds: cached local content is only
    // trusted when it's fully loaded AND its updatedAt still matches what
    // Cloud just reported. A local file whose updatedAt differs (older —
    // someone else's save landed since this browser last synced it; or from
    // this browser's own past session) is stale and must go back through the
    // lazy `_loaded: false` path rather than being presented as confirmed
    // Cloud content.
    const mergedFiles = files.map(cloudFile => {
      const localFile = local.files?.find(f => f.id === cloudFile.id) as (ChartFile & { _loaded?: boolean; _unconfirmed?: boolean }) | undefined;
      // A local file marked _unconfirmed (its last save's read-back never
      // proved the write, or hasn't been retried) must never be trusted as
      // Cloud content on this or any future hydration — regardless of
      // whether its updatedAt happens to match Cloud's. Force it back
      // through the lazy-load path so the next open re-fetches genuine
      // Cloud content instead of silently presenting the unproven draft as
      // saved. The draft's own data is kept (not overwritten here) so it
      // isn't silently discarded — only `_loaded` flips, so `openFile`
      // re-fetches and replaces it once the file is actually opened again.
      if (localFile && localFile._unconfirmed) {
        return { ...localFile, _loaded: false };
      }
      if (localFile && localFile._loaded !== false && localFile.updatedAt === cloudFile.updatedAt) {
        return localFile;
      }
      return {
        ...cloudFile,
        header: { processName: '', partNumber: '', partName: '', model: '', moldNo: '', cycleTime: 60, issueDate: '', revNo: 'A', preparedBy: '', approvedBy: '' },
        steps: [],
        layoutDiagram: { elements: [], connections: [] },
        _loaded: false,
      };
    }) as (ChartFile & { _loaded: boolean })[];

    // Local files/folders absent from Cloud's own list are unconfirmed by
    // definition — never synced, or created while Cloud was unavailable.
    // Flagged with `_unsynced` rather than silently folded into a result
    // that gets marked `cloudReady`, so they're never mistaken for confirmed
    // Cloud rows (a save attempt against one still correctly fails, since
    // there is no matching row for the API to update).
    const unsyncedFiles = (local.files || []).filter(f => !cloudFileIds.has(f.id)).map(f => ({ ...f, _unsynced: true }));
    const finalFiles = [...mergedFiles, ...unsyncedFiles];

    // Keep any local folders that are not in the cloud
    const cloudFolderIds = new Set(folders.map(f => f.id));
    const mergedFolders = folders.map(f => ({ ...f, expanded: Boolean(f.expanded) }));
    const unsyncedFolders = (local.folders || []).filter(f => !cloudFolderIds.has(f.id)).map(f => ({ ...f, _unsynced: true }));
    const finalFolders = [...mergedFolders, ...unsyncedFolders];

    const db: AppDatabase = {
      folders: finalFolders,
      files: finalFiles,
      activeFileId: local.activeFileId ?? null,
    };
    saveLocalDatabase(db);
    return { ok: true, db };
  } catch (err) {
    console.warn('Cloud load failed:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      fallback: loadLocalDatabase(),
    };
  }
}

// ── Load single file content from cloud ───────────────────────────────────
// Same explicit ok/not-ok shape as CloudLoadResult, for the same reason: the
// old `ChartFile | null` return swallowed its own failure internally, so the
// caller's try/catch never actually saw an error — `openFile` was left with
// no way to distinguish "load failed" from "nothing to do", and stayed stuck
// in `syncing` forever on failure.
export type FileLoadResult =
  | { ok: true; file: ChartFile }
  | { ok: false; error: string };

export async function loadFileFromCloud(id: string): Promise<FileLoadResult> {
  try {
    const row = await apiFetch(`/api/files?id=${encodeURIComponent(id)}`);
    const { content, ...meta } = row;
    return { ok: true, file: { ...meta, ...content } as ChartFile };
  } catch (err) {
    console.warn('File cloud load failed:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
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
// The single canonical definition of "everything that goes in the `content`
// JSON column" — every ChartFile field except the ones that are their own SQL
// columns (id/name/folderId/createdAt/updatedAt). GPT review flagged that
// createFileCloud/saveFileCloud previously hand-picked only
// header/steps/layoutDiagram, silently dropping timeMeasurement/timeStudy/
// machineCapacity (M1/M2 data) on every single save. Exported so
// useChartStore's read-back comparison uses this exact same field list —
// two independently-maintained copies of "what persists" is exactly how a
// field gets missed again.
export function chartFileContent(file: ChartFile): RevisionSnapshotContent {
  return {
    header: file.header,
    steps: file.steps,
    layoutDiagram: file.layoutDiagram,
    timeMeasurement: file.timeMeasurement,
    timeStudy: file.timeStudy,
    machineCapacity: file.machineCapacity,
  };
}

export async function createFileCloud(file: ChartFile): Promise<void> {
  const { id, name, folderId, createdAt, updatedAt } = file;
  await apiFetch('/api/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, folderId, createdAt, updatedAt, content: chartFileContent(file) }),
  });
}

// A save is not "done" just because the HTTP request didn't throw — the API
// can report success on a zero-row update (a stale/local-only id), and a
// response that arrives without the fields this checks for is not proof
// anything was written. The caller (saveActiveFile) still does its own
// independent fresh-GET read-back on top of this; this only confirms the
// write call itself was explicit, not silently assumed.
export type SaveFileResult =
  | { ok: true; id: string; updatedAt: string }
  | { ok: false; error: string };

export async function saveFileCloud(file: ChartFile, updatedAt: string): Promise<SaveFileResult> {
  const { id, name, folderId } = file;
  try {
    const res = await apiFetch('/api/files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id, name, folderId, updatedAt,
        content: chartFileContent(file),
      }),
    });
    if (!res || res.success !== true || !res.updatedAt || res.id !== file.id) {
      return { ok: false, error: 'save did not return an explicit confirmed response' };
    }
    return { ok: true, id: file.id, updatedAt: res.updatedAt };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type CloseRevisionResult =
  | { ok: true; snapshot: RevisionSnapshotMeta }
  | { ok: false; error: string };

export async function closeRevisionCloud(chartFileId: string, revNo: string): Promise<CloseRevisionResult> {
  const id = uuidv4();
  try {
    const res = await apiFetch('/api/revisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, chartFileId, revNo }),
    });
    const snapshot = res?.snapshot;
    if (
      res?.success !== true ||
      !snapshot ||
      snapshot.id !== id ||
      snapshot.chartFileId !== chartFileId ||
      snapshot.revNo !== revNo ||
      !snapshot.closedAt
    ) {
      return { ok: false, error: 'close revision did not return an explicit confirmed response' };
    }
    return {
      ok: true,
      snapshot: {
        id: snapshot.id,
        chartFileId: snapshot.chartFileId,
        revNo: snapshot.revNo,
        closedAt: snapshot.closedAt,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type OpenRevisionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function openRevisionCloud(chartFileId: string): Promise<OpenRevisionResult> {
  try {
    const res = await apiFetch('/api/revisions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chartFileId }),
    });
    if (res?.success !== true || res.chartFileId !== chartFileId) {
      return { ok: false, error: 'open revision did not return an explicit confirmed response' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type ListRevisionsResult =
  | { ok: true; snapshots: RevisionSnapshotMeta[] }
  | { ok: false; error: string };

export async function listRevisionSnapshotsCloud(chartFileId: string): Promise<ListRevisionsResult> {
  try {
    const res = await apiFetch(`/api/revisions?chartFileId=${encodeURIComponent(chartFileId)}`);
    if (!Array.isArray(res)) {
      return { ok: false, error: 'list revisions did not return an explicit confirmed response' };
    }
    return { ok: true, snapshots: res as RevisionSnapshotMeta[] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type GetRevisionSnapshotResult =
  | { ok: true; snapshot: RevisionSnapshot }
  | { ok: false; error: string };

export async function getRevisionSnapshotCloud(id: string): Promise<GetRevisionSnapshotResult> {
  try {
    const res = await apiFetch(`/api/revisions?id=${encodeURIComponent(id)}`);
    if (!res?.id || !res?.chartFileId || typeof res?.revNo !== 'string' || !res?.closedAt || !res?.content) {
      return { ok: false, error: 'get revision snapshot did not return an explicit confirmed response' };
    }
    return {
      ok: true,
      snapshot: {
        id: res.id,
        chartFileId: res.chartFileId,
        revNo: res.revNo,
        closedAt: res.closedAt,
        content: res.content,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteFileCloud(id: string): Promise<void> {
  await apiFetch(`/api/files?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}
