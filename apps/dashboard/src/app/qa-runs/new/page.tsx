"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Laptop, Plug, Workflow } from "lucide-react";
import { useSelectedApplication } from "@/hooks/use-selected-application";
import { ApplicationRequiredState } from "@/components/application-required-state";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import {
  beginQARunHandoffFunnel,
  buildQARunDesktopDeepLink,
  completeQARunHandoffFunnel,
  normalizeQARunMode,
  resolveQARunEnvironment,
  type QARunEnvironment,
} from "./qa-run-handoff";

const MARKETING_URL = (
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3020"
).replace(/\/$/, "");

/**
 * There is no browser-side "create QA run" endpoint: a demonstration is driven
 * end to end by Tellann Desktop, which holds the device-bound session that the
 * cloud API requires to open a run. This page is where every "Start
 * demonstration" call to action lands, so it hands the run off to the desktop
 * app rather than pretending the dashboard can start one.
 */
function NewQARunContent() {
  const searchParams = useSearchParams();
  const workflowId = searchParams.get("workflowId") ?? searchParams.get("flowId");
  const requestedEnvironmentId =
    searchParams.get("environmentId") ?? searchParams.get("envId");
  const requestedTargetUrl = searchParams.get("targetUrl");
  const {
    appId,
    selectedOrgId,
    isLoading: loadingApplication,
  } = useSelectedApplication();
  const environments = useQuery<QARunEnvironment[]>({
    queryKey: ["qa-run-handoff-environments", appId],
    queryFn: async () => {
      const response = await authenticatedFetch(
        `/api-gateway/applications/${appId}/environments`,
      );
      if (!response.ok) throw new Error("Failed to load QA environments");
      return response.json();
    },
    enabled: !!appId,
  });
  const selectedEnvironment = resolveQARunEnvironment(
    environments.data,
    requestedEnvironmentId,
  );
  const mode = normalizeQARunMode(
    searchParams.get("mode"),
    selectedEnvironment?.type,
  );
  const targetUrl = requestedTargetUrl || selectedEnvironment?.baseUrl || undefined;
  const desktopDeepLink = buildQARunDesktopDeepLink({
    applicationId: appId,
    environmentId: selectedEnvironment?.id,
    workflowId,
    mode,
    targetUrl,
  });
  const funnelContext = useMemo(
    () => ({
      applicationId: appId,
      environmentId: selectedEnvironment?.id,
      workflowId: workflowId ?? undefined,
      mode,
      hasTargetUrl: !!targetUrl,
    }),
    [appId, mode, selectedEnvironment?.id, targetUrl, workflowId],
  );
  const funnelStarted = useRef(false);

  useEffect(() => {
    if (!appId || environments.isLoading || funnelStarted.current) return;
    funnelStarted.current = true;
    beginQARunHandoffFunnel(funnelContext);
  }, [appId, environments.isLoading, funnelContext]);

  if (!selectedOrgId)
    return (
      <div className="text-neutral-400">
        Select an organization to start a demonstration.
      </div>
    );
  if (loadingApplication)
    return <div className="animate-pulse text-neutral-400">Loading…</div>;
  if (!appId) return <ApplicationRequiredState feature="QA runs" />;

  const appQuery = `?appId=${appId}`;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/qa-runs${appQuery}`}
          className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-neutral-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to QA runs
        </Link>
        <div className="mt-4 flex items-center gap-2 text-sm text-blue-400">
          <Laptop className="h-4 w-4" /> Browser-first quality assurance
        </div>
        <h1 className="mt-2 text-3xl font-bold">Start a demonstration</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          Demonstrations are guided from Tellann Desktop. It captures the
          browser session, evidence, and findings, then publishes the report
          back here. The dashboard can&apos;t drive a run on its own.
        </p>
      </div>

      {workflowId ? (
        <div className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
          <Workflow className="mt-0.5 h-4 w-4 text-blue-400" />
          <div>
            Continuing workflow{" "}
            <span className="font-mono text-xs text-neutral-400">
              {workflowId}
            </span>
            . Tellann Desktop will open with this workflow already selected.
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-400">
        Opening in <span className="text-neutral-200">{mode.replaceAll("_", " ").toLowerCase()}</span>
        {selectedEnvironment ? (
          <> for <span className="text-neutral-200">{selectedEnvironment.name}</span></>
        ) : null}
        {targetUrl ? (
          <> at <span className="font-mono text-xs text-neutral-300">{targetUrl}</span></>
        ) : null}
        . You can adjust these details in Desktop before capture starts.
      </div>

      <ol className="space-y-4">
        <li className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 text-xs">
              1
            </span>
            Open Tellann Desktop
          </div>
          <p className="mt-2 text-sm text-neutral-400">
            Launch the app, sign in with this workspace, and choose{" "}
            <span className="text-neutral-200">New demonstration</span>.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={desktopDeepLink}
              onClick={() => completeQARunHandoffFunnel(funnelContext)}
              className="inline-flex items-center gap-2 rounded bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-black transition-colors hover:bg-neutral-200"
            >
              <Laptop className="h-4 w-4" />
              Open Tellann Desktop
            </a>
            <a
              href={`${MARKETING_URL}/desktop`}
              className="inline-flex items-center gap-2 rounded border border-neutral-700 bg-black px-4 py-2 font-mono text-xs uppercase tracking-wider text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
            >
              <Download className="h-4 w-4" />
              Download Desktop
            </a>
          </div>
        </li>

        <li className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 text-xs">
              2
            </span>
            Not connected yet?
          </div>
          <p className="mt-2 text-sm text-neutral-400">
            If this application still needs a frontend or backend connection,
            finish that first.
          </p>
          <Link
            href={`/applications/${appId}/connect`}
            className="mt-4 inline-flex items-center gap-2 rounded border border-neutral-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-200 transition-colors hover:border-neutral-500"
          >
            <Plug className="h-4 w-4" />
            Connection setup
          </Link>
        </li>
      </ol>

      <p className="text-sm text-neutral-500">
        Runs appear on the{" "}
        <Link
          href={`/qa-runs${appQuery}`}
          className="text-neutral-300 underline hover:text-white"
        >
          QA runs
        </Link>{" "}
        list as soon as the desktop app starts capturing.
      </p>
    </div>
  );
}

export default function NewQARunPage() {
  return (
    <Suspense
      fallback={<div className="animate-pulse text-neutral-400">Loading…</div>}
    >
      <NewQARunContent />
    </Suspense>
  );
}
