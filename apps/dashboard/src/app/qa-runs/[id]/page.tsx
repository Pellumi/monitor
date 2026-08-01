"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Camera, FileArchive, Route, ShieldCheck } from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

type RunDetail = {
  id: string; status: string; targetUrl: string; startedAt: string | null; endedAt: string | null;
  environment: { name: string; type: string };
  artifacts: Array<{ id: string; artifactType: string; bytes: string; capturedAt: string }>;
  findings: Array<{ id: string; severity: string; category: string; title: string; description: string; url: string | null }>;
};
type Report = {
  id: string; generatedAt: string;
  coverage: { expected: number | null; reconciledFlows: number };
  correlation: { runId: string; sessions: Array<{ sessionId: string; traceId: string | null }> };
  summary: {
    sessionCount: number;
    observedStateCount: number;
    observedTransitionCount: number;
    artifactCount: number;
    findingCount: number;
    criticalOrHighFindings: number;
  };
};

export default function QARunDetailPage() {
  const runId = String(useParams<{ id: string }>().id);
  const run = useQuery<RunDetail>({
    queryKey: ["qa-run", runId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api-gateway/qa-runs/${runId}`);
      if (!response.ok) throw new Error("Unable to load QA run");
      return response.json();
    },
  });
  const report = useQuery<Report>({
    queryKey: ["qa-run-report", runId],
    enabled: run.data?.status === "COMPLETED",
    queryFn: async () => {
      const response = await authenticatedFetch(`/api-gateway/qa-runs/${runId}/report`);
      if (!response.ok) throw new Error("Unable to load QA report");
      return response.json();
    },
  });

  if (run.isLoading) return <div className="animate-pulse text-neutral-400">Loading run evidence…</div>;
  if (run.error || !run.data) return <div className="text-red-400">{(run.error as Error)?.message ?? "Run not found"}</div>;
  const detail = run.data;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-emerald-400"><ShieldCheck className="h-4 w-4" /> {detail.status}</div>
        <h1 className="mt-2 text-3xl font-bold">QA Run report</h1>
        <p className="mt-1 text-sm text-neutral-400">{detail.environment.name} · {detail.targetUrl}</p>
        <p className="mt-2 font-mono text-xs text-neutral-600">{detail.id}</p>
      </div>
      {report.data ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Expected coverage", report.data.coverage.expected == null ? "Pending intent" : `${report.data.coverage.expected.toFixed(1)}%`],
            ["Observed sessions", report.data.summary.sessionCount],
            ["Observed states", report.data.summary.observedStateCount],
            ["Observed transitions", report.data.summary.observedTransitionCount],
            ["Approved artifacts", report.data.summary.artifactCount],
            ["High-priority findings", report.data.summary.criticalOrHighFindings],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5"><div className="text-xs text-neutral-500">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></div>)}
        </section>
      ) : null}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-5 w-5" /> Findings</h2>
        <div className="space-y-3">
          {detail.findings.map((finding) => <article key={finding.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5"><div className="flex gap-2 text-xs"><span className="text-amber-400">{finding.severity}</span><span className="text-neutral-500">{finding.category}</span></div><h3 className="mt-2 font-medium">{finding.title}</h3><p className="mt-1 text-sm text-neutral-400">{finding.description}</p></article>)}
          {!detail.findings.length ? <p className="rounded-xl border border-neutral-800 p-5 text-sm text-neutral-500">No browser findings were captured.</p> : null}
        </div>
      </section>
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Camera className="h-5 w-5" /> Approved artifacts</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {detail.artifacts.map((artifact) => <div key={artifact.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"><FileArchive className="h-5 w-5 text-blue-400" /><div className="mt-3 text-sm font-medium">{artifact.artifactType}</div><div className="mt-1 text-xs text-neutral-500">{Number(artifact.bytes).toLocaleString()} bytes</div></div>)}
        </div>
      </section>
      {report.data?.correlation.sessions.length ? <section><h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Route className="h-5 w-5" /> Correlation</h2><pre className="overflow-auto rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-xs text-neutral-400">{JSON.stringify(report.data.correlation, null, 2)}</pre></section> : null}
    </div>
  );
}
