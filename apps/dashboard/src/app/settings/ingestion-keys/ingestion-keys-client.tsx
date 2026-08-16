'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Key, Plus, Trash2, Copy, CheckCircle, Eye, EyeOff,
  Loader2, AlertTriangle, Shield, RefreshCw, Calendar, Server,
} from 'lucide-react';

import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { useSession } from '@/components/providers';
import { EmptyState } from '@/components/empty-state';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  label: string | null;
  keyPrefix: string;
  environmentId: string | null;
  applicationId?: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  environment?: { id: string; name: string; type: string; applicationId?: string } | null;
  application?: { id: string; name: string } | null;
}

interface NewKeyReveal {
  keyPrefix: string;
  rawKey: string;
}

interface AlertState {
  type: 'success' | 'error';
  message: string;
}

interface Application {
  id: string;
  name: string;
  environments?: { id: string; name: string; type: string }[];
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authenticatedFetch(url, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data as T;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function IngestionKeysClient() {
  const { selectedOrgId } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const requestedAppId = searchParams.get('appId');
  const [selectedAppId, setSelectedAppId] = useState<string>('');

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [newKeyReveal, setNewKeyReveal] = useState<NewKeyReveal | null>(null);
  const [showRawKey, setShowRawKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLabel, setCreateLabel] = useState('');
  const [createEnvId, setCreateEnvId] = useState('');
  const [createExpiry, setCreateExpiry] = useState('');
  const [creating, setCreating] = useState(false);

  // Load applications and their environments
  const { data: apps, isLoading: isLoadingApps } = useQuery<Application[]>({
    queryKey: ['api-key-apps', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/applications`);
      if (!res.ok) return [];
      const data = await res.json();
      const enriched = await Promise.all(
        data.map(async (app: Application) => {
          try {
            const envRes = await authenticatedFetch(`/api-gateway/applications/${app.id}/environments`);
            const envData = envRes.ok ? await envRes.json() : [];
            return { ...app, environments: envData };
          } catch {
            return { ...app, environments: [] };
          }
        })
      );
      return enriched;
    },
    enabled: !!selectedOrgId,
  });

  // Sync selectedAppId with applications list or query parameter
  useEffect(() => {
    if (!apps || apps.length === 0) return;
    if (requestedAppId && apps.some((a) => a.id === requestedAppId)) {
      setSelectedAppId(requestedAppId);
    } else if (!selectedAppId || !apps.some((a) => a.id === selectedAppId)) {
      setSelectedAppId(apps[0].id);
    }
  }, [apps, requestedAppId, selectedAppId]);

  function handleSelectApp(appId: string) {
    setSelectedAppId(appId);
    setCreateEnvId('');
    const params = new URLSearchParams(searchParams.toString());
    params.set('appId', appId);
    router.replace(`/settings/ingestion-keys?${params.toString()}`);
  }

  const selectedApp = apps?.find((a) => a.id === selectedAppId);
  const selectedAppEnvs = selectedApp?.environments ?? [];
  const selectedAppEnvIds = new Set(selectedAppEnvs.map((e) => e.id));

  // Filter keys for the selected application
  const filteredKeys = keys.filter((key) => {
    if (!selectedAppId) return true;
    if (key.applicationId === selectedAppId || key.application?.id === selectedAppId) return true;
    if (key.environment?.applicationId === selectedAppId) return true;
    if (key.environmentId && selectedAppEnvIds.has(key.environmentId)) return true;
    return false;
  });

  const loadKeys = useCallback(async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    try {
      const data = await requestJson<ApiKey[]>(`/api-gateway/organizations/${selectedOrgId}/api-keys`);
      setKeys(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to load API keys.' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadKeys(), 0);
    return () => window.clearTimeout(timer);
  }, [loadKeys]);

  function openCreateForm() {
    setShowCreateForm(true);
    if (!createEnvId && selectedAppEnvs.length > 0) {
      setCreateEnvId(selectedAppEnvs[0].id);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrgId) return;
    if (!createEnvId) {
      setAlert({ type: 'error', message: 'Please select an environment for this key.' });
      return;
    }
    setCreating(true);
    setAlert(null);
    try {
      const payload: Record<string, any> = { environmentId: createEnvId };
      if (createLabel.trim()) payload.label = createLabel.trim();
      if (createExpiry) payload.expiresAt = new Date(createExpiry).toISOString();

      const result = await requestJson<{ keyPrefix: string; rawKey: string }>(
        `/api-gateway/organizations/${selectedOrgId}/api-keys`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      );
      setNewKeyReveal(result);
      setShowRawKey(true);
      setShowCreateForm(false);
      setCreateLabel('');
      setCreateEnvId('');
      setCreateExpiry('');
      await loadKeys();
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to create API key.' });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(keyId: string) {
    setDeleting(keyId);
    setConfirmDelete(null);
    try {
      await requestJson(`/api-gateway/api-keys/${keyId}`, { method: 'DELETE' });
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
      setAlert({ type: 'success', message: 'API key revoked.' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to revoke key.' });
    } finally {
      setDeleting(null);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setAlert({ type: 'error', message: 'Could not copy to clipboard.' });
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Ingestion Keys</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Manage SDK integration keys scoped to your applications and environments for telemetry ingestion.
          </p>
        </div>
        <Button
          id="create-api-key-btn"
          onClick={openCreateForm}
          variant="primary"
          disabled={!selectedAppId || selectedAppEnvs.length === 0}
        >
          <Plus className="h-4 w-4" />
          New Key
        </Button>
      </div>

      {/* Application Selector Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-[#262626] bg-[#131313] p-4">
        <div className="flex items-center gap-3">
          <Server className="h-4 w-4 text-white shrink-0" />
          <span className="text-xs font-mono uppercase tracking-wider text-[#8e9192]">
            Target Application:
          </span>
          {isLoadingApps ? (
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading applications...
            </div>
          ) : apps && apps.length > 0 ? (
            <Select value={selectedAppId} onValueChange={handleSelectApp}>
              <SelectTrigger className="w-64 font-mono text-xs bg-black border-[#262626]">
                <SelectValue placeholder="Select application...">
                  {selectedApp?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {apps.map((app) => (
                  <SelectItem key={app.id} value={app.id} className="font-mono text-xs">
                    {app.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-neutral-500 font-mono">No applications created yet</span>
          )}
        </div>

        {selectedApp && (
          <span className="text-xs font-mono text-[#8e9192]">
            {selectedAppEnvs.length} environment{selectedAppEnvs.length !== 1 ? 's' : ''} available
          </span>
        )}
      </div>

      {/* Alert Banner */}
      {alert && (
        <div
          className={cn(
            'flex items-center gap-3 rounded-md border px-4 py-3 text-sm font-mono',
            alert.type === 'success'
              ? 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300'
              : 'border-red-900/60 bg-red-950/40 text-red-300',
          )}
        >
          {alert.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span className="flex-1">{alert.message}</span>
          <button
            type="button"
            onClick={() => setAlert(null)}
            className="text-[#8e9192] hover:text-white transition-colors text-xs font-mono uppercase tracking-wider shrink-0 cursor-pointer"
          >
            [Cancel]
          </button>
        </div>
      )}

      {/* One-time key reveal */}
      {newKeyReveal && (
        <div className="rounded-md border border-[#333] bg-black p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-sm">Key Generated Successfully</span>
            </div>
            <button
              type="button"
              onClick={() => setNewKeyReveal(null)}
              className="text-[#8e9192] hover:text-white transition-colors text-xs font-mono uppercase"
            >
              [Dismiss]
            </button>
          </div>
          <p className="text-[#8e9192]">
            Make sure to copy your raw ingestion key now. You won't be able to retrieve it again!
          </p>
          <div className="flex items-center gap-2 bg-[#131313] border border-[#262626] p-3 rounded-md">
            <code className="flex-1 font-mono text-white text-xs select-all break-all">{newKeyReveal.rawKey}</code>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => void copyToClipboard(newKeyReveal.rawKey)}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      )}

      {/* Create Key Form (Scoped to Selected Application) */}
      {showCreateForm && (
        <section className="rounded-md border border-[#262626] bg-[#131313] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#262626] pb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-white" />
              Generate Ingestion Key for <span className="text-white font-mono">{selectedApp?.name}</span>
            </h2>
            <span className="border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[10px] font-mono uppercase">
              Application Scoped
            </span>
          </div>

          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            {/* Environment selector for the selected application */}
            <div>
              <label htmlFor="create-env-select" className="block text-xs text-[#8e9192] mb-1.5 font-mono uppercase tracking-wider">
                Target Environment ({selectedApp?.name}) <span className="text-red-400">*</span>
              </label>
              {selectedAppEnvs.length > 0 ? (
                <Select
                  value={createEnvId}
                  onValueChange={setCreateEnvId}
                >
                  <SelectTrigger id="create-env-select" className="w-full bg-black border-[#262626] font-mono text-xs">
                    <SelectValue placeholder="Select environment…">
                      {(() => {
                        const env = selectedAppEnvs.find((e) => e.id === createEnvId);
                        return env ? `${env.name} (${env.type})` : "Select environment…";
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {selectedAppEnvs.map((env) => (
                      <SelectItem key={env.id} value={env.id} className="font-mono text-xs">
                        {env.name} ({env.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-black border border-[#262626] rounded text-xs text-neutral-400 font-mono">
                  No environments configured for {selectedApp?.name}. Create an environment in Settings first.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Label */}
              <div>
                <label htmlFor="create-key-label" className="block text-xs text-[#8e9192] mb-1.5 font-mono uppercase tracking-wider">
                  Label (optional)
                </label>
                <input
                  id="create-key-label"
                  type="text"
                  placeholder="e.g. Production Ingestion / CI Pipeline"
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.target.value)}
                  className="w-full rounded-md border border-[#262626] bg-black text-sm text-white placeholder-neutral-500 px-3 py-2 font-mono text-xs focus:outline-none focus:border-white transition"
                />
              </div>

              {/* Expiry */}
              <div>
                <label htmlFor="create-key-expiry" className="block text-xs text-[#8e9192] mb-1.5 font-mono uppercase tracking-wider">
                  Expiry (optional)
                </label>
                <input
                  id="create-key-expiry"
                  type="date"
                  value={createExpiry}
                  onChange={(e) => setCreateExpiry(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-md border border-[#262626] bg-black text-sm text-neutral-200 px-3 py-2 font-mono text-xs focus:outline-none focus:border-white transition"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-[#262626]">
              <Button
                type="button"
                onClick={() => setShowCreateForm(false)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                id="create-key-submit-btn"
                type="submit"
                variant="primary"
                disabled={creating || !createEnvId}
                loading={creating}
              >
                {!creating && <Key className="h-4 w-4" />}
                Generate Key
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* Keys List Scoped to Selected Application */}
      <section className="rounded-md border border-[#262626] bg-[#131313]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-white" />
            <span className="text-sm font-semibold text-white font-sans">
              {filteredKeys.length} {filteredKeys.length === 1 ? 'Key' : 'Keys'}
              {selectedApp ? ` for ${selectedApp.name}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
            <Button
              id="refresh-keys-btn"
              onClick={() => void loadKeys()}
              variant="icon"
              size="icon"
              tooltip="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {filteredKeys.length === 0 && !isLoading ? (
          <EmptyState
            variant="activation"
            illustration="telemetry"
            layout="compact"
            eyebrow="SDK connection"
            title={selectedApp ? `No keys for ${selectedApp.name}` : "Create your first ingestion key"}
            description={`Use an environment-scoped key to authenticate telemetry from ${selectedApp?.name || 'your application'}.`}
            primaryAction={{ label: 'Generate key', onClick: openCreateForm }}
            className="m-4"
          />
        ) : (
          <ul className="divide-y divide-[#262626]">
            {filteredKeys.map((apiKey) => {
              const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
              return (
                <li key={apiKey.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Key icon */}
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#262626]',
                    isExpired ? 'bg-red-950/40 text-red-400' : 'bg-black text-white'
                  )}>
                    <Key className="h-4 w-4" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-mono text-white select-all">{apiKey.keyPrefix}••••••••</code>
                      {apiKey.label && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black text-neutral-300 border border-[#262626]">
                          {apiKey.label}
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-900/40 font-semibold">
                          EXPIRED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#8e9192] font-mono flex-wrap">
                      {apiKey.environment && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                          {apiKey.environment.name} ({apiKey.environment.type})
                        </span>
                      )}
                      {apiKey.lastUsedAt && (
                        <span>Last used {new Date(apiKey.lastUsedAt).toLocaleDateString()}</span>
                      )}
                      {apiKey.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Expires {new Date(apiKey.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {confirmDelete === apiKey.id ? (
                    <div className="flex items-center gap-1.5 text-xs shrink-0 font-mono">
                      <span className="text-red-400">Revoke?</span>
                      <Button
                        id={`confirm-revoke-${apiKey.id}`}
                        variant="danger"
                        size="xs"
                        onClick={() => void handleDelete(apiKey.id)}
                        disabled={deleting === apiKey.id}
                        loading={deleting === apiKey.id}
                      >
                        Yes
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setConfirmDelete(null)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      id={`revoke-key-${apiKey.id}`}
                      variant="icon"
                      size="icon"
                      onClick={() => setConfirmDelete(apiKey.id)}
                      tooltip="Revoke key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-[#8e9192] font-mono flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5" />
        API keys grant telemetry ingestion access for the selected application. Revoke any key that is no longer in use or may be compromised.
      </p>
    </div>
  );
}
