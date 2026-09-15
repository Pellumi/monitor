import { useCallback, useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react';

/**
 * Small helpers that give renderer code native desktop behaviour: menus,
 * confirmation dialogs, readable enum labels, and keyboard-driven lists.
 */

/** `IN_PROGRESS` → `In progress`. Values that are already prose pass through. */
export function formatEnum(value: unknown, fallback = ''): string {
  const text = value === null || value === undefined ? '' : String(value).trim();
  if (!text) return fallback;
  if (!/^[A-Z0-9_\s-]+$/.test(text) || !/[A-Z]/.test(text)) return text;
  const words = text.replace(/[_-]+/g, ' ').toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export type StatusTone = 'success' | 'danger' | 'warning' | 'progress' | 'neutral';

export function statusTone(value: unknown): StatusTone {
  const text = String(value ?? '').toUpperCase();
  if (/(FAIL|ERROR|REJECT|CRITICAL|BLOCK|QUARANTIN|MISMATCH|DISCONNECTED)/.test(text)) return 'danger';
  if (/(WARN|ATTENTION|PENDING|PAUSED|STALE|INCOMPLETE|DRAFT|PROPOSED)/.test(text)) return 'warning';
  if (/(RUNNING|RECORDING|PROCESS|UPLOAD|ANALY|WAITING|CHECKING|QUEUED|FINALIZ|SYNCING)/.test(text)) return 'progress';
  if (/(COMPLETE|READY|CONNECTED|ANALYZED|APPLIED|APPROVED|PASS|SUCCE|SYNCHRONIZED|ACCEPTED|DONE|ACTIVE)/.test(text)) return 'success';
  return 'neutral';
}

/** Opens a native menu at the cursor. Resolves with the chosen item id. */
export async function showMenu(
  event: Pick<MouseEvent, 'preventDefault' | 'stopPropagation'>,
  items: DesktopContextMenuItem[],
): Promise<string | null> {
  event.preventDefault();
  event.stopPropagation();
  if (!window.tellann?.window) return null;
  return window.tellann.window.showContextMenu(items).catch(() => null);
}

/** Native confirmation dialog, with a browser fallback for the renderer preview. */
export async function confirmAction(input: {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  if (window.tellann?.window) return window.tellann.window.confirm(input).catch(() => false);
  return window.confirm([input.message, input.detail].filter(Boolean).join('\n\n'));
}

/**
 * Selection for a list or table: click selects, double-click or Enter opens,
 * arrow keys and Home/End move the selection, right-click selects then asks
 * for a context menu.
 */
export function useSelectableList<T>({
  items,
  getKey,
  onOpen,
  onContextMenu,
}: {
  items: T[];
  getKey: (item: T) => string;
  onOpen: (item: T) => void;
  onContextMenu?: (item: T, event: MouseEvent) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(items[0] ? getKey(items[0]) : null);

  useEffect(() => {
    if (!items.length) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !items.some((item) => getKey(item) === selectedKey)) setSelectedKey(getKey(items[0]));
  }, [getKey, items, selectedKey]);

  const selected = items.find((item) => getKey(item) === selectedKey) ?? null;

  const focusRow = (key: string) => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest' });
    });
  };

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (!items.length) return;
    const index = Math.max(0, items.findIndex((item) => getKey(item) === selectedKey));
    let next = index;
    if (event.key === 'ArrowDown') next = Math.min(items.length - 1, index + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'Enter') {
      event.preventDefault();
      onOpen(items[index]);
      return;
    } else return;
    event.preventDefault();
    const key = getKey(items[next]);
    setSelectedKey(key);
    focusRow(key);
  }, [getKey, items, onOpen, selectedKey]);

  const rowProps = (item: T) => {
    const key = getKey(item);
    return {
      'data-row-key': key,
      'data-selected': key === selectedKey ? 'true' : undefined,
      'aria-selected': key === selectedKey,
      role: 'option' as const,
      onMouseDown: () => setSelectedKey(key),
      onDoubleClick: () => onOpen(item),
      onContextMenu: (event: MouseEvent) => {
        setSelectedKey(key);
        onContextMenu?.(item, event);
      },
    };
  };

  return {
    selected,
    selectedKey,
    setSelectedKey,
    listProps: { role: 'listbox' as const, tabIndex: 0, onKeyDown },
    rowProps,
  };
}
