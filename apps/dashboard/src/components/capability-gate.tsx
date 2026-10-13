'use client';

import Link from "next/link";
import type { ReactNode } from "react";
import { HIDDEN_CAPABILITY_STATES, useCapabilities, type CapabilityStateName } from "@/hooks/use-capabilities";

/**
 * Explains a feature page's state before it shows data (doc §26). A page never returns 404 for an
 * unavailable capability, and never renders zero-filled metrics for one.
 */

const REASON_COPY: Record<string, string> = {
  NO_BROWSER_SURFACE: "This application has no browser interface, so browser-based analysis does not apply.",
  NO_SERVER_RUNTIME: "No server runtime was detected in this application's codebase.",
  BACKEND_SDK_NOT_CONNECTED: "Connect the backend SDK to see server-side behaviour.",
  FRONTEND_SDK_NOT_CONNECTED: "Connect the frontend SDK to see browser-side behaviour.",
  AWAITING_FIRST_RUN: "Complete a QA run to populate this view.",
  NO_IN_FLOW_EVIDENCE: "No flow activity has been observed yet.",
  NO_ENDPOINT_EVIDENCE: "No endpoint activity has been observed yet.",
  UNSUPPORTED_FRAMEWORK: "A framework in this application is detected, but Tellann cannot instrument it yet.",
  PLAN_ENTITLEMENT_MISSING: "This feature is not included in your current plan.",
  ROLE_PERMISSION_MISSING: "Your role does not include access to this feature.",
  APPLICATION_PROFILE_UNKNOWN: "The architecture of this application has not been analysed yet.",
  CAPABILITY_NOT_SHIPPED: "This feature is not available yet.",
  ROLLOUT_DISABLED: "This feature is not enabled for this application yet.",
};

function reasonText(reason: string | null | undefined): string | null {
  return reason ? (REASON_COPY[reason] ?? null) : null;
}

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-lg border border-[#262626] bg-[#0a0a0a] p-6">
      <h2 className="text-base font-semibold text-[#e5e5e5]">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-[#a3a3a3]">{children}</div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function linkButton(href: string, label: string) {
  return (
    <Link href={href} className="inline-flex items-center rounded-md border border-[#333] px-3 py-1.5 text-sm text-[#e5e5e5] hover:bg-[#131313]">
      {label}
    </Link>
  );
}

export function CapabilityGate({
  appId,
  route,
  name,
  children,
}: {
  appId: string | null;
  /** Dashboard route this page serves. Matched against the registry's navigation routes. */
  route: string;
  /** Display name for the explanation card. */
  name: string;
  children: ReactNode;
}) {
  const { capabilities, isLoading, isError, resolvedUi } = useCapabilities(appId);

  // Legacy path: the rollout flag is off, so pages behave exactly as before.
  if (!appId || !resolvedUi) return <>{children}</>;

  if (isLoading) {
    return <div className="mx-auto mt-16 h-24 max-w-xl animate-pulse rounded-lg bg-[#0a0a0a]" aria-busy="true" />;
  }
  if (isError || !capabilities) return <>{children}</>;

  const entry = capabilities.routes[route];
  if (!entry) return <>{children}</>;
  const state: CapabilityStateName = entry.state;
  const reason = reasonText(entry.reason);
  const settingsHref = `/settings/architecture?appId=${encodeURIComponent(appId)}`;

  switch (state) {
    case "AVAILABLE":
      return <>{children}</>;
    case "LIMITED":
      return (
        <>
          <div className="mx-4 mt-4 rounded-md border border-amber-900/50 bg-amber-950/20 px-4 py-2 text-xs text-amber-200/80">
            Limited visibility. {reason ?? "Some evidence for this view is not connected."}
          </div>
          {children}
        </>
      );
    case "NEEDS_SETUP":
      return (
        <Card title={`${name} needs setup`} action={linkButton(`/applications/${appId}/connect`, "Connect telemetry")}>
          {reason ?? "Connect the SDK to start collecting evidence for this view."}
        </Card>
      );
    case "WAITING_FOR_EVIDENCE":
      return (
        <Card title={`No ${name.toLowerCase()} yet`}>
          {reason ?? "This view fills in once evidence arrives."}
        </Card>
      );
    case "PLAN_LOCKED":
      return (
        <Card title={`${name} is not in your plan`} action={linkButton("/settings/billing?upgrade=1", "View plans")}>
          {reason}
        </Card>
      );
    case "NOT_AUTHORIZED":
      return <Card title="Access restricted">{reason}</Card>;
    case "NOT_APPLICABLE":
      return (
        <Card title={`${name} does not apply here`} action={linkButton(settingsHref, "Review architecture")}>
          {reason ?? "This feature does not match the detected architecture of this application."}
        </Card>
      );
    case "UNAVAILABLE":
      return <Card title={`${name} is not available`}>{reason}</Card>;
  }
}

/**
 * Hides a card or section when its capability does not apply (doc §27). Cards for states the user
 * can act on (setup, waiting, plan-locked) stay visible, so the value they offer is not hidden.
 */
export function CapabilityVisible({
  appId,
  capability,
  children,
}: {
  appId: string | null;
  /** Capability key from the registry, for example ENDPOINT_INTELLIGENCE. */
  capability: string;
  children: ReactNode;
}) {
  const { capabilities, resolvedUi } = useCapabilities(appId);
  if (!appId || !resolvedUi || !capabilities) return <>{children}</>;
  const entry = capabilities.capabilities[capability];
  if (entry && HIDDEN_CAPABILITY_STATES.has(entry.state)) return null;
  return <>{children}</>;
}
