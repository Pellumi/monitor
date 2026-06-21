'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, Suspense } from 'react';
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
  X
} from 'lucide-react';
import { useSession, Membership, Organization } from './providers';
import { twMerge } from 'tailwind-merge';

interface Application {
  id: string;
  name: string;
}

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Behavioral Graph', href: '/graph', icon: GitGraph },
  { name: 'Flow Declaration', href: '/declare', icon: ClipboardList },
  { name: 'Reconciliation', href: '/reconciliation', icon: GitCompare },
  { name: 'Workflows', href: '/workflows', icon: Activity },
  { name: 'Missing States', href: '/missing-states', icon: AlertCircle },
  { name: 'Missing Flows', href: '/missing-flows', icon: AlertTriangle },
  { name: 'Sessions', href: '/sessions', icon: PlaySquare },
  { name: 'Endpoint Analysis', href: '/endpoints', icon: Zap },
  { name: 'Reports', href: '/reports', icon: FileText },
];

function AppSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedOrg, selectedOrgId, setSelectedOrgId, memberships } = useSession();
  const currentAppId = searchParams.get('appId');
  const [isOpen, setIsOpen] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL || 'https://domain-name.com';

  const { data: apps } = useQuery<Application[]>({
    queryKey: ['sidebar-apps', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await fetch(`/api-gateway/organizations/${selectedOrgId}/applications`);
      if (!res.ok) throw new Error('Failed to fetch apps');
      return res.json();
    },
    enabled: !!selectedOrgId,
  });

  const { data: entitlement } = useQuery({
    queryKey: ['sidebar-entitlement', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await fetch(`/api-gateway/organizations/${selectedOrgId}/entitlement`);
      if (!res.ok) throw new Error('Failed to fetch entitlement');
      return res.json();
    },
    enabled: !!selectedOrgId,
  });

  const selectedApp = apps?.find((a) => a.id === currentAppId) ?? apps?.[0];

  useEffect(() => {
    if (apps && apps.length > 0 && (!currentAppId || !apps.some(a => a.id === currentAppId))) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('appId', apps[0].id);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [apps, currentAppId, pathname, router, searchParams]);

  function handleSelect(appId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('appId', appId);
    router.push(`${pathname}?${params.toString()}`);
    setIsOpen(false);
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
              {/* <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <ShieldAlert className="h-6 w-6" />
              </div> */}
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

function NavigationList() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appId = searchParams.get('appId');

  return (
    <nav className="flex-1 space-y-1 px-4 py-2">
      {navigation.map((item) => {
        const isActive = pathname === item.href;
        const linkHref = appId ? `${item.href}?appId=${appId}` : item.href;
        return (
          <Link
            key={item.name}
            href={linkHref}
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
      })}
    </nav>
  );
}

function UserProfile() {
  const { user } = useSession();
  if (!user) return null;

  const initial = (user.displayName?.[0] || user.email[0]).toUpperCase();
  const name = user.displayName || user.email.split('@')[0];
  const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.domain-name.com';
  const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL || 'https://domain-name.com';

  return (
    <div className="p-4 border-t border-neutral-800 flex-shrink-0 space-y-3 bg-neutral-950/20">
      <div className="flex items-center gap-2.5 truncate">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs shadow-md flex-shrink-0">
          {initial}
        </div>
        <div className="truncate">
          <div className="text-xs font-semibold text-white truncate">{name}</div>
          <div className="text-[10px] text-neutral-500 truncate">{user.email}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <a
          href={docsUrl}
          className="text-center py-1.5 border border-neutral-800 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
        >
          Docs
        </a>
        <a
          href={marketingUrl}
          className="text-center py-1.5 border border-neutral-800 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
        >
          Site
        </a>
      </div>
      <div className="flex gap-2">
        <Link
          href="/settings/profile"
          className="flex-1 text-center py-1.5 border border-neutral-800 rounded-md hover:bg-neutral-800 text-[10px] text-neutral-400 hover:text-white transition-colors"
        >
          Settings
        </Link>
        <Link
          href="/auth/logout"
          className="flex-1 text-center py-1.5 border border-neutral-800 rounded-md hover:bg-red-950/30 hover:border-red-900/50 hover:text-red-400 text-[10px] text-neutral-400 transition-colors"
        >
          Logout
        </Link>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <div className="flex h-full w-64 flex-col border-r border-neutral-800 bg-neutral-900">
      <div className="flex h-16 items-center justify-between border-b border-neutral-800 px-6 mb-4 flex-shrink-0">
        <Link href="/" className="flex items-center space-x-2">
          <Building2 className="h-5 w-5 text-blue-400" />
          <h1 className="text-lg font-bold tracking-tight text-white">SOTS Platform</h1>
        </Link>
      </div>

      <Suspense fallback={<div className="h-10 px-4 mb-4 text-xs text-neutral-500 animate-pulse">Loading selector...</div>}>
        <AppSelector />
      </Suspense>

      <Suspense fallback={<div className="px-4 text-xs text-neutral-500 animate-pulse">Loading menu...</div>}>
        <NavigationList />
      </Suspense>

      <UserProfile />
    </div>
  );
}
