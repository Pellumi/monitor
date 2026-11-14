import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Receipt, ScrollText, ShieldCheck, Sliders, UserRound, Users } from "lucide-react";
import { useDesktop } from "../../desktop-context";
import { Page } from "../../pages";

type SettingsNavItem = {
  id: string;
  label: string;
  icon: typeof UserRound;
  href: string;
  /** Hidden unless the signed-in user is a system admin. */
  adminOnly?: boolean;
};

const SETTINGS_NAV: SettingsNavItem[] = [
  { id: "profile", label: "Profile", icon: UserRound, href: "/settings/profile" },
  { id: "security", label: "Security & MFA", icon: ShieldCheck, href: "/settings/security" },
  { id: "notifications", label: "Notifications", icon: Bell, href: "/settings/notifications" },
  { id: "members", label: "Team & Members", icon: Users, href: "/settings/members" },
  { id: "billing", label: "Billing", icon: Receipt, href: "/settings/billing" },
  { id: "audit-logs", label: "Audit Logs", icon: ScrollText, href: "/settings/audit-logs" },
  { id: "admin", label: "Admin", icon: Sliders, href: "/settings/admin", adminOnly: true },
];

// Mirrors the main sidebar's own constants (AppShell.tsx) so a resized
// Settings nav feels like the same control, not a different one.
const DEFAULT_WIDTH = 232;
const MIN_WIDTH = 196;
const MAX_WIDTH = 360;
const WIDTH_STORAGE_KEY = "tellann:settings-sidebar-width";

function storedWidth(): number {
  const stored = localStorage.getItem(WIDTH_STORAGE_KEY);
  if (stored === null) return DEFAULT_WIDTH;
  const value = Number(stored);
  return Number.isFinite(value) ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value)) : DEFAULT_WIDTH;
}

/**
 * Nested shell for every native settings page (Profile, Security, Notifications,
 * Team & Members, Billing, Audit Logs, Admin). Reached from the profile menu /
 * `Ctrl+,`, not the main `Ctrl+1..9` nav rail — see navigation.tsx for why.
 *
 * Built from the exact same `.sidebar` nav/active-state styling as the main
 * application sidebar (AppShell.tsx), including a draggable resize handle,
 * so it reads as the same control rather than a bespoke settings widget.
 */
export function SettingsLayout() {
  const navigate = useNavigate();
  const { session } = useDesktop();
  const isSystemAdmin = Boolean(session?.isSystemAdmin);
  const items = SETTINGS_NAV.filter((item) => !item.adminOnly || isSystemAdmin);

  const [width, setWidth] = useState(storedWidth);

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const onMove = (moveEvent: PointerEvent) => {
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + moveEvent.clientX - startX)));
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.body.classList.remove("sidebar-resizing");
      setWidth((current) => {
        localStorage.setItem(WIDTH_STORAGE_KEY, String(current));
        return current;
      });
    };
    document.body.classList.add("sidebar-resizing");
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const resetWidth = () => {
    setWidth(DEFAULT_WIDTH);
    localStorage.setItem(WIDTH_STORAGE_KEY, String(DEFAULT_WIDTH));
  };

  return (
    <div className="settings-shell">
      <aside className="sidebar settings-sidebar" aria-label="Settings" style={{ width }}>
        <nav aria-label="Settings navigation">
          <NavLink to="/applications" title="Back to App" draggable={false}>
            <ArrowLeft size={16} />
            <span>Back to App</span>
          </NavLink>
        </nav>
        <nav aria-label="Settings sections">
          {items.map((item) => (
            <NavLink
              key={item.id}
              to={item.href}
              title={item.id === "profile" ? `${item.label} (Ctrl+,)` : item.label}
              className={({ isActive }) => (isActive ? "nav-active" : undefined)}
              draggable={false}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div
          className="sidebar-resize-handle"
          role="separator"
          aria-label="Resize settings navigation"
          aria-orientation="vertical"
          onPointerDown={beginResize}
          onDoubleClick={resetWidth}
        />
      </aside>
      <div className="settings-content">
        <Outlet />
      </div>
    </div>
  );
}

/** Placeholder for a settings section not yet built in this phase of the rollout. */
export function SettingsComingSoon({ title }: { title: string }) {
  return (
    <Page title={title} description="This section is being built out natively.">
      <section className="guarded-card">
        <Sliders size={32} />
        <div>
          <h2>Coming soon</h2>
          <p>{title} is being migrated into the desktop app. Check back shortly.</p>
        </div>
      </section>
    </Page>
  );
}
