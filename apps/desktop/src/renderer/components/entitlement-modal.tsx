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
    const dashboardBillingUrl = "http://localhost:3000/settings/billing";
    if (window.tellann?.shell?.openExternal) {
      window.tellann.shell.openExternal(dashboardBillingUrl);
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
        className="desktop-modal auth-otp-theme"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entitlement-modal-title"
        style={{
          background: "#131313",
          border: "1px solid #262626",
          borderRadius: "4px",
          padding: "24px",
          width: "min(540px, 95vw)",
          color: "#e2e2e2",
          boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
        }}
      >
        <button
          type="button"
          className="desktop-modal-close"
          aria-label="Close modal"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "transparent",
            border: "none",
            color: "#8e9192",
            cursor: "pointer",
            padding: "4px",
          }}
        >
          <X size={16} />
        </button>

        <div
          className="confirm-modal-topbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            paddingRight: "28px",
          }}
        >
          <span
            className="confirm-modal-brand"
            style={{
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: 800,
              letterSpacing: "-0.04em",
            }}
          >
            TELLANN
          </span>
          <span
            className="confirm-modal-tag"
            style={{
              display: "inline-block",
              border: "1px solid #444748",
              color: "#8e9192",
              padding: "4px 8px",
              font: "10px ui-monospace, 'JetBrains Mono', 'Courier New', monospace",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            ENTITLEMENT // UPGRADE REQUIRED
          </span>
        </div>

        <h2
          id="entitlement-modal-title"
          className="confirm-modal-heading"
          style={{
            fontSize: "22px",
            lineHeight: 1.25,
            margin: "0 0 12px",
            color: "#ffffff",
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          Upgrade to {nextPlan} Plan
        </h2>

        <p
          style={{
            fontSize: "14px",
            lineHeight: "1.6",
            margin: "0 0 20px",
            color: "#c4c7c8",
          }}
        >
          {customDescription ??
            `${featureName} is not included on your organization's current plan (${currentPlan}). Upgrade to the ${nextPlan} plan to enable this feature and unlock full repository intelligence.`}
        </p>

        <div
          className="confirm-modal-body-box"
          style={{
            background: "#000000",
            border: "1px solid #262626",
            padding: "0",
            margin: "0 0 24px",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <table
            role="presentation"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              borderSpacing: 0,
            }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid #262626",
                    color: "#8e9192",
                    font: "11px ui-monospace, 'JetBrains Mono', 'Courier New', monospace",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  FEATURE REQUESTED
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid #262626",
                    color: "#ffffff",
                    textAlign: "right",
                    font: "12px ui-monospace, 'JetBrains Mono', 'Courier New', monospace",
                    fontWeight: 600,
                  }}
                >
                  {featureName}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid #262626",
                    color: "#8e9192",
                    font: "11px ui-monospace, 'JetBrains Mono', 'Courier New', monospace",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  CURRENT PLAN
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid #262626",
                    color: "#8e9192",
                    textAlign: "right",
                    font: "12px ui-monospace, 'JetBrains Mono', 'Courier New', monospace",
                  }}
                >
                  {currentPlan}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "10px 14px",
                    color: "#8e9192",
                    font: "11px ui-monospace, 'JetBrains Mono', 'Courier New', monospace",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  RECOMMENDED TIER
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    color: "#ffffff",
                    textAlign: "right",
                    font: "12px ui-monospace, 'JetBrains Mono', 'Courier New', monospace",
                    fontWeight: 700,
                  }}
                >
                  {nextPlan} Plan
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          className="confirm-modal-actions"
          style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}
        >
          <button
            type="button"
            className="button confirm-modal-btn-cancel"
            onClick={onClose}
            style={{
              background: "#000000",
              color: "#c4c7c8",
              border: "1px solid #262626",
              padding: "11px 18px",
              borderRadius: "4px",
              font: "600 11px inherit",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
          <button
            type="button"
            className="button confirm-modal-btn-action flex-1"
            onClick={handleUpgrade}
            style={{
              background: "#ffffff",
              color: "#000000",
              border: "1px solid #ffffff",
              padding: "11px 22px",
              borderRadius: "4px",
              font: "700 11px inherit",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            UPGRADE TO {nextPlan.toUpperCase()}
          </button>
        </div>

        <div
          style={{
            marginTop: "20px",
            paddingTop: "14px",
            borderTop: "1px solid #262626",
            color: "#8e9192",
            fontSize: "11px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Tellann Governance &middot; Plan Entitlements</span>
          <span>Step-Up Recommendation</span>
        </div>
      </div>
    </div>
  );
}
