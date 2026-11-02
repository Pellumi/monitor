"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSelectedApplication } from "@/hooks/use-selected-application";
import { ApplicationRequiredState } from "@/components/application-required-state";

/**
 * Where a developer declares an autonomous run's goal from the dashboard.
 *
 * Unlike every other QA run mode, this one is a real, session-authenticated form submission —
 * not a `tellann://` deep link. `qa-run-handoff.ts` deliberately keeps action-performing modes off
 * that untrusted link path; an autonomous run is the most consequential mode of all, so it gets
 * its own explicit-confirmation flow instead of being squeezed into that one. No browser is opened
 * by this submission: it only records the goal and budget. The desktop that owns this application
 * picks the goal up, plans against its own locally-mapped Flow, and a person there approves the
 * plan before anything runs — this page's job ends at "the goal now exists."
 */

type QAEnvironment = { id: string; name: string; type: string; baseUrl: string | null; isDefault: boolean };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
  return payload as T;
}

export default function NewAutonomousRunPage() {
  const params = useParams<{ appId: string }>();
  const appId = params.appId;
  const router = useRouter();
  const { selectedOrgId, isLoading: loadingApplication } = useSelectedApplication();

  const environments = useQuery<QAEnvironment[]>({
    queryKey: ["qa-run-handoff-environments", appId],
    queryFn: () => json<QAEnvironment[]>(`/api-gateway/applications/${appId}/environments`),
    enabled: Boolean(appId),
  });

  const [environmentId, setEnvironmentId] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxActions, setMaxActions] = useState(50);
  const [maxModelCalls, setMaxModelCalls] = useState(30);
  const [maxDurationMinutes, setMaxDurationMinutes] = useState(30);

  const selectedEnvironment = environments.data?.find((environment) => environment.id === environmentId)
    ?? environments.data?.find((environment) => environment.isDefault)
    ?? environments.data?.[0];
  const effectiveEnvironmentId = environmentId || selectedEnvironment?.id || "";
  const effectiveTargetUrl = targetUrl || selectedEnvironment?.baseUrl || "";
  const isProduction = selectedEnvironment?.type === "PRODUCTION";

  const create = useMutation({
    mutationFn: () =>
      json<{ runId: string; autonomousRunId: string; status: string }>(
        `/api-gateway/applications/${appId}/autonomous-runs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            environmentId: effectiveEnvironmentId,
            targetUrl: effectiveTargetUrl,
            goal: goal.trim(),
            maxActions,
            maxModelCalls,
            maxDurationMs: maxDurationMinutes * 60_000,
          }),
        },
      ),
    onSuccess: () => router.push(`/qa-runs?appId=${appId}`),
  });

  if (!selectedOrgId) return <div className="font-mono text-sm text-[#8e9192]">Select an organization to declare an autonomous run.</div>;
  if (loadingApplication) return <div className="animate-pulse text-[#8e9192]">Loading…</div>;
  if (!appId) return <ApplicationRequiredState feature="Autonomous QA runs" />;

  const canSubmit = Boolean(effectiveEnvironmentId && effectiveTargetUrl && goal.trim().length > 0 && !isProduction);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href={`/qa-runs?appId=${appId}`} className="inline-flex items-center gap-2 text-sm text-[#8e9192] transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to QA runs
        </Link>
        <div className="mt-4 flex items-center gap-2 text-sm text-blue-400">
          <Sparkles className="h-4 w-4" /> Autonomous run
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Declare a goal</h1>
        <p className="mt-1 text-sm text-[#c4c7c8]">
          Describe what you want tested, in plain English. This only records the goal — nothing is driven from
          here. A desktop connected to this application picks it up, plans against the Flow you&apos;ve already
          mapped, and a person there reviews and approves the plan before anything runs.
        </p>
      </div>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) create.mutate();
        }}
      >
        <div className="space-y-2">
          <label htmlFor="environment" className="block text-xs font-semibold uppercase tracking-wider text-[#8e9192]">
            Environment
          </label>
          <select
            id="environment"
            value={effectiveEnvironmentId}
            onChange={(event) => setEnvironmentId(event.target.value)}
            className="w-full rounded-md border border-[#262626] bg-[#131313] px-3 py-2 text-sm text-white"
          >
            <option value="" disabled>Choose an environment</option>
            {(environments.data ?? []).map((environment) => (
              <option key={environment.id} value={environment.id}>{environment.name} ({environment.type})</option>
            ))}
          </select>
          {isProduction ? (
            <p className="text-sm text-amber-400">
              Production environments support observation only. Choose a staging or development environment for an autonomous run.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="targetUrl" className="block text-xs font-semibold uppercase tracking-wider text-[#8e9192]">
            Target URL
          </label>
          <input
            id="targetUrl"
            type="url"
            required
            value={effectiveTargetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            placeholder="http://localhost:3000"
            className="w-full rounded-md border border-[#262626] bg-[#131313] px-3 py-2 font-mono text-sm text-white"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="goal" className="block text-xs font-semibold uppercase tracking-wider text-[#8e9192]">
            Goal
          </label>
          <textarea
            id="goal"
            required
            maxLength={2000}
            rows={4}
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Register a new account, verify the welcome email arrives, and reach the dashboard. Also test an invalid login."
            className="w-full rounded-md border border-[#262626] bg-[#131313] px-3 py-2 text-sm text-white"
          />
          <p className="text-xs text-[#5a5a5a]">{goal.length}/2000</p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="text-xs font-semibold uppercase tracking-wider text-[#8e9192] transition hover:text-white"
          >
            {showAdvanced ? "Hide" : "Show"} budget limits
          </button>
          {showAdvanced ? (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="maxActions" className="block text-[11px] text-[#8e9192]">Max actions</label>
                <input
                  id="maxActions" type="number" min={1} max={500} value={maxActions}
                  onChange={(event) => setMaxActions(Number(event.target.value))}
                  className="w-full rounded-md border border-[#262626] bg-[#131313] px-2 py-1.5 text-sm text-white"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="maxModelCalls" className="block text-[11px] text-[#8e9192]">Max model calls</label>
                <input
                  id="maxModelCalls" type="number" min={1} max={200} value={maxModelCalls}
                  onChange={(event) => setMaxModelCalls(Number(event.target.value))}
                  className="w-full rounded-md border border-[#262626] bg-[#131313] px-2 py-1.5 text-sm text-white"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="maxDurationMinutes" className="block text-[11px] text-[#8e9192]">Max minutes</label>
                <input
                  id="maxDurationMinutes" type="number" min={1} max={60} value={maxDurationMinutes}
                  onChange={(event) => setMaxDurationMinutes(Number(event.target.value))}
                  className="w-full rounded-md border border-[#262626] bg-[#131313] px-2 py-1.5 text-sm text-white"
                />
              </div>
            </div>
          ) : null}
        </div>

        {create.error ? (
          <p role="alert" className="text-sm text-red-400">{(create.error as Error).message}</p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || create.isPending}
          className="inline-flex items-center gap-2 rounded bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Declare goal
        </button>
      </form>
    </div>
  );
}
