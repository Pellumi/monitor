"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import {
  DashboardOverviewResponse,
  UserRole,
  DashboardEntitlements,
} from "./types";
import { getDashboardEntitlements } from "./entitlements";
import { evaluateDashboardState, EvaluatedDashboardState } from "./state-engine";

interface DashboardContextType {
  data: DashboardOverviewResponse | null;
  state: EvaluatedDashboardState;
  userRole: UserRole;
  entitlements: DashboardEntitlements;
  firstAnalysisAcknowledged: boolean;
  acknowledgeFirstAnalysis: () => void;
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
  const [firstAnalysisAcknowledged, setFirstAnalysisAcknowledged] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("DEVELOPER");

  const state = useMemo(
    () => evaluateDashboardState(data, hasApplications, firstAnalysisAcknowledged),
    [data, hasApplications, firstAnalysisAcknowledged],
  );

  const entitlements = useMemo(
    () => getDashboardEntitlements(data?.application?.plan ?? "free"),
    [data?.application?.plan],
  );

  const acknowledgeFirstAnalysis = () => {
    setFirstAnalysisAcknowledged(true);
  };

  const value = useMemo(
    () => ({
      data,
      state,
      userRole,
      entitlements,
      firstAnalysisAcknowledged,
      acknowledgeFirstAnalysis,
      setUserRole,
    }),
    [data, state, userRole, entitlements, firstAnalysisAcknowledged],
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
