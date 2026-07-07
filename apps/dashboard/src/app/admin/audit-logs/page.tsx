'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Shield, Loader2, AlertTriangle, Search, Filter, Download } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  action: string;
  userId: string | null;
  organizationId: string | null;
  applicationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user?: { email: string; displayName: string | null } | null;
}

const ACTION_BADGE: Record<string, string> = {
  // Security-sensitive (red)
  MEMBER_REMOVED: 'bg-red-500/10 text-red-400',
  ROLE_CHANGED: 'bg-orange-500/10 text-orange-400',
  AI_SUGGESTION_ACCEPTED: 'bg-indigo-500/10 text-indigo-400',
  RULESET_PROMOTED: 'bg-amber-500/10 text-amber-400',
  FLOW_DELETED: 'bg-red-500/10 text-red-400',
  API_KEY_CREATED: 'bg-emerald-500/10 text-emerald-400',
  API_KEY_REVOKED: 'bg-red-500/10 text-red-400',
  APPLICATION_CREATED: 'bg-blue-500/10 text-blue-400',
  DEFAULT: 'bg-neutral-800 text-neutral-400',
};

async function requestJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 403) throw new Error('ADMIN_REQUIRED');
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data as T;
}

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_BADGE[action] || ACTION_BADGE.DEFAULT;
  const label = action.replace(/_/g, ' ');
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 25;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        page: String(page),
        ...(search ? { q: search } : {}),
        ...(actionFilter ? { action: actionFilter } : {}),
      });
      const data = await requestJson<{ data: AuditLogEntry[]; total: number }>(
        `/api-gateway/admin/audit-logs?${params}`
      );
      setLogs(data.data || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message === 'ADMIN_REQUIRED' ? 'System admin access required.' : (err.message || 'Failed to load audit logs.'));
    } finally {
      setIsLoading(false);
    }
  }, [page, search, actionFilter]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">System Admin</span>
          <h1 className="mt-1 text-3xl font-bold text-white">Audit Logs</h1>
          <p className="mt-1 text-sm text-neutral-400">Security-sensitive actions recorded across all organizations.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input
            id="audit-log-search"
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by user, org, or action…"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-200 text-sm pl-9 pr-4 py-2 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <select
          id="audit-action-filter"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-200 text-sm px-3 py-2 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Actions</option>
          <option value="MEMBER_REMOVED">Member Removed</option>
          <option value="ROLE_CHANGED">Role Changed</option>
          <option value="AI_SUGGESTION_ACCEPTED">AI Suggestion Accepted</option>
          <option value="RULESET_PROMOTED">Ruleset Promoted</option>
          <option value="FLOW_DELETED">Flow Deleted</option>
          <option value="API_KEY_CREATED">API Key Created</option>
          <option value="API_KEY_REVOKED">API Key Revoked</option>
          <option value="APPLICATION_CREATED">Application Created</option>
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">{total.toLocaleString()} Events</span>
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
        </div>

        {logs.length === 0 && !isLoading ? (
          <div className="py-12 text-center text-sm text-neutral-500">No audit log entries.</div>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {logs.map((log) => (
              <li key={log.id}>
                <button
                  className="w-full text-left px-5 py-4 hover:bg-neutral-800/30 transition"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <ActionBadge action={log.action} />
                    <span className="text-xs text-neutral-400 font-mono">
                      {log.user?.email || log.userId || 'system'}
                    </span>
                    {log.organizationId && (
                      <span className="text-xs text-neutral-600 font-mono">{log.organizationId.slice(0, 8)}…</span>
                    )}
                    <span className="ml-auto text-xs text-neutral-600">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  {log.ipAddress && (
                    <p className="text-[11px] text-neutral-600 mt-1">IP: {log.ipAddress}</p>
                  )}
                </button>
                {expandedId === log.id && log.metadata && (
                  <div className="px-5 pb-4">
                    <pre className="text-[11px] text-neutral-400 bg-neutral-950 border border-neutral-800 rounded-md p-4 overflow-x-auto max-h-40">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-neutral-800 px-5 py-3 flex items-center justify-between">
            <span className="text-xs text-neutral-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                id="audit-prev-page"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-xs px-3 py-1.5 rounded border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 transition disabled:opacity-40"
              >
                Previous
              </button>
              <button
                id="audit-next-page"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs px-3 py-1.5 rounded border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 transition disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
