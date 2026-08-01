"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, FileSearch, Laptop } from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSelectedApplication } from "@/hooks/use-selected-application";
import { ApplicationRequiredState } from "@/components/application-required-state";

type QARun = {
  id: string;
  status: string;
  mode: string;
  targetUrl: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  environment: { name: string; type: string };
  _count: { artifacts: number; findings: number };
};

export default function QARunsPage() {
  const { appId, selectedOrgId, isLoading: loadingApplication } = useSelectedApplication();
  const runs = useQuery<QARun[]>({
    queryKey: ["qa-runs", appId],
    enabled: Boolean(appId),
    queryFn: async () => {
      const response = await authenticatedFetch(`/api-gateway/applications/${appId}/qa-runs`);
      if (!response.ok) throw new Error("Unable to load QA runs");
      return response.json();
    },
  });

  if (!selectedOrgId) return <div className="text-neutral-400">Select an organization to view QA runs.</div>;
  if (loadingApplication) return <div className="animate-pulse text-neutral-400">Loading application…</div>;
  if (!appId) return <ApplicationRequiredState feature="QA runs" />;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-blue-400"><Laptop className="h-4 w-4" /> Browser-first quality assurance</div>
        <h1 className="mt-2 text-3xl font-bold">QA Runs</h1>
        <p className="mt-1 text-sm text-neutral-400">Guided desktop runs, captured evidence, findings, reconciliation, and reports.</p>
      </div>
      {runs.isLoading ? <div className="animate-pulse text-neutral-400">Loading QA runs…</div> : null}
      {runs.error ? <div className="text-red-400">{(runs.error as Error).message}</div> : null}
      <div className="grid gap-3">
        {(runs.data ?? []).map((run) => (
          <Link key={run.id} href={`/qa-runs/${run.id}`} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 transition hover:border-neutral-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <span className="font-medium">{run.environment.name}</span>
                  <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">{run.environment.type}</span>
                </div>
                <p className="mt-2 truncate text-sm text-neutral-400">{run.targetUrl}</p>
                <p className="mt-2 text-xs text-neutral-500">{new Date(run.createdAt).toLocaleString()} · {run.id}</p>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300">{run.status}</span>
                <div className="mt-3 flex gap-3 text-xs text-neutral-500">
                  <span><FileSearch className="mr-1 inline h-3 w-3" />{run._count.artifacts} artifacts</span>
                  <span><AlertTriangle className="mr-1 inline h-3 w-3" />{run._count.findings} findings</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {!runs.isLoading && !runs.data?.length ? (
        <div className="rounded-xl border border-dashed border-neutral-800 p-12 text-center text-neutral-400">
          No guided runs yet. Open Tellann Desktop to receive your first report without installing an SDK.
        </div>
      ) : null}
    </div>
  );
}
