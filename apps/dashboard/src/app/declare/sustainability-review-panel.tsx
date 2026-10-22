"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown before a Flow is published: what Tellann's free, deterministic checks found about
 * whether the Flow is "sustainable" — readable end to end, its terminal pages told apart from
 * its intermediate ones, named clearly enough to derive business intent from the graph alone.
 *
 * Advisory only. Nothing here blocks publish: the footer's "Publish anyway" always works,
 * because the hard-blocking checks (one initial state, a terminal kind, no duplicate states)
 * already ran before this panel could even open — see `validateFlow` server-side.
 */

export type SustainabilityCriterion =
  | "INTERPRETABLE_END_TO_END"
  | "CODEBASE_MAPPING"
  | "ROUTE_DISAMBIGUATION"
  | "BUSINESS_INTENT_DERIVABLE"
  | "DATA_ACTION_COMPLETENESS";

export type SustainabilityFindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface SustainabilityFinding {
  id: string;
  criterion: SustainabilityCriterion;
  code: string;
  severity: SustainabilityFindingSeverity;
  message: string;
  nodeIds: string[];
  edgeIds: string[];
  rationale?: string | null;
  source: "STATIC" | "AI" | "COVERAGE_WALK";
}

export interface SustainabilityReview {
  id: string;
  status: "STATIC_COMPLETE" | "COMPLETE";
  entitled: boolean;
  requiresDesktopWalk: boolean;
  coverageWalkStatus: string | null;
  findings: SustainabilityFinding[];
}

const CRITERION_LABEL: Record<SustainabilityCriterion, string> = {
  INTERPRETABLE_END_TO_END: "Interpretable end-to-end",
  CODEBASE_MAPPING: "Mapped to the codebase",
  ROUTE_DISAMBIGUATION: "Terminal vs. intermediate routes",
  BUSINESS_INTENT_DERIVABLE: "Business intent from the graph",
  DATA_ACTION_COMPLETENESS: "Declared data & actions",
};

const CRITERION_ORDER: SustainabilityCriterion[] = [
  "DATA_ACTION_COMPLETENESS",
  "ROUTE_DISAMBIGUATION",
  "INTERPRETABLE_END_TO_END",
  "CODEBASE_MAPPING",
  "BUSINESS_INTENT_DERIVABLE",
];

const SEVERITY_STYLE: Record<SustainabilityFindingSeverity, string> = {
  CRITICAL: "border-red-900/60 bg-red-950/30 text-red-300",
  HIGH: "border-orange-900/60 bg-orange-950/30 text-orange-300",
  MEDIUM: "border-amber-900/50 bg-amber-950/20 text-amber-300",
  LOW: "border-neutral-700 bg-neutral-900 text-neutral-400",
  INFO: "border-sky-900/60 bg-sky-950/20 text-sky-300",
};

function groupByCriterion(findings: SustainabilityFinding[]): Map<SustainabilityCriterion, SustainabilityFinding[]> {
  const grouped = new Map<SustainabilityCriterion, SustainabilityFinding[]>();
  for (const criterion of CRITERION_ORDER) grouped.set(criterion, []);
  for (const finding of findings) grouped.get(finding.criterion)?.push(finding);
  return grouped;
}

export interface SustainabilityReviewPanelProps {
  review: SustainabilityReview;
  publishing: boolean;
  onPublishAnyway: () => void;
  onClose: () => void;
  /** Scrolls the named states/transitions into view on the canvas, when the caller supports it. */
  onViewOnCanvas?: (nodeIds: string[], edgeIds: string[]) => void;
}

export function SustainabilityReviewPanel({
  review, publishing, onPublishAnyway, onClose, onViewOnCanvas,
}: SustainabilityReviewPanelProps) {
  const grouped = groupByCriterion(review.findings);
  const criticalCount = review.findings.filter((finding) => finding.severity === "CRITICAL").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Sustainability review</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {review.findings.length === 0
                ? "No concerns found by the free checks."
                : `${review.findings.length} ${review.findings.length === 1 ? "thing" : "things"} worth a look before publishing.`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {CRITERION_ORDER.map((criterion) => {
            const findings = grouped.get(criterion) ?? [];
            if (findings.length === 0) return null;
            return (
              <div key={criterion}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {CRITERION_LABEL[criterion]}
                </h3>
                <div className="space-y-1.5">
                  {findings.map((finding) => (
                    <div key={finding.id} className={`rounded border px-2.5 py-2 text-xs ${SEVERITY_STYLE[finding.severity]}`}>
                      <div className="flex items-start gap-1.5">
                        {finding.severity === "CRITICAL" || finding.severity === "HIGH" ? (
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        ) : (
                          <Info className="mt-0.5 h-3 w-3 shrink-0" />
                        )}
                        <div className="flex-1">
                          <p>{finding.message}</p>
                          {finding.rationale && <p className="mt-1 text-[11px] opacity-80">{finding.rationale}</p>}
                          {(finding.nodeIds.length > 0 || finding.edgeIds.length > 0) && onViewOnCanvas && (
                            <button
                              type="button"
                              onClick={() => onViewOnCanvas(finding.nodeIds, finding.edgeIds)}
                              className="mt-1 text-[11px] font-medium underline underline-offset-2 opacity-80 hover:opacity-100"
                            >
                              View on canvas
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {!review.entitled && (
            <div className="rounded border border-neutral-800 bg-neutral-900/60 px-2.5 py-2 text-[11px] text-neutral-500">
              Your plan covers the free checks above. Upgrading also reviews whether this Flow&apos;s
              business intent and codebase mapping hold up on their own, and — from the desktop
              app — whether every step still has what it needs once the app is actually running.
            </div>
          )}
          {review.requiresDesktopWalk && review.coverageWalkStatus !== "COMPLETE" && (
            <div className="rounded border border-neutral-800 bg-neutral-900/60 px-2.5 py-2 text-[11px] text-neutral-500">
              Run from the desktop app for a live check that every step still declares what it
              needs once the application is running.
            </div>
          )}
          {review.findings.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Nothing to flag.
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-800 px-4 py-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Fix issues
          </Button>
          <Button variant="primary" size="sm" loading={publishing} onClick={onPublishAnyway}>
            {criticalCount > 0 ? "Publish anyway" : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
