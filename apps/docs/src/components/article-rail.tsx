'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, ExternalLink } from 'lucide-react';
import type { GeneratedDoc } from '@/lib/docs-types';

function PageFeedback({ page }: { page: GeneratedDoc }) {
  const endpoint = process.env.NEXT_PUBLIC_DOCS_FEEDBACK_URL;
  const [submitted, setSubmitted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  if (!endpoint) return null;

  async function vote(helpful: boolean) {
    if (!endpoint) return;
    setBusy(true);
    try {
      let feedbackId = localStorage.getItem('tellann-docs:feedback-id');
      if (!feedbackId) {
        feedbackId = crypto.randomUUID();
        localStorage.setItem('tellann-docs:feedback-id', feedbackId);
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId, pageId: page.id, docsVersion: 'v1', helpful }),
      });
      if (!response.ok) throw new Error('Feedback request failed');
      localStorage.setItem('tellann-docs:vote:' + page.id, helpful ? 'yes' : 'no');
      setSubmitted(helpful);
    } finally {
      setBusy(false);
    }
  }

  return <div className="docs-feedback">
    <p>{submitted === null ? 'Was this page helpful?' : <><Check aria-hidden="true" /> Feedback recorded</>}</p>
    <div>
      <button type="button" disabled={busy} aria-pressed={submitted === true} onClick={() => vote(true)}>Yes</button>
      <button type="button" disabled={busy} aria-pressed={submitted === false} onClick={() => vote(false)}>No</button>
    </div>
  </div>;
}

function Toc({ page, activeId }: { page: GeneratedDoc; activeId: string }) {
  return <nav className="docs-toc-links" aria-label="On this page">
    {page.headings.map((heading) => <a key={heading.id} href={'#' + heading.id} aria-current={activeId === heading.id ? 'location' : undefined} data-level={heading.level}>
      {heading.title}
    </a>)}
  </nav>;
}

export function ArticleRail({ page }: { page: GeneratedDoc }) {
  const [activeId, setActiveId] = useState(page.headings[0]?.id || '');
  const repository = process.env.NEXT_PUBLIC_DOCS_REPOSITORY_URL || 'https://github.com/Pellumi/monitor';
  useEffect(() => {
    const headings = page.headings.map((heading) => document.getElementById(heading.id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveId(visible[0].target.id);
    }, { rootMargin: '-18% 0px -70% 0px' });
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [page.headings]);

  const issue = repository.replace(/\/$/, '') + '/issues/new?title=' + encodeURIComponent('Docs: ' + page.title);
  const edit = repository.replace(/\/$/, '') + '/edit/main/apps/docs/' + page.sourcePath;
  const contents = <><Toc page={page} activeId={activeId} /><PageFeedback page={page} />
    <div className="docs-rail-links">
      <a href={edit}>Edit this page <ExternalLink aria-hidden="true" /></a>
      <a href={issue}>Report an issue <ExternalLink aria-hidden="true" /></a>
    </div></>;

  return <>
    <aside className="docs-article-rail"><p className="docs-utility-label">On this page</p>{contents}</aside>
    <details className="docs-mobile-toc">
      <summary>On this page <ChevronDown aria-hidden="true" /></summary>
      <div>{contents}</div>
    </details>
  </>;
}
