'use client';

import React, { useState } from 'react';
import { useChartStore } from '@/store/useChartStore';
import type { ChartFolder, ProcessType } from '@/types';

const PROCESS_ICONS: Record<ProcessType, string> = {
  blow_molding:     '💨',
  injection_molding:'💉',
  assembly:         '🔧',
  custom:           '⚙️',
};

const PROCESS_COLORS: Record<ProcessType, string> = {
  blow_molding:      'text-blue-600',
  injection_molding: 'text-purple-600',
  assembly:          'text-green-600',
  custom:            'text-gray-600',
};

type ContextTarget = { type: 'folder'; id: string } | { type: 'file'; id: string } | null;

export default function Sidebar() {
  const folders      = useChartStore(s => s.folders);
  const files        = useChartStore(s => s.files);
  const activeFileId = useChartStore(s => s.activeFileId);

  const createFolder = useChartStore(s => s.createFolder);
  const renameFolder = useChartStore(s => s.renameFolder);
  const deleteFolder = useChartStore(s => s.deleteFolder);
  const toggleFolder = useChartStore(s => s.toggleFolder);

  const createFile   = useChartStore(s => s.createFile);
  const openFile     = useChartStore(s => s.openFile);
  const renameFile   = useChartStore(s => s.renameFile);
  const deleteFile   = useChartStore(s => s.deleteFile);

  const [newFolderName, setNewFolderName]       = useState('');
  const [newFolderProcess, setNewFolderProcess] = useState<ProcessType>('blow_molding');
  const [showNewFolder, setShowNewFolder]       = useState(false);
  const [renaming, setRenaming]                 = useState<ContextTarget>(null);
  const [renameValue, setRenameValue]           = useState('');
  const [newFileFolder, setNewFileFolder]       = useState<string | null>(null);
  const [newFileName, setNewFileName]           = useState('');

  const filesInFolder = (folderId: string) => files.filter(f => f.folderId === folderId);

  const submitNewFolder = () => {
    if (!newFolderName.trim()) return;
    createFolder(newFolderName.trim(), newFolderProcess);
    setNewFolderName('');
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

  return (
    <aside className="w-64 min-w-[200px] bg-slate-900 flex flex-col h-full overflow-hidden">
      {/* Sidebar header */}
      <div className="px-4 py-4 border-b border-slate-700">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Project Files</h2>
      </div>

      {/* Folder tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {folders.map(folder => {
          const folderFiles = filesInFolder(folder.id);
          return (
            <div key={folder.id} className="mb-1">
              {/* Folder row */}
              <div className="group flex items-center gap-1 px-3 py-1.5 hover:bg-slate-800 cursor-pointer rounded mx-1">
                {/* Expand toggle */}
                <button
                  onClick={() => toggleFolder(folder.id)}
                  className="text-slate-400 text-xs w-4 text-center flex-shrink-0"
                >
                  {folder.expanded ? '▾' : '▸'}
                </button>
                <span className="text-sm flex-shrink-0">{PROCESS_ICONS[folder.processType]}</span>

                {renaming?.type === 'folder' && renaming.id === folder.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(null); }}
                    onBlur={submitRename}
                    className="flex-1 bg-slate-700 text-white text-xs rounded px-1 py-0.5 focus:outline-none min-w-0"
                  />
                ) : (
                  <span
                    className={`flex-1 text-sm font-semibold truncate ${PROCESS_COLORS[folder.processType]}`}
                    onClick={() => toggleFolder(folder.id)}
                  >
                    {folder.name}
                  </span>
                )}

                {/* Folder actions */}
                <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
                  {/* Add file */}
                  <button
                    onClick={e => { e.stopPropagation(); setNewFileFolder(folder.id); setNewFileName(''); }}
                    className="text-slate-400 hover:text-white text-xs px-1"
                    title="New chart"
                  >+</button>
                  {/* Rename */}
                  <button
                    onClick={e => { e.stopPropagation(); setRenaming({ type: 'folder', id: folder.id }); setRenameValue(folder.name); }}
                    className="text-slate-400 hover:text-white text-xs px-1"
                    title="Rename"
                  >✏️</button>
                  {/* Delete */}
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm(`Delete folder "${folder.name}"?`)) deleteFolder(folder.id); }}
                    className="text-slate-400 hover:text-red-400 text-xs px-1"
                    title="Delete folder"
                  >✕</button>
                </div>
              </div>

              {/* New file input */}
              {newFileFolder === folder.id && (
                <div className="mx-3 ml-7 mt-1 flex gap-1">
                  <input
                    autoFocus
                    type="text"
                    value={newFileName}
                    onChange={e => setNewFileName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitNewFile(); if (e.key === 'Escape') setNewFileFolder(null); }}
                    placeholder="Chart name…"
                    className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1 focus:outline-none min-w-0"
                  />
                  <button onClick={submitNewFile} className="text-xs text-blue-400 hover:text-blue-300">✓</button>
                </div>
              )}

              {/* Files */}
              {folder.expanded && folderFiles.map(file => (
                <div
                  key={file.id}
                  className={`group ml-6 mr-1 flex items-center gap-1.5 px-3 py-1.5 rounded cursor-pointer transition-colors ${
                    activeFileId === file.id
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                  onClick={() => openFile(file.id)}
                >
                  <span className="text-xs flex-shrink-0">📊</span>

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
                    <span className="flex-1 text-xs font-medium truncate">{file.name}</span>
                  )}

                  {/* File actions */}
                  <div className={`${activeFileId === file.id ? 'flex' : 'hidden group-hover:flex'} items-center gap-1 flex-shrink-0`}>
                    <button
                      onClick={e => { e.stopPropagation(); setRenaming({ type: 'file', id: file.id }); setRenameValue(file.name); }}
                      className="text-white/60 hover:text-white text-xs"
                      title="Rename"
                    >✏️</button>
                    <button
                      onClick={e => { e.stopPropagation(); if (confirm(`Delete "${file.name}"?`)) deleteFile(file.id); }}
                      className="text-white/60 hover:text-red-300 text-xs"
                      title="Delete"
                    >✕</button>
                  </div>
                </div>
              ))}

              {/* Empty folder hint */}
              {folder.expanded && folderFiles.length === 0 && (
                <p className="ml-8 text-xs text-slate-600 italic py-1">No charts yet</p>
              )}
            </div>
          );
        })}
      </div>

      {/* New folder panel */}
      <div className="border-t border-slate-700 p-3">
        {showNewFolder ? (
          <div className="space-y-2">
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitNewFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
              placeholder="Folder name…"
              className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none"
            />
            <select
              value={newFolderProcess}
              onChange={e => setNewFolderProcess(e.target.value as ProcessType)}
              className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none"
            >
              <option value="blow_molding">💨 Blow Molding</option>
              <option value="injection_molding">💉 Injection Molding</option>
              <option value="assembly">🔧 Assembly</option>
              <option value="custom">⚙️ Custom</option>
            </select>
            <div className="flex gap-2">
              <button onClick={submitNewFolder} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded py-1 font-semibold">Create</button>
              <button onClick={() => setShowNewFolder(false)} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded py-1">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNewFolder(true)}
            className="w-full flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-semibold rounded py-2 transition-colors"
          >
            <span className="text-base leading-none">+</span> New Folder
          </button>
        )}
      </div>
    </aside>
  );
}
