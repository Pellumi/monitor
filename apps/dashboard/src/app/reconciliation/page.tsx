'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { Button } from '@/components/ui/button';

import { useState, useMemo, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelectedApplication } from '@/hooks/use-selected-application';
import { ApplicationRequiredState } from '@/components/application-required-state';
import { EmptyState } from '@/components/empty-state';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  TrendingUp,
  Download,
  ArrowRight,
  GitPullRequest,
  Info,
  Lightbulb,
  ChevronDown,
  Radio,
} from 'lucide-react';

const FDRS_API = '/api-gateway';

interface DeclaredFlow {
  id: string;
  name: string;
  status: 'DRAFT' | 'COMPLETE';
  version: number;
  workflowType: string;
}

interface ReconciliationReport {
  flowId: string;
  applicationId: string;
  confirmedCount: number;
  trueGapCount: number;
  undeclaredCount: number;
  expectedCoverageScore: number;
  trueGaps: Array<{ stateName: string; provenance: string; declaredById: string | null }>;
  undeclared: Array<{ stateName: string; observationCount: number }>;
  confirmedTransitions: number;
  trueGapTransitions: number;
  undeclaredTransitions: number;
  transitionCoverageScore: number;
  trueGapTransitionsList: Array<{ fromStateId: string; toStateId: string; fromStateName: string; toStateName: string; action: string | null }>;
  undeclaredTransitionsList: Array<{ fromStateName: string; toStateName: string; observationCount: number }>;
  generatedAt: string;
  flow: DeclaredFlow;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 45) return 'just now';
  if (secs < 90) return 'a minute ago';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const MONO_BADGE =
  'inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-[0.08em] uppercase rounded-sm';

// ─────────────────────────────────────────────────────────────
// How reconciliation works — static explainer / legend
// ─────────────────────────────────────────────────────────────

function HowItWorksPanel() {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-md border border-[#262626] bg-[#131313]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Info className="h-4 w-4 text-[#8e9192]" />
          How reconciliation works
        </span>
        <span className="flex items-center gap-2">
          <span className={MONO_BADGE}>Reconciliation // FDRS</span>
          <ChevronDown
            className={`h-4 w-4 text-[#8e9192] transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-[#262626] px-6 py-5">
          <p className="text-sm leading-6 text-[#c4c7c8]">
            Tellann keeps two graphs for this application and continuously diffs them. This page is
            that diff.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-sm border border-[#262626] bg-black p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#8e9192]">
                Declared intent graph
              </p>
              <p className="mt-2 text-xs leading-5 text-[#c4c7c8]">
                What your team says the app <span className="text-white">should</span> do — the states
                and transitions you drew in <span className="text-white">Declare Flows</span>, before
                any traffic.
              </p>
            </div>
            <div className="rounded-sm border border-[#262626] bg-black p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#8e9192]">
                Observed behavior graph
              </p>
              <p className="mt-2 text-xs leading-5 text-[#c4c7c8]">
                What the app has actually been <span className="text-white">seen</span> doing —
                rebuilt from SDK telemetry in real sessions for the selected environment.
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[#8e9192]">
              Every state &amp; transition lands in one bucket
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-sm border border-[#262626] bg-black p-3">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed
                </span>
                <p className="mt-1.5 text-[11px] leading-5 text-[#8e9192]">
                  Declared <span className="text-[#c4c7c8]">and</span> observed. Real,
                  evidence-backed coverage.
                </p>
              </div>
              <div className="rounded-sm border border-[#262626] bg-black p-3">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" /> True gap
                </span>
                <p className="mt-1.5 text-[11px] leading-5 text-[#8e9192]">
                  Declared but <span className="text-[#c4c7c8]">never seen</span>. A human said this
                  should be reachable and it isn&apos;t — yet.
                </p>
              </div>
              <div className="rounded-sm border border-[#262626] bg-black p-3">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                  <TrendingUp className="h-3.5 w-3.5" /> Undeclared
                </span>
                <p className="mt-1.5 text-[11px] leading-5 text-[#8e9192]">
                  Observed but <span className="text-[#c4c7c8]">not declared</span>. Not an error by
                  default — needs a human call.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-sm border border-[#262626] bg-black p-4">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[#8e9192]">
              What you get out of it
            </p>
            <ul className="space-y-1.5 text-xs leading-5 text-[#c4c7c8]">
              <li className="flex gap-2">
                <ArrowRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-[#8e9192]" />
                <span>
                  <span className="text-white">True gaps</span> surface features that are broken,
                  unreachable, or simply untested — before your users find them.
                </span>
              </li>
              <li className="flex gap-2">
                <ArrowRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-[#8e9192]" />
                <span>
                  <span className="text-white">Undeclared behavior</span> reveals flows nobody wrote
                  down and code paths nobody intended.
                </span>
              </li>
              <li className="flex gap-2">
                <ArrowRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-[#8e9192]" />
                <span>
                  <span className="text-white">Coverage %</span> is a single QA-health number you can
                  track per release in <span className="text-white">Graph Drift</span>.
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Lifecycle tracker — "where am I in the process"
// ─────────────────────────────────────────────────────────────

function LifecycleTracker({
  hasFlow,
  hasTelemetry,
  hasReport,
  resolved,
}: {
  hasFlow: boolean;
  hasTelemetry: boolean;
  hasReport: boolean;
  resolved: boolean;
}) {
  const steps = [
    { label: 'Declare', detail: 'Draw the expected flow', done: hasFlow },
    { label: 'Observe', detail: 'SDK telemetry from real sessions', done: hasTelemetry },
    { label: 'Reconcile', detail: 'Diff declared vs observed', done: hasReport },
    { label: 'Resolve', detail: 'Close gaps, promote/ignore', done: resolved },
  ];
  const activeIndex = steps.findIndex((s) => !s.done);

  return (
    <div className="rounded-md border border-[#262626] bg-[#131313] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {steps.map((step, i) => {
          const isActive = i === activeIndex;
          return (
            <div key={step.label} className="flex flex-1 items-center gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                ) : isActive ? (
                  <Radio className="mt-0.5 h-4 w-4 flex-shrink-0 animate-pulse text-white" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#444748]" />
                )}
                <div className="min-w-0">
                  <p
                    className={`font-mono text-[11px] uppercase tracking-[0.08em] ${
                      step.done ? 'text-[#c4c7c8]' : isActive ? 'text-white' : 'text-[#8e9192]'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#8e9192]">{step.detail}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="ml-auto hidden h-3.5 w-3.5 flex-shrink-0 text-[#444748] sm:block" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Guidance panel — dynamic "do this next"
// ─────────────────────────────────────────────────────────────

interface Guidance {
  tone: 'todo' | 'success';
  title: string;
  body: string;
  action?: { label: string; onClick?: () => void; href?: string };
}

function buildGuidance(
  report: ReconciliationReport,
  appId: string,
  onRun: () => void,
): { primary: Guidance; secondary: Guidance[] } {
  const observed =
    report.confirmedCount +
      report.undeclaredCount +
      report.confirmedTransitions +
      report.undeclaredTransitions >
    0;
  const hasGaps = report.trueGapCount > 0 || report.trueGapTransitions > 0;

  const all: Guidance[] = [];

  if (!observed) {
    all.push({
      tone: 'todo',
      title: 'No telemetry has reached this flow yet',
      body:
        'The zeros below are real, not placeholders — nothing in the selected environment has matched this declared flow. Install the SDK, run your app through the flow so it emits STATE_ENTERED / STATE_TRANSITION events, then run reconciliation again.',
      action: { label: 'Open declaration walkthrough', href: `/declare?appId=${encodeURIComponent(appId)}` },
    });
  }

  if (hasGaps) {
    all.push({
      tone: 'todo',
      title: `Close your true gaps (${report.trueGapCount} states · ${report.trueGapTransitions} transitions)`,
      body:
        'You declared these but no session has exercised them. Either walk the app through those paths in a demonstration or QA run, or — if they are no longer intended — reopen the flow in Declare Flows and remove them.',
      action: { label: 'Reopen this flow', href: `/declare?appId=${encodeURIComponent(appId)}` },
    });
  }

  if (report.undeclaredCount > 0) {
    all.push({
      tone: 'todo',
      title: `Triage ${report.undeclaredCount} undeclared state${report.undeclaredCount === 1 ? '' : 's'}`,
      body:
        'These appeared in telemetry but are missing from your declaration. Promote the legitimate ones into the expected model (they gain provenance DEMONSTRATION_PROMOTED and recompile the ruleset). Ignore naming mismatches and instrumentation noise so they stop resurfacing.',
    });
  }

  if (report.undeclaredTransitions > 0) {
    all.push({
      tone: 'todo',
      title: `Review ${report.undeclaredTransitions} bypass transition${report.undeclaredTransitions === 1 ? '' : 's'}`,
      body:
        'Both endpoints are declared, but users move between them on an edge you never declared — a shortcut around the intended path. Add the edge in Declare Flows if it is intended; investigate the code path if it is not.',
    });
  }

  if (all.length === 0) {
    return {
      primary: {
        tone: 'success',
        title: 'This flow is fully reconciled',
        body:
          'Every declared state and transition is confirmed by telemetry, and nothing undeclared is showing up. Keep this honest by tracking the coverage score per release.',
        action: { label: 'Track drift over time', href: `/graph-drift?appId=${encodeURIComponent(appId)}` },
      },
      secondary: [],
    };
  }

  const [primary, ...secondary] = all;
  // Always offer a re-run on the primary card when it has no other action.
  if (!primary.action) primary.action = { label: 'Run reconciliation', onClick: onRun };
  return { primary, secondary };
}

function GuidancePanel({
  report,
  appId,
  onRun,
}: {
  report: ReconciliationReport;
  appId: string;
  onRun: () => void;
}) {
  const { primary, secondary } = useMemo(
    () => buildGuidance(report, appId, onRun),
    [report, appId, onRun],
  );

  return (
    <div className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#262626] pb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Lightbulb className="h-4 w-4 text-[#8e9192]" />
          What to do next
        </h2>
        <span className={MONO_BADGE}>Guidance // Next steps</span>
      </div>

      <div
        className={`rounded-sm border bg-black p-4 ${
          primary.tone === 'success' ? 'border-emerald-900/50' : 'border-[#303030]'
        }`}
      >
        <div className="flex items-start gap-3">
          {primary.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
          ) : (
            <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-white" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">{primary.title}</p>
            <p className="mt-1.5 text-xs leading-5 text-[#c4c7c8]">{primary.body}</p>
            {primary.action && (
              <div className="mt-3">
                {primary.action.href ? (
                  <a
                    href={primary.action.href}
                    className="inline-flex h-8 items-center gap-2 rounded bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-black transition-colors hover:bg-neutral-200"
                  >
                    {primary.action.label}
                    <ArrowRight className="h-3 w-3" />
                  </a>
                ) : (
                  <Button variant="primary" size="sm" onClick={primary.action.onClick}>
                    {primary.action.label}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {secondary.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#8e9192]">
            Then
          </p>
          {secondary.map((g) => (
            <div key={g.title} className="rounded-sm border border-[#262626] bg-black p-3">
              <p className="text-xs font-semibold text-[#c4c7c8]">{g.title}</p>
              <p className="mt-1 text-[11px] leading-5 text-[#8e9192]">{g.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  definition,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  definition: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#262626] bg-[#131313] p-6">
      <div className="flex items-start justify-between">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8e9192]">
            {label}
          </span>
          <div className="mt-2 font-mono text-4xl font-bold text-white">{value}</div>
          <p className="mt-2 text-xs text-[#8e9192]">{sub}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-[#262626] bg-black text-[#8e9192]">
          {icon}
        </div>
      </div>
      <p className="mt-4 border-t border-[#262626] pt-3 text-[11px] leading-5 text-[#8e9192]">
        {definition}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section card
// ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  count,
  badge,
  helper,
  icon,
  children,
}: {
  title: string;
  count: number;
  badge: string;
  helper: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-4">
      <div className="space-y-3 border-b border-[#262626] pb-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            {icon}
            <span>
              {title} <span className="text-[#8e9192]">({count})</span>
            </span>
          </h3>
          <span className={MONO_BADGE}>{badge}</span>
        </div>
        <p className="text-[11px] leading-5 text-[#8e9192]">{helper}</p>
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────

function ReconciliationSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#262626] pb-5">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-sm bg-[#131313] border border-[#262626]" />
          <div className="h-4 w-96 rounded-sm bg-[#131313] border border-[#262626]" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-36 rounded-sm bg-[#131313] border border-[#262626]" />
          <div className="h-9 w-28 rounded-sm bg-[#131313] border border-[#262626]" />
          <div className="h-9 w-28 rounded-sm bg-[#131313] border border-[#262626]" />
        </div>
      </div>
      <div className="h-14 rounded-md bg-[#131313] border border-[#262626]" />
      <div className="h-20 rounded-md bg-[#131313] border border-[#262626]" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-40 rounded-md bg-[#131313] border border-[#262626]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-52 rounded-md bg-[#131313] border border-[#262626]" />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

function ReconciliationContent() {
  const {
    appId,
    selectedOrgId,
    isLoading: isApplicationsLoading,
    error: applicationsError,
  } = useSelectedApplication();
  const queryClient = useQueryClient();

  const [activeTabFlowId, setActiveTabFlowId] = useState<string>('');

  const { data: flows, isLoading: isFlowsLoading } = useQuery<DeclaredFlow[]>({
    queryKey: ['reconciliation-flows', appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`${FDRS_API}/applications/${appId}/declared-flow`);
      if (!res.ok) throw new Error('Failed to fetch declared flows');
      const data: DeclaredFlow[] = await res.json();
      return data.filter((f) => f.status === 'COMPLETE');
    },
    enabled: !!appId,
  });

  const { data: reports, isLoading: isReportsLoading } = useQuery<ReconciliationReport[]>({
    queryKey: ['reconciliation-reports-detail', appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`${FDRS_API}/applications/${appId}/reconciliation`);
      if (!res.ok) throw new Error('Failed to fetch reconciliation reports');
      return res.json();
    },
    enabled: !!appId,
  });

  const selectedFlowId = flows?.some((flow) => flow.id === activeTabFlowId)
    ? activeTabFlowId
    : flows?.[0]?.id ?? '';

  const activeReport = useMemo(() => {
    return reports?.find((r) => r.flowId === selectedFlowId);
  }, [reports, selectedFlowId]);

  const runReconciliationMutation = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(`${FDRS_API}/applications/${appId}/reconciliation/run`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to run reconciliation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation-reports-detail', appId] });
    },
  });

  const promoteStateMutation = useMutation({
    mutationFn: async (data: { stateName: string; accepted: boolean }) => {
      const res = await authenticatedFetch(
        `${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/promote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) throw new Error('Failed to promote state');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation-reports-detail', appId] });
    },
  });

  if (!selectedOrgId) {
    return <div className="font-mono text-sm text-[#8e9192]">No organization is selected.</div>;
  }
  if (isApplicationsLoading) {
    return <ReconciliationSkeleton />;
  }
  if (applicationsError) {
    return <div className="font-mono text-sm text-red-400">Error: {(applicationsError as Error).message}</div>;
  }
  if (!appId) {
    return <ApplicationRequiredState feature="Reconciliation" />;
  }
  if (isFlowsLoading || isReportsLoading) {
    return <ReconciliationSkeleton />;
  }

  const triggerExport = async (format: string) => {
    try {
      const res = await authenticatedFetch(
        `${FDRS_API}/applications/${appId}/reconciliation/export?format=${format}`,
      );
      if (!res.ok) throw new Error('Export failed');
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json') && res.headers.get('content-disposition') === null) {
        const { url, filename } = (await res.json()) as { url: string; filename: string };
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objUrl;
        link.download = `reconciliation-${appId}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objUrl);
      }
    } catch (err) {
      console.error('[Reconciliation] Export error', err);
    }
  };

  const observedTelemetry = activeReport
    ? activeReport.confirmedCount +
        activeReport.undeclaredCount +
        activeReport.confirmedTransitions +
        activeReport.undeclaredTransitions >
      0
    : false;
  const resolved = activeReport
    ? activeReport.trueGapCount === 0 &&
      activeReport.trueGapTransitions === 0 &&
      activeReport.undeclaredCount === 0 &&
      activeReport.undeclaredTransitions === 0
    : false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#262626] pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Behavioral Reconciliation</h1>
          <p className="mt-1 text-sm text-[#c4c7c8]">
            Reconcile top-down intent flows against observed bottom-up telemetry and handle promotion.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => runReconciliationMutation.mutate()}
            disabled={runReconciliationMutation.isPending}
            loading={runReconciliationMutation.isPending}
            variant="primary"
          >
            Run Reconciliation
          </Button>

          {[
            { label: 'Export CSV', format: 'csv' },
            { label: 'Export JSON', format: 'json' },
          ].map((btn) => (
            <Button key={btn.format} onClick={() => triggerExport(btn.format)} variant="secondary" size="sm">
              <Download className="h-3.5 w-3.5" />
              <span>{btn.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <HowItWorksPanel />

      {flows && flows.length > 0 ? (
        <div className="space-y-6">
          {/* Tabs */}
          <div className="border-b border-[#262626]">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {flows.map((flow) => {
                const isActive = selectedFlowId === flow.id;
                return (
                  <button
                    key={flow.id}
                    onClick={() => setActiveTabFlowId(flow.id)}
                    className={`whitespace-nowrap border-b-2 px-1 py-4 font-mono text-xs uppercase tracking-[0.08em] transition-colors ${
                      isActive
                        ? 'border-white font-semibold text-white'
                        : 'border-transparent text-[#8e9192] hover:border-[#444748] hover:text-[#c4c7c8]'
                    }`}
                  >
                    {flow.name} (v{flow.version})
                  </button>
                );
              })}
            </nav>
          </div>

          {activeReport ? (
            <div className="space-y-6">
              <LifecycleTracker
                hasFlow
                hasTelemetry={observedTelemetry}
                hasReport
                resolved={resolved}
              />

              <GuidancePanel
                report={activeReport}
                appId={appId}
                onRun={() => runReconciliationMutation.mutate()}
              />

              {/* KPI Metrics */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <KpiCard
                  label="State Coverage (Expected Score)"
                  value={`${(activeReport.expectedCoverageScore * 100).toFixed(1)}%`}
                  sub={`${activeReport.confirmedCount} confirmed states, ${activeReport.trueGapCount} true gaps`}
                  definition="Share of declared states seen in real telemetry. Formula: confirmed ÷ (confirmed + true gaps). Undeclared states are excluded from the denominator, so discovering new behavior never lowers this number."
                  icon={<CheckCircle2 className="h-5 w-5" />}
                />
                <KpiCard
                  label="Transition Coverage KPI"
                  value={`${(activeReport.transitionCoverageScore * 100).toFixed(1)}%`}
                  sub={`${activeReport.confirmedTransitions} confirmed edges, ${activeReport.trueGapTransitions} true gaps`}
                  definition="Share of declared transitions (edges) confirmed by telemetry. Formula: confirmed ÷ (confirmed + true gaps). An edge can be a gap even when both of its states are confirmed — users reach both screens but never via this path."
                  icon={<GitPullRequest className="h-5 w-5" />}
                />
              </div>

              {/* Meta strip */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border border-[#262626] bg-[#131313] px-5 py-3 font-mono text-[11px] text-[#8e9192]">
                <span>
                  LAST RECONCILED{' '}
                  <span className="text-[#c4c7c8]">{timeAgo(activeReport.generatedAt)}</span>
                </span>
                <span>
                  CONFIRMED{' '}
                  <span className="text-[#c4c7c8]">
                    {activeReport.confirmedCount} states · {activeReport.confirmedTransitions} transitions
                  </span>
                </span>
                <span>
                  FLOW <span className="text-[#c4c7c8]">v{activeReport.flow.version}</span>
                </span>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* LEFT — states */}
                <div className="space-y-6">
                  <SectionCard
                    title="Missing Expected States (True Gaps)"
                    count={activeReport.trueGapCount}
                    badge="States // Gap"
                    icon={<AlertCircle className="h-4 w-4 text-red-400" />}
                    helper="Declared but never entered in any session. Provenance USER_AUTHORED means a teammate typed it; SUGGESTED_ACCEPTED means the Derivation Engine proposed it and someone kept it. Exercise the path to close the gap, or remove the state in Declare Flows if it is obsolete."
                  >
                    <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                      {activeReport.trueGaps.map((gap) => (
                        <div
                          key={gap.stateName}
                          className="flex items-center justify-between rounded-sm border border-[#262626] bg-black p-4 text-xs text-[#c4c7c8]"
                        >
                          <div>
                            <span className="font-mono font-bold text-red-400">{gap.stateName}</span>
                            <p className="mt-1 text-[10px] text-[#8e9192]">Source: {gap.provenance}</p>
                          </div>
                          <span className={MONO_BADGE}>Required</span>
                        </div>
                      ))}
                      {activeReport.trueGapCount === 0 && (
                        <p className="py-6 text-center text-xs text-[#8e9192]">
                          All expected states observed.
                        </p>
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Undeclared States Observed"
                    count={activeReport.undeclaredCount}
                    badge="States // Undeclared"
                    icon={<TrendingUp className="h-4 w-4 text-amber-400" />}
                    helper="Seen in telemetry, absent from your declaration. Could be a forgotten flow, a naming mismatch, or instrumentation noise. Promote the real ones into the expected model (recompiles the ruleset and re-runs reconciliation); Ignore the rest so they stop resurfacing."
                  >
                    <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                      {activeReport.undeclared.map((und) => (
                        <div
                          key={und.stateName}
                          className="flex items-center justify-between rounded-sm border border-[#262626] bg-black p-4"
                        >
                          <div>
                            <span className="font-mono text-sm font-semibold text-white">
                              {und.stateName}
                            </span>
                            <div className="mt-1 text-[10px] text-[#8e9192]">
                              {und.observationCount} visits in observed telemetry
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              onClick={() =>
                                promoteStateMutation.mutate({ stateName: und.stateName, accepted: true })
                              }
                              disabled={promoteStateMutation.isPending}
                              variant="primary"
                              size="xs"
                            >
                              <span>Promote</span>
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={() =>
                                promoteStateMutation.mutate({ stateName: und.stateName, accepted: false })
                              }
                              disabled={promoteStateMutation.isPending}
                              variant="secondary"
                              size="xs"
                            >
                              Ignore
                            </Button>
                          </div>
                        </div>
                      ))}
                      {activeReport.undeclaredCount === 0 && (
                        <p className="py-6 text-center text-xs text-[#8e9192]">
                          No undeclared states observed.
                        </p>
                      )}
                    </div>
                  </SectionCard>
                </div>

                {/* RIGHT — transitions */}
                <div className="space-y-6">
                  <SectionCard
                    title="True Gap Transitions"
                    count={activeReport.trueGapTransitions}
                    badge="Edges // Gap"
                    icon={<AlertCircle className="h-4 w-4 text-red-400" />}
                    helper="Declared edges never observed as a from → to pair. Users may reach both states but never move between them via this action. Close by walking the transition in a demonstration, or drop the edge in Declare Flows."
                  >
                    <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                      {activeReport.trueGapTransitionsList.map((trans, idx) => (
                        <div
                          key={idx}
                          className="space-y-1 rounded-sm border border-[#262626] bg-black p-4 text-xs text-[#c4c7c8]"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-[#8e9192]">{trans.fromStateName}</span>
                            <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-white" />
                            <span className="font-mono font-bold text-white">{trans.toStateName}</span>
                          </div>
                          {trans.action && (
                            <p className="text-[10px] text-[#8e9192]">Action: {trans.action}</p>
                          )}
                        </div>
                      ))}
                      {activeReport.trueGapTransitions === 0 && (
                        <p className="py-6 text-center text-xs text-[#8e9192]">
                          All expected transitions observed.
                        </p>
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Undeclared Transitions (Bypasses)"
                    count={activeReport.undeclaredTransitions}
                    badge="Edges // Bypass"
                    icon={<TrendingUp className="h-4 w-4 text-amber-400" />}
                    helper="Both endpoints are declared, but users travel between them on an edge you never declared — a shortcut around the intended path. Add the edge in Declare Flows if it is intended; investigate the code path if it is not."
                  >
                    <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                      {activeReport.undeclaredTransitionsList.map((trans, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-sm border border-[#262626] bg-black p-4 text-xs text-[#c4c7c8]"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-[#8e9192]">{trans.fromStateName}</span>
                            <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-white" />
                            <span className="font-mono font-bold text-white">{trans.toStateName}</span>
                          </div>
                          <span className={MONO_BADGE}>{trans.observationCount}×</span>
                        </div>
                      ))}
                      {activeReport.undeclaredTransitions === 0 && (
                        <p className="py-6 text-center text-xs text-[#8e9192]">
                          No unexpected workflow transitions observed.
                        </p>
                      )}
                    </div>
                  </SectionCard>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              variant="activation"
              illustration="telemetry"
              layout="page"
              eyebrow="Waiting for telemetry"
              title="No reconciliation report yet"
              description="Run your application through this flow, then trigger reconciliation to compare observed and expected behavior."
              primaryAction={{
                label: 'Run reconciliation',
                onClick: () => runReconciliationMutation.mutate(),
              }}
            />
          )}
        </div>
      ) : (
        <EmptyState
          variant="activation"
          illustration="flow"
          eyebrow="Expected flow required"
          title="Complete your first declared flow"
          description="Reconciliation needs a completed expected flow before it can compare telemetry."
          primaryAction={{
            label: 'Declare your first flow',
            href: `/declare?appId=${encodeURIComponent(appId)}`,
          }}
        />
      )}
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <Suspense fallback={<ReconciliationSkeleton />}>
      <ReconciliationContent />
    </Suspense>
  );
}
