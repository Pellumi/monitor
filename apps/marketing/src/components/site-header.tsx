'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  companyRoutes,
  developerGroups,
  productGroups,
  resourceGroups,
  solutionGroups,
  type RouteGroup,
} from '@/config/site-routes';
import { logoIconText, logoIconTextBlack } from '@/lib/image';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.domain-name.com';
const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.domain-name.com';
const DESKTOP_BREAKPOINT = '(min-width: 1101px)';
const CLOSE_DELAY_MS = 150;

const menuSections = [
  { key: 'product', label: 'Product', groups: productGroups },
  { key: 'solutions', label: 'Solutions', groups: solutionGroups },
  { key: 'developers', label: 'Developers', groups: developerGroups },
  { key: 'resources', label: 'Resources', groups: resourceGroups },
  { key: 'company', label: 'Company', groups: [{ label: 'Tellann', routes: companyRoutes }] },
] as const;

type MenuKey = (typeof menuSections)[number]['key'];

function routeIsActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

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
    <div className={mobile ? 'mobile-nav-groups' : 'mega-menu-grid'}>
      {groups.map((group) => (
        <section key={group.label} className={mobile ? 'mobile-nav-group' : 'mega-menu-group'}>
          <p>{group.label}</p>
          <div className={mobile ? 'mobile-nav-links' : 'mega-menu-links'}>
            {group.routes.map((item) => {
              const isActive = routeIsActive(pathname, item.href);

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
          </div>
        </section>
      ))}
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
      {menuSections.slice(0, 4).map((section) => {
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

      <Link href="/pricing" aria-current={routeIsActive(pathname, '/pricing') ? 'page' : undefined} onClick={onClose}>
        Pricing
      </Link>

      {menuSections.slice(4).map((section) => {
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
        {menuSections.slice(0, 4).map((section) => (
          <details key={section.key} className="mobile-nav-section">
            <summary>
              {section.label}
              <span className="nav-chevron" aria-hidden="true"><ChevronDown size={14} /></span>
            </summary>
            <MenuGroups groups={section.groups} pathname={pathname} mobile onNavigate={closeMobileMenu} />
          </details>
        ))}

        <Link href="/pricing" aria-current={routeIsActive(pathname, '/pricing') ? 'page' : undefined} onClick={closeMobileMenu}>
          Pricing
        </Link>

        {menuSections.slice(4).map((section) => (
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

  return (
    <>
      <Link href="/product/demonstration-mode" className="home-announcement">
        <span>Introducing Developer Demonstration Mode</span><span aria-hidden="true">→</span>
      </Link>
      <header
        ref={headerRef}
        className={`site-header${activeSection ? ' mega-menu-open' : ''}`}
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
