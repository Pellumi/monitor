"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSelectedApplication } from "@/hooks/use-selected-application";
import { useDashboard } from "./core/dashboard-provider";
import { UserRole } from "./core/types";
import { Activity, ArrowRight, Play, Plus, Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DASHBOARD_PERSONAS, DASHBOARD_PERSONA_LABELS } from "@/lib/preferences";

export function DashboardHeader() {
  const { appId } = useSelectedApplication();
  const { state, userRole, setUserRole } = useDashboard();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "30d";

  const setRange = (nextRange: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("range", nextRange);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const renderPrimaryCTA = () => {
    switch (state.lifecycle) {
      case "NEW_ACCOUNT":
        return (
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold text-xs rounded hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Application
          </Link>
        );
      case "SDK_SETUP":
        return (
          <Link
            href={appId ? `/applications/${appId}/connect` : "/onboarding"}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold text-xs rounded hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            Connect SDK
          </Link>
        );
      case "READY_TO_DEMONSTRATE":
        return (
          <Link
            href={`/qa-runs/new?appId=${appId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold text-xs rounded hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            Start Demonstration
          </Link>
        );
      case "ANALYSIS_IN_PROGRESS":
        return (
          <Link
            href={`/qa-runs?appId=${appId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold text-xs rounded hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5" />
            Analysis Processing
          </Link>
        );
      case "FIRST_ANALYSIS_READY":
        return (
          <Link
            href={`/reports?appId=${appId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold text-xs rounded hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Review First Analysis
          </Link>
        );
      case "ACTIVE":
      default:
        return (
          <Link
            href={`/qa-runs/new?appId=${appId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold text-xs rounded hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            Start Demonstration
          </Link>
        );
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-[#262626] gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Overview
          </h1>
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          Behavioral quality intelligence & application observation surface
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Which layout to arrange the overview into. Persisted to the
            account, so it follows the reader to another device. */}
        {state.lifecycle === "ACTIVE" && (
          <Select value={userRole} onValueChange={(value) => setUserRole(value as UserRole)} width="200px">
            <SelectTrigger
              aria-label="Dashboard layout"
              className="bg-[#141414] border-[#2d2d2d] text-neutral-300 text-xs font-mono py-1.5 px-2.5"
            >
              <SelectValue placeholder="Select layout">
                {DASHBOARD_PERSONA_LABELS[userRole]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="font-mono">
              {DASHBOARD_PERSONAS.map((persona) => (
                <SelectItem key={persona} value={persona}>
                  {DASHBOARD_PERSONA_LABELS[persona]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Date Range Selector */}
        {state.lifecycle === "ACTIVE" && (
          <Select value={range} onValueChange={setRange} width="180px">
            <SelectTrigger
              aria-label="Date range"
              className="bg-[#141414] border-[#2d2d2d] text-neutral-300 text-xs font-mono py-1.5 px-2.5"
            >
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent className="font-mono">
              <SelectItem value="latest">Last demonstration</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Dynamic Primary Action */}
        {renderPrimaryCTA()}
      </div>
    </div>
  );
}
