"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useEntitlement } from "@/hooks/use-entitlement";
import { usePreferences } from "@/components/preferences-provider";
import type { Preferences } from "@/lib/preferences";
import {
  DashboardEntitlements,
  DashboardOverviewResponse,
  UserRole,
} from "./types";
import { evaluateDashboardState, EvaluatedDashboardState } from "./state-engine";

interface DashboardContextType {
  data: DashboardOverviewResponse | null;
  state: EvaluatedDashboardState;
  userRole: UserRole;
  entitlements: DashboardEntitlements;
  acknowledgeFirstAnalysis: () => void;
  isAcknowledging: boolean;
  setUserRole: (role: UserRole) => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({
  children,
  data,
  hasApplications,
}: {
  children: React.ReactNode;
  data: DashboardOverviewResponse | null;
  hasApplications: boolean;
}) {
  const { entitlements } = useEntitlement();
  const { preferences, applyPreferences } = usePreferences();

  /**
   * Which layout to show, and remembering the choice.
   *
   * Held locally so switching is instant, seeded from the account so it follows
   * the reader to another device. The write is fire-and-forget: failing to save
   * a layout preference must not interrupt anyone, and the local value still
   * applies for this session.
   */
  const [localRole, setLocalRole] = useState<UserRole | null>(null);
  const userRole = localRole ?? (preferences.dashboardPersona as UserRole);

  const setUserRole = useCallback(
    (role: UserRole) => {
      setLocalRole(role);
      const next = { ...preferences, dashboardPersona: role as Preferences["dashboardPersona"] };
      applyPreferences(next);
      void authenticatedFetch("/api-gateway/auth/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {
        // The layout still changed for this session.
      });
    },
    [preferences, applyPreferences],
  );
  const queryClient = useQueryClient();
  const applicationId = data?.application?.id;

  const state = useMemo(
    () => evaluateDashboardState(data, hasApplications),
    [data, hasApplications],
  );

  /**
   * Records that the first analysis has been reviewed.
   *
   * Previously this only set React state, so the milestone was forgotten on
   * reload and an account with a single demonstration was shown the
   * celebration card — and kept out of the real dashboard — indefinitely. The
   * server owns the lifecycle, so the acknowledgement has to reach it.
   */
  const acknowledge = useMutation({
    mutationFn: async () => {
      if (!applicationId) return;
      const response = await authenticatedFetch(
        `/api-gateway/applications/${applicationId}/onboarding-progress`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstAnalysisReviewed: true }),
        },
      );
      if (!response.ok) throw new Error("Failed to record the review");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
    },
  });

  const acknowledgeFirstAnalysis = useCallback(() => {
    acknowledge.mutate();
  }, [acknowledge]);

  const value = useMemo(
    () => ({
      data,
      state,
      userRole,
      entitlements,
      acknowledgeFirstAnalysis,
      isAcknowledging: acknowledge.isPending,
      setUserRole,
    }),
    [data, state, userRole, entitlements, acknowledgeFirstAnalysis, acknowledge.isPending, setUserRole],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
