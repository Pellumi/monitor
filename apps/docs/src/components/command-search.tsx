'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, X } from 'lucide-react';
import type { SearchDocument } from '@/lib/docs-types';

type Result = SearchDocument & { score: number; match?: Record<string, string[]> };

export function CommandSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState<SearchDocument[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);

  const open = useCallback(async () => {
    dialogRef.current?.showModal();
    setTimeout(() => inputRef.current?.focus(), 0);
    if (!documents.length) {
      const response = await fetch('/docs-search-index.json');
      const payload = await response.json() as { documents: SearchDocument[] };
      setDocuments(payload.documents);
      setResults(payload.documents.slice(0, 8).map((doc) => ({ ...doc, score: 0 })));
    }
  }, [documents.length]);

  useEffect(() => {
    if (compact) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compact, open]);

  useEffect(() => {
    if (!documents.length || !query.trim()) return;
    const value = query.trim();
    let cancelled = false;
    import('minisearch').then(({ default: MiniSearch }) => {
      if (cancelled) return;
      const mini = new MiniSearch<SearchDocument>({
        fields: ['title', 'description', 'headings', 'body', 'codeTerms', 'endpointTerms', 'tags'],
        storeFields: ['id', 'slug', 'title', 'description', 'headings', 'body', 'codeTerms', 'endpointTerms', 'tags'],
        searchOptions: {
          boost: { title: 10, codeTerms: 9, endpointTerms: 9, headings: 5, description: 3, tags: 4, body: 1 },
          prefix: true,
          fuzzy: 0.2,
          combineWith: 'AND',
        },
      });
      mini.addAll(documents);
      setResults(mini.search(value).slice(0, 12) as unknown as Result[]);
      setActive(0);
    });
    return () => { cancelled = true; };
  }, [documents, query]);

  function updateQuery(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults(documents.slice(0, 8).map((doc) => ({ ...doc, score: 0 })));
      setActive(0);
    }
  }

  function choose(result: Result) {
    dialogRef.current?.close();
    setQuery('');
    router.push('/' + result.slug);
  }

  return <>
    <button type="button" className={'docs-search-trigger' + (compact ? ' docs-search-trigger-compact' : '')} onClick={open}>
      <Search aria-hidden="true" /><span>Search documentation</span>
    </button>
    <dialog ref={dialogRef} className="docs-command" onClose={() => setQuery('')}>
      <div className="docs-command-box">
        <div className="docs-command-input">
          <Search aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Search pages, methods, endpoints, errors…" aria-label="Search documentation"
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => Math.min(value + 1, results.length - 1)); }
              if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
              if (event.key === 'Enter' && results[active]) { event.preventDefault(); choose(results[active]); }
              if (event.key === 'Escape') dialogRef.current?.close();
            }} />
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close search"><X aria-hidden="true" /></button>
        </div>
        <div className="docs-command-results" role="listbox" aria-label="Search results">
          {results.length ? results.map((result, index) => <button type="button" key={result.id} role="option" aria-selected={active === index} onMouseEnter={() => setActive(index)} onClick={() => choose(result)}>
            <span><strong>{result.title}</strong><small>{result.description}</small></span><ArrowRight aria-hidden="true" />
          </button>) : <p>No matching documentation. Try a method, endpoint, event name, or error code.</p>}
        </div>
        <footer><span>↑↓ Navigate</span><span>↵ Open</span><span>Esc Close</span></footer>
      </div>
    </dialog>
  </>;
}
