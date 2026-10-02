'use client';

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useId,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface SidebarActionMenuProps {
  fileId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cloudReady: boolean;
  onDuplicate: () => void;
  onCopy: () => void;
  onMove: () => void;
  onRename: () => void;
  onTrash: () => void;
}

interface MenuItemConfig {
  id: string;
  label: string;
  icon: string;
  helperText?: string;
  disabled: boolean;
  action: () => void;
  danger?: boolean;
}

export function SidebarActionMenu({
  fileName,
  open,
  onOpenChange,
  cloudReady,
  onDuplicate,
  onCopy,
  onMove,
  onRename,
  onTrash,
}: SidebarActionMenuProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const menuItems: MenuItemConfig[] = [
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: '📋',
      disabled: false,
      action: onDuplicate,
    },
    {
      id: 'copy',
      label: 'Copy to Folder…',
      icon: '📑',
      disabled: !cloudReady,
      action: onCopy,
    },
    {
      id: 'move',
      label: 'Move to…',
      icon: '🔄',
      helperText: 'Server-side authorization not shipped',
      disabled: false,
      action: onMove,
    },
    {
      id: 'rename',
      label: 'Rename',
      icon: '✏️',
      disabled: false,
      action: onRename,
    },
    {
      id: 'trash',
      label: 'Move to Trash…',
      icon: '🗑️',
      disabled: !cloudReady,
      action: onTrash,
      danger: true,
    },
  ];

  // Measure and compute clamped viewport position when opened
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuEl = menuRef.current;
    const menuWidth = menuEl ? menuEl.offsetWidth : 210;
    const menuHeight = menuEl ? menuEl.offsetHeight : 230;
    const gap = 4;
    const margin = 8;

    // Default: place directly beside the trigger (to the right of the 320px sidebar)
    let left = triggerRect.right + gap;
    // If it would overflow right of viewport, place to the left of the trigger or clamp
    if (left + menuWidth > window.innerWidth - margin) {
      left = triggerRect.left - menuWidth - gap;
      if (left < margin) {
        left = Math.max(margin, window.innerWidth - menuWidth - margin);
      }
    }

    // Default: align with trigger top
    let top = triggerRect.top;
    // If near bottom of viewport, clamp upwards
    if (top + menuHeight > window.innerHeight - margin) {
      top = triggerRect.bottom - menuHeight;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - menuHeight - margin));

    setCoords({ top, left });
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    // Focus first enabled item upon opening
    const firstEnabled = menuItems.findIndex((item) => !item.disabled);
    setFocusedIndex(firstEnabled >= 0 ? firstEnabled : 0);
  }, [open, updatePosition]);

  // Focus the active menu item when focusedIndex changes
  useEffect(() => {
    if (open && coords && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [open, coords, focusedIndex]);

  // Safe outside listeners: pointerdown outside, capture scroll, resize close
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      )
        onOpenChange(false);
    };

    const handleScroll = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      onOpenChange(false);
    };

    const handleResize = () => {
      onOpenChange(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, onOpenChange]);

  const handleAction = (
    e: React.MouseEvent | React.KeyboardEvent,
    action: () => void,
    disabled: boolean
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled) return;
    // Close menu before firing action so rename input or modal can receive focus without theft
    triggerRef.current?.focus();
    onOpenChange(false);
    action();
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();

    if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === 'Tab') {
      onOpenChange(false);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      for (let i = 1; i <= menuItems.length; i++) {
        const next = (focusedIndex + i) % menuItems.length;
        if (!menuItems[next].disabled) {
          setFocusedIndex(next);
          break;
        }
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      for (let i = 1; i <= menuItems.length; i++) {
        const prev = (focusedIndex - i + menuItems.length) % menuItems.length;
        if (!menuItems[prev].disabled) {
          setFocusedIndex(prev);
          break;
        }
      }
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      const first = menuItems.findIndex((it) => !it.disabled);
      if (first >= 0) setFocusedIndex(first);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      for (let i = menuItems.length - 1; i >= 0; i--) {
        if (!menuItems[i].disabled) {
          setFocusedIndex(i);
          break;
        }
      }
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const current = menuItems[focusedIndex];
      if (current && !current.disabled) {
        handleAction(e, current.action, current.disabled);
      }
    }
  };

  const portalContent =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={`Actions for ${fileName}`}
            tabIndex={-1}
            onKeyDown={handleMenuKeyDown}
            className="fixed z-50 min-w-[210px] max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none"
            style={{
              top: coords ? `${coords.top}px` : '-9999px',
              left: coords ? `${coords.left}px` : '-9999px',
              visibility: coords ? 'visible' : 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {menuItems.map((item, idx) => {
              const isFocused = idx === focusedIndex;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  role="menuitem"
                  type="button"
                  tabIndex={isFocused ? 0 : -1}
                  disabled={item.disabled}
                  aria-disabled={item.disabled}
                  title={
                    item.disabled && !cloudReady ? 'Cloud unavailable' : undefined
                  }
                  onClick={(e) => handleAction(e, item.action, item.disabled)}
                  onMouseEnter={() => {
                    if (!item.disabled) setFocusedIndex(idx);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex flex-col transition-colors ${
                    item.disabled
                      ? 'opacity-40 cursor-not-allowed text-slate-400'
                      : isFocused
                      ? item.danger
                        ? 'bg-red-50 text-red-700'
                        : 'bg-slate-100 text-slate-900'
                      : item.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm leading-none flex-shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="font-medium flex-1">{item.label}</span>
                  </div>
                  {item.helperText && (
                    <span className="text-[10px] text-slate-500 pl-6 leading-tight mt-0.5">
                      {item.helperText}
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Actions for ${fileName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            e.preventDefault();
            onOpenChange(true);
          }
        }}
        className="w-[28px] h-[28px] min-w-[28px] min-h-[28px] flex items-center justify-center rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <span className="text-base leading-none select-none font-bold" aria-hidden="true">
          ⋯
        </span>
      </button>
      {portalContent}
    </>
  );
}

export interface SidebarCopyDialogProps {
  fileName: string;
  folders: Array<{ id: string; name: string }>;
  cloudReady: boolean;
  onCopy: (folderId: string) => void;
  onClose: () => void;
}

export function SidebarCopyDialog({
  fileName,
  folders,
  cloudReady,
  onCopy,
  onClose,
}: SidebarCopyDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    () => folders[0]?.id ?? ''
  );
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const priorFocusedElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const isSelectedFolderValid = folders.some((f) => f.id === selectedFolderId);

  if (selectedFolderId && !isSelectedFolderValid) {
    setSelectedFolderId(folders[0]?.id ?? '');
  } else if (!selectedFolderId && folders.length > 0) {
    setSelectedFolderId(folders[0]?.id ?? '');
  }

  const canCopy = Boolean(cloudReady && selectedFolderId && isSelectedFolderValid);

  useEffect(() => {
    priorFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!cloudReady || folders.length === 0 || selectRef.current?.disabled) {
      cancelButtonRef.current?.focus();
    } else {
      selectRef.current?.focus();
    }

    return () => {
      const active = document.activeElement;
      const isInsideDialog = dialogRef.current && active ? dialogRef.current.contains(active) : false;
      const isBodyOrNull = !active || active === document.body;
      if (
        priorFocusedElementRef.current &&
        priorFocusedElementRef.current.isConnected &&
        (isInsideDialog || isBodyOrNull)
      ) {
        priorFocusedElementRef.current.focus();
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg bg-white p-5 shadow-xl border border-slate-200"
      >
        <h3 id={titleId} className="text-sm font-semibold text-slate-800 mb-2 break-words">
          Copy &ldquo;{fileName}&rdquo; to Folder
        </h3>

        {!cloudReady && (
          <div className="mb-3 rounded bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 leading-snug">
            ⚠ Cloud unavailable. Copying charts requires a live cloud connection.
          </div>
        )}

        <div className="mb-4">
          <label
            htmlFor="destination-folder-select"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Destination Folder
          </label>
          <select
            id="destination-folder-select"
            ref={selectRef}
            value={selectedFolderId}
            disabled={!cloudReady || folders.length === 0}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          >
            {folders.length === 0 ? (
              <option value="" disabled>
                No folders available
              </option>
            ) : (
              folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canCopy}
            onClick={(e) => {
              e.stopPropagation();
              if (canCopy) {
                onCopy(selectedFolderId);
              }
            }}
            className={`rounded px-3 py-1.5 text-xs font-medium text-white transition-colors ${
              !canCopy
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Copy
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default SidebarActionMenu;
