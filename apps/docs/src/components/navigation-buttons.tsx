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
    <div className="mt-12 flex flex-col sm:flex-row gap-4 border-t border-border pt-8 transition-colors duration-200">
      {previousLabel && previousHref ? (
        <Link
          href={previousHref}
          className="flex-1 flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-muted/10 hover:bg-accent/50 transition-colors group text-left"
        >
          <div className="flex items-center gap-2.5">
            <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
            <div>
              <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">Previous</p>
              <p className="text-xs font-semibold text-foreground">{previousLabel}</p>
            </div>
          </div>
        </Link>
      ) : (
        <div className="flex-1 hidden sm:block" />
      )}
      
      {nextLabel && nextHref ? (
        <Link
          href={nextHref}
          className="flex-1 flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-muted/10 hover:bg-accent/50 transition-colors group text-right"
        >
          <div className="flex items-center justify-end w-full gap-2.5">
            <div>
              <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">Next</p>
              <p className="text-xs font-semibold text-foreground">{nextLabel}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
          </div>
        </Link>
      ) : (
        <div className="flex-1 hidden sm:block" />
      )}
    </div>
  );
}
