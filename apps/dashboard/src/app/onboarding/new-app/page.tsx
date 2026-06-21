'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppWindow, ArrowRight, ShoppingCart, GraduationCap, Settings, ShieldAlert } from 'lucide-react';

const ONBOARDING_API = '/api-gateway';

interface Application {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string;
}

import { Suspense } from 'react';

function NewAppContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('orgId') ?? '';
  const orgName = searchParams.get('orgName') ?? '';
  const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL || 'https://domain-name.com';

  const [appName, setAppName] = useState('');
  const [profileType, setProfileType] = useState('ECOMMERCE');

  const { data: entitlement, isLoading: isEntitlementLoading } = useQuery({
    queryKey: ['entitlement', orgId],
    queryFn: async () => {
      const res = await fetch(`${ONBOARDING_API}/organizations/${orgId}/entitlement`);
      if (!res.ok) throw new Error('Failed to load entitlement');
      return res.json();
    },
    enabled: !!orgId,
  });

  const { data: apps, isLoading: isAppsLoading } = useQuery<Application[]>({
    queryKey: ['apps', orgId],
    queryFn: async () => {
      const res = await fetch(`${ONBOARDING_API}/organizations/${orgId}/applications`);
      if (!res.ok) throw new Error('Failed to load applications');
      return res.json();
    },
    enabled: !!orgId,
  });

  const createAppMutation = useMutation({
    mutationFn: async (data: { name: string; profileType: string }) => {
      const res = await fetch(`${ONBOARDING_API}/organizations/${orgId}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name }),
      });
      if (!res.ok) {
        let errMsg = 'Failed to create application';
        try {
          const errData = await res.json();
          if (errData.message) {
            errMsg = errData.message;
          }
        } catch {}
        throw new Error(errMsg);
      }
      const app = await res.json() as Application;

      // Call profile endpoint to preload template if applicable
      const profileRes = await fetch(`${ONBOARDING_API}/applications/${app.id}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileType: data.profileType }),
      });
      if (!profileRes.ok) throw new Error('Failed to seed template profile');

      return app;
    },
    onSuccess: (data) => {
      router.push(
        `/onboarding/api-keys?orgId=${orgId}&appId=${data.id}&appName=${encodeURIComponent(data.name)}`
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    if (appName.trim()) {
      createAppMutation.mutate({
        name: appName.trim(),
        profileType,
      });
    }
  }

  if (!orgId) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-red-400">Error: Organization context is missing. Please restart onboarding.</div>
      </div>
    );
  }

  if (isEntitlementLoading || isAppsLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-neutral-400 animate-pulse text-lg">Checking plan limits…</div>
      </div>
    );
  }

  const appLimit = entitlement?.limits?.applications ?? 1;
  const currentAppCount = apps?.length ?? 0;
  const hasReachedLimit = currentAppCount >= appLimit;

  if (hasReachedLimit) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-lg space-y-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-xl shadow-2xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-sans">Limit Reached</h2>
            <p className="text-sm text-neutral-400 font-sans">
              Your organization <span className="font-semibold text-neutral-300">{orgName}</span> has onboarded{' '}
              <span className="font-semibold text-white">{currentAppCount}</span> of{' '}
              <span className="font-semibold text-white">{appLimit}</span> allowed applications on the{' '}
              <span className="font-semibold text-blue-400 uppercase">{entitlement?.planType}</span> plan.
            </p>
          </div>
          <div className="pt-2 space-y-3">
            <a
              href={`${marketingUrl}/pricing`}
              className="w-full flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-95 py-3 text-sm font-semibold text-white shadow-md transition-all font-sans"
            >
              <span>Upgrade Plan</span>
            </a>
            <button
              onClick={() => router.back()}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-3 text-sm font-medium text-neutral-400 hover:bg-neutral-900 transition-colors font-sans"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-xl shadow-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <AppWindow className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">Register Application</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Create an application configuration for <span className="font-semibold text-neutral-300">{orgName}</span>
          </p>
        </div>

        {createAppMutation.error && (
          <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-400 border border-red-500/20">
            {(createAppMutation.error as Error).message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="app-name" className="block text-sm font-medium text-neutral-300">
              Application Name
            </label>
            <input
              id="app-name"
              type="text"
              required
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g. Production E-commerce Store"
              className="mt-1 block w-full rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Behavior Profile / Template
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  id: 'ECOMMERCE',
                  name: 'E-commerce',
                  desc: 'Cart, Checkout, Catalog flows',
                  icon: ShoppingCart,
                },
                {
                  id: 'LMS',
                  name: 'Education/LMS',
                  desc: 'Course, Quiz, Lesson flows',
                  icon: GraduationCap,
                },
                {
                  id: 'CUSTOM',
                  name: 'Custom / API',
                  desc: 'Define custom user paths',
                  icon: Settings,
                },
              ].map((t) => {
                const SelectedIcon = t.icon;
                const isSelected = profileType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setProfileType(t.id)}
                    className={`flex flex-col items-center justify-between rounded-xl border p-4 text-center transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/5 text-white'
                        : 'border-neutral-800 bg-neutral-950/30 hover:bg-neutral-950/70 text-neutral-400 hover:text-neutral-300'
                    }`}
                  >
                    <SelectedIcon className={`h-6 w-6 mb-2 ${isSelected ? 'text-blue-400' : 'text-neutral-500'}`} />
                    <span className="font-semibold text-xs mb-1">{t.name}</span>
                    <span className="text-[10px] text-neutral-500 leading-tight">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-400 hover:bg-neutral-800 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={createAppMutation.isPending || !appName.trim()}
              className="flex-1 flex items-center justify-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              <span>{createAppMutation.isPending ? 'Creating…' : 'Register App'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewAppPage() {
  return (
    <Suspense fallback={<div className="text-neutral-400 animate-pulse">Loading…</div>}>
      <NewAppContent />
    </Suspense>
  );
}
