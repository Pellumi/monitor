"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, Laptop, Loader2, RefreshCw, Settings2, Terminal, TriangleAlert } from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Target = {
  id: "frontend" | "backend";
  kind: "FRONTEND" | "BACKEND";
  label: string;
  packageName: string;
  installCommands: Record<string, string>;
  environmentVariables: Record<string, string>;
  snippet: string;
};
type Descriptor = {
  applicationId: string;
  applicationName: string;
  organizationId: string;
  environmentId: string;
  environmentName: string;
  environmentType: string;
  baseUrl: string | null;
  gatewayEndpoint: string;
  gatewayEndpointCustomized: boolean;
  hasActiveKey: boolean;
  keyPrefix: string | null;
  targets: Target[];
  readiness: {
    connected: boolean;
    readyForDemonstration: boolean;
    sessionObserved: boolean;
    eventObserved: boolean;
    installationTestPassed: boolean;
    targets: Array<{ targetId: string; verified: boolean; lastEventAt: string | null }>;
  };
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
  return payload as T;
}

const DASHBOARD_GATEWAY_URL = (process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "").replace(/\/$/, "");

function isLoopbackUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

/**
 * The onboarding service embeds http://localhost:3000 into the descriptor whenever
 * TELLANN_PUBLIC_GATEWAY_URL is unset for its own deployment. A hosted dashboard must still
 * hand users a reachable telemetry origin, so prefer a customised endpoint, then the
 * dashboard's configured gateway URL, then its own origin, before showing a loopback address.
 */
function resolveGatewayEndpoint(descriptor: Descriptor): string {
  if (descriptor.gatewayEndpointCustomized) return descriptor.gatewayEndpoint;
  if (!isLoopbackUrl(descriptor.gatewayEndpoint)) return descriptor.gatewayEndpoint;
  if (DASHBOARD_GATEWAY_URL && !isLoopbackUrl(DASHBOARD_GATEWAY_URL)) return DASHBOARD_GATEWAY_URL;
  if (typeof window !== "undefined" && !isLoopbackUrl(window.location.origin)) return window.location.origin;
  return descriptor.gatewayEndpoint;
}

type FrameworkId =
  | "nextjs"
  | "react-vite"
  | "react-cra"
  | "sveltekit"
  | "vanilla"
  | "node"
  | "nextjs-server"
  | "deno";

type SnippetContext = { packageName: string; endpoint: string; applicationId: string; environmentId: string };

type FrameworkOption = {
  id: FrameworkId;
  label: string;
  kind: "FRONTEND" | "BACKEND";
  envVars: { url: string; key: string } | null;
  build: (ctx: SnippetContext) => string;
};

function frontendSnippet(opts: {
  ctx: SnippetContext;
  comment: string;
  urlExpr: string;
  keyExpr: string;
  extraImport?: string;
}): string {
  const lines = [`import { TELLANN } from '${opts.ctx.packageName}';`];
  if (opts.extraImport) lines.push(opts.extraImport);
  lines.push(
    "",
    opts.comment,
    "TELLANN.initialize({",
    `    endpoint: ${opts.urlExpr},`,
    `    apiKey: ${opts.keyExpr},`,
    `    applicationId: '${opts.ctx.applicationId}',`,
    `    environmentId: '${opts.ctx.environmentId}'`,
    "});",
    "",
    "void TELLANN.verifyInstallation();",
  );
  return lines.join("\n");
}

const FRAMEWORKS: FrameworkOption[] = [
  {
    id: "nextjs",
    label: "Next.js",
    kind: "FRONTEND",
    envVars: { url: "NEXT_PUBLIC_TELLANN_GATEWAY_URL", key: "NEXT_PUBLIC_TELLANN_INGESTION_KEY" },
    build: (ctx) =>
      frontendSnippet({
        ctx,
        comment: "// Initialize Tellann browser telemetry (root client component or instrumentation-client.ts)",
        urlExpr: `process.env.NEXT_PUBLIC_TELLANN_GATEWAY_URL || '${ctx.endpoint}'`,
        keyExpr: "process.env.NEXT_PUBLIC_TELLANN_INGESTION_KEY",
      }),
  },
  {
    id: "react-vite",
    label: "Vite (React / Vue / Svelte)",
    kind: "FRONTEND",
    envVars: { url: "VITE_TELLANN_GATEWAY_URL", key: "VITE_TELLANN_INGESTION_KEY" },
    build: (ctx) =>
      frontendSnippet({
        ctx,
        comment: "// Initialize once from your entry file (main.tsx / main.ts), outside any component",
        urlExpr: `import.meta.env.VITE_TELLANN_GATEWAY_URL || '${ctx.endpoint}'`,
        keyExpr: "import.meta.env.VITE_TELLANN_INGESTION_KEY",
      }),
  },
  {
    id: "react-cra",
    label: "Create React App",
    kind: "FRONTEND",
    envVars: { url: "REACT_APP_TELLANN_GATEWAY_URL", key: "REACT_APP_TELLANN_INGESTION_KEY" },
    build: (ctx) =>
      frontendSnippet({
        ctx,
        comment: "// Initialize once from src/index.tsx, outside any component",
        urlExpr: `process.env.REACT_APP_TELLANN_GATEWAY_URL || '${ctx.endpoint}'`,
        keyExpr: "process.env.REACT_APP_TELLANN_INGESTION_KEY",
      }),
  },
  {
    id: "sveltekit",
    label: "SvelteKit",
    kind: "FRONTEND",
    envVars: { url: "PUBLIC_TELLANN_GATEWAY_URL", key: "PUBLIC_TELLANN_INGESTION_KEY" },
    build: (ctx) =>
      frontendSnippet({
        ctx,
        extraImport: "import { env } from '$env/dynamic/public';",
        comment: "// Initialize from hooks.client.ts (or a root +layout.svelte module script)",
        urlExpr: `env.PUBLIC_TELLANN_GATEWAY_URL || '${ctx.endpoint}'`,
        keyExpr: "env.PUBLIC_TELLANN_INGESTION_KEY",
      }),
  },
  {
    id: "vanilla",
    label: "Vanilla / other",
    kind: "FRONTEND",
    envVars: null,
    build: (ctx) =>
      frontendSnippet({
        ctx,
        comment: "// Initialize Tellann browser telemetry as early as possible in your app bootstrap",
        urlExpr: `'${ctx.endpoint}'`,
        keyExpr: "'YOUR_API_KEY'",
      }),
  },
  {
    id: "node",
    label: "Node.js (Express / Fastify / Nest)",
    kind: "BACKEND",
    envVars: { url: "TELLANN_GATEWAY_URL", key: "TELLANN_INGESTION_KEY" },
    build: (ctx) =>
      [
        `import { TELLANN } from '${ctx.packageName}';`,
        "",
        "// Initialize before your HTTP server starts — keep this at the very top of your entry file",
        "TELLANN.initialize({",
        `    endpoint: process.env.TELLANN_GATEWAY_URL || '${ctx.endpoint}',`,
        "    apiKey: process.env.TELLANN_INGESTION_KEY,",
        `    applicationId: '${ctx.applicationId}',`,
        `    environmentId: '${ctx.environmentId}'`,
        "});",
        "",
        "await TELLANN.verifyInstallation();",
      ].join("\n"),
  },
  {
    id: "nextjs-server",
    label: "Next.js (server)",
    kind: "BACKEND",
    envVars: { url: "TELLANN_GATEWAY_URL", key: "TELLANN_INGESTION_KEY" },
    build: (ctx) =>
      [
        `import { TELLANN } from '${ctx.packageName}';`,
        "",
        "// Call from register() in instrumentation.ts so it runs once per server process",
        "export async function register() {",
        "    TELLANN.initialize({",
        `        endpoint: process.env.TELLANN_GATEWAY_URL || '${ctx.endpoint}',`,
        "        apiKey: process.env.TELLANN_INGESTION_KEY,",
        `        applicationId: '${ctx.applicationId}',`,
        `        environmentId: '${ctx.environmentId}'`,
        "    });",
        "    await TELLANN.verifyInstallation();",
        "}",
      ].join("\n"),
  },
  {
    id: "deno",
    label: "Deno",
    kind: "BACKEND",
    envVars: { url: "TELLANN_GATEWAY_URL", key: "TELLANN_INGESTION_KEY" },
    build: (ctx) =>
      [
        `import { TELLANN } from 'npm:${ctx.packageName}';`,
        "",
        "// Initialize before your server starts. Run with --allow-env --allow-net",
        "TELLANN.initialize({",
        `    endpoint: Deno.env.get('TELLANN_GATEWAY_URL') ?? '${ctx.endpoint}',`,
        "    apiKey: Deno.env.get('TELLANN_INGESTION_KEY'),",
        `    applicationId: '${ctx.applicationId}',`,
        `    environmentId: '${ctx.environmentId}'`,
        "});",
        "",
        "await TELLANN.verifyInstallation();",
      ].join("\n"),
  },
];

const DEFAULT_FRAMEWORK: Record<"FRONTEND" | "BACKEND", FrameworkId> = { FRONTEND: "nextjs", BACKEND: "node" };

function GatewaySettings({ descriptor, fallbackEndpoint, onSaved }: { descriptor: Descriptor; fallbackEndpoint: string; onSaved: () => void }) {
  const [customized, setCustomized] = useState(descriptor.gatewayEndpointCustomized);
  const [endpoint, setEndpoint] = useState(descriptor.gatewayEndpointCustomized ? descriptor.gatewayEndpoint : "");
  const save = useMutation({
    mutationFn: () => json(`/api-gateway/applications/${descriptor.applicationId}/environments/${descriptor.environmentId}/sdk-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telemetryGatewayUrl: customized ? endpoint : null }),
    }),
    onSuccess: onSaved,
  });

  return (
    <details className="rounded border border-[#262626] bg-black">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#8e9192] hover:text-white">
        <Settings2 className="h-3.5 w-3.5" />
        Advanced configuration
      </summary>
      <div className="space-y-4 border-t border-[#262626] px-4 py-4">
        <div>
          <p className="text-sm font-medium text-white">Telemetry destination</p>
          <p className="mt-1 text-xs leading-relaxed text-[#8e9192]">
            Tellann Cloud selects this automatically. Change it only when using a self-hosted gateway, regional endpoint, or corporate telemetry relay.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm text-[#c4c7c8]">
          <input
            type="checkbox"
            checked={customized}
            onChange={(event) => setCustomized(event.target.checked)}
            className="h-4 w-4 accent-white"
          />
          Use a custom gateway endpoint
        </label>
        <div>
          <label htmlFor="telemetry-gateway-url" className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-[#8e9192]">
            Gateway URL
          </label>
          <input
            id="telemetry-gateway-url"
            type="url"
            value={customized ? endpoint : fallbackEndpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            disabled={!customized}
            placeholder="https://telemetry.example.com"
            className="w-full rounded border border-[#262626] bg-[#131313] px-3 py-2 font-mono text-xs text-white disabled:cursor-not-allowed disabled:text-[#666] focus:border-[#666] focus:outline-none"
          />
          <p className="mt-2 font-mono text-[11px] text-[#666]">HTTPS is required. Localhost may use HTTP for development.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" onClick={() => save.mutate()} disabled={save.isPending || (customized && !endpoint.trim())}>
            {save.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Save destination
          </Button>
          {save.isSuccess ? <span className="font-mono text-[11px] text-[#8e9192]">Saved</span> : null}
        </div>
        {save.error ? <p className="font-mono text-xs text-red-400">{save.error.message}</p> : null}
      </div>
    </details>
  );
}

export default function ConnectApplicationPage() {
  const { appId } = useParams<{ appId: string }>();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"choice" | "manual" | "desktop">("choice");
  const [targetId, setTargetId] = useState<"frontend" | "backend">("frontend");
  const [framework, setFramework] = useState<FrameworkId>("nextjs");
  const [manager, setManager] = useState("pnpm");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<{ deepLink: string; handoffToken: string; expiresAt: string } | null>(null);
  const marketingUrl = (process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3020").replace(/\/$/, "");

  const setup = useQuery<Descriptor>({
    queryKey: ["sdk-setup", appId],
    queryFn: () => json(`/api-gateway/applications/${appId}/sdk-setup`),
    enabled: Boolean(appId),
    refetchInterval: (query) => query.state.data?.readiness.connected ? false : document.hidden ? 15_000 : 3_000,
    refetchIntervalInBackground: false,
  });

  const selectMethod = useMutation({
    mutationFn: (method: "MANUAL" | "DESKTOP") => json(`/api-gateway/applications/${appId}/sdk-setup/method`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method }) }),
  });
  const createKey = useMutation({
    mutationFn: () => json<{ rawKey: string }>(`/api-gateway/applications/${appId}/sdk-setup/key`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ environmentId: setup.data?.environmentId }) }),
    onSuccess: (result) => { setRawKey(result.rawKey); void queryClient.invalidateQueries({ queryKey: ["sdk-setup", appId] }); },
  });
  const createHandoff = useMutation({
    mutationFn: () => json<{ deepLink: string; handoffToken: string; expiresAt: string }>(`/api-gateway/applications/${appId}/sdk-setup/handoffs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ environmentId: setup.data?.environmentId }) }),
    onSuccess: (result) => { setHandoff(result); window.location.href = result.deepLink; },
  });

  const target = useMemo(() => setup.data?.targets.find((item) => item.id === targetId), [setup.data, targetId]);
  const targetKind = target?.kind ?? "FRONTEND";
  const frameworkOptions = useMemo(() => FRAMEWORKS.filter((item) => item.kind === targetKind), [targetKind]);
  const activeFramework = frameworkOptions.find((item) => item.id === framework) ?? frameworkOptions[0];
  const resolvedEndpoint = setup.data ? resolveGatewayEndpoint(setup.data) : "";
  const snippet =
    target && setup.data && activeFramework
      ? activeFramework
          .build({
            packageName: target.packageName,
            endpoint: resolvedEndpoint,
            applicationId: setup.data.applicationId,
            environmentId: setup.data.environmentId,
          })
          .replace(/YOUR_API_KEY/g, rawKey ?? "YOUR_API_KEY")
      : "";
  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1_500);
  };

  if (setup.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center font-mono text-xs uppercase tracking-wider text-[#8e9192]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
        Loading Connection Setup…
      </div>
    );
  }
  if (setup.error || !setup.data) {
    return (
      <div className="mx-auto mt-16 max-w-xl rounded-md border border-[#262626] bg-[#131313] p-6 font-mono text-xs text-white">
        <TriangleAlert className="mb-3 h-5 w-5 text-white" />
        {setup.error?.message ?? "SDK setup is unavailable."}
      </div>
    );
  }

  const descriptor = setup.data;
  return (
    <main className="mx-auto w-full space-y-6 pb-16">
      {/* Top Header Card */}
      <section className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Connect {descriptor.applicationName}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-[#c4c7c8]">
            Connect a browser application, backend service, or both. One verified SDK is enough to continue; connecting both gives end-to-end workflow and endpoint intelligence.
          </p>
        </div>

        {/* Readiness Table */}
        <table className="w-full border-collapse border border-[#262626] bg-black">
          <tbody>
            <tr>
              <td className="border-b border-[#262626] px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#8e9192]">
                ENVIRONMENT
              </td>
              <td className="border-b border-[#262626] px-3 py-2.5 text-right font-mono text-[13px] text-white">
                {descriptor.environmentName} ({descriptor.environmentType})
              </td>
            </tr>
            <tr>
              <td className="border-b border-[#262626] px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#8e9192]">
                SESSION OBSERVED
              </td>
              <td className="border-b border-[#262626] px-3 py-2.5 text-right font-mono text-[13px] text-white">
                {descriptor.readiness.sessionObserved ? (
                  <span className="text-white">✓ YES</span>
                ) : (
                  <span className="text-[#8e9192]">NO</span>
                )}
              </td>
            </tr>
            <tr>
              <td className="border-b border-[#262626] px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#8e9192]">
                EVENT OBSERVED
              </td>
              <td className="border-b border-[#262626] px-3 py-2.5 text-right font-mono text-[13px] text-white">
                {descriptor.readiness.eventObserved ? (
                  <span className="text-white">✓ YES</span>
                ) : (
                  <span className="text-[#8e9192]">NO</span>
                )}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#8e9192]">
                INSTALLATION VERIFIED
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-[13px] text-white">
                {descriptor.readiness.installationTestPassed ? (
                  <span className="text-white">✓ VERIFIED</span>
                ) : (
                  <span className="text-[#8e9192]">WAITING</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <GatewaySettings
          key={`${descriptor.environmentId}:${resolvedEndpoint}:${descriptor.gatewayEndpointCustomized}`}
          descriptor={descriptor}
          fallbackEndpoint={resolvedEndpoint}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ["sdk-setup", appId] })}
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => void setup.refetch()}
              disabled={setup.isFetching}
              className={`inline-flex items-center gap-2 rounded border font-mono text-xs uppercase tracking-wider px-4 py-2 transition-all ${
                setup.isFetching
                  ? "border-neutral-400 bg-[#1c1c1c] text-white opacity-90 cursor-not-allowed"
                  : "border-[#444748] bg-black text-[#8e9192] hover:border-neutral-400 hover:text-white"
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${setup.isFetching ? "animate-spin text-white" : ""}`} />
              {setup.isFetching ? "Checking connection…" : "Check connection now"}
            </button>
            {setup.isFetching ? (
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#8e9192] animate-pulse">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                Polling status…
              </span>
            ) : null}
          </div>
          {descriptor.readiness.connected ? (
            <Link
              className="inline-block rounded bg-white px-5 py-2.5 font-semibold text-xs uppercase tracking-[0.08em] text-black hover:bg-[#e2e2e2] transition-colors"
              href={`/qa-runs/new?appId=${appId}`}
            >
              Run Walkthrough →
            </Link>
          ) : null}
        </div>
      </section>

      {/* Choice Cards */}
      {!descriptor.readiness.connected && mode === "choice" ? (
        <div className="grid gap-5 md:grid-cols-2">
          <button
            onClick={() => {
              setMode("desktop");
              selectMethod.mutate("DESKTOP");
            }}
            className="group rounded-md border border-[#262626] bg-[#131313] p-6 text-left transition-colors hover:border-[#444748]"
          >
            <div className="flex items-center justify-between">
              <Laptop className="h-6 w-6 text-white" />
              <span className="border border-[#444748] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#8e9192]">
                RECOMMENDED
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">Set up automatically with Desktop</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#c4c7c8]">
              Attach your project folder. Tellann detects supported frontend and backend targets, shows every file and command for one approval, then installs, validates, starts, and verifies them.
            </p>
            <span className="mt-6 inline-block font-mono text-xs uppercase tracking-wider text-white group-hover:underline">
              Automatic desktop task →
            </span>
          </button>

          <button
            onClick={() => {
              setMode("manual");
              selectMethod.mutate("MANUAL");
            }}
            className="group rounded-md border border-[#262626] bg-[#131313] p-6 text-left transition-colors hover:border-[#444748]"
          >
            <div className="flex items-center justify-between">
              <Terminal className="h-6 w-6 text-white" />
              <span className="border border-[#444748] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#8e9192]">
                MANUAL
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">Set up manually</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#c4c7c8]">
              Choose frontend or backend, install the package, add environment variables and paste the initialization code. Tellann verifies the connection here.
            </p>
            <span className="mt-6 inline-block font-mono text-xs uppercase tracking-wider text-[#8e9192] group-hover:text-white group-hover:underline">
              View manual instructions →
            </span>
          </button>
        </div>
      ) : null}

      {/* Desktop Mode */}
      {!descriptor.readiness.connected && mode === "desktop" ? (
        <section className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-6">
          <div className="border-b border-[#262626] pb-4">
            <h2 className="text-xl font-semibold text-white">Continue in Tellann Desktop</h2>
            <p className="mt-2 text-sm text-[#c4c7c8]">
              The handoff contains only a short-lived, one-time identifier. Your ingestion key and source code are never placed in the link.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => createHandoff.mutate()}
              disabled={createHandoff.isPending}
              className="inline-flex items-center gap-2 rounded bg-white px-5 py-3 font-semibold text-xs uppercase tracking-[0.08em] text-black hover:bg-[#e2e2e2] disabled:opacity-50 transition-colors"
            >
              {createHandoff.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Laptop className="h-4 w-4" />
              )}
              Open Tellann Desktop
            </button>
            <a
              className="inline-flex items-center gap-2 rounded border border-[#444748] bg-black px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#c4c7c8] hover:text-white hover:border-neutral-500 transition-colors"
              href={`${marketingUrl}/desktop${handoff ? `?handoff=${encodeURIComponent(handoff.handoffToken)}` : ""}`}
            >
              <Download className="h-4 w-4" />
              Download Desktop
            </a>
            <button
              onClick={() => setMode("manual")}
              className="inline-flex items-center rounded border border-transparent px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#8e9192] hover:text-white transition-colors"
            >
              Use Manual Setup
            </button>
          </div>
          {createHandoff.error ? (
            <p className="font-mono text-xs text-red-400">{createHandoff.error.message}</p>
          ) : null}
        </section>
      ) : null}

      {/* Manual Mode */}
      {!descriptor.readiness.connected && mode === "manual" ? (
        <section className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#262626] pb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Manual SDK Setup</h2>
              <p className="mt-1 font-mono text-xs text-[#8e9192]">Use either SDK or configure both.</p>
            </div>
            <button
              onClick={() => setMode("desktop")}
              className="inline-flex items-center gap-2 rounded border border-[#444748] bg-black px-4 py-2 font-mono text-xs uppercase tracking-wider text-[#8e9192] hover:text-white hover:border-neutral-500 transition-colors"
            >
              <Laptop className="h-3.5 w-3.5" />
              Automate with Desktop
            </button>
          </div>

          <div className="flex gap-2">
            {descriptor.targets.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setTargetId(item.id);
                  setFramework(DEFAULT_FRAMEWORK[item.kind]);
                }}
                className={`rounded px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                  targetId === item.id
                    ? "bg-white text-black font-semibold"
                    : "border border-[#262626] bg-black text-[#8e9192] hover:border-[#444748] hover:text-white"
                }`}
              >
                {item.kind === "FRONTEND" ? "Frontend / Browser" : "Backend / Node.js"}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#8e9192]">
                  Framework
                </label>
                <Select value={activeFramework?.id ?? ""} onValueChange={(value) => setFramework(value as FrameworkId)}>
                  <SelectTrigger className="font-mono text-xs">
                    <SelectValue placeholder="Select framework">{activeFramework?.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {frameworkOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="font-mono text-xs">
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#8e9192]">
                  Package Manager
                </label>
                <Select value={manager} onValueChange={setManager}>
                  <SelectTrigger className="font-mono text-xs">
                    <SelectValue placeholder="Select package manager">{manager}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {["pnpm", "npm", "yarn", "bun"].map((item) => (
                      <SelectItem key={item} value={item} className="font-mono text-xs">
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <CodeBox
                title="1. Install Package"
                value={target?.installCommands[manager] ?? ""}
                copied={copied === "install"}
                onCopy={() => void copy("install", target?.installCommands[manager] ?? "")}
              />

              <div className="rounded border border-[#262626] bg-black p-4 font-mono text-xs leading-relaxed text-[#8e9192]">
                Store the Development ingestion key in an ignored local environment file. Never commit it.
              </div>

              {rawKey ? (
                <CodeBox
                  title="2. One-time Ingestion Key"
                  value={rawKey}
                  copied={copied === "key"}
                  onCopy={() => void copy("key", rawKey)}
                />
              ) : (
                <button
                  onClick={() => createKey.mutate()}
                  disabled={createKey.isPending}
                  className="w-full rounded bg-white px-5 py-3 font-semibold text-xs uppercase tracking-[0.08em] text-black hover:bg-[#e2e2e2] disabled:opacity-50 transition-colors"
                >
                  {createKey.isPending
                    ? "Generating…"
                    : descriptor.hasActiveKey
                    ? "Generate Replacement Setup Key"
                    : "Generate Setup Key"}
                </button>
              )}
            </div>

            <div className="space-y-4">
              <CodeBox
                title="3. Initialize and Verify"
                value={snippet}
                copied={copied === "snippet"}
                onCopy={() => void copy("snippet", snippet)}
                multiline
              />
              {activeFramework?.envVars ? (
                <p className="font-mono text-xs leading-relaxed text-[#8e9192]">
                  Set <span className="text-white">{activeFramework.envVars.url}</span> and{" "}
                  <span className="text-white">{activeFramework.envVars.key}</span> in your environment. The URL falls
                  back to <span className="text-white">{resolvedEndpoint}</span> when unset.
                </p>
              ) : (
                <p className="font-mono text-xs leading-relaxed text-[#8e9192]">
                  This snippet reads no build-time environment variables; it posts telemetry directly to{" "}
                  <span className="text-white">{resolvedEndpoint}</span>.
                </p>
              )}
              <p className="font-mono text-xs leading-relaxed text-[#8e9192]">
                Start your application after initialization. This page will detect its session, first event, and test automatically.
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function CodeBox({
  title,
  value,
  copied,
  onCopy,
  multiline = false,
}: {
  title: string;
  value: string;
  copied: boolean;
  onCopy(): void;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-[#8e9192]">{title}</span>
        <button onClick={onCopy} className="text-[#8e9192] hover:text-white transition-colors">
          {copied ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <pre
        className={`overflow-auto rounded border border-[#262626] bg-black p-4 font-mono text-xs text-white ${
          multiline ? "min-h-64 whitespace-pre" : "whitespace-pre-wrap"
        }`}
      >
        {value}
      </pre>
    </div>
  );
}
