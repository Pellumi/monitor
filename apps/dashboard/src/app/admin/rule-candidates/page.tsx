'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import React, { useEffect, useState, useCallback } from 'react';
import { ClipboardList, CheckCircle, XCircle, Loader2, AlertTriangle, ChevronRight, Eye } from 'lucide-react';

interface RuleCandidate {
  id: string;
  applicationId: string;
  ruleName: string;
  ruleType: string;
  confidence: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  proposedRule: Record<string, unknown>;
  createdAt: string;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authenticatedFetch(url, init);
  if (res.status === 403) throw new Error('ADMIN_REQUIRED');
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data as T;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  REJECTED: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

export default function AdminRuleCandidatesPage() {
  const [candidates, setCandidates] = useState<RuleCandidate[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [feedback, setFeedback] = useState<{ id: string; type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async (cur?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '20', status: statusFilter });
      if (cur) params.set('cursor', cur);
      const data = await requestJson<{ data: RuleCandidate[]; nextCursor: string | null }>(
        `/api-gateway/admin/rule-candidates?${params}`
      );
      setCandidates(cur ? (prev) => [...prev, ...data.data] : data.data);
      setNextCursor(data.nextCursor);
      if (cur) setCursor(cur);
    } catch (err: any) {
      setError(err.message === 'ADMIN_REQUIRED' ? 'System admin access required.' : (err.message || 'Failed to load candidates.'));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setCandidates([]);
    setCursor(null);
    void load();
  }, [load]);

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setActionLoading(id);
    setFeedback(null);
    try {
      await requestJson(`/api-gateway/admin/rule-candidates/${id}/${action}`, { method: 'POST' });
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      setFeedback({ id, type: 'success', message: `Rule candidate ${action === 'approve' ? 'approved' : 'rejected'}.` });
    } catch (err: any) {
      setFeedback({ id, type: 'error', message: err.message || `Failed to ${action} candidate.` });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">System Admin</span>
          <h1 className="mt-1 text-3xl font-bold text-white">Rule Candidates</h1>
          <p className="mt-1 text-sm text-neutral-400">Review AI-proposed rule candidates and approve or reject them.</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-200 text-xs px-3 py-2 focus:outline-none focus:border-indigo-500"
        >
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All</option>
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
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">{statusFilter || 'All'} Candidates</span>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500 ml-auto" />}
        </div>

        {candidates.length === 0 && !isLoading ? (
          <div className="py-12 text-center text-sm text-neutral-500">No {statusFilter.toLowerCase()} candidates.</div>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {candidates.map((c) => (
              <li key={c.id} className="px-5 py-4 space-y-3">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{c.ruleName}</span>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider', STATUS_BADGE[c.status] || STATUS_BADGE['PENDING'])}>
                        {c.status}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">{(c.confidence * 100).toFixed(0)}% confidence</span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      Type: <span className="text-neutral-400 font-mono">{c.ruleType}</span> · App: <span className="font-mono">{c.applicationId.slice(0, 8)}…</span>
                    </p>
                    <p className="text-xs text-neutral-600 mt-0.5">{new Date(c.createdAt).toLocaleString()}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      id={`view-candidate-${c.id}`}
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-white transition"
                      title="View rule JSON"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {c.status === 'PENDING' && (
                      <>
                        <button
                          id={`approve-candidate-${c.id}`}
                          onClick={() => void handleAction(c.id, 'approve')}
                          disabled={actionLoading === c.id}
                          className="flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                        >
                          {actionLoading === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                          Approve
                        </button>
                        <button
                          id={`reject-candidate-${c.id}`}
                          onClick={() => void handleAction(c.id, 'reject')}
                          disabled={actionLoading === c.id}
                          className="flex items-center gap-1 rounded-md border border-neutral-700 hover:bg-red-950/40 hover:border-red-900/60 hover:text-red-400 text-neutral-400 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                        >
                          {actionLoading === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {expandedId === c.id && (
                  <pre className="text-[11px] text-neutral-400 bg-neutral-950 border border-neutral-800 rounded-md p-4 overflow-x-auto max-h-48">
                    {JSON.stringify(c.proposedRule, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}

        {nextCursor && !isLoading && (
          <div className="border-t border-neutral-800 px-5 py-3">
            <button
              onClick={() => void load(nextCursor)}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
            >
              Load more <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
