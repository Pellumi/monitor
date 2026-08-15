"use client";

import React from "react";
import Link from "next/link";
import { useSelectedApplication } from "@/hooks/use-selected-application";
import { useDashboard } from "../core/dashboard-provider";
import {
  CheckCircle2,
  Circle,
  Play,
  Zap,
  Network,
  FileText,
  Workflow,
  Search,
  Activity,
} from "lucide-react";

export function SetupProgressCard() {
  const { data, state } = useDashboard();
  const { appId } = useSelectedApplication();
  const onboarding = data?.onboarding;

  if (state.lifecycle === "ACTIVE") return null;

  const connectAppId = appId || data?.application?.id;

  const steps = [
    {
      title: "1. Create your application",
      desc: "Tellann needs an application workspace before telemetry can be associated with your project.",
      done: onboarding?.applicationCreated ?? true,
      required: true,
      action: (
        <Link
          href="/onboarding"
          className="text-xs text-white underline hover:text-neutral-300 font-mono"
        >
          Create Workspace
        </Link>
      ),
    },
    {
      title: "2. Connect your application",
      desc: "Connect a frontend, backend, or both manually or through Tellann Desktop.",
      done: onboarding?.frontendConnected ?? false,
      required: true,
      action: onboarding?.frontendConnected ? (
        <span className="text-xs text-neutral-400 font-mono">
          Application Connected
        </span>
      ) : (
        <Link
          href={connectAppId ? `/applications/${connectAppId}/connect?appId=${connectAppId}` : "/onboarding"}
          className="text-xs text-[#00e599] hover:underline font-mono"
        >
          Connect application
        </Link>
      ),
    },
    {
      title: "3. Verify telemetry connection",
      desc: "Tellann waits for the first valid event from your application.",
      done: onboarding?.telemetryVerified ?? false,
      required: true,
      action: (
        <span className="text-xs text-neutral-400 font-mono">
          {onboarding?.telemetryVerified ? "Verified" : "Waiting for events..."}
        </span>
      ),
    },
    {
      title: "4. Record your first demonstration",
      desc: "Use your app normally. Register, log in, navigate features, submit forms, and complete core workflows.",
      done: onboarding?.firstDemonstrationCompleted ?? false,
      required: true,
      action: (
        onboarding?.firstDemonstrationCompleted ? (
          <span className="text-xs text-neutral-400 font-mono">Completed</span>
        ) : (
          <Link
            href="/qa-runs/new"
            className="text-xs px-2.5 py-1 bg-white text-black font-semibold rounded hover:bg-neutral-200"
          >
            Start Demo
          </Link>
        )
      ),
    },
    {
      title: "5. Review your first analysis",
      desc: "Inspect the generated behavior model, coverage score, and detected state/flow gaps.",
      done: onboarding?.firstAnalysisReviewed ?? false,
      required: true,
      action: (
        onboarding?.firstAnalysisGenerated ? (
          <Link href="/reports" className="text-xs text-[#00e599] hover:underline font-mono">
            Review analysis
          </Link>
        ) : onboarding?.firstDemonstrationCompleted ? (
          <span className="text-xs text-neutral-400 font-mono">Preparing analysis...</span>
        ) : (
          <span className="text-xs text-neutral-500 font-mono">Available after demo</span>
        )
      ),
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="space-y-6">
      {/* 5-Step Getting Started Card */}
      <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold tracking-tight">Getting Started</h3>
            <p className="text-xs text-neutral-400 mt-0.5 font-mono">
              {completedCount} of {steps.length} steps completed
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400">
            {progressPercent}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Steps List */}
        <div className="space-y-4 border-b border-[#262626] pb-6">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-neutral-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-xs font-mono font-semibold text-white">
                    {step.title}{" "}
                    <span className="text-[10px] text-neutral-500">
                      ({step.required ? "Required" : "Recommended"})
                    </span>
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
              <div className="shrink-0">{step.action}</div>
            </div>
          ))}
        </div>

        {/* Recommended Node SDK Card */}
        <div className="mt-4 pt-2 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-neutral-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Enhance analysis with backend telemetry</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Recommended
            </span>
          </div>
          <Link
            href={connectAppId ? `/applications/${connectAppId}/connect?appId=${connectAppId}` : "/onboarding"}
            className="text-neutral-400 hover:text-white underline"
          >
            Add backend SDK
          </Link>
        </div>
      </div>

      {/* What Tellann Will Generate Card */}
      <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 text-white">
        <h3 className="text-base font-bold tracking-tight mb-1">
          What Tellann Will Generate
        </h3>
        <p className="text-xs text-neutral-400 mb-6">
          After your first walkthrough, Tellann automatically synthesizes the following quality intelligence models:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PreviewGridCard
            icon={<Workflow className="w-4 h-4 text-emerald-400" />}
            title="Behavior Graph"
            desc="Constructs an interactive state machine map of discovered application states and transitions."
          />
          <PreviewGridCard
            icon={<Activity className="w-4 h-4 text-emerald-400" />}
            title="Workflow Coverage"
            desc="Measures demonstrated user paths vs unobserved workflow trajectories."
          />
          <PreviewGridCard
            icon={<Search className="w-4 h-4 text-amber-400" />}
            title="Missing States"
            desc="Identifies missing loading, empty, error, and recovery state implementations."
          />
          <PreviewGridCard
            icon={<Network className="w-4 h-4 text-amber-400" />}
            title="Missing Flows"
            desc="Exposes unobserved failure, alternative, and recovery flow sequences."
          />
          <PreviewGridCard
            icon={<Play className="w-4 h-4 text-cyan-400" />}
            title="Session Replay"
            desc="Inspects full replayable timeline with DOM events and network requests."
          />
          <PreviewGridCard
            icon={<FileText className="w-4 h-4 text-cyan-400" />}
            title="Endpoint Analysis"
            desc="Evaluates API latency, request volume, error rates, and backend health."
          />
        </div>
      </div>
    </div>
  );
}

function PreviewGridCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="p-4 rounded border border-[#222] bg-[#171717] space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-mono font-bold text-white">{title}</span>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">{desc}</p>
    </div>
  );
}
