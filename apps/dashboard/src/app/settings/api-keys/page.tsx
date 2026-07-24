'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Key, Plus, Trash2, Copy, CheckCircle, Eye, EyeOff,
  Loader2, AlertTriangle, Shield, RefreshCw, Calendar,
} from 'lucide-react';
import { useSession } from '@/components/providers';
import { useQuery } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  label: string | null;
  keyPrefix: string;
  environmentId: string | null;
  applicationId: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  environment?: { id: string; name: string; type: string } | null;
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

function maskKey(raw: string): string {
  return raw.slice(0, 12) + '••••••••••••••••••••••••••••';
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const { selectedOrgId } = useSession();

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

  // Load apps for the env selector
  const { data: apps } = useQuery<Application[]>({
    queryKey: ['api-key-apps', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/applications`);
      if (!res.ok) return [];
      const data = await res.json();
      // Enrich with environments
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

  const allEnvs = apps?.flatMap((a) =>
    (a.environments ?? []).map((e) => ({ ...e, appName: a.name, appId: a.id }))
  ) ?? [];

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

  useEffect(() => { void loadKeys(); }, [loadKeys]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createEnvId || !selectedOrgId) return;
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">API Keys</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Manage SDK integration keys. Each key is bound to an environment and grants telemetry ingestion access.
          </p>
        </div>
        <button
          id="create-api-key-btn"
          onClick={() => setShowCreateForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-white hover:bg-neutral-200 text-black text-sm font-semibold transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          New Key
        </button>
      </div>

      {/* Alert */}
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
          <span>{alert.message}</span>
          <button onClick={() => setAlert(null)} className="ml-auto text-neutral-500 hover:text-white transition">
            &times;
          </button>
        </div>
      )}

      {/* One-time key reveal */}
      {newKeyReveal && (
        <div className="rounded-md border border-[#333] bg-black p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-white">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-sm">Key Generated Successfully</span>
          </div>
          <p className="text-[#8e9192]">
            Make sure to copy your key now. You won't be able to see it again!
          </p>
          <div className="flex items-center gap-2 bg-[#131313] border border-[#262626] p-3 rounded-md">
            <code className="flex-1 font-mono text-white text-xs select-all break-all">{newKeyReveal.rawKey}</code>
          </div>
        </div>
      )}

      {/* Create key form */}
      {showCreateForm && (
        <section className="rounded-md border border-[#262626] bg-[#131313] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Plus className="h-4 w-4 text-white" /> Create New Ingestion Key
          </h2>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            {/* Environment selector */}
            <div>
              <label htmlFor="create-env-select" className="block text-xs text-[#8e9192] mb-1.5 font-mono uppercase tracking-wider">
                Environment <span className="text-red-400">*</span>
              </label>
              <select
                id="create-env-select"
                value={createEnvId}
                onChange={(e) => setCreateEnvId(e.target.value)}
                required
                className="w-full rounded-md border border-[#262626] bg-black text-sm text-neutral-200 px-3 py-2 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition"
              >
                <option value="">Select environment…</option>
                {allEnvs.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.appName} — {env.name} ({env.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Label */}
              <div>
                <label htmlFor="create-key-label" className="block text-xs text-[#8e9192] mb-1.5 font-mono uppercase tracking-wider">Label (optional)</label>
                <input
                  id="create-key-label"
                  type="text"
                  placeholder="e.g. CI/CD pipeline"
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.target.value)}
                  className="w-full rounded-md border border-[#262626] bg-black text-sm text-white placeholder-neutral-500 px-3 py-2 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition"
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
                  className="w-full rounded-md border border-[#262626] bg-black text-sm text-neutral-200 px-3 py-2 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 rounded-md border border-[#262626] text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="create-key-submit-btn"
                type="submit"
                disabled={creating || !createEnvId}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-white hover:bg-neutral-200 text-black text-sm font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                Generate Key
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Keys list */}
      <section className="rounded-md border border-[#262626] bg-[#131313]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-white" />
            <span className="text-sm font-semibold text-white">
              {keys.length} {keys.length === 1 ? 'Key' : 'Keys'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
            <button
              id="refresh-keys-btn"
              onClick={() => void loadKeys()}
              className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {keys.length === 0 && !isLoading ? (
          <div className="py-14 text-center space-y-3">
            <Key className="h-8 w-8 text-neutral-700 mx-auto" />
            <p className="text-sm text-neutral-500">No ingestion keys yet.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="text-xs text-white hover:underline transition font-mono"
            >
              Create your first key
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-[#262626]">
            {keys.map((apiKey) => {
              const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
              return (
                <li key={apiKey.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Key icon */}
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    isExpired ? 'bg-red-950/40 text-red-400' : 'bg-indigo-950/40 text-indigo-400'
                  )}>
                    <Key className="h-4 w-4" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono text-white">{apiKey.keyPrefix}••••••••</code>
                      {apiKey.label && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                          {apiKey.label}
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/40 text-red-400 border border-red-900/40 font-semibold">
                          EXPIRED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                      {apiKey.environment && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          {apiKey.environment.name} ({apiKey.environment.type})
                        </span>
                      )}
                      {apiKey.application && <span>{apiKey.application.name}</span>}
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
                    <div className="flex items-center gap-1.5 text-xs shrink-0">
                      <span className="text-red-400">Revoke?</span>
                      <button
                        id={`confirm-revoke-${apiKey.id}`}
                        onClick={() => void handleDelete(apiKey.id)}
                        disabled={deleting === apiKey.id}
                        className="rounded px-2 py-1 bg-red-600 hover:bg-red-500 text-white font-semibold transition disabled:opacity-50"
                      >
                        {deleting === apiKey.id ? '…' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded px-2 py-1 border border-neutral-700 text-neutral-400 hover:text-white transition"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      id={`revoke-key-${apiKey.id}`}
                      onClick={() => setConfirmDelete(apiKey.id)}
                      className="p-1.5 rounded-md text-neutral-500 hover:bg-red-950/40 hover:text-red-400 border border-transparent hover:border-red-900/40 transition shrink-0"
                      title="Revoke key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-neutral-600 flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5" />
        API keys grant telemetry ingestion access. Revoke any key that is no longer in use or may be compromised.
      </p>
    </div>
  );
}
