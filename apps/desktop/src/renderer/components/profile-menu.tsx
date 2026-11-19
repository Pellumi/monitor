import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpenText,
  ChevronRight,
  LogOut,
  Receipt,
  ScrollText,
  ShieldCheck,
  Sliders,
  UserRound,
  Users,
} from "lucide-react";

type ProfileMenuItem = {
  id: string;
  label: string;
  icon: typeof UserRound;
  accelerator?: string;
  onSelect(): void;
};

/**
 * The sidebar's profile button + its dropdown of account/settings actions.
 * Replaces the native OS context menu `showMenu()` used to drive this with
 * an in-app popover built from the `.profile-popover` / `.profile-summary` /
 * `.profile-menu-items` styling already defined in styles.css (unused until
 * now) — matching the app's own UI instead of an OS chrome menu.
 */
export function ProfileMenu({
  avatarNode,
  userName,
  userEmail,
  isSystemAdmin,
  onSignOut,
}: {
  avatarNode: ReactNode;
  userName: string;
  userEmail: string;
  isSystemAdmin?: boolean;
  onSignOut(): void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const items: ProfileMenuItem[] = [
    { id: "profile", label: "Profile", icon: UserRound, accelerator: "Ctrl+,", onSelect: () => go("/settings/profile") },
    { id: "security", label: "Security & MFA", icon: ShieldCheck, onSelect: () => go("/settings/security") },
    { id: "notifications", label: "Notifications", icon: Bell, onSelect: () => go("/settings/notifications") },
    { id: "members", label: "Team & Members", icon: Users, onSelect: () => go("/settings/members") },
    { id: "billing", label: "Billing", icon: Receipt, onSelect: () => go("/settings/billing") },
    { id: "audit-logs", label: "Audit Logs", icon: ScrollText, onSelect: () => go("/settings/audit-logs") },
    ...(isSystemAdmin ? [{ id: "admin", label: "Admin", icon: Sliders, onSelect: () => go("/settings/admin") } as ProfileMenuItem] : []),
    {
      id: "docs",
      label: "Documentation",
      icon: BookOpenText,
      onSelect: () => {
        setOpen(false);
        void window.tellann?.system.openExternal("https://docs.tellann.co");
      },
    },
  ];

  return (
    <div className="sidebar-profile" ref={rootRef}>
      <button
        className="profile-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={userEmail ? `${userName} (${userEmail})` : userName}
        onClick={() => setOpen((value) => !value)}
      >
        {avatarNode}
        <span className="profile-trigger-name">
          <strong>{userName}</strong>
          {userEmail ? <small>{userEmail}</small> : null}
        </span>
      </button>

      {open ? (
        <div className="profile-popover" role="menu">
          <button type="button" className="profile-summary" onClick={() => go("/settings/profile")}>
            {avatarNode}
            <span className="profile-identity">
              <strong>{userName}</strong>
              {userEmail ? <small>{userEmail}</small> : null}
            </span>
            <ChevronRight size={14} />
          </button>

          <div className="profile-menu-items">
            {items.map((item) => (
              <button type="button" key={item.id} role="menuitem" onClick={item.onSelect}>
                <item.icon size={14} />
                <span>{item.label}</span>
                {item.accelerator ? <kbd>{item.accelerator}</kbd> : null}
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              className="profile-signout"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
            >
              <LogOut size={14} />
              <span>Sign out…</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
