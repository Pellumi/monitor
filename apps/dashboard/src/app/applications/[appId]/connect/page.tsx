"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Circle, Copy, Download, Laptop, Loader2, Play, RefreshCw, Settings2, TriangleAlert, Workflow } from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { Button } from "@/components/ui/button";

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
type DesktopDevice = {
  id: string;
  expiresAt: string;
  revokedAt: string | null;
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
        "// Initialize before your HTTP server starts, keep this at the very top of your entry file",
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

const FRAMEWORK_GROUPS: Array<{ kind: FrameworkOption["kind"]; label: string }> = [
  { kind: "FRONTEND", label: "Frontend / browser" },
  { kind: "BACKEND", label: "Backend / server" },
];

const PACKAGE_MANAGERS = ["pnpm", "npm", "yarn", "bun"];

/** Plain Node and Deno read `.env`; the framework dev servers also load `.env.local`. */
function envFileFor(framework: FrameworkId): string {
  return framework === "node" || framework === "deno" ? ".env" : ".env.local";
}

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
    <details className="rounded border border-[#262626] bg-[#0f0f0f]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#8e9192] hover:text-neutral-200">
        <Settings2 className="h-3.5 w-3.5" />
        Advanced configuration
      </summary>
      <div className="space-y-4 border-t border-[#262626] px-4 py-4">
        <div>
          <p className="text-sm font-medium text-neutral-200">Telemetry destination</p>
          <p className="mt-1 text-xs leading-relaxed text-[#8e9192]">
            Tellann Cloud selects this automatically. Change it only when using a self-hosted gateway, regional endpoint, or corporate telemetry relay.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm text-[#c4c7c8]">
          <input
            type="checkbox"
            checked={customized}
            onChange={(event) => setCustomized(event.target.checked)}
            className="h-4 w-4 accent-neutral-200"
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
            className="w-full rounded border border-[#262626] bg-[#131313] px-3 py-2 font-mono text-xs text-neutral-200 disabled:cursor-not-allowed disabled:text-[#666] focus:border-[#666] focus:outline-none"
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
  const [framework, setFramework] = useState<FrameworkId | null>(null);
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

  // A live Desktop sign-in means the app is installed, which is the only case
  // where Desktop is the faster path and earns the "Recommended" label.
  const desktopInstalled = useQuery<DesktopDevice[], Error, boolean>({
    queryKey: ["desktop-devices"],
    queryFn: () => json("/api-gateway/auth/desktop/devices"),
    select: (devices) =>
      devices.some((device) => !device.revokedAt && Date.parse(device.expiresAt) > Date.now()),
    staleTime: 60_000,
  }).data === true;

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

  // Generate the setup key on first view so it is already in the env block.
  // Only when the environment has no active key: issuing a key never revokes
  // older ones, so doing this on every visit would pile up live keys.
  const { mutate: generateKey } = createKey;
  const autoKeyRequested = useRef(false);
  const descriptorData = setup.data;
  useEffect(() => {
    if (!descriptorData || autoKeyRequested.current) return;
    if (
      descriptorData.hasActiveKey ||
      descriptorData.readiness.connected ||
      descriptorData.environmentType === "PRODUCTION"
    ) {
      return;
    }
    autoKeyRequested.current = true;
    generateKey();
  }, [descriptorData, generateKey]);

  const { mutate: recordMethod } = selectMethod;
  const methodRecorded = useRef(false);
  const chooseFramework = (id: FrameworkId) => {
    setFramework(id);
    if (methodRecorded.current) return;
    methodRecorded.current = true;
    recordMethod("MANUAL");
  };

  const activeFramework = FRAMEWORKS.find((item) => item.id === framework) ?? null;
  const target = setup.data?.targets.find((item) => item.kind === activeFramework?.kind);
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
  const installCommand =
    !target || !activeFramework
      ? ""
      : activeFramework.id === "deno"
        ? `deno add npm:${target.packageName}`
        : target.installCommands[manager] ?? "";
  const keyValue =
    rawKey ??
    (createKey.isPending
      ? "<generating…>"
      : setup.data?.hasActiveKey
        ? `<your existing ${setup.data.keyPrefix ?? "Tellann"}… key>`
        : "<generate a setup key below>");
  const envBlock = activeFramework?.envVars
    ? `${activeFramework.envVars.url}=${resolvedEndpoint}\n${activeFramework.envVars.key}=${keyValue}`
    : "";
  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1_500);
  };

  if (setup.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center font-mono text-xs uppercase tracking-wider text-[#8e9192]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-neutral-200" />
        Loading Connection Setup…
      </div>
    );
  }
  if (setup.error || !setup.data) {
    return (
      <div className="mx-auto mt-16 max-w-xl rounded-md border border-[#262626] bg-[#131313] p-6 font-mono text-xs text-neutral-200">
        <TriangleAlert className="mb-3 h-5 w-5 text-neutral-200" />
        {setup.error?.message ?? "SDK setup is unavailable."}
      </div>
    );
  }

  const descriptor = setup.data;
  const { readiness } = descriptor;
  const encodedAppId = encodeURIComponent(appId);
  const checklist = [
    {
      label: "Installed",
      done: readiness.installationTestPassed,
      doneText: "The SDK initialized and verified its installation.",
      waitingText: "Waiting for TELLANN.verifyInstallation() to reach Tellann.",
    },
    {
      label: "Key set",
      done: descriptor.hasActiveKey || Boolean(rawKey),
      doneText: rawKey
        ? "Your setup key is in the env block below."
        : `An active key${descriptor.keyPrefix ? ` (${descriptor.keyPrefix}…)` : ""} exists for this environment.`,
      waitingText: createKey.isPending ? "Generating your setup key…" : "Generate a setup key below.",
    },
    {
      label: "First event",
      done: readiness.connected,
      doneText: `Receiving telemetry from ${descriptor.environmentName}.`,
      waitingText: "Start your app and open it once.",
    },
  ];
  const currentStep = checklist.findIndex((step) => !step.done);

  return (
    <main className="mx-auto w-full space-y-6 pb-16">
      {readiness.connected ? (
        <section className="rounded-md border border-neutral-300 bg-[#131313] p-6">
          <div className="flex items-start gap-3">
            <Check className="mt-1 h-5 w-5 shrink-0 text-neutral-200" />
            <div>
              <h2 className="text-xl font-semibold text-neutral-200">Tellann is connected</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#c4c7c8]">
                Next, declare the Flow you want Tellann to check, or run a walkthrough right away.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center gap-2 rounded bg-neutral-200 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-900 transition-colors hover:bg-neutral-300"
              href={`/declare?appId=${encodedAppId}`}
            >
              <Workflow className="h-4 w-4" />
              Declare your first Flow
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded border border-[#444748] bg-[#0f0f0f] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-[#c4c7c8] transition-colors hover:border-neutral-500 hover:text-neutral-200"
              href={`/qa-runs/new?appId=${encodedAppId}`}
            >
              <Play className="h-4 w-4" />
              Run Walkthrough
            </Link>
          </div>
        </section>
      ) : null}

      {/* Header with live checklist */}
      <section className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#8e9192]">
            {descriptor.environmentName} · {descriptor.environmentType}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-200">
            Connect {descriptor.applicationName}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-[#c4c7c8]">
            Install the SDK, add your key, and start your app. This page confirms the connection on its own.
          </p>
        </div>

        <ol className="grid gap-3 sm:grid-cols-3">
          {checklist.map((step, index) => {
            const isCurrent = index === currentStep;
            return (
              <li
                key={step.label}
                className={`rounded border bg-[#0f0f0f] p-4 ${
                  step.done ? "border-neutral-300" : isCurrent ? "border-[#444748]" : "border-[#262626]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {step.done ? (
                    <Check className="h-4 w-4 shrink-0 text-neutral-200" />
                  ) : isCurrent ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#8e9192]" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-[#444748]" />
                  )}
                  <span className={`font-mono text-[11px] uppercase tracking-[0.08em] ${step.done ? "text-neutral-200" : "text-[#8e9192]"}`}>
                    {index + 1}. {step.label}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#8e9192]">
                  {step.done ? step.doneText : step.waitingText}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#8e9192]">
            {readiness.connected ? "Connection verified" : "Checking every few seconds"}
          </span>
          <button
            onClick={() => void setup.refetch()}
            disabled={setup.isFetching}
            className={`inline-flex items-center gap-2 rounded border font-mono text-xs uppercase tracking-wider px-4 py-2 transition-all ${
              setup.isFetching
                ? "border-neutral-400 bg-[#1c1c1c] text-neutral-200 opacity-90 cursor-not-allowed"
                : "border-[#444748] bg-[#0f0f0f] text-[#8e9192] hover:border-neutral-400 hover:text-neutral-200"
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${setup.isFetching ? "animate-spin text-neutral-200" : ""}`} />
            {setup.isFetching ? "Checking connection…" : "Check connection now"}
          </button>
        </div>
      </section>

      {/* Desktop, as the alternative path */}
      <section className="rounded-md border border-[#262626] bg-[#131313] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Laptop className="mt-0.5 h-5 w-5 shrink-0 text-neutral-200" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-neutral-200">Prefer automatic setup? Use Tellann Desktop</h2>
                {desktopInstalled ? (
                  <span className="border border-[#444748] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#8e9192]">
                    Recommended
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#8e9192]">
                {desktopInstalled
                  ? "Tellann Desktop is signed in on one of your devices. Attach your project folder and it detects your stack, shows every file and command for approval, then installs and verifies the SDK."
                  : "The desktop app attaches your project folder, shows every file and command for approval, then installs and verifies the SDK for you."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              onClick={() => createHandoff.mutate()}
              disabled={createHandoff.isPending}
              className={`inline-flex items-center gap-2 rounded px-4 py-2 text-xs uppercase tracking-[0.08em] transition-colors disabled:opacity-50 ${
                desktopInstalled
                  ? "bg-neutral-200 font-semibold text-neutral-900 hover:bg-neutral-300"
                  : "border border-[#444748] bg-[#0f0f0f] font-mono text-[#c4c7c8] hover:border-neutral-500 hover:text-neutral-200"
              }`}
            >
              {createHandoff.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Laptop className="h-4 w-4" />}
              Open Tellann Desktop
            </button>
            {desktopInstalled ? null : (
              <a
                className="inline-flex items-center gap-2 rounded border border-[#444748] bg-[#0f0f0f] px-4 py-2 font-mono text-xs uppercase tracking-wider text-[#c4c7c8] transition-colors hover:border-neutral-500 hover:text-neutral-200"
                href={`${marketingUrl}/desktop${handoff ? `?handoff=${encodeURIComponent(handoff.handoffToken)}` : ""}`}
              >
                <Download className="h-4 w-4" />
                Download Desktop
              </a>
            )}
          </div>
        </div>
        {createHandoff.error ? (
          <p className="mt-3 font-mono text-xs text-red-400">{createHandoff.error.message}</p>
        ) : null}
      </section>

      {/* Manual setup, open by default */}
      <section className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-8">
        <div className="space-y-4">
          <StepHeading step={1} title="What's your app built with?" />
          <div className="space-y-4 pl-9">
            {FRAMEWORK_GROUPS.map((group) => (
              <div key={group.kind}>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[#8e9192]">{group.label}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {FRAMEWORKS.filter((item) => item.kind === group.kind).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => chooseFramework(item.id)}
                      aria-pressed={framework === item.id}
                      className={`rounded border px-3 py-2.5 text-left font-mono text-xs transition-colors ${
                        framework === item.id
                          ? "border-neutral-300 bg-[#0f0f0f] font-semibold text-neutral-200"
                          : "border-[#262626] bg-[#0f0f0f] text-[#8e9192] hover:border-[#444748] hover:text-neutral-200"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {activeFramework && target ? (
          <>
            <div className="space-y-4">
              <StepHeading step={2} title="Install the package" />
              <div className="space-y-3 pl-9">
                {activeFramework.id === "deno" ? null : (
                  <div className="flex flex-wrap gap-2">
                    {PACKAGE_MANAGERS.map((item) => (
                      <button
                        key={item}
                        onClick={() => setManager(item)}
                        aria-pressed={manager === item}
                        className={`rounded px-3 py-1.5 font-mono text-xs transition-colors ${
                          manager === item
                            ? "bg-neutral-200 font-semibold text-neutral-900"
                            : "border border-[#262626] bg-[#0f0f0f] text-[#8e9192] hover:border-[#444748] hover:text-neutral-200"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
                <CodeBox
                  title="Terminal"
                  value={installCommand}
                  copied={copied === "install"}
                  onCopy={() => void copy("install", installCommand)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <StepHeading
                step={3}
                title={activeFramework.envVars ? `Add these to ${envFileFor(activeFramework.id)}` : "Your setup key"}
                description={
                  activeFramework.envVars
                    ? "Keep this file out of version control."
                    : "This setup reads no environment variables, so the key is placed directly in the snippet below."
                }
              />
              <div className="space-y-3 pl-9">
                {activeFramework.envVars ? (
                  <CodeBox
                    title={envFileFor(activeFramework.id)}
                    value={envBlock}
                    copied={copied === "env"}
                    onCopy={() => void copy("env", envBlock)}
                  />
                ) : null}
                {rawKey ? (
                  <p className="font-mono text-[11px] leading-relaxed text-[#8e9192]">
                    This key is shown only once. Copy it now.
                  </p>
                ) : null}
                {createKey.error ? (
                  <p className="font-mono text-xs text-red-400">{createKey.error.message}</p>
                ) : null}
                {!rawKey && !createKey.isPending ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#262626] bg-[#0f0f0f] px-4 py-3">
                    <p className="max-w-xl text-xs leading-relaxed text-[#8e9192]">
                      {descriptor.hasActiveKey
                        ? "This environment already has a key. Keys are shown only once, so use the one you saved or generate a new one — existing keys keep working."
                        : "No setup key has been generated for this environment yet."}
                    </p>
                    <button
                      onClick={() => generateKey()}
                      className="rounded bg-neutral-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-900 transition-colors hover:bg-neutral-300"
                    >
                      {descriptor.hasActiveKey ? "Generate new key" : "Generate setup key"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              <StepHeading step={4} title="Initialize and verify" />
              <div className="space-y-3 pl-9">
                <CodeBox
                  title="Initialization"
                  value={snippet}
                  copied={copied === "snippet"}
                  onCopy={() => void copy("snippet", snippet)}
                  multiline
                />
                <p className="font-mono text-xs leading-relaxed text-[#8e9192]">
                  {activeFramework.envVars
                    ? `The gateway URL falls back to ${resolvedEndpoint} when unset.`
                    : `This snippet posts telemetry directly to ${resolvedEndpoint}.`}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <StepHeading
                step={5}
                title="Start your app"
                description="Run your app and open it once. The checklist at the top turns green when the first event arrives."
              />
            </div>
          </>
        ) : (
          <p className="pl-9 text-sm text-[#8e9192]">
            Pick your framework to see the install command, environment variables, and initialization code.
          </p>
        )}

        <GatewaySettings
          key={`${descriptor.environmentId}:${resolvedEndpoint}:${descriptor.gatewayEndpointCustomized}`}
          descriptor={descriptor}
          fallbackEndpoint={resolvedEndpoint}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ["sdk-setup", appId] })}
        />
      </section>
    </main>
  );
}

function StepHeading({ step, title, description }: { step: number; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#444748] font-mono text-[11px] text-neutral-200">
        {step}
      </span>
      <div>
        <h2 className="text-base font-semibold text-neutral-200">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-relaxed text-[#8e9192]">{description}</p> : null}
      </div>
    </div>
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
        <button onClick={onCopy} aria-label={`Copy ${title}`} className="text-[#8e9192] hover:text-neutral-200 transition-colors">
          {copied ? <Check className="h-4 w-4 text-neutral-200" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <pre
        className={`overflow-auto rounded border border-[#262626] bg-[#0f0f0f] p-4 font-mono text-xs text-neutral-200 ${
          multiline ? "min-h-64 whitespace-pre" : "whitespace-pre-wrap"
        }`}
      >
        {value}
      </pre>
    </div>
  );
}
