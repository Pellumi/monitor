"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSelectedApplication } from "@/hooks/use-selected-application";
import {
  ANALYSIS_NOTIFICATION_TYPES,
  useInvalidateOnNotification,
} from "@/hooks/use-invalidate-on-notification";

// Core Providers & Data
import { DashboardProvider, useDashboard } from "@/components/dashboard/core/dashboard-provider";
import { DashboardOverviewResponse } from "@/components/dashboard/core/types";

// Modular Components
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { HealthOverlays } from "@/components/dashboard/status/health-overlays";
import { LifecycleHero } from "@/components/dashboard/onboarding/lifecycle-hero";
import { SetupProgressCard } from "@/components/dashboard/onboarding/setup-progress";
import { FirstAnalysisReady } from "@/components/dashboard/onboarding/first-analysis-ready";
import { QualitySummary } from "@/components/dashboard/overview/quality-summary";
import { CoverageSummary } from "@/components/dashboard/overview/coverage-summary";
import { WorkflowCoverageList } from "@/components/dashboard/overview/workflow-coverage-list";
import { ExpectedVsObserved } from "@/components/dashboard/overview/expected-vs-observed";
import { FlowChangeFeed } from "@/components/dashboard/overview/flow-change-feed";
import { WorkflowAttention } from "@/components/dashboard/overview/workflow-attention";
import { BehaviorSummaryCard } from "@/components/dashboard/overview/behavior-summary";
import { ObservedFindingsCard } from "@/components/dashboard/findings/observed-findings-card";
import { ActivityFeed } from "@/components/dashboard/activity/activity-feed";
import { MissingStatesCard } from "@/components/dashboard/findings/missing-states-card";
import { MissingFlowsCard } from "@/components/dashboard/findings/missing-flows-card";
import { SuggestedDemonstrationsCard } from "@/components/dashboard/findings/suggested-demonstrations";
import { RecentSessions } from "@/components/dashboard/activity/recent-sessions";
import { RecentReports } from "@/components/dashboard/activity/recent-reports";
import { ObservationStatusCard } from "@/components/dashboard/status/observation-status";
import { PrivacyStatusCard } from "@/components/dashboard/status/privacy-status";
import { PlanUsageCard } from "@/components/dashboard/status/plan-usage";

// Lazy-loaded heavy components for performance budget (< 3s TTFB)
const GraphPreview = dynamic(
  () =>
    import("@/components/dashboard/overview/graph-preview").then(
      (mod) => mod.GraphPreview,
    ),
  {
    ssr: false,
    loading: () => <SkeletonCard title="Loading Topology Preview..." />,
  },
);

const CoverageTrend = dynamic(
  () =>
    import("@/components/dashboard/overview/coverage-trend").then(
      (mod) => mod.CoverageTrend,
    ),
  {
    ssr: false,
    loading: () => <SkeletonCard title="Loading Coverage History..." />,
  },
);

const EndpointHealth = dynamic(
  () =>
    import("@/components/dashboard/activity/endpoint-health").then(
      (mod) => mod.EndpointHealth,
    ),
  {
    ssr: false,
    loading: () => <SkeletonCard title="Loading Endpoint Analysis..." />,
  },
);

/**
 * The whole overview, from one endpoint.
 *
 * This replaced eight parallel requests stitched together here by ~250 lines of
 * untyped mapping. That arrangement could not fail: `Promise.allSettled` always
 * resolved, so an outage produced a response with every field missing, which
 * read as "SDK not connected" and answered a mature account with an onboarding
 * wizard. Throwing on a non-ok response is what makes `isError` mean something,
 * because `authenticatedFetch` returns failures rather than raising them.
 */
async function fetchDashboardOverview(
  appId: string,
  range: string,
  environmentId?: string,
): Promise<DashboardOverviewResponse> {
  const params = new URLSearchParams({ range });
  if (environmentId) params.set("environmentId", environmentId);

  const response = await authenticatedFetch(
    `/api-gateway/applications/${appId}/dashboard-overview?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(`Dashboard overview request failed (${response.status})`);
  }
  return response.json();
}

function MainDashboardLayout() {
  const { state, userRole } = useDashboard();

  const renderActiveGrid = () => {
    switch (userRole) {
      case "DEVELOPER":
        return (
          <div className="space-y-6">
            <QualitySummary />
            <EndpointHealth />
            <RecentSessions />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GraphPreview />
              <WorkflowCoverageList />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MissingStatesCard />
              <MissingFlowsCard />
            </div>
            <ObservedFindingsCard />
            <CoverageSummary />
            <ExpectedVsObserved />
            <FlowChangeFeed />
            <CoverageTrend />
            <RecentReports />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WorkflowAttention />
              <BehaviorSummaryCard />
            </div>
            <ActivityFeed />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[#262626]">
              <ObservationStatusCard />
              <PrivacyStatusCard />
              <PlanUsageCard />
            </div>
          </div>
        );

      case "QA_ENGINEER":
        return (
          <div className="space-y-6">
            <CoverageSummary />
            <ExpectedVsObserved />
            <FlowChangeFeed />
            <SuggestedDemonstrationsCard />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MissingStatesCard />
              <MissingFlowsCard />
            </div>
            <ObservedFindingsCard />
            <WorkflowCoverageList />
            <QualitySummary />
            <RecentSessions />
            <CoverageTrend />
            <RecentReports />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WorkflowAttention />
              <BehaviorSummaryCard />
            </div>
            <ActivityFeed />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[#262626]">
              <ObservationStatusCard />
              <PrivacyStatusCard />
              <PlanUsageCard />
            </div>
          </div>
        );

      case "ENGINEERING_MANAGER":
        return (
          <div className="space-y-6">
            <QualitySummary />
            <CoverageTrend />
            <CoverageSummary />
            <ExpectedVsObserved />
            <FlowChangeFeed />
            <RecentReports />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MissingStatesCard />
              <MissingFlowsCard />
            </div>
            <ObservedFindingsCard />
            <EndpointHealth />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WorkflowAttention />
              <BehaviorSummaryCard />
            </div>
            <ActivityFeed />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[#262626]">
              <ObservationStatusCard />
              <PrivacyStatusCard />
              <PlanUsageCard />
            </div>
          </div>
        );

      case "PRODUCT_MANAGER":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GraphPreview />
              <WorkflowCoverageList />
            </div>
            <CoverageSummary />
            <ExpectedVsObserved />
            <FlowChangeFeed />
            <QualitySummary />
            <SuggestedDemonstrationsCard />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MissingStatesCard />
              <MissingFlowsCard />
            </div>
            <ObservedFindingsCard />
            <RecentReports />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WorkflowAttention />
              <BehaviorSummaryCard />
            </div>
            <ActivityFeed />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[#262626]">
              <ObservationStatusCard />
              <PrivacyStatusCard />
              <PlanUsageCard />
            </div>
          </div>
        );

      case "ORGANIZATION_ADMIN":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 rounded-lg bg-[#141414] border border-[#262626]">
              <PlanUsageCard />
              <PrivacyStatusCard />
              <ObservationStatusCard />
            </div>
            <QualitySummary />
            <RecentReports />
            <EndpointHealth />
            <CoverageSummary />
            <ExpectedVsObserved />
            <FlowChangeFeed />
            <RecentSessions />
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            <QualitySummary />
            <CoverageSummary />
            <ExpectedVsObserved />
            <FlowChangeFeed />
            <CoverageTrend />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GraphPreview />
              <WorkflowCoverageList />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MissingStatesCard />
              <MissingFlowsCard />
            </div>
            <ObservedFindingsCard />
            <SuggestedDemonstrationsCard />
            <RecentSessions />
            <EndpointHealth />
            <RecentReports />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WorkflowAttention />
              <BehaviorSummaryCard />
            </div>
            <ActivityFeed />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[#262626]">
              <ObservationStatusCard />
              <PrivacyStatusCard />
              <PlanUsageCard />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Header Bar */}
      <DashboardHeader />

      {/* Operational Health Overlays */}
      <HealthOverlays />

      {/* Lifecycle Hero & First-Analysis Celebration */}
      <LifecycleHero />
      <FirstAnalysisReady />

      {/* 5-Step Getting Started Setup (New/SDK Setup) */}
      <SetupProgressCard />

      {/* Active Mature Dashboard Grid (Role-Aware Composition) */}
      {state.lifecycle === "ACTIVE" && renderActiveGrid()}
    </div>
  );
}

function OverviewContent() {
  const searchParams = useSearchParams();
  const { applications, selectedApplication, appId, isLoading: isApplicationsLoading } =
    useSelectedApplication();

  const activeAppId = appId || selectedApplication?.id || "";
  const range = searchParams.get("range") || "30d";

  const environmentId = searchParams.get("envId") || undefined;

  // A finished run now pushes the page forward. Without this the overview
  // stopped polling once ACTIVE and only caught up on a tab refocus.
  useInvalidateOnNotification(ANALYSIS_NOTIFICATION_TYPES, ["dashboard-overview"]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<DashboardOverviewResponse>({
    queryKey: ["dashboard-overview", activeAppId, range, environmentId ?? null],
    queryFn: () => fetchDashboardOverview(activeAppId, range, environmentId),
    enabled: !!activeAppId,
    refetchInterval: (query) => {
      if (query.state.data?.lifecycle === "ACTIVE") return false;
      // One request now instead of eight, so a slower cadence still feels live
      // while onboarding without hammering the API.
      return typeof document !== "undefined" && document.hidden ? 30_000 : 10_000;
    },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    // An outage must surface as an error, not as a retry storm behind a spinner.
    retry: 1,
  });

  if (isApplicationsLoading) {
    return <DashboardSkeleton />;
  }

  if (applications.length > 0 && !activeAppId) {
    // Applications exist but none has been resolved yet. Rendering the
    // dashboard here would report NEW_ACCOUNT and tell someone who already has
    // applications to go and create one.
    return <DashboardSkeleton />;
  }

  if (isLoading && activeAppId) {
    return <DashboardSkeleton />;
  }

  if (isError && activeAppId) {
    return <DashboardLoadError onRetry={() => void refetch()} isRetrying={isFetching} />;
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto my-auto space-y-6 py-16">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
            Welcome to Tellann
          </h1>
          <p className="text-[#c4c7c8] text-sm leading-relaxed">
            To start tracking expected states, state transitions, workflow coverage, and observing behavioral gaps, configure your first application workspace.
          </p>
        </div>
        <Link
          href="/onboarding"
          className="px-6 py-2.5 bg-white text-black font-semibold rounded-md hover:bg-neutral-200 transition-colors text-sm shadow-md cursor-pointer"
        >
          Create Your First Application
        </Link>
      </div>
    );
  }

  return (
    <DashboardProvider key={activeAppId} data={data ?? null} hasApplications={applications.length > 0}>
      <MainDashboardLayout />
    </DashboardProvider>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <OverviewContent />
    </Suspense>
  );
}

/**
 * Shown when the overview could not be loaded.
 *
 * The specific regression this prevents: the page used to absorb every failure
 * and fall through to the onboarding lifecycle, so a customer with months of
 * data was told to connect their SDK whenever the backend was down.
 */
function DashboardLoadError({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 py-24">
      <h1 className="text-lg font-bold text-white tracking-tight">
        We couldn&apos;t load your dashboard
      </h1>
      <p className="text-sm text-[#c4c7c8] leading-relaxed">
        Your data is safe — this request didn&apos;t get through. Nothing here has changed.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="px-5 py-2 bg-white text-black font-semibold rounded-md text-xs hover:bg-neutral-200 transition-colors disabled:opacity-60 cursor-pointer"
      >
        {isRetrying ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 w-full pb-12 animate-pulse">
      {/* Header Bar Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-[#141414] border border-[#262626]">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-neutral-800 rounded-md" />
          <div className="h-4 w-72 bg-neutral-800/60 rounded-md" />
        </div>
        <div className="h-9 w-32 bg-neutral-800 rounded-md" />
      </div>

      {/* Hero / Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-24 bg-[#141414] border border-[#262626] rounded-lg p-4 space-y-2">
          <div className="h-4 w-20 bg-neutral-800 rounded" />
          <div className="h-8 w-16 bg-neutral-800 rounded" />
        </div>
        <div className="h-24 bg-[#141414] border border-[#262626] rounded-lg p-4 space-y-2">
          <div className="h-4 w-24 bg-neutral-800 rounded" />
          <div className="h-8 w-20 bg-neutral-800 rounded" />
        </div>
        <div className="h-24 bg-[#141414] border border-[#262626] rounded-lg p-4 space-y-2">
          <div className="h-4 w-28 bg-neutral-800 rounded" />
          <div className="h-8 w-16 bg-neutral-800 rounded" />
        </div>
        <div className="h-24 bg-[#141414] border border-[#262626] rounded-lg p-4 space-y-2">
          <div className="h-4 w-20 bg-neutral-800 rounded" />
          <div className="h-8 w-24 bg-neutral-800 rounded" />
        </div>
      </div>

      {/* Main Charts & Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-[#141414] border border-[#262626] rounded-lg p-6 space-y-4">
          <div className="h-5 w-40 bg-neutral-800 rounded" />
          <div className="h-40 bg-neutral-800/40 rounded-md" />
        </div>
        <div className="h-64 bg-[#141414] border border-[#262626] rounded-lg p-6 space-y-4">
          <div className="h-5 w-48 bg-neutral-800 rounded" />
          <div className="h-40 bg-neutral-800/40 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 text-neutral-500 font-mono text-xs flex items-center justify-center min-h-[160px] animate-pulse">
      {title}
    </div>
  );
}
