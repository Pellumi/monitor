'use client';

import { Sun, Moon, Monitor, Building2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export function Header() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'dark';
    }
    return 'dark';
  });

  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010';

  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (t: 'light' | 'dark' | 'system') => {
      let actualTheme = t;
      if (t === 'system') {
        actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      if (actualTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme(theme);
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background px-4 py-3 sm:px-8 h-16 flex items-center justify-between transition-colors duration-200">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-400" />
          <span className="text-sm font-bold tracking-tight text-foreground">
            Tellann <span className="text-muted-foreground/60 font-normal">Platform</span>
          </span>
          <span className="px-1.5 py-0.5 rounded bg-muted border border-border text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
            Docs
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-6">
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-muted-foreground">
          <Link href="/getting-started" className="hover:text-foreground transition-colors">
            Guides
          </Link>
          <Link href="/sdk-reference/frontend" className="hover:text-foreground transition-colors">
            SDKs
          </Link>
          <Link href="/api-reference/authentication" className="hover:text-foreground transition-colors">
            API Reference
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {/* Theme switcher */}
          {/* <div className="flex items-center gap-1 p-0.5 bg-muted rounded-lg border border-border">
            <button
              onClick={() => setTheme('light')}
              className={`p-1.5 rounded-md transition-colors ${
                theme === 'light' ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Light theme"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`p-1.5 rounded-md transition-colors ${
                theme === 'system' ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="System preference"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-1.5 rounded-md transition-colors ${
                theme === 'dark' ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Dark theme"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div> */}

          <a
            href={dashboardUrl}
            className="rounded-lg bg-muted border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            Open Dashboard
          </a>
        </div>
      </div>
    </header>
  );
}
