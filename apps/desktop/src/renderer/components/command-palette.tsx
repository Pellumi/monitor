import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CornerDownLeft, Search, type LucideIcon } from 'lucide-react';

export type PaletteItem = {
  id: string;
  label: string;
  group: string;
  icon?: LucideIcon;
  shortcut?: string;
  keywords?: string;
  disabled?: boolean;
  run: () => void;
};

/** Ctrl+K quick switcher: jump to a section or application, or run a command. */
export function CommandPalette({ open, items, onClose }: { open: boolean; items: PaletteItem[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      if (item.disabled) return false;
      const haystack = `${item.label} ${item.group} ${item.keywords ?? ''}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [items, query]);

  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const run = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (results.length ? (current + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (results.length ? (current - 1 + results.length) % results.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(results[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-input">
          <Search size={15} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search sections, applications and commands"
            aria-label="Search commands"
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
            spellCheck={false}
          />
        </div>
        <div className="palette-results" id="palette-results" role="listbox" ref={listRef}>
          {results.length ? results.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const Icon = item.icon;
            return (
              <div key={item.id} role="presentation">
                {header ? <div className="palette-group">{header}</div> : null}
                <div
                  id={`palette-${item.id}`}
                  role="option"
                  aria-selected={index === active}
                  data-index={index}
                  className="palette-item"
                  onMouseMove={() => setActive(index)}
                  onClick={() => run(item)}
                >
                  {Icon ? <Icon size={15} aria-hidden="true" /> : <span className="palette-icon-spacer" />}
                  <span className="palette-label">{item.label}</span>
                  {item.shortcut ? <kbd>{item.shortcut}</kbd> : index === active ? <CornerDownLeft size={13} aria-hidden="true" /> : null}
                </div>
              </div>
            );
          }) : <div className="palette-empty">No matching commands</div>}
        </div>
      </div>
    </div>
  );
}
