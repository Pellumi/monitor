'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from '@/components/providers';
import { BarChart3, Brain, Calendar, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';

interface AiUsageSummary {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgCallsPerDay: number;
  byProvider: Array<{
    provider: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }>;
}

interface AiUsageDaily {
  date: string;
  provider: string;
  modelId: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

async function requestJson<T>(url: string): Promise<T> {
  const res = await authenticatedFetch(url);
  if (res.status === 403) throw new Error('ADMIN_REQUIRED');
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data as T;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}

export default function AdminAiUsagePage() {
  const { user } = useSession();
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [daily, setDaily] = useState<AiUsageDaily[]>([]);
  const [days, setDays] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sum, dailyData] = await Promise.all([
        requestJson<AiUsageSummary>(`/api-gateway/admin/ai-usage?days=${days}`),
        requestJson<{ data: AiUsageDaily[] }>(`/api-gateway/admin/ai-usage/daily?days=${days}`),
      ]);
      setSummary(sum);
      setDaily(dailyData.data || []);
    } catch (err: any) {
      setError(err.message === 'ADMIN_REQUIRED' ? 'System admin access required.' : (err.message || 'Failed to load usage data.'));
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  const runBackfill = async () => {
    setIsBackfilling(true);
    setBackfillMessage(null);
    try {
      const res = await authenticatedFetch(`/api-gateway/admin/ai-usage/backfill?days=${days}`, {
        method: 'POST',
      });
      if (res.status === 403) throw new Error('ADMIN_REQUIRED');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setBackfillMessage(`Metrics aggregated successfully: read ${data.logsRead} logs and created/updated ${data.groupsWritten} daily aggregate records.`);
      await load();
    } catch (err: any) {
      setBackfillMessage(`Backfill failed: ${err.message === 'ADMIN_REQUIRED' ? 'System admin access required.' : (err.message || 'Unknown error')}`);
    } finally {
      setIsBackfilling(false);
    }
  };

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">System Admin</span>
          </div>
          <h1 className="text-3xl font-bold text-white">AI Usage</h1>
          <p className="mt-1 text-sm text-neutral-400">Monitor AI provider costs, token consumption, and usage trends.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-400">Period:</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-200 text-xs px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>Last {d} days</option>
            ))}
          </select>
          <button
            onClick={runBackfill}
            disabled={isBackfilling || isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-800 bg-indigo-950/40 text-indigo-300 px-3 py-2 text-xs font-medium hover:bg-indigo-900/40 disabled:opacity-50 transition"
          >
            {isBackfilling ? (
              <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
            ) : (
              <BarChart3 className="h-3 w-3 text-indigo-400" />
            )}
            {isBackfilling ? 'Aggregating...' : 'Sync Metrics'}
          </button>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {backfillMessage && (
        <div className="flex items-center gap-3 rounded-lg border border-indigo-900/60 bg-indigo-950/40 px-4 py-3 text-sm text-indigo-300">
          <BarChart3 className="h-4 w-4 shrink-0 text-indigo-400" />
          {backfillMessage}
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total AI Calls" value={summary.totalCalls.toLocaleString()} sub={`${summary.avgCallsPerDay.toFixed(1)}/day avg`} />
            <StatCard label="Input Tokens" value={(summary.totalInputTokens / 1000).toFixed(1) + 'K'} />
            <StatCard label="Output Tokens" value={(summary.totalOutputTokens / 1000).toFixed(1) + 'K'} />
            <StatCard label="Est. Cost" value={`$${summary.totalCostUsd.toFixed(2)}`} sub={`Last ${days} days`} />
          </div>

          <section className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center gap-2">
              <Brain className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-semibold text-white">By Provider</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Provider</th>
                  <th className="text-right px-5 py-3">Calls</th>
                  <th className="text-right px-5 py-3">Input Tokens</th>
                  <th className="text-right px-5 py-3">Output Tokens</th>
                  <th className="text-right px-5 py-3">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {summary.byProvider.map((p) => (
                  <tr key={p.provider} className="hover:bg-neutral-800/30 transition">
                    <td className="px-5 py-3 font-mono text-neutral-200">{p.provider}</td>
                    <td className="px-5 py-3 text-right text-neutral-300">{p.calls.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-neutral-400">{(p.inputTokens / 1000).toFixed(1)}K</td>
                    <td className="px-5 py-3 text-right text-neutral-400">{(p.outputTokens / 1000).toFixed(1)}K</td>
                    <td className="px-5 py-3 text-right text-indigo-400 font-semibold">${p.estimatedCostUsd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-semibold text-white">Daily Breakdown</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3">Date</th>
                    <th className="text-left px-5 py-3">Provider</th>
                    <th className="text-left px-5 py-3">Model</th>
                    <th className="text-right px-5 py-3">Calls</th>
                    <th className="text-right px-5 py-3">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {daily.slice(0, 50).map((d, i) => (
                    <tr key={i} className="hover:bg-neutral-800/30 transition">
                      <td className="px-5 py-3 text-neutral-400 font-mono text-xs">{d.date}</td>
                      <td className="px-5 py-3 text-neutral-300">{d.provider}</td>
                      <td className="px-5 py-3 text-neutral-500 font-mono text-xs truncate max-w-[200px]">{d.modelId}</td>
                      <td className="px-5 py-3 text-right text-neutral-300">{d.calls}</td>
                      <td className="px-5 py-3 text-right text-indigo-400">${d.estimatedCostUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                  {daily.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-neutral-500 text-xs">No data for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
