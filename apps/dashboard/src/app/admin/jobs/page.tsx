'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useEffect, useState } from 'react';
import { useSession } from '@/components/providers';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Pause,
  RefreshCw,
  Timer,
  ArrowRight,
  AlertTriangle,
  Loader2,
  BarChart3,
  ExternalLink,
} from 'lucide-react';

interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

interface RecentJob {
  id: string;
  name: string;
  queue: string;
  status: string;
  timestamp: string;
  duration?: number;
  failedReason?: string;
  attemptsMade?: number;
}

export default function AdminJobsPage() {
  const { user } = useSession();
  const isSystemAdmin = (user as any)?.isSystemAdmin === true;
  const [queues, setQueues] = useState<QueueStatus[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const workersUrl = process.env.NEXT_PUBLIC_WORKERS_URL || 'http://localhost:3020';
  const bullBoardUrl = `${workersUrl}/admin/jobs`;

  const fetchStatus = async () => {
    try {
      const res = await authenticatedFetch(`${workersUrl}/health`);
      if (!res.ok) throw new Error('Workers not reachable');
      const health = await res.json();

      // Generate queue status from our known job definitions
      const jobDefinitions = [
        { name: 'ai-draft-job-processor', schedule: 'Every 5s' },
        { name: 'ruleset-cache-warmer', schedule: 'Every 10m' },
        { name: 'ai-invocation-metrics-aggregator', schedule: 'Hourly' },
        { name: 'ai-draft-expiry-cleaner', schedule: 'Daily 2AM' },
        { name: 'ruleset-feedback-analyzer', schedule: 'Daily 3AM' },
        { name: 'rule-candidate-promoter', schedule: 'Daily 4AM' },
        { name: 'weekly-report-digest', schedule: 'Monday 6AM' },
        { name: 'coverage-alert-digest', schedule: 'Daily 7AM' },
        { name: 'rule-candidate-admin-digest', schedule: 'Daily 8AM' },
        { name: 'cross-tenant-index-builder', schedule: 'Weekly Sun 1AM' },
      ];

      setQueues(
        jobDefinitions.map((job) => ({
          name: job.name,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: 0,
        }))
      );

      setError(null);
      setLastRefresh(new Date());
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch worker status');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 10_000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (!isSystemAdmin) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <p className="text-neutral-400 text-sm">System admin access required</p>
        </div>
      </div>
    );
  }

  const scheduleLookup: Record<string, string> = {
    'ai-draft-job-processor': 'Every 5s',
    'ruleset-cache-warmer': 'Every 10m',
    'ai-invocation-metrics-aggregator': 'Hourly',
    'ai-draft-expiry-cleaner': 'Daily 2AM',
    'ruleset-feedback-analyzer': 'Daily 3AM',
    'rule-candidate-promoter': 'Daily 4AM',
    'weekly-report-digest': 'Monday 6AM',
    'coverage-alert-digest': 'Daily 7AM',
    'rule-candidate-admin-digest': 'Daily 8AM',
    'cross-tenant-index-builder': 'Weekly Sun 1AM',
  };

  const totalActive = queues.reduce((s, q) => s + q.active, 0);
  const totalWaiting = queues.reduce((s, q) => s + q.waiting, 0);
  const totalFailed = queues.reduce((s, q) => s + q.failed, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Job Monitor</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Background worker status and job queue monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-neutral-600">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              autoRefresh
                ? 'border-green-800/50 bg-green-950/30 text-green-400'
                : 'border-neutral-800 bg-neutral-950 text-neutral-400'
            }`}
          >
            {autoRefresh ? (
              <><RefreshCw className="h-3 w-3 animate-spin" /> Auto</>
            ) : (
              <><Pause className="h-3 w-3" /> Paused</>
            )}
          </button>
          <button
            onClick={fetchStatus}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-400 hover:bg-neutral-900 hover:text-white text-xs font-medium transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
          <a
            href={bullBoardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-semibold shadow-md hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="h-3 w-3" /> Bull Board
          </a>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Total Queues</span>
            <BarChart3 className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{queues.length}</div>
          <div className="text-[10px] text-neutral-600 mt-1">registered workers</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Active Jobs</span>
            <Activity className="h-4 w-4 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-green-400">{totalActive}</div>
          <div className="text-[10px] text-neutral-600 mt-1">currently processing</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Waiting</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{totalWaiting}</div>
          <div className="text-[10px] text-neutral-600 mt-1">queued for processing</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Failed</span>
            <XCircle className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400">{totalFailed}</div>
          <div className="text-[10px] text-neutral-600 mt-1">need attention</div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-400 font-medium">Workers Unreachable</p>
            <p className="text-xs text-red-400/60 mt-0.5">{error}. Make sure the background-workers service is running on port {process.env.BACKGROUND_WORKERS_METRICS_PORT || '3020'}.</p>
          </div>
        </div>
      )}

      {/* Queue table */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Worker Queues</h2>
          {loading && <Loader2 className="h-4 w-4 text-neutral-500 animate-spin" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800/50">
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Queue</th>
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Schedule</th>
                <th className="text-center px-5 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Active</th>
                <th className="text-center px-5 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Waiting</th>
                <th className="text-center px-5 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Completed</th>
                <th className="text-center px-5 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Failed</th>
                <th className="text-center px-5 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {queues.map((q) => (
                <tr key={q.name} className="border-b border-neutral-800/30 hover:bg-neutral-800/20 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-mono text-neutral-300">{q.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-medium">
                      {scheduleLookup[q.name] || '—'}
                    </span>
                  </td>
                  <td className="text-center px-5 py-3">
                    <span className={`text-xs font-medium ${q.active > 0 ? 'text-green-400' : 'text-neutral-600'}`}>
                      {q.active}
                    </span>
                  </td>
                  <td className="text-center px-5 py-3">
                    <span className={`text-xs font-medium ${q.waiting > 0 ? 'text-amber-400' : 'text-neutral-600'}`}>
                      {q.waiting}
                    </span>
                  </td>
                  <td className="text-center px-5 py-3">
                    <span className="text-xs text-neutral-500">{q.completed}</span>
                  </td>
                  <td className="text-center px-5 py-3">
                    <span className={`text-xs font-medium ${q.failed > 0 ? 'text-red-400' : 'text-neutral-600'}`}>
                      {q.failed}
                    </span>
                  </td>
                  <td className="text-center px-5 py-3">
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-950/40 text-green-400 border border-green-800/30 font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Running
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bull Board embed info */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 flex-shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Full Bull Board Dashboard</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              For detailed job inspection, retry management, and real-time monitoring, open the full Bull Board UI.
              It provides per-job logs, retry/remove actions, and queue-level controls.
            </p>
            <a
              href={bullBoardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Open Bull Board <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
