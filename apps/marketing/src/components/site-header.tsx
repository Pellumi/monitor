'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  isRouteActive,
  navCompanyGroups,
  navDeveloperGroups,
  navProductGroups,
  navResourceGroups,
  navSolutionGroups,
  type RouteGroup,
} from '@/config/site-routes';
import { logoIconText, logoIconTextBlack } from '@/lib/image';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.domain-name.com';
const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.domain-name.com';
const DESKTOP_BREAKPOINT = '(min-width: 1101px)';
const CLOSE_DELAY_MS = 150;
const SCROLLED_AFTER_PX = 8;
const UNPIN_AFTER_PX = 140;

// Sections whose routes are all still planned are dropped entirely, so the
// navigation never opens onto an empty mega-menu.
const menuSections = (
  [
    { key: 'product', label: 'Product', groups: navProductGroups },
    { key: 'solutions', label: 'Solutions', groups: navSolutionGroups },
    { key: 'developers', label: 'Developers', groups: navDeveloperGroups },
    { key: 'resources', label: 'Resources', groups: navResourceGroups },
    { key: 'company', label: 'Company', groups: navCompanyGroups },
  ] as const
).filter((section) => section.groups.some((group) => group.routes.length > 0));

type MenuKey = (typeof menuSections)[number]['key'];

// Pricing sits between the feature menus and Company, so the split is by key
// rather than index — filtering a section out must not reorder the rest.
const leadingSections = menuSections.filter((section) => section.key !== 'company');
const trailingSections = menuSections.filter((section) => section.key === 'company');

function MenuGroups({
  groups,
  pathname,
  mobile = false,
  onNavigate,
}: {
  groups: readonly RouteGroup[];
  pathname: string;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div
      className={mobile ? 'mobile-nav-groups' : 'mega-menu-grid'}
      // One column per group, so a menu is exactly as wide as it needs to be
      // and never wraps onto a second row the reader has to scroll to.
      style={mobile ? undefined : ({ '--mega-cols': groups.length } as CSSProperties)}
    >
      {groups.map((group) => {
        // The menu shows a group's most important routes; the rest stay one
        // click away on its index page. Mobile is a scrolling list already, so
        // it shows everything.
        const shown = !mobile && group.limit ? group.routes.slice(0, group.limit) : group.routes;
        const truncated = shown.length < group.routes.length;

        return (
          <section key={group.label} className={mobile ? 'mobile-nav-group' : 'mega-menu-group'}>
            <p>{group.label}</p>
            <div className={mobile ? 'mobile-nav-links' : 'mega-menu-links'}>
              {shown.map((item) => {
                const isActive = isRouteActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    <span className="mega-menu-link-copy">
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </span>
                    <span className="mega-menu-arrow" aria-hidden="true">→</span>
                  </Link>
                );
              })}
              {truncated && group.seeAll ? (
                <Link className="mega-menu-see-all" href={group.seeAll} onClick={onNavigate}>
                  See all {group.label.toLowerCase()}
                  <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DesktopNavigation({
  activeMenu,
  pathname,
  onOpen,
  onToggle,
  onClose,
  onTriggerRef,
}: {
  activeMenu: MenuKey | null;
  pathname: string;
  onOpen: (key: MenuKey) => void;
  onToggle: (key: MenuKey) => void;
  onClose: () => void;
  onTriggerRef: (key: MenuKey, node: HTMLButtonElement | null) => void;
}) {
  return (
    <nav className="desktop-nav" aria-label="Primary navigation">
      {leadingSections.map((section) => {
        const isOpen = activeMenu === section.key;

        return (
          <button
            key={section.key}
            ref={(node) => onTriggerRef(section.key, node)}
            type="button"
            className="desktop-nav-trigger"
            aria-expanded={isOpen}
            aria-controls={`mega-menu-${section.key}`}
            onPointerEnter={() => onOpen(section.key)}
            onClick={() => onToggle(section.key)}
          >
            {section.label}
            <span className="nav-chevron" aria-hidden="true"><ChevronDown size={14} /></span>
          </button>
        );
      })}

      <Link href="/pricing" aria-current={isRouteActive(pathname, '/pricing') ? 'page' : undefined} onClick={onClose}>
        Pricing
      </Link>

      {trailingSections.map((section) => {
        const isOpen = activeMenu === section.key;

        return (
          <button
            key={section.key}
            ref={(node) => onTriggerRef(section.key, node)}
            type="button"
            className="desktop-nav-trigger"
            aria-expanded={isOpen}
            aria-controls={`mega-menu-${section.key}`}
            onPointerEnter={() => onOpen(section.key)}
            onClick={() => onToggle(section.key)}
          >
            {section.label}
            <span className="nav-chevron" aria-hidden="true"><ChevronDown size={14} /></span>
          </button>
        );
      })}
    </nav>
  );
}

function MobileMenu({ pathname, menuRef }: { pathname: string; menuRef: React.RefObject<HTMLDetailsElement | null> }) {
  const closeMobileMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };

  return (
    <details ref={menuRef} className="mobile-menu">
      <summary aria-label="Open navigation"><span /><span /><span /></summary>
      <nav aria-label="Mobile navigation">
        {leadingSections.map((section) => (
          <details key={section.key} className="mobile-nav-section">
            <summary>
              {section.label}
              <span className="nav-chevron" aria-hidden="true"><ChevronDown size={14} /></span>
            </summary>
            <MenuGroups groups={section.groups} pathname={pathname} mobile onNavigate={closeMobileMenu} />
          </details>
        ))}

        <Link href="/pricing" aria-current={isRouteActive(pathname, '/pricing') ? 'page' : undefined} onClick={closeMobileMenu}>
          Pricing
        </Link>

        {trailingSections.map((section) => (
          <details key={section.key} className="mobile-nav-section">
            <summary>
              {section.label}
              <span className="nav-chevron" aria-hidden="true"><ChevronDown size={14} /></span>
            </summary>
            <MenuGroups groups={section.groups} pathname={pathname} mobile onNavigate={closeMobileMenu} />
          </details>
        ))}

        <a href={docsUrl}>Documentation</a>
        <div className="mobile-actions">
          <ThemeToggle />
          <a href={`${appUrl}/auth/login`}>Sign in</a>
          <a href={`${appUrl}/auth/login`} className="start-free">Start free</a>
        </div>
      </nav>
    </details>
  );
}


/**
 * Tracks vertical scroll so the header can settle in (`data-scrolled`) and step
 * out of the way while the visitor reads downward (`data-pinned`). Reads are
 * batched into a rAF so the listener never measures layout per scroll event,
 * and the first measurement is deferred for the same reason.
 */
function useHeaderScrollState() {
  const [state, setState] = useState({ scrolled: false, pinned: true });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let lastY = window.scrollY;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const goingDown = y > lastY;
      lastY = y;

      setState((current) => {
        const scrolled = y > SCROLLED_AFTER_PX;
        const pinned = y <= UNPIN_AFTER_PX ? true : !goingDown;
        return current.scrolled === scrolled && current.pinned === pinned
          ? current
          : { scrolled, pinned };
      });
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    frame = window.requestAnimationFrame(measure);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return state;
}

export function SiteHeader() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  const triggerRefs = useRef<Partial<Record<MenuKey, HTMLButtonElement | null>>>({});
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuState, setMenuState] = useState<{ key: MenuKey; pathname: string } | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeMenu = useCallback(() => {
    clearCloseTimer();
    setMenuState(null);
  }, [clearCloseTimer]);

  const openMenu = useCallback((key: MenuKey) => {
    clearCloseTimer();
    setMenuState({ key, pathname });
  }, [clearCloseTimer, pathname]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setMenuState(null), CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  useEffect(() => {
    clearCloseTimer();
    if (mobileMenuRef.current) mobileMenuRef.current.open = false;
  }, [pathname, clearCloseTimer]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT);
    const resetNavigation = () => {
      closeMenu();
      if (mobileMenuRef.current) mobileMenuRef.current.open = false;
    };

    mediaQuery.addEventListener('change', resetNavigation);
    return () => mediaQuery.removeEventListener('change', resetNavigation);
  }, [closeMenu]);

  const visibleActiveMenu = menuState?.pathname === pathname ? menuState.key : null;

  useEffect(() => {
    if (!visibleActiveMenu) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      const trigger = triggerRefs.current[visibleActiveMenu];
      closeMenu();
      trigger?.focus();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visibleActiveMenu, closeMenu]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const activeSection = menuSections.find((section) => section.key === visibleActiveMenu);
  const { scrolled, pinned } = useHeaderScrollState();
  const headerPinned = Boolean(activeSection) || pinned;

  return (
    <>
      <Link href="/product/demonstration-mode" className="home-announcement">
        <span>Introducing Developer Demonstration Mode</span><span aria-hidden="true">→</span>
      </Link>
      <header
        ref={headerRef}
        className={`site-header${activeSection ? ' mega-menu-open' : ''}`}
        data-scrolled={scrolled}
        data-pinned={headerPinned}
        onPointerEnter={clearCloseTimer}
        onPointerLeave={scheduleClose}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose();
        }}
        onFocusCapture={clearCloseTimer}
      >
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="Tellann home" onClick={closeMenu}>
            <Image src={logoIconText} alt="Tellann" width={120} className="hidden dark:block h-auto" priority />
            <Image src={logoIconTextBlack} alt="Tellann" width={120} className="block dark:hidden h-auto" priority />
          </Link>

          <DesktopNavigation
            activeMenu={visibleActiveMenu}
            pathname={pathname}
            onOpen={openMenu}
            onToggle={(key) => visibleActiveMenu === key ? closeMenu() : openMenu(key)}
            onClose={closeMenu}
            onTriggerRef={(key, node) => { triggerRefs.current[key] = node; }}
          />

          <div className="header-actions">
            <ThemeToggle />
            <a href={`${appUrl}/auth/login`} className="sign-in">Sign in</a>
            {/* <a href="mailto:sales@tellann.co?subject=Tellann%20demo" className="book-demo">Book demo</a> */}
            <a href={`${appUrl}/auth/login`} className="start-free">Start free</a>
          </div>

          <MobileMenu pathname={pathname} menuRef={mobileMenuRef} />
        </div>

        <button
          type="button"
          className="mega-menu-backdrop"
          aria-label="Close navigation"
          tabIndex={activeSection ? 0 : -1}
          onClick={closeMenu}
        />

        <div
          id={activeSection ? `mega-menu-${activeSection.key}` : 'mega-menu'}
          className="mega-menu-shell"
          aria-hidden={!activeSection}
          onPointerEnter={clearCloseTimer}
        >
          {activeSection ? (
            <div className="mega-menu-inner">
              <div className="mega-menu-heading">
                <span>Explore</span>
                <strong>{activeSection.label}</strong>
              </div>
              <MenuGroups groups={activeSection.groups} pathname={pathname} onNavigate={closeMenu} />
            </div>
          ) : null}
        </div>
      </header>
    </>
  );
}
