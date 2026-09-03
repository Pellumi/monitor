'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from '@/components/providers';

/**
 * Messages the app can hand itself across a redirect, keyed by the `notice`
 * query parameter. Anything unrecognised is ignored, so a stray value in a
 * bookmarked URL cannot put arbitrary text on the page.
 */
const NOTICES: Record<string, { title: string; detail: string }> = {
  'already-signed-in': {
    title: "You're already signed in",
    detail: 'We brought you straight here instead of asking for your credentials again.',
  },
};

/** How long the banner stays up before dismissing itself. */
const AUTO_DISMISS_MS = 8_000;

/**
 * Renders the one-off banner that explains a redirect the user did not ask for.
 *
 * The parameter is read once, on mount, and then stripped from the address bar
 * so a reload or a shared link is clean. Reading it in the state initialiser
 * rather than an effect is what makes that possible: by the time the effect
 * removes it from the URL, the banner no longer depends on it being there.
 * Every producer of `notice` redirects the whole document, so a mount and a
 * new notice always coincide.
 */
export function SessionNotice() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user } = useSession();
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(
    () => NOTICES[searchParams.get('notice') ?? ''] ?? null,
  );

  useEffect(() => {
    if (!notice) return;

    const next = new URLSearchParams(window.location.search);
    next.delete('notice');
    const query = next.toString();
    window.history.replaceState(null, '', `${pathname}${query ? `?${query}` : ''}`);

    const timer = window.setTimeout(() => setNotice(null), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
    // Runs for the notice captured at mount; `pathname` is read, not tracked,
    // because a route change should not re-strip or restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!notice) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex items-start justify-between gap-4 rounded-md border border-[#262626] bg-[#131313] px-4 py-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{notice.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-[#8e9192]">
          {notice.detail}
          {user?.email ? <> You are signed in as <span className="text-[#c4c7c8]">{user.email}</span>.</> : null}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setNotice(null)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded border border-[#303030] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[#8e9192] transition-colors hover:text-white"
      >
        Dismiss
      </button>
    </div>
  );
}
