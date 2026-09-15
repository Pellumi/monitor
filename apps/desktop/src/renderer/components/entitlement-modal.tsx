import React from "react";
import { X } from "lucide-react";

export interface EntitlementModalProps {
  isOpen: boolean;
  feature?: string;
  featureName?: string;
  currentPlan?: string;
  requiredPlan?: string;
  description?: string;
  onClose(): void;
}

export function getNextPlanTier(
  currentPlanInput?: string,
  featureRequired?: string,
): { currentPlan: string; nextPlan: string } {
  const norm = (currentPlanInput ?? "FREE").toUpperCase();

  let currentPlan = "Free";
  let nextPlan = "Local";

  if (norm === "FREE") {
    currentPlan = "Free";
    nextPlan =
      featureRequired && featureRequired.toUpperCase().includes("INSTRUMENTATION")
        ? "Solo"
        : "Local";
  } else if (norm === "LOCAL") {
    currentPlan = "Local";
    nextPlan = "Solo";
  } else if (norm === "SOLO") {
    currentPlan = "Solo";
    nextPlan = "Team";
  } else if (norm === "TEAM") {
    currentPlan = "Team";
    nextPlan = "Business";
  } else if (norm === "BUSINESS") {
    currentPlan = "Business";
    nextPlan = "Enterprise";
  } else if (norm === "ENTERPRISE") {
    currentPlan = "Enterprise";
    nextPlan = "Enterprise";
  }

  return { currentPlan, nextPlan };
}

export function EntitlementModal({
  isOpen,
  feature = "DOCUMENT_FLOW_INFERENCE",
  featureName: customFeatureName,
  currentPlan: customCurrentPlan,
  requiredPlan: customRequiredPlan,
  description: customDescription,
  onClose,
}: EntitlementModalProps) {
  if (!isOpen) return null;

  const featureName =
    customFeatureName ??
    (feature === "AUTOMATED_INSTRUMENTATION"
      ? "Automated Instrumentation"
      : feature === "DOCUMENT_FLOW_INFERENCE"
        ? "Document Flow Inference"
        : feature === "BROWSER_TRACE_CAPTURE"
          ? "Browser Trace Capture"
          : "Advanced Flow Intelligence");

  const resolved = getNextPlanTier(customCurrentPlan, feature);
  const currentPlan = customCurrentPlan ?? resolved.currentPlan;
  const nextPlan = customRequiredPlan ?? resolved.nextPlan;

  const handleUpgrade = () => {
    const dashboardBaseUrl = (
      import.meta.env.VITE_TELLANN_DASHBOARD_URL || "http://localhost:3010"
    ).replace(/\/$/, "");
    const dashboardBillingUrl = `${dashboardBaseUrl}/settings/billing`;
    if (window.tellann?.system?.openExternal) {
      void window.tellann.system.openExternal(dashboardBillingUrl);
    } else {
      window.open(dashboardBillingUrl, "_blank");
    }
    onClose();
  };

  return (
    <div
      className="desktop-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="desktop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entitlement-modal-title"
      >
        <button
          type="button"
          className="desktop-modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={16} />
        </button>

        <h2 id="entitlement-modal-title">Upgrade to the {nextPlan} plan</h2>

        <p>
          {customDescription ??
            `${featureName} is not included on your organization's current plan (${currentPlan}). Upgrade to the ${nextPlan} plan to enable this feature and unlock full repository intelligence.`}
        </p>

        <dl className="property-list">
          <div>
            <dt>Feature</dt>
            <dd>{featureName}</dd>
          </div>
          <div>
            <dt>Current plan</dt>
            <dd>{currentPlan}</dd>
          </div>
          <div>
            <dt>Recommended plan</dt>
            <dd>{nextPlan}</dd>
          </div>
        </dl>

        <div className="desktop-modal-actions">
          <button type="button" onClick={onClose}>
            Not now
          </button>
          <button type="button" className="confirm" onClick={handleUpgrade}>
            Upgrade to {nextPlan}
          </button>
        </div>
      </div>
    </div>
  );
}
