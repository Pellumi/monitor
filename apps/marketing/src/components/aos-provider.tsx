'use client';

import AOS from 'aos';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Boots AOS (Animate On Scroll) for the marketing site.
 *
 * The reveal styles live in globals.css under `html.aos-ready` rather than
 * importing `aos/dist/aos.css`, so the site keeps one motion vocabulary and
 * content is never hidden when JavaScript is unavailable. `aos-ready` is added
 * before paint by the bootstrap script in layout.tsx and released here once AOS
 * is live (or immediately when the visitor prefers reduced motion).
 */
export function AosProvider() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia(REDUCED_MOTION);

    const start = () => {
      if (reducedMotion.matches) {
        AOS.init({ disable: true });
        root.classList.remove('aos-ready');
        root.classList.add('aos-loaded');
        return;
      }

      AOS.init({
        duration: 620,
        offset: 72,
        delay: 0,
        once: true,
        mirror: false,
        anchorPlacement: 'top-bottom',
      });
      root.classList.add('aos-ready', 'aos-loaded');
    };

    start();
    reducedMotion.addEventListener('change', start);

    return () => reducedMotion.removeEventListener('change', start);
  }, []);

  // App Router swaps the tree without a document load, so AOS has to re-measure
  // the new page's elements after every client-side navigation.
  useEffect(() => {
    AOS.refreshHard();
  }, [pathname]);

  return null;
}
