'use client';

import React, { useEffect, useState } from 'react';
import { useChartStore } from '@/store/useChartStore';
import type { ChartFile, ChartFolder, ProcessType } from '@/types';

const LEVEL_ICONS = ['🏭', '⚙️', '📦', '🗃️'];
const LEVEL_COLORS = ['text-yellow-500', 'text-green-400', 'text-blue-300', 'text-slate-400'];

function getLevelIcon(level: number) {
  return LEVEL_ICONS[Math.min(level, LEVEL_ICONS.length - 1)];
}
function getLevelColor(level: number) {
  return LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)];
}

type ContextTarget = { type: 'folder'; id: string } | { type: 'file'; id: string } | null;

// Moving remains gated pending the shared login/authorization design. The
// current owner-approved trash action is available to all app visitors; this
// confirmation is an accident guard, not an identity or permission check.
function denyDestructiveAction(actionName: string): void {
  alert(`${actionName} is not available yet — it requires server-side authorization, which has not shipped. This is a safety gate, not an error.`);
}

// Phase 0C: a folder/file whose id doesn't exist in Cloud at all (`_unsynced`)
// or whose last save's read-back never confirmed the write (`_unconfirmed`)
// must be visibly distinguished, not rendered identically to a confirmed
// Cloud row — per the source-of-truth rule, these are local-only/unproven
// until they successfully sync.
function unsyncedBadge(item: { _unsynced?: boolean; _unconfirmed?: boolean }) {
  if (!item._unsynced && !item._unconfirmed) return null;
  const label = item._unsynced ? 'local only' : 'unconfirmed';
  const title = item._unsynced
    ? 'Not yet confirmed in Cloud — created while Cloud was unavailable, or never synced.'
    : 'Not yet confirmed in Cloud — the last save could not be verified by a fresh read. Try saving again.';
  return (
    <span
      className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded px-1 py-0.5 flex-shrink-0"
      title={title}
    >
      {label}
    </span>
  );
}

export default function Sidebar() {
  const folders      = useChartStore(s => s.folders);
  const files        = useChartStore(s => s.files);
  const activeFileId = useChartStore(s => s.activeFileId);
  const cloudReady   = useChartStore(s => s.cloudReady);

  const createFolder = useChartStore(s => s.createFolder);
  const renameFolder = useChartStore(s => s.renameFolder);
  const toggleFolder = useChartStore(s => s.toggleFolder);

  const createFile    = useChartStore(s => s.createFile);
  const openFile      = useChartStore(s => s.openFile);
  const renameFile    = useChartStore(s => s.renameFile);
  const duplicateFile = useChartStore(s => s.duplicateFile);
  const deleteFile = useChartStore(s => s.deleteFile);
  const deleteFolder = useChartStore(s => s.deleteFolder);
  const restoreTrash = useChartStore(s => s.restoreTrash);
  const acknowledgeTrashWarning = useChartStore(s => s.acknowledgeTrashWarning);
  const trashEntries = useChartStore(s => s.trashEntries);
  const trashMessage = useChartStore(s => s.trashMessage);
  const setActiveModule = useChartStore(s => s.setActiveModule);
  const activeModule = useChartStore(s => s.activeModule);

  const [showNewFolder, setShowNewFolder]       = useState(false);
  const [newFolderName, setNewFolderName]       = useState('');
  const [newFolderProcess, setNewFolderProcess] = useState<ProcessType>('blow_molding');
  const [newFolderParent, setNewFolderParent]   = useState<string | null>(null);

  const [renaming, setRenaming]                 = useState<ContextTarget>(null);
  const [renameValue, setRenameValue]           = useState('');
  const [newFileFolder, setNewFileFolder]       = useState<string | null>(null);
  const [newFileName, setNewFileName]           = useState('');

  const [movingTarget, setMovingTarget]         = useState<ContextTarget>(null);
  const [copyingFileId, setCopyingFileId]       = useState<string | null>(null);
  const [trashOpen, setTrashOpen]                 = useState(false);
  const [clockNow, setClockNow]                   = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const warningStart = clockNow + 7 * 24 * 60 * 60 * 1000;
  const expiringEntries = trashEntries.filter(entry => !entry.purgeStartedAt && Date.parse(entry.expiresAt) <= warningStart);

  const confirmDeleteFile = (file: ChartFile) => {
    if (!cloudReady) return;
    if (window.confirm(`Move chart "${file.name}" to Trash? You can restore it for at least 90 days.`)) {
      setTrashOpen(true);
      void deleteFile(file.id);
    }
  };

  const confirmDeleteFolder = (folder: ChartFolder) => {
    if (!cloudReady) return;
    if (window.confirm(`Move folder "${folder.name}" and everything inside it to Trash? You can restore the whole group for at least 90 days.`)) {
      setTrashOpen(true);
      void deleteFolder(folder.id);
    }
  };

  // Tooltip for truncated folder/file names
  const [nameTip, setNameTip] = useState<{ text: string; x: number; y: number; flip: boolean } | null>(null);

  const showNameTip = (e: React.MouseEvent<HTMLElement>, text: string) => {
    const el = e.currentTarget;
    // Only pop up when the name is actually clipped by `truncate`
    if (el.scrollWidth <= el.clientWidth + 1) return;
    const r = el.getBoundingClientRect();
    const flip = r.bottom + 56 > window.innerHeight;
    setNameTip({ text, x: r.left, y: flip ? r.top - 6 : r.bottom + 6, flip });
  };
  const hideNameTip = () => setNameTip(null);

  const filesInFolder = (folderId: string) => files.filter(f => f.folderId === folderId);

  const submitNewFolder = () => {
    if (!newFolderName.trim()) return;
    createFolder(newFolderName.trim(), newFolderProcess, newFolderParent);
    setNewFolderName('');
    setNewFolderParent(null);
    setShowNewFolder(false);
  };

  const submitNewFile = () => {
    if (!newFileName.trim() || !newFileFolder) return;
    createFile(newFileFolder, newFileName.trim());
    setNewFileName('');
    setNewFileFolder(null);
  };

  const submitRename = () => {
    if (!renaming || !renameValue.trim()) return;
    if (renaming.type === 'folder') renameFolder(renaming.id, renameValue.trim());
    else renameFile(renaming.id, renameValue.trim());
    setRenaming(null);
  };

  const submitMove = () => {
    if (!movingTarget) return;
    // Moving is a hierarchy change — denied until server-side authorization
    // ships (Phase 0B). The cycle/self-parent checks this used to run
    // client-side now live server-side in functions/api/folders.js, which is
    // the authoritative check regardless of what the UI allows.
    denyDestructiveAction(movingTarget.type === 'folder' ? 'Moving folders' : 'Moving charts');
    setMovingTarget(null);
  };

  // Helper to render tree nodes recursively
  const renderFolderNode = (folder: ChartFolder, level: number = 0) => {
    const childFolders = folders.filter(f => f.parentId === folder.id);
    const childFiles = filesInFolder(folder.id);
    const indent = level * 16;
    const isMovingHere = movingTarget !== null && movingTarget.id !== folder.id;

    return (
      <div key={folder.id} className="mb-0.5">
        <div
          className="group flex items-center gap-1 px-3 py-1.5 hover:bg-slate-200 cursor-pointer rounded mx-1 transition-colors"
          style={{ marginLeft: `${indent + 4}px` }}
        >
          <button onClick={() => toggleFolder(folder.id)} className="text-slate-500 hover:text-slate-700 text-xs w-4 text-center flex-shrink-0">
            {folder.expanded ? '▾' : '▸'}
          </button>

          <span className="text-lg flex-shrink-0 drop-shadow-sm mr-1">{getLevelIcon(level)}</span>

          {renaming?.type === 'folder' && renaming.id === folder.id ? (
            <input
              autoFocus
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(null); }}
              onBlur={submitRename}
              className="flex-1 bg-white border border-slate-300 text-slate-800 text-xs rounded px-1 py-0.5 focus:outline-none min-w-0"
            />
          ) : (
            <span
              className={`flex-1 text-sm font-semibold truncate ${getLevelColor(level)} ${movingTarget?.id === folder.id ? 'opacity-30' : ''}`}
              onClick={() => toggleFolder(folder.id)}
              onMouseEnter={e => showNameTip(e, folder.name)}
              onMouseLeave={hideNameTip}
            >
              {folder.name}
            </span>
          )}
          {unsyncedBadge(folder as ChartFolder & { _unsynced?: boolean })}

          {/* Action buttons */}
          {isMovingHere ? (
            <button
              onClick={e => { e.stopPropagation(); submitMove(); }}
              className="text-green-400 hover:text-green-300 bg-green-900/30 hover:bg-green-800/50 text-[10px] px-2 py-0.5 rounded border border-green-700/50 transition-colors"
            >
              Move Here
            </button>
          ) : (
            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={e => { e.stopPropagation(); setNewFolderParent(folder.id); setShowNewFolder(true); }}
                className="text-slate-500 hover:text-slate-800 text-[10px] p-1 hover:bg-slate-300 rounded transition-colors"
                title="New sub-folder"
              >📁➕</button>
              <button
                onClick={e => { e.stopPropagation(); setNewFileFolder(folder.id); setNewFileName(''); }}
                className="text-slate-500 hover:text-slate-800 text-[10px] p-1 hover:bg-slate-300 rounded transition-colors"
                title="New chart"
              >📄➕</button>
              <button
                onClick={e => { e.stopPropagation(); setMovingTarget({ type: 'folder', id: folder.id }); }}
                className="text-slate-500 hover:text-blue-600 text-[10px] p-1 hover:bg-slate-300 rounded transition-colors"
                title="Move folder"
              >🔄</button>
              <button
                onClick={e => { e.stopPropagation(); setRenaming({ type: 'folder', id: folder.id }); setRenameValue(folder.name); }}
                className="text-slate-500 hover:text-slate-800 text-[10px] p-1 hover:bg-slate-300 rounded transition-colors"
                title="Rename"
              >✏️</button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  confirmDeleteFolder(folder);
                }}
                disabled={!cloudReady}
                className="text-slate-500 hover:text-red-600 text-[10px] p-1 hover:bg-slate-300 rounded transition-colors"
                title="Move folder and contents to Trash"
              >🗑️</button>
            </div>
          )}
        </div>

        {/* Input for new file in this folder */}
        {newFileFolder === folder.id && (
          <div className="mx-3 mt-1 flex gap-1 mb-2" style={{ marginLeft: `${indent + 28}px` }}>
            <input
              autoFocus
              type="text"
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitNewFile(); if (e.key === 'Escape') setNewFileFolder(null); }}
              placeholder="Chart name…"
              className="flex-1 bg-white border border-slate-300 text-slate-800 text-xs rounded px-2 py-1 focus:outline-none min-w-0"
            />
            <button onClick={submitNewFile} className="text-xs text-blue-400 hover:text-blue-300">✓</button>
          </div>
        )}

        {/* Expanded content */}
        {folder.expanded && (
          <div className="mt-0.5">
            {/* 1. Render Sub-folders */}
            {childFolders.map(child => renderFolderNode(child, level + 1))}

            {/* 2. Render Files */}
            {childFiles.map(file => (
              <div
                key={file.id}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded cursor-pointer transition-colors mx-1 ${
                  activeFileId === file.id
                    ? 'bg-blue-100 text-blue-700 shadow-sm border border-blue-200'
                    : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                style={{ marginLeft: `${indent + 24}px` }}
                onClick={() => openFile(file.id)}
              >
                <span className="text-base flex-shrink-0 drop-shadow-sm mr-1">📋</span>

                {renaming?.type === 'file' && renaming.id === file.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(null); }}
                    onBlur={submitRename}
                    className="flex-1 bg-blue-700 text-white text-xs rounded px-1 py-0.5 focus:outline-none min-w-0"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className={`flex-1 text-xs font-medium truncate ${movingTarget?.id === file.id ? 'opacity-30' : ''}`}
                    onMouseEnter={e => showNameTip(e, file.name)}
                    onMouseLeave={hideNameTip}
                  >
                    {file.name}
                  </span>
                )}
                {unsyncedBadge(file as ChartFile & { _unsynced?: boolean; _unconfirmed?: boolean })}

                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); duplicateFile(file.id); }}
                    className="text-slate-400 hover:text-slate-700 text-[10px] p-1 hover:bg-slate-300 rounded transition-colors"
                    title="Duplicate Chart"
                  >📋</button>
                  <button
                    disabled={!cloudReady}
                    onClick={e => {
                      e.stopPropagation();
                      setCopyingFileId(copyingFileId === file.id ? null : file.id);
                    }}
                    className={`text-[10px] p-1 rounded transition-colors ${
                      !cloudReady
                        ? 'opacity-30 cursor-not-allowed text-slate-400'
                        : 'text-slate-400 hover:text-blue-600 hover:bg-slate-300'
                    }`}
                    title={cloudReady ? "Copy to Folder" : "Cloud unavailable"}
                  >📑</button>
                  {copyingFileId === file.id && (
                    <span className="flex items-center gap-1 bg-white border border-slate-300 rounded px-1 py-0.5 text-xs shadow-sm" onClick={e => e.stopPropagation()}>
                      <select
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value) {
                            duplicateFile(file.id, e.target.value);
                            setCopyingFileId(null);
                          }
                        }}
                        className="bg-transparent text-slate-800 text-[10px] focus:outline-none"
                      >
                        <option value="" disabled>Select target folder…</option>
                        {folders.filter(f => {
                          const status = f as ChartFolder & { _unconfirmed?: boolean; _unsynced?: boolean };
                          return !status._unconfirmed && !status._unsynced;
                        }).map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setCopyingFileId(null)}
                        className="text-[10px] text-slate-500 hover:text-slate-800 font-semibold px-1"
                        title="Cancel"
                      >✕</button>
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); setMovingTarget({ type: 'file', id: file.id }); }}
                    className="text-slate-400 hover:text-blue-600 text-[10px] p-1 hover:bg-slate-300 rounded transition-colors"
                    title="Move"
                  >🔄</button>
                  <button
                    onClick={e => { e.stopPropagation(); setRenaming({ type: 'file', id: file.id }); setRenameValue(file.name); }}
                    className="text-slate-400 hover:text-slate-700 text-[10px] p-1 hover:bg-slate-300 rounded transition-colors"
                    title="Rename"
                  >✏️</button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      confirmDeleteFile(file);
                    }}
                    disabled={!cloudReady}
                    className="text-slate-400 hover:text-red-600 text-[10px] p-1 hover:bg-slate-300 rounded transition-colors"
                    title="Move chart to Trash"
                  >🗑️</button>
                </div>
              </div>
            ))}

            {/* Empty hint */}
            {childFolders.length === 0 && childFiles.length === 0 && (
              <p className="text-xs text-slate-600 italic py-1" style={{ marginLeft: `${indent + 32}px` }}>
                Empty
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = folders.filter(f => !f.parentId);

  return (
    <aside className="w-[320px] min-w-[320px] bg-slate-50 flex flex-col h-full overflow-hidden flex-shrink-0 border-r border-slate-200">
      {/* Sidebar header */}
      <div className="px-4 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Project Files</h2>
        {movingTarget?.type === 'folder' && (
          <button
            onClick={() => submitMove()}
            className="text-[10px] bg-green-900/30 text-green-400 px-2 py-1 rounded border border-green-700/50 hover:bg-green-800/50"
          >
            Move to Root
          </button>
        )}
        {movingTarget && (
          <button
            onClick={() => setMovingTarget(null)}
            className="text-[10px] text-red-600 hover:text-red-500 font-semibold"
          >
            Cancel Move
          </button>
        )}
      </div>

      {/* Cloud-unavailable state — data safety gate (Phase 0B) */}
      {!cloudReady && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-[11px] leading-snug">
          <b>⚠ Cloud unavailable.</b> Showing cached data — changes and Trash are unavailable until reconnected.
        </div>
      )}

      {cloudReady && expiringEntries.length > 0 && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-200 text-red-800 text-[11px] leading-snug" role="alert">
          ⚠ {expiringEntries.length} Trash item{expiringEntries.length === 1 ? '' : 's'} near the 90-day deadline. Review Trash now; permanent deletion requires seven days after notice acknowledgement.
          <button onClick={() => setTrashOpen(true)} className="ml-1 underline font-semibold">Open Trash</button>
        </div>
      )}

      {/* Folder tree */}
      <div className="flex-1 overflow-y-auto py-2" onScroll={hideNameTip}>
        {rootFolders.map(folder => renderFolderNode(folder, 0))}
      </div>

      <div className="border-t border-slate-200 bg-white">
        <button onClick={() => setTrashOpen(open => !open)} className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100">
          🗑️ Trash ({trashEntries.length}) {trashOpen ? '▴' : '▾'}
        </button>
        {trashOpen && (
          <div className="max-h-56 overflow-y-auto px-3 pb-2 space-y-2">
            {trashMessage && <p className="rounded bg-red-50 border border-red-200 px-2 py-1 text-[11px] text-red-700" role="alert">{trashMessage}</p>}
            {trashEntries.length === 0 && <p className="text-xs text-slate-500">Trash is empty.</p>}
            {trashEntries.map(entry => {
              const warningDue = Date.parse(entry.expiresAt) <= warningStart && !entry.warnedAt && !entry.purgeStartedAt;
              const purgeTime = entry.warnedAt
                ? Math.max(Date.parse(entry.expiresAt), Date.parse(entry.warnedAt) + 7 * 24 * 60 * 60 * 1000)
                : null;
              return (
                <div key={entry.id} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                  <div className="font-semibold break-words">{entry.kind === 'folder' ? '📁' : '📄'} {entry.name}</div>
                  <div className="text-[10px] text-slate-500">
                    Deleted {new Date(entry.deletedAt).toLocaleDateString()} · 90 days {new Date(entry.expiresAt).toLocaleDateString()}
                  </div>
                  <div className="text-[10px] text-slate-600">
                    {entry.purgeStartedAt ? 'Permanent deletion in progress' : purgeTime
                      ? `Permanent deletion no sooner than ${new Date(purgeTime).toLocaleDateString()}`
                      : 'Permanent deletion waits for the seven-day notice'}
                  </div>
                  <div className="flex gap-2 mt-1">
                    {!entry.purgeStartedAt && <button onClick={() => void restoreTrash(entry.id)} className="text-blue-700 font-semibold underline">Restore</button>}
                    {warningDue && <button onClick={() => void acknowledgeTrashWarning(entry.id)} className="text-red-700 font-semibold underline">Acknowledge notice</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full-name tooltip (fixed so it is not clipped by the sidebar) */}
      {nameTip && (
        <div
          className="fixed z-50 pointer-events-none max-w-[420px] rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg break-words"
          style={{
            left: `${nameTip.x}px`,
            top: `${nameTip.y}px`,
            transform: nameTip.flip ? 'translateY(-100%)' : undefined,
          }}
        >
          {nameTip.text}
        </div>
      )}

      {/* New folder panel */}
      <div className="border-t border-slate-200 p-3 bg-white">
        {showNewFolder ? (
          <div className="space-y-2">
            <div className="text-xs text-blue-600 mb-1 font-semibold">
              {newFolderParent
                ? `Creating sub-folder in "${folders.find(f => f.id === newFolderParent)?.name}"`
                : 'Creating root folder (e.g. PD level)'}
            </div>
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitNewFolder(); if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderParent(null); } }}
              placeholder="Folder name…"
              className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded px-2 py-1.5 focus:outline-none"
            />
            <select
              value={newFolderProcess}
              onChange={e => setNewFolderProcess(e.target.value as ProcessType)}
              className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded px-2 py-1.5 focus:outline-none"
            >
              <option value="blow_molding">💨 Blow Molding</option>
              <option value="injection_molding">💉 Injection Molding</option>
              <option value="assembly">🔧 Assembly</option>
              <option value="custom">⚙️ Custom</option>
            </select>
            <div className="flex gap-2">
              <button onClick={submitNewFolder} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded py-1.5 font-semibold shadow-sm">Create</button>
              <button onClick={() => { setShowNewFolder(false); setNewFolderParent(null); }} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded py-1.5 font-semibold">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setNewFolderParent(null); setShowNewFolder(true); }}
            className="w-full flex items-center justify-center gap-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 text-xs font-bold rounded py-2 transition-all shadow-sm"
          >
            <span className="text-base leading-none text-blue-600">+</span> New Root Folder
          </button>
        )}
      </div>

      {/* Module Switcher */}
      <div className="border-t border-slate-200 bg-slate-50 p-2 flex flex-col gap-1">
        <div className="text-[10px] font-bold text-slate-500 uppercase px-2 mb-1">Ecosystem Modules</div>
        <div className="grid grid-cols-5 gap-1">
          {([1, 2, 3, 4, 5] as const).map(m => (
            <button
              key={m}
              onClick={() => setActiveModule(m)}
              className={`py-1.5 rounded text-xs font-bold transition-colors shadow-sm border ${
                activeModule === m
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title={`Module ${m}`}
            >
              M{m}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
