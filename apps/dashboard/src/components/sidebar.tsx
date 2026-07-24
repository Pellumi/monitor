'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef, Suspense, createContext, useContext } from 'react';
import {
  Activity,
  GitGraph,
  LayoutDashboard,
  AlertCircle,
  AlertTriangle,
  PlaySquare,
  Zap,
  ChevronDown,
  Building2,
  Plus,
  ClipboardList,
  GitCompare,
  FileText,
  ShieldAlert,
  X,
  Settings,
  Users,
  CreditCard,
  User,
  Shield,
  Brain,
  Code2,
  ListChecks,
  TrendingUp,
  Lock,
  Globe,
  LogOut,
  ArrowLeft,
} from 'lucide-react';
import { useSession, Membership, Organization } from './providers';
import { twMerge } from 'tailwind-merge';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Application {
  id: string;
  name: string;
}

interface Environment {
  id: string;
  name: string;
  type: string;
  isDefault?: boolean;
}

interface Entitlement {
  planType: string;
  features: Record<string, boolean | string>;
  limits: Record<string, number>;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredFeature?: string;
}

// ─────────────────────────────────────────────────────────────
// Entitlement context — shared between AppSelector & NavigationList
// ─────────────────────────────────────────────────────────────

const EntitlementContext = createContext<{
  entitlement: Entitlement | null;
  selectedEnvId: string | null;
}>({ entitlement: null, selectedEnvId: null });

function useEntitlement() {
  return useContext(EntitlementContext);
}

// ─────────────────────────────────────────────────────────────
// Navigation config with feature gates
// ─────────────────────────────────────────────────────────────

const navigation: NavItem[] = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Behavioral Graph', href: '/graph', icon: GitGraph, requiredFeature: 'BEHAVIOR_GRAPH' },
  { name: 'Flow Declaration', href: '/declare', icon: ClipboardList, requiredFeature: 'BEHAVIOR_GRAPH' },
  { name: 'Reconciliation', href: '/reconciliation', icon: GitCompare, requiredFeature: 'COVERAGE_ANALYSIS' },
  { name: 'Graph Drift', href: '/graph-drift', icon: TrendingUp, requiredFeature: 'COVERAGE_ANALYSIS' },
  { name: 'Workflows', href: '/workflows', icon: Activity, requiredFeature: 'WORKFLOW_DISCOVERY' },
  { name: 'Missing States', href: '/missing-states', icon: AlertCircle, requiredFeature: 'MISSING_STATE_DETECTION' },
  { name: 'Missing Flows', href: '/missing-flows', icon: AlertTriangle, requiredFeature: 'MISSING_FLOW_DETECTION' },
  { name: 'Sessions', href: '/sessions', icon: PlaySquare, requiredFeature: 'SESSION_REPLAY' },
  { name: 'Endpoint Analysis', href: '/endpoints', icon: Zap, requiredFeature: 'ENDPOINT_INTELLIGENCE' },
  { name: 'Reports', href: '/reports', icon: FileText, requiredFeature: 'REPORT_GENERATION' },
];

interface SettingsNavItem extends NavItem {
  hasAppId?: boolean;
}

const settingsNavigation: SettingsNavItem[] = [
  { name: 'Profile', href: '/settings/profile', icon: User },
  { name: 'Security & MFA', href: '/settings/security', icon: Shield, requiredFeature: 'SSO' },
  { name: 'Billing', href: '/settings/billing', icon: CreditCard },
  { name: 'Members', href: '/settings/members', icon: Users, requiredFeature: 'TEAM_COLLABORATION' },
  { name: 'Ingestion Keys', href: '/settings/api-keys', icon: Code2, requiredFeature: 'SESSION_RECORDING' },
];

const adminNavigation: NavItem[] = [
  { name: 'Rulesets', href: '/admin/rulesets', icon: Code2 },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: Shield, requiredFeature: 'AUDIT_LOGS' },
  { name: 'AI Usage', href: '/admin/ai-usage', icon: Brain },
  { name: 'Rule Candidates', href: '/admin/rule-candidates', icon: ListChecks },
  { name: 'Job Monitor', href: '/admin/jobs', icon: Activity },
];

// ─────────────────────────────────────────────────────────────
// Helper: check if a feature is enabled on the entitlement
// ─────────────────────────────────────────────────────────────

function isFeatureEnabled(entitlement: Entitlement | null, feature?: string): boolean {
  if (!feature) return true; // No gate = always visible
  if (!entitlement?.features) return true; // No entitlement loaded yet = assume enabled (loading state)
  const value = entitlement.features[feature];
  if (value === undefined) return true; // Feature not in map = assume enabled
  return value === true || (typeof value === 'string' && value !== 'false');
}

// ─────────────────────────────────────────────────────────────
// AppSelector (Org + App + Environment)
// ─────────────────────────────────────────────────────────────

function AppSelector({
  onEntitlementLoaded,
  onEnvSelected,
}: {
  onEntitlementLoaded: (e: Entitlement | null) => void;
  onEnvSelected: (envId: string | null) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedOrg, selectedOrgId, setSelectedOrgId, memberships } = useSession();
  const currentAppId = searchParams.get('appId');
  const currentEnvId = searchParams.get('envId');
  const [isOpen, setIsOpen] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL || 'https://domain-name.com';

  const { data: apps } = useQuery<Application[]>({
    queryKey: ['sidebar-apps', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/applications`);
      if (!res.ok) throw new Error('Failed to fetch apps');
      return res.json();
    },
    enabled: !!selectedOrgId,
  });

  const { data: entitlement } = useQuery<Entitlement>({
    queryKey: ['sidebar-entitlement', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/entitlement`);
      if (!res.ok) throw new Error('Failed to fetch entitlement');
      return res.json();
    },
    enabled: !!selectedOrgId,
  });

  const selectedApp = apps?.find((a) => a.id === currentAppId) ?? apps?.[0];

  // Fetch environments for the selected app
  const { data: environments } = useQuery<Environment[]>({
    queryKey: ['sidebar-envs', selectedApp?.id],
    queryFn: async () => {
      if (!selectedApp?.id) return [];
      const res = await authenticatedFetch(`/api-gateway/applications/${selectedApp.id}/environments`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedApp?.id,
  });

  const hasMultipleEnvs = isFeatureEnabled(entitlement ?? null, 'MULTIPLE_ENVIRONMENTS');
  const selectedEnv = environments?.find((e) => e.id === currentEnvId)
    ?? environments?.find((e) => e.isDefault)
    ?? environments?.[0];

  // Propagate entitlement and env selection up
  useEffect(() => {
    onEntitlementLoaded(entitlement ?? null);
  }, [entitlement, onEntitlementLoaded]);

  useEffect(() => {
    onEnvSelected(selectedEnv?.id ?? null);
  }, [selectedEnv?.id, onEnvSelected]);

  // Auto-select first app if none selected
  useEffect(() => {
    if (apps && apps.length > 0 && (!currentAppId || !apps.some(a => a.id === currentAppId))) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('appId', apps[0].id);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [apps, currentAppId, pathname, router, searchParams]);

  // Auto-select default environment
  useEffect(() => {
    if (environments && environments.length > 0 && selectedEnv && !currentEnvId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('envId', selectedEnv.id);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [environments, selectedEnv, currentEnvId, pathname, router, searchParams]);

  function handleSelect(appId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('appId', appId);
    params.delete('envId'); // Reset env when switching apps
    router.push(`${pathname}?${params.toString()}`);
    setIsOpen(false);
  }

  function handleEnvSelect(envId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('envId', envId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="relative px-4 mb-4 space-y-2">
      {/* Org Selector */}
      {memberships.length > 1 ? (
        <div className="relative">
          <select
            value={selectedOrgId || ''}
            onChange={(e) => {
              setSelectedOrgId(e.target.value);
              const params = new URLSearchParams(searchParams.toString());
              params.delete('appId');
              params.delete('envId');
              router.push(`${pathname}?${params.toString()}`);
            }}
            className="w-full bg-neutral-950 text-neutral-400 border border-neutral-800 rounded-lg py-1 px-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
          >
            {memberships.map((m) => (
              <option key={m.organization.id} value={m.organization.id}>
                {m.organization.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        memberships.length === 1 && (
          <div className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider px-1">
            {memberships[0].organization.name}
          </div>
        )
      )}

      {/* App Selector button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={!apps || apps.length === 0}
        className="w-full flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-left text-sm transition-all hover:bg-neutral-900 disabled:opacity-50"
      >
        <div className="truncate pr-2">
          <div className="font-semibold text-white truncate text-xs">
            {selectedApp ? selectedApp.name : 'No Applications'}
          </div>
        </div>
        {apps && apps.length > 0 && (
          <ChevronDown className="h-4 w-4 text-neutral-500 flex-shrink-0" />
        )}
      </button>

      {isOpen && apps && apps.length > 0 && (
        <div className="absolute left-4 right-4 z-50 mt-1 rounded-lg border border-neutral-800 bg-neutral-950 shadow-xl max-h-60 overflow-y-auto">
          <div className="py-1">
            {apps.map((app) => (
              <button
                key={app.id}
                onClick={() => handleSelect(app.id)}
                className={twMerge(
                  'w-full text-left px-3 py-2 text-xs hover:bg-neutral-800 transition-colors',
                  selectedApp?.id === app.id ? 'bg-neutral-900 text-white font-semibold' : 'text-neutral-400'
                )}
              >
                <div>{app.name}</div>
              </button>
            ))}

            <div className="border-t border-neutral-800 mt-1 pt-1">
              <button
                onClick={(e) => {
                  setIsOpen(false);
                  const limit = entitlement?.limits?.applications ?? 1;
                  const currentCount = apps?.length ?? 0;
                  if (currentCount >= limit) {
                    setShowLimitModal(true);
                  } else {
                    router.push('/onboarding');
                  }
                }}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs text-blue-400 hover:bg-neutral-800 hover:text-blue-300 transition-colors font-medium w-full text-left"
              >
                <Plus className="h-3 w-3" />
                <span>Add Application…</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Environment Selector — global, shown only when plan has MULTIPLE_ENVIRONMENTS or when envs > 1 */}
      {environments && environments.length > 0 && (
        <div className="flex items-center gap-1">
          <Globe className="h-3 w-3 text-neutral-600 flex-shrink-0" />
          {hasMultipleEnvs && environments.length > 1 ? (
            <select
              value={selectedEnv?.id || ''}
              onChange={(e) => handleEnvSelect(e.target.value)}
              className="flex-1 bg-neutral-950 text-neutral-500 border border-neutral-800/50 rounded-md py-1 px-2 text-[10px] font-medium focus:outline-none focus:border-indigo-500/50 transition-colors"
            >
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name} ({env.type})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[10px] text-neutral-600 font-medium truncate">
              {selectedEnv?.name ?? 'Default'}
            </span>
          )}
        </div>
      )}

      {showLimitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl space-y-6">
            <button
              onClick={() => setShowLimitModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col items-center text-center space-y-3">
              <h3 className="text-xl font-bold text-white font-sans">Application Limit Reached</h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                You have reached the maximum number of applications allowed on your plan ({entitlement?.limits?.applications ?? 1} application). Please upgrade your plan to onboard more applications.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLimitModal(false)}
                className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 py-2.5 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 transition-colors font-sans"
              >
                Cancel
              </button>
              <a
                href={`${marketingUrl}/pricing`}
                className="flex-1 flex items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-95 py-2.5 text-xs font-semibold text-white shadow-md transition-all text-center font-sans"
              >
                Upgrade Plan
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NavigationList — with entitlement gating
// ─────────────────────────────────────────────────────────────

function NavigationList() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const appId = searchParams.get('appId');
  const envId = searchParams.get('envId');
  const { entitlement } = useEntitlement();

  const isSettingsMode = pathname.startsWith('/settings');
  const isAdminMode = pathname.startsWith('/admin');
  const isMainAppMode = !isSettingsMode && !isAdminMode;

  // Track last main app path so "Back to App" returns to the user's previous active page
  useEffect(() => {
    if (isMainAppMode && !pathname.startsWith('/auth') && !pathname.startsWith('/onboarding')) {
      const fullPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
      sessionStorage.setItem('lastMainAppPath', fullPath);
    }
  }, [pathname, searchParams, isMainAppMode]);

  function handleBackToApp() {
    const lastPath = sessionStorage.getItem('lastMainAppPath');
    if (lastPath) {
      router.push(lastPath);
    } else {
      const params = new URLSearchParams();
      if (appId) params.set('appId', appId);
      if (envId) params.set('envId', envId);
      router.push(params.toString() ? `/?${params.toString()}` : '/');
    }
  }

  function buildHref(href: string, hasAppId = true) {
    const params = new URLSearchParams();
    if (hasAppId && appId) params.set('appId', appId);
    if (hasAppId && envId) params.set('envId', envId);
    return params.toString() ? `${href}?${params.toString()}` : href;
  }

  const renderNavItem = (
    item: NavItem,
    hasAppId = true,
  ) => {
    const enabled = isFeatureEnabled(entitlement, item.requiredFeature);
    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));

    if (!enabled) {
      // Locked item — visible but greyed out with lock icon
      return (
        <button
          key={item.name}
          onClick={() => router.push('/settings/billing?upgrade=1')}
          className="group flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-all text-neutral-600 hover:bg-neutral-800/50 hover:text-neutral-500 w-full text-left cursor-pointer"
          title={`Upgrade your plan to access ${item.name}`}
        >
          <div className="flex items-center">
            <item.icon className="mr-3 h-4 w-4 flex-shrink-0 text-neutral-700" />
            {item.name}
          </div>
          <Lock className="h-3 w-3 text-neutral-700 group-hover:text-amber-600/60" />
        </button>
      );
    }

    const fullHref = buildHref(item.href, hasAppId);
    return (
      <Link
        key={item.name}
        href={fullHref}
        className={twMerge(
          isActive
            ? 'bg-neutral-800 text-white font-semibold'
            : 'text-neutral-400 hover:bg-neutral-800 hover:text-white',
          'group flex items-center rounded-md px-3 py-2 text-xs font-medium transition-all'
        )}
      >
        <item.icon
          className={twMerge(
            isActive ? 'text-white' : 'text-neutral-500 group-hover:text-white',
            'mr-3 h-4 w-4 flex-shrink-0 transition-colors'
          )}
          aria-hidden="true"
        />
        {item.name}
      </Link>
    );
  };

  return (
    <nav className="flex-1 space-y-1 px-4 py-2 overflow-y-auto">
      {/* ── Back to App Button (shown in Settings or Admin mode) ─── */}
      {!isMainAppMode && (
        <button
          type="button"
          onClick={handleBackToApp}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded-md transition-colors w-full text-left mb-3 border-b border-neutral-800/80 pb-3 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-neutral-400" />
          <span>Back to App</span>
        </button>
      )}

      {/* ── Main App Navigation Mode ─── */}
      {isMainAppMode && (
        <>
          {navigation.map((item) => renderNavItem(item, true))}
        </>
      )}

      {/* ── Settings Navigation Mode ─── */}
      {isSettingsMode && (
        <div>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Settings</p>
          {settingsNavigation.map((item) => renderNavItem(item, false))}
        </div>
      )}

      {/* ── Admin Navigation Mode ─── */}
      {isAdminMode && (
        <div>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-amber-600 font-medium">Admin</p>
          {adminNavigation.map((item) => renderNavItem(item, false))}
        </div>
      )}
    </nav>
  );
}

function UserProfile() {
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) return null;

  const isSystemAdmin = (user as any)?.isSystemAdmin === true;
  const initial = (user.displayName?.[0] || user.email[0]).toUpperCase();
  const name = user.displayName || user.email.split('@')[0];
  const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.domain-name.com';

  const avatarElement = user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt={name}
      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
    />
  ) : (
    <div className="w-7 h-7 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-medium text-xs flex-shrink-0">
      {initial}
    </div>
  );

  return (
    <div ref={containerRef} className="relative border-t border-neutral-800 flex-shrink-0 bg-neutral-950/20">
      {/* Pop Up Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-1 right-1 mb-2 bg-[#18181b] border border-neutral-800 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Header inside Pop Up — Clicking opens profile settings */}
          <Link
            href="/settings/profile"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-2.5 py-2 border-b border-neutral-800/80 mb-1 hover:bg-neutral-800/70 rounded-lg transition-colors cursor-pointer group"
          >
            {avatarElement}
            <div className="truncate">
              <div className="text-xs font-semibold text-white group-hover:underline transition-colors truncate">{name}</div>
              <div className="text-[10px] text-neutral-500 truncate">{user.email}</div>
            </div>
          </Link>

          {/* Menu Options */}
          <div className="space-y-0.5">
            <Link
              href="/settings/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/70 transition-colors"
            >
              <Settings className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <span>Settings</span>
            </Link>

            {isSystemAdmin && (
              <Link
                href="/admin/rulesets"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/70 transition-colors"
              >
                <ShieldAlert className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <span>Admin</span>
              </Link>
            )}

            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/70 transition-colors"
            >
              <FileText className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <span>Documentation</span>
            </a>

            <Link
              href="/auth/logout"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-red-400 hover:bg-red-950/30 transition-colors"
            >
              <LogOut className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <span>Log out</span>
            </Link>
          </div>
        </div>
      )}

      {/* Main Sidebar User Trigger Row */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2.5 w-full p-2.5 rounded-lg hover:bg-neutral-800/60 transition-colors text-left focus:outline-none cursor-pointer"
      >
        {avatarElement}
        <span className="text-xs font-semibold text-white truncate">{name}</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sidebar (root)
// ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);

  return (
    <EntitlementContext.Provider value={{ entitlement, selectedEnvId }}>
      <div className="flex h-full w-64 flex-col border-r border-[#262626] bg-[#0a0a0a]">
        <div className="flex h-16 items-center justify-between px-6 mb-4 shrink-0">
          <Link href="/" className="flex items-center space-x-2">
            <h1 className="text-[22px] font-extrabold tracking-tight text-white">Tellann</h1>
          </Link>
        </div>

        <Suspense fallback={<div className="h-10 px-4 mb-4 text-xs text-neutral-500 animate-pulse">Loading selector...</div>}>
          <AppSelector
            onEntitlementLoaded={setEntitlement}
            onEnvSelected={setSelectedEnvId}
          />
        </Suspense>

        <Suspense fallback={<div className="px-4 text-xs text-neutral-500 animate-pulse">Loading menu...</div>}>
          <NavigationList />
        </Suspense>

        <UserProfile />
      </div>
    </EntitlementContext.Provider>
  );
}
