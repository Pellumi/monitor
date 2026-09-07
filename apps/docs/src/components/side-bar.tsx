"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, ExternalLink, Menu, X } from "lucide-react";
import {
  docsNavigation,
  externalDocsLinks,
  standalonePages,
} from "@/config/docs-navigation";
import { CommandSearch } from "@/components/command-search";
import { StatusBadges } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoIconText, logoIconTextBlack } from "@/lib/image";

const STORAGE_KEY = "tellann-docs:nav:v1";

function currentSection(pathname: string) {
  const slug = pathname.replace(/^\//, "").replace(/\/$/, "");
  for (const group of docsNavigation) {
    for (const section of group.sections) {
      if (section.pages.some((page) => page.slug === slug)) return section.id;
    }
  }
  return pathname === "/" ? "overview" : null;
}

function Navigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const activeSection = currentSection(pathname);
  const [expanded, setExpanded] = useState<string[]>([
    activeSection || "overview",
  ]);
  const hydrated = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(
          localStorage.getItem(STORAGE_KEY) || "[]",
        ) as string[];
        setExpanded([
          ...new Set([...stored, activeSection].filter(Boolean) as string[]),
        ]);
      } catch {
        setExpanded([activeSection || "overview"]);
      }
      hydrated.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeSection]);

  useEffect(() => {
    if (!activeSection) return;
    const timer = window.setTimeout(
      () =>
        setExpanded((sections) =>
          sections.includes(activeSection)
            ? sections
            : [...sections, activeSection],
        ),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [activeSection]);

  function toggle(sectionId: string) {
    setExpanded((sections) => {
      const next = sections.includes(sectionId)
        ? sections.filter((id) => id !== sectionId)
        : [...sections, sectionId];
      if (hydrated.current)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const marketing = (
    process.env.NEXT_PUBLIC_MARKETING_URL || "https://tellann.co"
  ).replace(/\/$/, "");
  const status =
    process.env.NEXT_PUBLIC_STATUS_URL || "https://status.tellann.co";
  const externalHref = (link: (typeof externalDocsLinks)[number]) =>
    link.id === "status" ? status : marketing + link.href;

  return (
    <div className="docs-sidebar-content">
      <div className="docs-sidebar-tools">
        <div className="docs-version-row">
          <span>Tellann Docs</span>
          {/* <button type="button" aria-label="Documentation version">
            v1 <small>current</small>
          </button> */}
        </div>
        <CommandSearch />
      </div>
      <nav className="docs-sidebar-nav" aria-label="Documentation pages">
        {docsNavigation.map((group) => (
          <section className="docs-nav-region" key={group.id}>
            <h2>{group.title}</h2>
            {group.sections.map((section) => {
              const open = expanded.includes(section.id);
              return (
                <div className="docs-nav-section" key={section.id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggle(section.id)}
                  >
                    <ChevronDown aria-hidden="true" />
                    <span>{section.title}</span>
                  </button>
                  {open ? (
                    <div className="docs-nav-pages">
                      {section.pages.map((page) => {
                        const active = pathname === "/" + page.slug;
                        return (
                          <Link
                            key={page.id}
                            href={"/" + page.slug}
                            aria-current={active ? "page" : undefined}
                            onClick={onNavigate}
                          >
                            <span>{page.title}</span>
                            {page.status !== "ga" ||
                            page.plans?.includes("enterprise") ? (
                              <StatusBadges
                                status={page.status}
                                plans={page.plans}
                              />
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {group.id === "resources" ? (
              <div className="docs-nav-standalone">
                {standalonePages.map((page) => (
                  <Link
                    key={page.id}
                    href={"/" + page.slug}
                    aria-current={
                      pathname === "/" + page.slug ? "page" : undefined
                    }
                    onClick={onNavigate}
                  >
                    {page.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </nav>
      <nav
        className="docs-sidebar-external"
        aria-label="Product and support links"
      >
        {externalDocsLinks.map((link) => (
          <a key={link.id} href={externalHref(link)}>
            {link.title}
            <ExternalLink aria-hidden="true" />
          </a>
        ))}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'a,button,input,[tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key === "Tab" && focusable?.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  return (
    <>
      <aside className="docs-sidebar">
        <Navigation pathname={pathname} />
      </aside>
      <div className="docs-mobile-bar">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
        >
          <Menu aria-hidden="true" /> Browse docs
        </button>
        <CommandSearch compact />
      </div>
      {mobileOpen ? (
        <div
          className="docs-drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileOpen(false);
          }}
        >
          <div
            ref={panelRef}
            className="docs-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Documentation navigation"
          >
            <header>
              <span className="docs-drawer-brand">
                <Image
                  src={logoIconText}
                  alt="Tellann"
                  width={112}
                  className="docs-logo docs-logo-dark"
                />
                <Image
                  src={logoIconTextBlack}
                  alt="Tellann"
                  width={112}
                  className="docs-logo docs-logo-light"
                />
                <b>Docs</b>
              </span>
              <span>
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                >
                  <X aria-hidden="true" />
                </button>
              </span>
            </header>
            <Navigation
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
