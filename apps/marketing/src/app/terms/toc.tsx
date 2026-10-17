'use client';

import { useEffect, useState } from 'react';

export type TocItem = { id: string; label: string };

// Active-offset scrollspy rather than an IntersectionObserver band: a narrow
// observer band can be skipped entirely between frames on a fast scroll or a
// jump-to-anchor click, leaving the previous section stuck as "active". This
// recomputes directly from heading positions on every scroll, so it is always
// correct regardless of how the scroll happened.
const ACTIVE_OFFSET = 130;

export function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    const headings = items
      .map(({ id }) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (headings.length === 0) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      let currentId = headings[0].id;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top - ACTIVE_OFFSET <= 0) {
          currentId = heading.id;
        } else {
          break;
        }
      }
      setActiveId(currentId);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [items]);

  return (
    <nav className="terms-toc" aria-label="On this page">
      <p className="terms-toc-label">On this page</p>
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={activeId === item.id ? 'location' : undefined}>
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function MobileToc({ items }: { items: TocItem[] }) {
  return (
    <details className="terms-toc-mobile">
      <summary>On this page</summary>
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function SectionHeading({
  id,
  number,
  heading,
}: {
  id: string;
  number?: string;
  heading: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied by the browser; the anchor link still works via the URL bar.
    }
  };

  return (
    <h2 id={id} className="terms-section-heading">
      <span>
        {number ? `${number}. ` : ''}
        {heading}
      </span>
      <button type="button" onClick={handleCopy} aria-label={`Copy link to ${heading}`} className="terms-copy-link">
        {copied ? 'Copied' : '#'}
      </button>
    </h2>
  );
}
