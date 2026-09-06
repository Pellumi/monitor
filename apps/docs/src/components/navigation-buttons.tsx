import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface NavigationButtonsProps {
  previousLabel?: string;
  previousHref?: string;
  nextLabel?: string;
  nextHref?: string;
}

export function NavigationButtons({ previousLabel, previousHref, nextLabel, nextHref }: NavigationButtonsProps) {
  return (
    <nav className="docs-page-navigation" aria-label="Previous and next documentation pages">
      {previousLabel && previousHref ? (
        <Link
          href={previousHref}
          className="docs-page-navigation-link docs-page-navigation-previous"
        >
          <ChevronLeft aria-hidden="true" />
            <div>
            <span>Previous</span>
            <strong>{previousLabel}</strong>
            </div>
        </Link>
      ) : (
        <div className="docs-page-navigation-spacer" />
      )}
      
      {nextLabel && nextHref ? (
        <Link
          href={nextHref}
          className="docs-page-navigation-link docs-page-navigation-next"
        >
            <div>
            <span>Next</span>
            <strong>{nextLabel}</strong>
            </div>
          <ChevronRight aria-hidden="true" />
        </Link>
      ) : (
        <div className="docs-page-navigation-spacer" />
      )}
    </nav>
  );
}
