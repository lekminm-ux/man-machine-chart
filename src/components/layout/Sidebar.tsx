'use client';

import React, { useState } from 'react';
import { useChartStore } from '@/store/useChartStore';
import type { ChartFolder, ProcessType } from '@/types';

const LEVEL_ICONS = ['🏭', '⚙️', '📦', '🗃️'];
const LEVEL_COLORS = ['text-yellow-500', 'text-green-400', 'text-blue-300', 'text-slate-400'];

function getLevelIcon(level: number) {
  return LEVEL_ICONS[Math.min(level, LEVEL_ICONS.length - 1)];
}
function getLevelColor(level: number) {
  return LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)];
}

type ContextTarget = { type: 'folder'; id: string } | { type: 'file'; id: string } | null;

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '1234';

function requireAdminPin(actionName: string): boolean {
  const pin = window.prompt(`Admin PIN required to ${actionName}:`);
  if (pin === ADMIN_PIN) return true;
  if (pin !== null) alert('Incorrect PIN.');
  return false;
}

export default function Sidebar() {
  const folders      = useChartStore(s => s.folders);
  const files        = useChartStore(s => s.files);
  const activeFileId = useChartStore(s => s.activeFileId);

  const createFolder = useChartStore(s => s.createFolder);
  const renameFolder = useChartStore(s => s.renameFolder);
  const deleteFolder = useChartStore(s => s.deleteFolder);
  const toggleFolder = useChartStore(s => s.toggleFolder);
  const moveFolder   = useChartStore(s => s.moveFolder);

  const createFile    = useChartStore(s => s.createFile);
  const openFile      = useChartStore(s => s.openFile);
  const renameFile    = useChartStore(s => s.renameFile);
  const deleteFile    = useChartStore(s => s.deleteFile);
  const duplicateFile = useChartStore(s => s.duplicateFile);
  const moveFile      = useChartStore(s => s.moveFile);
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

  const submitMove = (targetFolderId: string | null) => {
    if (!movingTarget) return;
    
    // Moving a folder to another folder (or to root)
    if (movingTarget.type === 'folder') {
      if (targetFolderId === movingTarget.id) return alert('Cannot move a folder into itself.');
      
      // Prevent circular moves (moving a parent into its own child)
      if (targetFolderId) {
        let currentParent = folders.find(f => f.id === targetFolderId)?.parentId;
        while (currentParent) {
          if (currentParent === movingTarget.id) return alert('Cannot move a folder into its own sub-folder.');
          currentParent = folders.find(f => f.id === currentParent)?.parentId;
        }
      }

      if (requireAdminPin('move this folder')) {
        moveFolder(movingTarget.id, targetFolderId);
      }
    } 
    // Moving a file to another folder
    else if (movingTarget.type === 'file') {
      if (targetFolderId === null) return alert('Files must be placed inside a folder.');
      if (requireAdminPin('move this file')) {
        moveFile(movingTarget.id, targetFolderId);
      }
    }
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
            >
              {folder.name}
            </span>
          )}

          {/* Action buttons */}
          {isMovingHere ? (
            <button
              onClick={e => { e.stopPropagation(); submitMove(folder.id); }}
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
                  if (requireAdminPin('delete this folder')) {
                    if (confirm(`Delete folder "${folder.name}"? This will delete all sub-folders and charts.`)) deleteFolder(folder.id); 
                  }
                }}
                className="text-slate-500 hover:text-red-600 text-[10px] p-1 hover:bg-slate-300 rounded transition-colors"
                title="Delete folder"
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
                  <span className={`flex-1 text-xs font-medium truncate ${movingTarget?.id === file.id ? 'opacity-30' : ''}`}>
                    {file.name}
                  </span>
                )}

                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); duplicateFile(file.id); }}
                    className="text-slate-400 hover:text-slate-700 text-[10px] p-1 hover:bg-slate-300 rounded transition-colors"
                    title="Duplicate Chart"
                  >📋</button>
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
                      if (requireAdminPin('delete this chart')) {
                        if (confirm(`Delete "${file.name}"?`)) deleteFile(file.id); 
                      }
                    }}
                    className="text-slate-400 hover:text-red-600 text-[10px] p-1 hover:bg-slate-300 rounded transition-colors"
                    title="Delete"
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
            onClick={() => submitMove(null)} 
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

      {/* Folder tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {rootFolders.map(folder => renderFolderNode(folder, 0))}
      </div>

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
          {[1, 2, 3, 4, 5].map(m => (
            <button
              key={m}
              onClick={() => setActiveModule(m as any)}
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
