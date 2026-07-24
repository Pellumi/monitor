'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Building2, ArrowRight, Plus, Check } from 'lucide-react';

const ONBOARDING_API = '/api-gateway';

interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data: organizations, isLoading, error } = useQuery<Organization[]>({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await authenticatedFetch(`${ONBOARDING_API}/organizations`);
      if (!res.ok) throw new Error('Failed to load organizations');
      return res.json();
    },
  });

  const createOrgMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await authenticatedFetch(`${ONBOARDING_API}/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to create organization');
      return res.json() as Promise<Organization>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setSelectedOrgId(data.id);
      setIsCreating(false);
      setNewOrgName('');
    },
  });

  function handleNext() {
    if (!selectedOrgId) return;
    const org = organizations?.find((o) => o.id === selectedOrgId);
    router.push(`/onboarding/new-app?orgId=${selectedOrgId}&orgName=${encodeURIComponent(org?.name ?? '')}`);
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-neutral-400 animate-pulse text-lg">Loading organizations…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-xl shadow-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">Select Organization</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Choose an existing organization or create a new one to get started.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-400 border border-red-500/20">
            {(error as Error).message}
          </div>
        )}

        <div className="space-y-6">
          {isCreating ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newOrgName.trim()) createOrgMutation.mutate(newOrgName.trim());
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="org-name" className="block text-sm font-medium text-neutral-300">
                  Organization Name
                </label>
                <input
                  id="org-name"
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Acme Corp"
                  className="mt-1 block w-full rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-400 hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createOrgMutation.isPending || !newOrgName.trim()}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {createOrgMutation.isPending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {organizations && organizations.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {organizations.map((org) => {
                    const isSelected = selectedOrgId === org.id;
                    return (
                      <button
                        key={org.id}
                        onClick={() => setSelectedOrgId(org.id)}
                        className={`w-full flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/5 text-white'
                            : 'border-neutral-800 bg-neutral-950/50 hover:bg-neutral-950 text-neutral-300'
                        }`}
                      >
                        <span className="font-medium">{org.name}</span>
                        {isSelected && <Check className="h-5 w-5 text-blue-400" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-neutral-500">
                  No organizations found. Create one to continue.
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center justify-center space-x-2 rounded-xl border border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-950/20 py-4 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Organization</span>
              </button>
            </div>
          )}

          {!isCreating && (
            <button
              onClick={handleNext}
              disabled={!selectedOrgId}
              className="w-full flex items-center justify-center space-x-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-3 text-sm font-medium text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <span>Continue</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
