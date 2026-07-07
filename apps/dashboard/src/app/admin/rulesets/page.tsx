'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Code2, CheckCircle, XCircle, Loader2, AlertTriangle, ChevronDown, ToggleLeft, ToggleRight } from 'lucide-react';

interface CompiledRuleset {
  id: string;
  applicationId: string;
  applicationName?: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  compiledAt: string;
  rules: unknown[];
  profileType: string;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 403) throw new Error('ADMIN_REQUIRED');
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data as T;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  DRAFT: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  ARCHIVED: 'bg-neutral-800 text-neutral-500 border border-neutral-700',
};

export default function AdminRulesetsPage() {
  const [rulesets, setRulesets] = useState<CompiledRuleset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoteLoading, setPromoteLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '30', ...(statusFilter ? { status: statusFilter } : {}) });
      const data = await requestJson<{ data: CompiledRuleset[] }>(`/api-gateway/admin/rulesets?${params}`);
      setRulesets(data.data || []);
    } catch (err: any) {
      setError(err.message === 'ADMIN_REQUIRED' ? 'System admin access required.' : (err.message || 'Failed to load rulesets.'));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function handlePromote(id: string) {
    setPromoteLoading(id);
    setFeedback(null);
    try {
      await requestJson(`/api-gateway/admin/rulesets/${id}/promote`, { method: 'POST' });
      setFeedback({ type: 'success', message: 'Ruleset promoted to ACTIVE.' });
      await load();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to promote ruleset.' });
    } finally {
      setPromoteLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">System Admin</span>
          <h1 className="mt-1 text-3xl font-bold text-white">Ruleset Governance</h1>
          <p className="mt-1 text-sm text-neutral-400">Manage compiled rulesets and promote DRAFT to ACTIVE production rules.</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-200 text-xs px-3 py-2 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {feedback && (
        <div className={cn('flex items-center gap-3 rounded-lg border px-4 py-3 text-sm',
          feedback.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300' : 'border-red-900/60 bg-red-950/40 text-red-300'
        )}>
          {feedback.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {feedback.message}
        </div>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">{rulesets.length} Rulesets</span>
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
        </div>

        {rulesets.length === 0 && !isLoading ? (
          <div className="py-12 text-center text-sm text-neutral-500">No rulesets found.</div>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {rulesets.map((r) => (
              <li key={r.id} className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">
                        {r.applicationName || r.applicationId.slice(0, 12) + '…'}
                      </span>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider', STATUS_BADGE[r.status] || STATUS_BADGE.DRAFT)}>
                        {r.status}
                      </span>
                      <span className="text-[10px] text-neutral-500">v{r.version}</span>
                      <span className="text-[10px] font-mono text-neutral-600">{r.profileType}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-xs text-neutral-500">{r.rules?.length ?? 0} rules</p>
                      <p className="text-xs text-neutral-600">{new Date(r.compiledAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      id={`view-ruleset-${r.id}`}
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      className="text-xs text-neutral-500 hover:text-white border border-neutral-800 hover:border-neutral-700 rounded-md px-3 py-1.5 transition flex items-center gap-1"
                    >
                      <ChevronDown className={cn('h-3 w-3 transition-transform', expandedId === r.id && 'rotate-180')} />
                      Rules
                    </button>

                    {r.status === 'DRAFT' && (
                      <button
                        id={`promote-ruleset-${r.id}`}
                        onClick={() => void handlePromote(r.id)}
                        disabled={promoteLoading === r.id}
                        className="flex items-center gap-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                      >
                        {promoteLoading === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ToggleRight className="h-3 w-3" />}
                        Promote
                      </button>
                    )}
                  </div>
                </div>

                {expandedId === r.id && (
                  <pre className="text-[11px] text-neutral-400 bg-neutral-950 border border-neutral-800 rounded-md p-4 overflow-x-auto max-h-56">
                    {JSON.stringify(r.rules, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
