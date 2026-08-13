"use client";

import React from "react";
import Link from "next/link";
import { useSelectedApplication } from "@/hooks/use-selected-application";
import { useDashboard } from "./core/dashboard-provider";
import { UserRole } from "./core/types";
import { Play, Plus, Zap } from "lucide-react";

export function DashboardHeader() {
  const { appId } = useSelectedApplication();
  const { state, userRole, setUserRole } = useDashboard();

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
            href="/settings/ingestion-keys"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold text-xs rounded hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            Connect SDK
          </Link>
        );
      case "READY_TO_DEMONSTRATE":
      case "FIRST_ANALYSIS_READY":
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
        {/* Role Selector (UX testing & role-based view adaptation) */}
        <div className="relative inline-block text-xs">
          <select
            aria-label="User role mode"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as UserRole)}
            className="bg-[#141414] border border-[#2d2d2d] text-neutral-300 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-500 font-mono cursor-pointer"
          >
            <option value="DEVELOPER">Developer View</option>
            <option value="QA_ENGINEER">QA Engineer View</option>
            <option value="ENGINEERING_MANAGER">Manager View</option>
            <option value="PRODUCT_MANAGER">PM View</option>
            <option value="ORGANIZATION_ADMIN">Admin View</option>
          </select>
        </div>

        {/* Date Range Selector */}
        {state.lifecycle === "ACTIVE" && (
          <select
            aria-label="Time range selector"
            defaultValue="30d"
            className="bg-[#141414] border border-[#2d2d2d] text-neutral-300 text-xs rounded px-2.5 py-1.5 focus:outline-none font-mono cursor-pointer"
          >
            <option value="latest">Last demonstration</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        )}

        {/* Dynamic Primary Action */}
        {renderPrimaryCTA()}
      </div>
    </div>
  );
}
