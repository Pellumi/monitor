import type { MDXComponents } from 'mdx/types';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { TryItPanel } from '@/components/try-it-panel';

export function Callout({ type = 'note', title, children }: { type?: 'note' | 'tip' | 'warning' | 'danger'; title?: string; children: ReactNode }) {
  return <aside className={'mdx-callout mdx-callout-' + type} role={type === 'danger' ? 'alert' : undefined}>
    {title ? <strong>{title}</strong> : null}
    <div>{children}</div>
  </aside>;
}

export function Procedure({ children }: { children: ReactNode }) {
  return <div className="mdx-procedure">{children}</div>;
}

export function Tabs({ label, children }: { label: string; children: ReactNode }) {
  return <section className="mdx-tabs" aria-label={label}>{children}</section>;
}

export function Tab({ label, children }: { label: string; children: ReactNode }) {
  return <details className="mdx-tab" open><summary>{label}</summary><div>{children}</div></details>;
}

export function EndpointDefinition({ method, path, status = 'ga' }: { method: string; path: string; status?: string }) {
  return <div className="mdx-endpoint">
    <span data-method={method}>{method}</span>
    <code>{path}</code>
    <small>{status}</small>
  </div>;
}

export function Example({ title = 'Example', children }: { title?: string; children: ReactNode }) {
  return <figure className="mdx-example"><figcaption>{title}</figcaption><div>{children}</div></figure>;
}

export function Diagram({ label, children }: { label: string; children: ReactNode }) {
  return <figure className="mdx-diagram" aria-label={label}>{children}</figure>;
}

export function RelatedPages({ pages }: { pages: Array<{ href: string; title: string; description?: string }> }) {
  return <nav className="mdx-related" aria-label="Related pages">
    {pages.map((page) => <Link key={page.href} href={page.href}><strong>{page.title}</strong>{page.description ? <span>{page.description}</span> : null}</Link>)}
  </nav>;
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: () => null,
    Callout,
    Procedure,
    Tabs,
    Tab,
    EndpointDefinition,
    Example,
    Diagram,
    RelatedPages,
    TryItPanel,
    ...components,
  };
}
