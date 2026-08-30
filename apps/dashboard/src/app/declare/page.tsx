"use client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { ApplicationRequiredState } from "@/components/application-required-state";
import { useSelectedApplication } from "@/hooks/use-selected-application";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import {
  useState,
  useMemo,
  Suspense,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Node,
  Edge,
  type EdgeProps,
  applyNodeChanges,
  applyEdgeChanges,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ClipboardList,
  Plus,
  ArrowRight,
  Check,
  X,
  Lock,
  Unlock,
  AlertCircle,
  TrendingUp,
  Activity,
  GitCompare,
  Layers,
  ChevronRight,
  Info,
  Copy,
  Terminal,
  Play,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Pencil,
  Download,
  FileText,
  Maximize2,
  Minimize2,
} from "lucide-react";

const FDRS_API = "/api-gateway";
const ONBOARDING_API = "/api-gateway";

interface DeclaredStateSuggestion {
  id: string;
  parentStateId: string;
  suggestedStateName: string;
  category: string;
  sourceTier: string;
  rationale: string;
  confidence: number;
  title?: string;
  description?: string;
  suggestionType?: string;
  severity?: string;
  source?: "RULE_ENGINE" | "AI" | "HYBRID";
  suggestedStatesJson?: Array<{ name: string; category: string }>;
  suggestedTransitionsJson?: Array<{
    from: string;
    to: string;
    action?: string;
  }>;
  graphVersion?: number;
  graphHash?: string;
  status:
    | "PENDING"
    | "EDITED"
    | "ACCEPTED"
    | "REJECTED"
    | "DISMISSED"
    | "SUPERSEDED";
  patternId?: string;
}

const truncateGraphLabel = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}â€¦` : value;

function CopyableGraphLabel({
  value,
  maxLength,
  kind,
}: {
  value: string;
  maxLength: number;
  kind: "state" | "transition";
}) {
  const [copied, setCopied] = useState(false);

  const copyValue = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="nodrag nopan flex max-w-[180px] items-center gap-1.5">
      <span className="min-w-0 flex-1 truncate" title={value}>
        {truncateGraphLabel(value, maxLength)}
      </span>
      <button
        type="button"
        className="shrink-0 rounded p-1 text-neutral-500 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-1 focus:ring-white"
        aria-label={`Copy full ${kind} label: ${value}`}
        title={copied ? "Copied" : `Copy full ${kind} label`}
        onClick={(event) => {
          event.stopPropagation();
          void copyValue();
        }}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

function CopyableTransitionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerStart,
  markerEnd,
  style,
  interactionWidth,
  data,
  label,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const value = String(data?.fullLabel ?? label ?? "Transition");

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={interactionWidth}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute rounded border border-[#262626] bg-[#0a0a0a] px-1.5 py-1 font-mono text-[9px] text-neutral-400"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          <CopyableGraphLabel value={value} maxLength={36} kind="transition" />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const declarationEdgeTypes = { copyableTransition: CopyableTransitionEdge };

interface DeclaredState {
  id: string;
  stateName: string;
  category: string;
  provenance: string;
  role?: "NORMAL" | "INITIAL" | "TERMINAL";
  terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null;
  canonicalBehavior?: string;
  suggestions?: DeclaredStateSuggestion[];
}

interface DeclaredTransition {
  id: string;
  fromStateId: string;
  toStateId: string;
  action?: string | null;
  provenance: string;
  fromState: DeclaredState;
  toState: DeclaredState;
}

interface DeclaredFlow {
  id: string;
  name: string;
  status: "DRAFT" | "COMPLETE";
  version: number;
  workflowType: string;
  states: DeclaredState[];
  transitions: DeclaredTransition[];
  graphHash: string;
  lifecycleStatus?: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SUPERSEDED";
  purpose?: string | null;
  scopeStatement?: string | null;
  publishedVersionId?: string | null;
  versions?: Array<{ id: string; version: number }>;
}

function safeExportName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tellann-flow";
}

function downloadTextFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

function flowAsMermaid(flow: DeclaredFlow) {
  const nodeIds = new Map(flow.states.map((state, index) => [state.id, `state${index}`]));
  const escapeLabel = (value: string) => value.replace(/"/g, "'").replace(/\r?\n/g, " ");
  const lines = ["flowchart TD"];

  for (const state of flow.states) {
    lines.push(`  ${nodeIds.get(state.id)}["${escapeLabel(state.stateName)}"]`);
  }
  for (const transition of flow.transitions) {
    const from = nodeIds.get(transition.fromStateId);
    const to = nodeIds.get(transition.toStateId);
    if (!from || !to) continue;
    const action = transition.action
      ? `|"${escapeLabel(transition.action)}"|`
      : "";
    lines.push(`  ${from} -->${action} ${to}`);
  }

  return lines.join("\n");
}

function flowAsMarkdown(flow: DeclaredFlow, diagramKind: string, diagramSource: string) {
  const stateNames = new Map(flow.states.map((state) => [state.id, state.stateName]));
  const rows = flow.transitions.map(
    (transition) => {
      const fromStateName = transition.fromState?.stateName
        ?? stateNames.get(transition.fromStateId)
        ?? transition.fromStateId;
      const toStateName = transition.toState?.stateName
        ?? stateNames.get(transition.toStateId)
        ?? transition.toStateId;
      return `| ${fromStateName.replace(/\|/g, "\\|")} | ${transition.action?.replace(/\|/g, "\\|") || "Transition"} | ${toStateName.replace(/\|/g, "\\|")} |`;
    },
  );

  return [
    `# ${flow.name}`,
    "",
    `- Version: ${flow.version}`,
    `- Status: ${flow.status}`,
    `- Diagram: ${diagramKind.replace("_", " ")}`,
    "",
    "## Diagram",
    "",
    "```mermaid",
    diagramSource,
    "```",
    "",
    "## States",
    "",
    ...flow.states.map((state) => `- ${state.stateName} (${state.category})`),
    "",
    "## Transitions",
    "",
    "| From | Action | To |",
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

interface FlowSuggestionsResponse {
  success: boolean;
  data: {
    graphVersion: number;
    graphHash: string;
    suggestions: DeclaredStateSuggestion[];
    meta?: {
      ruleCount: number;
      aiCount: number;
      aiAttempted: boolean;
      fallbackUsed: boolean;
      stale: boolean;
      latencyMs: number;
    };
  };
}

interface ReconciliationReport {
  flowId: string;
  confirmedCount: number;
  trueGapCount: number;
  undeclaredCount: number;
  expectedCoverageScore: number;
  trueGaps: Array<{
    stateName: string;
    provenance: string;
    declaredById: string | null;
  }>;
  undeclared: Array<{ stateName: string; observationCount: number }>;
  confirmedTransitions: number;
  trueGapTransitions: number;
  undeclaredTransitions: number;
  transitionCoverageScore: number;
  trueGapTransitionsList: Array<{
    fromStateId: string;
    toStateId: string;
    fromStateName: string;
    toStateName: string;
    action: string | null;
  }>;
  undeclaredTransitionsList: Array<{
    fromStateName: string;
    toStateName: string;
    observationCount: number;
  }>;
  generatedAt: string;
}

function DeclareContent() {
  const { appId } = useSelectedApplication();
  const queryClient = useQueryClient();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes],
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges],
  );

  const [selectedFlowId, setSelectedFlowId] = useState<string>("");
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowPurpose, setNewFlowPurpose] = useState("");
  const [newFlowScope, setNewFlowScope] = useState("");
  const [newFlowType, setNewFlowType] = useState("CUSTOM");

  // State builder inputs
  const [stateName, setStateName] = useState("");
  const [stateCategory, setStateCategory] = useState("BUSINESS");
  const [stateRole, setStateRole] = useState<"NORMAL" | "INITIAL" | "TERMINAL">("NORMAL");
  const [terminalKind, setTerminalKind] = useState<"SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE">("SUCCESS");
  const [diagramKind, setDiagramKind] = useState<"FLOW" | "SEQUENCE" | "ACTIVITY" | "STATE_MACHINE">("FLOW");
  const [diagramFullscreen, setDiagramFullscreen] = useState(false);
  const [exportingDiagram, setExportingDiagram] = useState<"pdf" | "markdown" | null>(null);
  const diagramCaptureRef = useRef<HTMLDivElement>(null);

  // Transition builder inputs
  const [fromStateId, setFromStateId] = useState("");
  const [toStateId, setToStateId] = useState("");
  const [transAction, setTransAction] = useState("");

  // Rejection modal state
  const [rejectingSugId, setRejectingSugId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Onboarding Wizard state
  const prevFlowIdRef = useRef<string>("");
  const [rawApiKey, setRawApiKey] = useState("");
  const [selectedTab, setSelectedTab] = useState<"react" | "node">("react");
  const [sdkReadiness, setSdkReadiness] = useState<any>(null);
  const [isCheckingSdkReadiness, setIsCheckingSdkReadiness] = useState(false);
  const [demoStatus, setDemoStatus] = useState<any>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const suggestionAbortRef = useRef<AbortController | null>(null);
  const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  }, []);

  useEffect(() => {
    if (!diagramFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDiagramFullscreen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [diagramFullscreen]);

  // ─────────────────────────────────────────────────────────────
  // Onboarding / Environment Queries
  // ─────────────────────────────────────────────────────────────

  // Fetch onboarding progress
  const { data: onboardingProgress, refetch: refetchProgress } = useQuery<any>({
    queryKey: ["onboarding-progress", appId],
    queryFn: async () => {
      const res = await authenticatedFetch(
        `${ONBOARDING_API}/applications/${appId}/onboarding-progress`,
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch onboarding progress");
      return res.json();
    },
    enabled: !!appId,
  });

  // Fetch environments
  const { data: environments } = useQuery<any[]>({
    queryKey: ["environments", appId],
    queryFn: async () => {
      const res = await authenticatedFetch(
        `${ONBOARDING_API}/applications/${appId}/environments`,
      );
      if (!res.ok) throw new Error("Failed to fetch environments");
      return res.json();
    },
    enabled: !!appId,
  });

  const activeEnv = environments?.[0]; // Default Development environment

  const checkSdkReadiness = useCallback(async () => {
    if (!appId || !activeEnv) return null;

    setIsCheckingSdkReadiness(true);
    try {
      const res = await authenticatedFetch(
        `${ONBOARDING_API}/applications/${appId}/environments/${activeEnv.id}/sdk-readiness`,
      );
      if (!res.ok) throw new Error("Failed to verify SDK readiness");

      const data = await res.json();
      setSdkReadiness(data);
      if (data.installationTestPassed && data.connected) {
        void refetchProgress();
      }
      return data;
    } catch (err) {
      console.error("Failed to verify SDK readiness", err);
      return null;
    } finally {
      setIsCheckingSdkReadiness(false);
    }
  }, [appId, activeEnv, refetchProgress]);

  // ─────────────────────────────────────────────────────────────
  // Onboarding Mutations
  // ─────────────────────────────────────────────────────────────

  const selectProfileMutation = useMutation({
    mutationFn: async (profileType: string) => {
      const res = await authenticatedFetch(
        `${ONBOARDING_API}/applications/${appId}/profile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileType }),
        },
      );
      if (!res.ok) throw new Error("Failed to set profile template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["onboarding-progress", appId],
      });
      queryClient.invalidateQueries({ queryKey: ["declared-flows", appId] });
    },
  });

  const patchProgressMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await authenticatedFetch(
        `${ONBOARDING_API}/applications/${appId}/onboarding-progress`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) throw new Error("Failed to update progress");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["onboarding-progress", appId],
      });
    },
  });

  const generateKeyMutation = useMutation({
    mutationFn: async () => {
      if (!activeEnv) throw new Error("No environment initialized");
      const res = await authenticatedFetch(
        `${ONBOARDING_API}/environments/${activeEnv.id}/api-keys`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: "Onboarding API Key" }),
        },
      );
      if (!res.ok) throw new Error("Failed to generate API key");
      const data = await res.json();
      setRawApiKey(data.rawKey);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["environments", appId] });
    },
  });

  const analyzeDemoMutation = useMutation({
    mutationFn: async () => {
      if (!activeEnv) throw new Error("No environment initialized");

      // 1. Mark demo completed and first report generated
      await authenticatedFetch(
        `${ONBOARDING_API}/applications/${appId}/onboarding-progress`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            demonstrationCompleted: true,
            firstReportGenerated: true,
          }),
        },
      );

      // 2. Trigger reconciliation
      const res = await authenticatedFetch(
        `${FDRS_API}/applications/${appId}/reconciliation/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ environmentId: activeEnv.id }),
        },
      );
      if (!res.ok) throw new Error("Reconciliation trigger failed");

      // 3. Force auto-value realization check
      await authenticatedFetch(
        `${ONBOARDING_API}/internal/applications/${appId}/reconcile-value`,
        { method: "POST" },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["onboarding-progress", appId],
      });
      queryClient.invalidateQueries({
        queryKey: ["reconciliation-reports", appId],
      });
      refetchReconciliation();
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────

  // List flows
  const {
    data: flows,
    isLoading: flowsLoading,
    isError: flowsFailed,
    refetch: refetchFlows,
  } = useQuery<DeclaredFlow[]>({
    queryKey: ["declared-flows", appId],
    queryFn: async () => {
      const res = await authenticatedFetch(
        `${FDRS_API}/v1/applications/${appId}/flows`,
      );
      if (!res.ok) throw new Error("Failed to fetch declared flows");
      return res.json();
    },
    enabled: !!appId,
  });

  // Get selected flow details
  const { data: activeFlow, refetch: refetchActiveFlow } =
    useQuery<DeclaredFlow>({
      queryKey: ["declared-flow-details", selectedFlowId],
      queryFn: async () => {
        if (!selectedFlowId) return null as any;
        const res = await authenticatedFetch(
          `${FDRS_API}/v1/applications/${appId}/flows/${selectedFlowId}`,
        );
        if (!res.ok) throw new Error("Failed to fetch flow details");
        return res.json();
      },
      enabled: !!selectedFlowId,
    });

  const publishedVersionId = activeFlow?.publishedVersionId ?? activeFlow?.versions?.[0]?.id;
  const { data: diagramPayload } = useQuery<{ diagrams: Array<{ kind: string; source: string }> }>({
    queryKey: ["flow-diagrams", appId, selectedFlowId, publishedVersionId],
    queryFn: async () => {
      const response = await authenticatedFetch(`${FDRS_API}/v1/applications/${appId}/flows/${selectedFlowId}/versions/${publishedVersionId}/diagrams`);
      if (!response.ok) throw new Error("Failed to load Flow diagrams");
      return response.json();
    },
    enabled: Boolean(selectedFlowId && publishedVersionId && activeFlow?.status === "COMPLETE"),
  });

  const selectedDiagramSource = useMemo(() => {
    if (!activeFlow) return "";
    if (diagramKind === "FLOW") return flowAsMermaid(activeFlow);
    return (
      diagramPayload?.diagrams.find((diagram) => diagram.kind === diagramKind)
        ?.source ?? ""
    );
  }, [activeFlow, diagramKind, diagramPayload]);

  const exportDiagramMarkdown = async () => {
    if (!activeFlow || !selectedDiagramSource) {
      showToast("Diagram data is still loading. Please try again.");
      return;
    }
    setExportingDiagram("markdown");
    try {
      downloadTextFile(
        `${safeExportName(activeFlow.name)}-${diagramKind.toLowerCase()}.md`,
        flowAsMarkdown(activeFlow, diagramKind, selectedDiagramSource),
        "text/markdown;charset=utf-8",
      );
      showToast("Markdown diagram exported");
    } catch (error) {
      console.error("Failed to export diagram Markdown", error);
      showToast("Markdown export failed. Please try again.");
    } finally {
      setExportingDiagram(null);
    }
  };

  const exportDiagramPdf = async () => {
    if (!activeFlow) {
      showToast("Diagram data is still loading. Please try again.");
      return;
    }
    const captureTarget = diagramCaptureRef.current
      ?? document.getElementById("flow-diagram-capture");
    if (!captureTarget) {
      showToast("Diagram preview is not ready. Please try again.");
      return;
    }
    setExportingDiagram("pdf");
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);
      const image = await toPng(captureTarget, {
        backgroundColor: "#050505",
        pixelRatio: 2,
        filter: (node) =>
          !(node instanceof HTMLElement && node.dataset.exportIgnore === "true"),
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 36;
      const titleHeight = 42;
      const imageProperties = pdf.getImageProperties(image);
      const scale = Math.min(
        (pageWidth - margin * 2) / imageProperties.width,
        (pageHeight - margin * 2 - titleHeight) / imageProperties.height,
      );
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text(`${activeFlow.name} - ${diagramKind.replace("_", " ")}`, margin, margin);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`Version ${activeFlow.version} | ${activeFlow.status}`, margin, margin + 16);
      pdf.addImage(
        image,
        "PNG",
        margin,
        margin + titleHeight,
        imageProperties.width * scale,
        imageProperties.height * scale,
      );
      pdf.save(`${safeExportName(activeFlow.name)}-${diagramKind.toLowerCase()}.pdf`);
      showToast("PDF diagram exported");
    } catch (error) {
      console.error("Failed to export diagram PDF", error);
      showToast("PDF export failed. Please try again.");
    } finally {
      setExportingDiagram(null);
    }
  };

  const { data: suggestionResponse, isFetching: isSuggestionsLoading } =
    useQuery<FlowSuggestionsResponse>({
      queryKey: ["flow-suggestions", appId, selectedFlowId],
      queryFn: async () => {
        const res = await authenticatedFetch(
          `${FDRS_API}/v1/applications/${appId}/declared-flows/${selectedFlowId}/suggestions`,
        );
        if (!res.ok) throw new Error("Failed to fetch flow suggestions");
        return res.json();
      },
      enabled: !!selectedFlowId,
    });

  const generateSuggestions = useCallback(
    async (
      flow: DeclaredFlow,
      trigger:
        | "STATE_ADDED"
        | "TRANSITION_ADDED"
        | "SUGGESTION_ACCEPTED"
        | "MANUAL_REFRESH",
      includeAi: boolean,
      signal?: AbortSignal,
    ) => {
      const res = await authenticatedFetch(
        `${FDRS_API}/v1/applications/${appId}/declared-flows/${flow.id}/suggestions/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            graphVersion: flow.version,
            graphHash: flow.graphHash,
            trigger,
            includeAi,
          }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          payload.message ?? payload.error ?? "Failed to generate suggestions",
        );
      if (
        payload.data.graphVersion !== flow.version ||
        payload.data.graphHash !== flow.graphHash
      )
        return;
      queryClient.setQueryData(["flow-suggestions", appId, flow.id], payload);
      setSuggestionError(null);
    },
    [appId, queryClient],
  );

  const refreshAfterGraphMutation = useCallback(
    async (
      trigger: "STATE_ADDED" | "TRANSITION_ADDED" | "SUGGESTION_ACCEPTED",
    ) => {
      if (trigger !== "SUGGESTION_ACCEPTED") setHighlightedNodeIds([]);
      suggestionAbortRef.current?.abort();
      if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
      const refreshed = await refetchActiveFlow();
      const flow = refreshed.data;
      if (!flow) return;
      try {
        await generateSuggestions(flow, trigger, false);
        const controller = new AbortController();
        suggestionAbortRef.current = controller;
        suggestionTimerRef.current = setTimeout(() => {
          void generateSuggestions(
            flow,
            trigger,
            true,
            controller.signal,
          ).catch((error) => {
            if (error instanceof DOMException && error.name === "AbortError")
              return;
            setSuggestionError(
              error instanceof Error ? error.message : "AI enrichment failed",
            );
          });
        }, 500);
      } catch (error) {
        setSuggestionError(
          error instanceof Error ? error.message : "Suggestion refresh failed",
        );
      }
    },
    [generateSuggestions, refetchActiveFlow],
  );

  useEffect(
    () => () => {
      suggestionAbortRef.current?.abort();
      if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
    },
    [],
  );

  // Get reconciliation reports
  const { data: recReports, refetch: refetchReconciliation } = useQuery<
    ReconciliationReport[]
  >({
    queryKey: ["reconciliation-reports", appId],
    queryFn: async () => {
      const res = await authenticatedFetch(
        `${FDRS_API}/applications/${appId}/reconciliation`,
      );
      if (!res.ok) throw new Error("Failed to fetch reconciliation reports");
      return res.json();
    },
    enabled: !!appId,
  });

  const activeReport = useMemo(() => {
    return recReports?.find((r) => r.flowId === selectedFlowId);
  }, [recReports, selectedFlowId]);

  // ─────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────

  const createFlowMutation = useMutation({
    mutationFn: async (data: { name: string; workflowType: string; purpose: string; scopeStatement: string }) => {
      const res = await authenticatedFetch(
        `${FDRS_API}/v1/applications/${appId}/flows`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) throw new Error("Failed to create flow");
      return res.json() as Promise<DeclaredFlow>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["declared-flows", appId] });
      setSelectedFlowId(data.id);
      setNewFlowName("");
      setNewFlowPurpose("");
      setNewFlowScope("");
    },
  });

  const addStateMutation = useMutation({
    mutationFn: async (data: {
      stateName: string;
      category: string;
      provenance: string;
      role: "NORMAL" | "INITIAL" | "TERMINAL";
      terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE";
    }) => {
      const res = await authenticatedFetch(
        `${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/states`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) throw new Error("Failed to add state");
      return res.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: ["declared-flow-details", selectedFlowId],
      });
      setStateName("");
      await refreshAfterGraphMutation("STATE_ADDED");
    },
  });

  const addTransitionMutation = useMutation({
    mutationFn: async (data: {
      fromStateId: string;
      toStateId: string;
      action?: string;
      provenance: string;
    }) => {
      const res = await authenticatedFetch(
        `${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/transitions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) throw new Error("Failed to add transition");
      return res.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: ["declared-flow-details", selectedFlowId],
      });
      setFromStateId("");
      setToStateId("");
      setTransAction("");
      await refreshAfterGraphMutation("TRANSITION_ADDED");
    },
  });

  const acceptSuggestionMutation = useMutation({
    mutationFn: async (sugId: string) => {
      const res = await authenticatedFetch(
        `${FDRS_API}/v1/applications/${appId}/declared-flows/${selectedFlowId}/suggestions/${sugId}/accept`,
        {
          method: "POST",
        },
      );
      if (!res.ok) throw new Error("Failed to accept suggestion");
      return res.json();
    },
    onSuccess: async (data) => {
      const createdIds =
        data?.data?.createdNodes?.map((node: { id: string }) => node.id) ?? [];
      setHighlightedNodeIds(createdIds);
      queryClient.invalidateQueries({
        queryKey: ["declared-flow-details", selectedFlowId],
      });
      queryClient.invalidateQueries({
        queryKey: ["flow-suggestions", appId, selectedFlowId],
      });
      await refreshAfterGraphMutation("SUGGESTION_ACCEPTED");
    },
  });

  const rejectSuggestionMutation = useMutation({
    mutationFn: async (data: { sugId: string; reason?: string }) => {
      const res = await authenticatedFetch(
        `${FDRS_API}/v1/applications/${appId}/declared-flows/${selectedFlowId}/suggestions/${data.sugId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejectionReason: data.reason }),
        },
      );
      if (!res.ok) throw new Error("Failed to reject suggestion");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["declared-flow-details", selectedFlowId],
      });
      queryClient.invalidateQueries({
        queryKey: ["flow-suggestions", appId, selectedFlowId],
      });
      setRejectingSugId(null);
      setRejectionReason("");
    },
  });

  const dismissSuggestionMutation = useMutation({
    mutationFn: async (sugId: string) => {
      const res = await authenticatedFetch(
        `${FDRS_API}/v1/applications/${appId}/declared-flows/${selectedFlowId}/suggestions/${sugId}/dismiss`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed to dismiss suggestion");
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["flow-suggestions", appId, selectedFlowId],
      }),
  });

  const editSuggestionMutation = useMutation({
    mutationFn: async (data: { sugId: string; suggestedStateName: string }) => {
      const res = await authenticatedFetch(
        `${FDRS_API}/v1/applications/${appId}/declared-flows/${selectedFlowId}/suggestions/${data.sugId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestedStateName: data.suggestedStateName }),
        },
      );
      if (!res.ok) throw new Error("Failed to edit suggestion");
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["flow-suggestions", appId, selectedFlowId],
      }),
  });

  const completeFlowMutation = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(
        `${FDRS_API}/v1/applications/${appId}/flows/${selectedFlowId}/publish`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.validation?.issues?.map((issue: { message: string }) => issue.message).join(" ") || "Failed to publish Flow");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["declared-flows", appId] });
      queryClient.invalidateQueries({
        queryKey: ["declared-flow-details", selectedFlowId],
      });
      refetchReconciliation();
      if (onboardingProgress && !onboardingProgress.expectedFlowsDefined) {
        patchProgressMutation.mutate({ expectedFlowsDefined: true });
      }
    },
  });

  const reopenFlowMutation = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(
        `${FDRS_API}/v1/applications/${appId}/flows/${selectedFlowId}/versions/${activeFlow?.publishedVersionId ?? activeFlow?.versions?.[0]?.id}/revise`,
        {
          method: "POST",
        },
      );
      if (!res.ok) throw new Error("Failed to reopen flow");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["declared-flows", appId] });
      queryClient.invalidateQueries({
        queryKey: ["declared-flow-details", selectedFlowId],
      });
    },
  });

  const promoteStateMutation = useMutation({
    mutationFn: async (data: {
      stateName: string;
      accepted: boolean;
      reason?: string;
    }) => {
      const res = await authenticatedFetch(
        `${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/promote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) throw new Error("Failed to promote state");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["declared-flow-details", selectedFlowId],
      });
      refetchReconciliation();
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Visual Flow Diagram (using @xyflow/react)
  // ─────────────────────────────────────────────────────────────

  // Synchronize local nodes and edges state when activeFlow changes (stable dragging)
  useEffect(() => {
    if (!activeFlow) {
      setNodes([]);
      setEdges([]);
      prevFlowIdRef.current = "";
      return;
    }

    const stateList = activeFlow.states;
    const transList = activeFlow.transitions;

    const initialEdges: Edge[] = transList.map((t) => ({
      id: t.id,
      source: t.fromStateId,
      target: t.toStateId,
      label: t.action || "Transition",
      data: { fullLabel: t.action || "Transition" },
      type: "copyableTransition",
      animated: activeFlow.status === "DRAFT",
      style: { stroke: "#404040" },
      labelStyle: { fill: "#737373", fontSize: 9, fontFamily: "monospace" },
      labelBgStyle: { fill: "#0a0a0a" },
    }));
    setEdges(initialEdges);

    if (activeFlow.id !== prevFlowIdRef.current) {
      // Switched flows: calculate new initial positions
      const initialNodes: Node[] = stateList.map((s, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        return {
          id: s.id,
          position: { x: col * 220 + 50, y: row * 150 + 50 },
          data: {
            label: (
              <CopyableGraphLabel
                value={s.stateName}
                maxLength={28}
                kind="state"
              />
            ),
          },
          style: {
            background: "#0a0a0a",
            color: s.category === "ERROR" ? "#f87171" : "#e5e5e5",
            border:
              s.category === "ERROR"
                ? "1px solid #7f1d1d"
                : "1px solid #262626",
            borderRadius: "8px",
            padding: "10px 15px",
            fontSize: "11px",
            fontWeight: "600",
            fontFamily: "monospace",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          },
        };
      });
      setNodes(initialNodes);
      prevFlowIdRef.current = activeFlow.id;
    } else {
      // Same flow, update existing nodes list preserving positions
      setNodes((prevNodes) => {
        const updatedNodes = prevNodes.filter((n) =>
          stateList.some((s) => s.id === n.id),
        );

        stateList.forEach((s, idx) => {
          if (!updatedNodes.some((n) => n.id === s.id)) {
            const col = idx % 3;
            const row = Math.floor(idx / 3);
            updatedNodes.push({
              id: s.id,
              position: { x: col * 220 + 50, y: row * 150 + 50 },
              data: {
                label: (
                  <CopyableGraphLabel
                    value={s.stateName}
                    maxLength={28}
                    kind="state"
                  />
                ),
              },
              style: {
                background: "#0a0a0a",
                color: s.category === "ERROR" ? "#f87171" : "#e5e5e5",
                border: highlightedNodeIds.includes(s.id)
                  ? "2px solid #10b981"
                  : s.category === "ERROR"
                    ? "1px solid #7f1d1d"
                    : "1px solid #262626",
                borderRadius: "8px",
                padding: "10px 15px",
                fontSize: "11px",
                fontWeight: "600",
                fontFamily: "monospace",
                boxShadow: highlightedNodeIds.includes(s.id)
                  ? "0 0 18px rgba(16,185,129,.35)"
                  : "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              },
            });
          }
        });

        return updatedNodes.map((n) => {
          const s = stateList.find((x) => x.id === n.id);
          if (s) {
            return {
              ...n,
              data: {
                label: (
                  <CopyableGraphLabel
                    value={s.stateName}
                    maxLength={28}
                    kind="state"
                  />
                ),
              },
              style: {
                ...n.style,
                color: s.category === "ERROR" ? "#f87171" : "#e5e5e5",
                border: highlightedNodeIds.includes(s.id)
                  ? "2px solid #10b981"
                  : s.category === "ERROR"
                    ? "1px solid #7f1d1d"
                    : "1px solid #262626",
                boxShadow: highlightedNodeIds.includes(s.id)
                  ? "0 0 18px rgba(16,185,129,.35)"
                  : n.style?.boxShadow,
              },
            };
          }
          return n;
        });
      });
    }
  }, [activeFlow, highlightedNodeIds]);

  // Auto-select active flow on load
  useEffect(() => {
    if (flows && flows.length > 0 && !selectedFlowId) {
      const activeDecl = flows.find((f) => f.status === "DRAFT") || flows[0];
      if (activeDecl) {
        setSelectedFlowId(activeDecl.id);
      }
    }
  }, [flows, selectedFlowId]);

  // Poll SDK readiness status
  useEffect(() => {
    if (
      !appId ||
      !activeEnv ||
      !onboardingProgress ||
      onboardingProgress.completedAt
    )
      return;
    if (
      onboardingProgress.templateSelected &&
      onboardingProgress.expectedFlowsDefined &&
      (!onboardingProgress.sdkConnected ||
        !onboardingProgress.installationTestPassed)
    ) {
      void checkSdkReadiness();
      const interval = setInterval(() => {
        void checkSdkReadiness();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [appId, activeEnv, onboardingProgress, checkSdkReadiness]);

  // Poll Demonstration status
  useEffect(() => {
    if (
      !appId ||
      !activeEnv ||
      !onboardingProgress ||
      onboardingProgress.completedAt
    )
      return;
    if (
      onboardingProgress.sdkConnected &&
      !onboardingProgress.demonstrationCompleted
    ) {
      const interval = setInterval(async () => {
        try {
          const res = await authenticatedFetch(
            `${ONBOARDING_API}/applications/${appId}/environments/${activeEnv.id}/demo-status`,
          );
          if (res.ok) {
            const data = await res.json();
            setDemoStatus(data);
          }
        } catch (err) {
          console.error("Failed to poll demo status", err);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [appId, activeEnv, onboardingProgress]);

  const pendingSuggestions = useMemo(() => {
    return (suggestionResponse?.data.suggestions ?? [])
      .filter(
        (suggestion) =>
          suggestion.status === "PENDING" || suggestion.status === "EDITED",
      )
      .toSorted((a, b) => b.confidence - a.confidence);
  }, [suggestionResponse]);

  // Auto-complete onboarding once demonstration is finished so the user isn't trapped in Stage 5
  useEffect(() => {
    if (
      onboardingProgress &&
      !onboardingProgress.completedAt &&
      onboardingProgress.demonstrationCompleted
    ) {
      patchProgressMutation.mutate({ completedAt: new Date() });
    }
  }, [onboardingProgress]);

  const onboardingIsActive =
    onboardingProgress && !onboardingProgress.completedAt;

  if (onboardingIsActive && flowsLoading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <p className="text-sm text-neutral-400" role="status">
          Loading declared flowsâ€¦
        </p>
      </div>
    );
  }

  if (onboardingIsActive && flowsFailed) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4 rounded-md border border-[#262626] bg-[#131313] p-8 text-center">
          <h2 className="text-xl font-bold text-white">
            Declared flows could not be loaded
          </h2>
          <p className="text-sm text-neutral-400">
            Retry before continuing onboarding so existing desktop flows are
            not hidden.
          </p>
          <Button type="button" onClick={() => void refetchFlows()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // A Flow created by another client is authoritative. Onboarding progress is
  // client-local guidance and must not hide the shared Flow builder, even when
  // legacy demonstration flags were not synchronized by the desktop app.
  if (onboardingIsActive && !flows?.length) {
    // Stage 1: Select profile template
    if (!onboardingProgress.templateSelected) {
      if (flowsLoading) {
        return (
          <div className="flex min-h-[80vh] items-center justify-center px-4">
            <p className="text-sm text-neutral-400" role="status">
              Loading declared flows…
            </p>
          </div>
        );
      }

      if (flowsFailed) {
        return (
          <div className="flex min-h-[80vh] items-center justify-center px-4">
            <div className="w-full max-w-md space-y-4 rounded-md border border-[#262626] bg-[#131313] p-8 text-center">
              <h2 className="text-xl font-bold text-white">
                Declared flows could not be loaded
              </h2>
              <p className="text-sm text-neutral-400">
                Retry before creating a new application profile so existing
                desktop flows are not hidden.
              </p>
              <Button type="button" onClick={() => void refetchFlows()}>
                Retry
              </Button>
            </div>
          </div>
        );
      }

      // A flow created by another client (for example the desktop app) is
      // authoritative even when legacy onboarding progress was never updated.
      // Continue to the shared flow builder instead of showing setup again.
      if (!flows?.length) {
        return (
        <div className="flex min-h-[80vh] items-center justify-center px-4">
          <div className="w-full max-w-2xl space-y-2 rounded-md border border-[#262626] bg-[#131313] p-8 backdrop-blur-xl shadow-2xl">
            <div className="w-full flex justify-between items-start">
              <h2 className="text-3xl font-extrabold tracking-tight text-white">
                Select Application Profile
              </h2>
              <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
                APPLICATION // PROFILE
              </span>
            </div>
            <div className="text-left">
              <p className="mt-2 text-sm text-neutral-400">
                Choose a workflow template to preload standard states and
                transitions, or start from scratch.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              {[
                {
                  id: "ECOMMERCE",
                  name: "E-commerce Store",
                  desc: "Auto-generates typical shop flow: Anonymous → Browse → View Product → Add to Cart → Checkout → Success",
                  icon: Layers,
                },
                {
                  id: "LMS",
                  name: "Education / LMS",
                  desc: "Auto-generates typical learning flow: Anonymous → View Courses → Select → Enroll → Start Lesson → Complete",
                  icon: ClipboardList,
                },
                {
                  id: "CUSTOM",
                  name: "Custom Flow",
                  desc: "Start with a blank canvas to construct your application's exact state model manually",
                  icon: Plus,
                },
              ].map((template) => {
                const IconComponent = template.icon;
                return (
                  <button
                    key={template.id}
                    onClick={() => selectProfileMutation.mutate(template.id)}
                    disabled={selectProfileMutation.isPending}
                    className="flex flex-col items-center p-6 bg-black/40 hover:bg-[#131313] border border-[#262626] hover:border-white/50 rounded-md text-center transition-all duration-200 group"
                  >
                    <div className="p-3 bg-[#131313] group-hover:bg-black border border-[#262626] rounded-lg text-neutral-400 group-hover:text-white transition-colors mb-4">
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <span className="font-bold text-sm text-white group-hover:text-white transition-colors mb-2">
                      {template.name}
                    </span>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {template.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        );
      }
    }

    // Stage 3: SDK Connection Check
    if (
      onboardingProgress.expectedFlowsDefined &&
      (!onboardingProgress.sdkConnected ||
        !onboardingProgress.installationTestPassed)
    ) {
      const sdkConnected =
        sdkReadiness?.connected ?? onboardingProgress.sdkConnected ?? false;
      const installationTestPassed =
        sdkReadiness?.installationTestPassed ??
        onboardingProgress.installationTestPassed ??
        false;
      const currentStage = !sdkConnected ? 1 : !installationTestPassed ? 2 : 3;

      const apiKeyToShow = rawApiKey || "YOUR_API_KEY";
      const environmentId = activeEnv?.id || "YOUR_ENVIRONMENT_ID";
      const sdkCode =
        selectedTab === "react"
          ? `'use client';\n\nimport { useEffect, type ReactNode } from 'react';\nimport { TELLANN } from '@tellann/frontend-sdk';\n\nexport function TellannProvider({ children }: { children: ReactNode }) {\n  useEffect(() => {\n    TELLANN.initialize({\n      endpoint: 'http://localhost:3000',\n      apiKey: '${apiKeyToShow}',\n      applicationId: '${appId}',\n      environmentId: '${environmentId}'\n    });\n\n    void TELLANN.verifyInstallation();\n\n    return () => TELLANN.teardown();\n  }, []);\n\n  return children;\n}`
          : `const { TELLANN } = require('@tellann/backend-sdk');\n\nasync function verifyTellannInstall() {\n  TELLANN.initialize({\n    endpoint: 'http://localhost:3000',\n    apiKey: '${apiKeyToShow}',\n    applicationId: '${appId}',\n    environmentId: '${environmentId}'\n  });\n\n  await TELLANN.verifyInstallation();\n}\n\nverifyTellannInstall().catch(console.error);`;

      return (
        <div className="flex min-h-[85vh] items-center justify-center px-4">
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-5 gap-8 bg-[#131313]/40 border border-[#262626] p-8 rounded-md backdrop-blur-xl shadow-2xl">
            {/* Connection Status Panel */}
            <div className="md:col-span-2 space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white">
                  SDK Installation
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Connect your code to the Tellann gateway.
                </p>
              </div>

              {/* API Key Loader */}
              {!rawApiKey && !activeEnv?.apiKeys?.length ? (
                <div className="rounded-md border border-dashed border-[#262626] bg-black/20 p-5 text-center space-y-3">
                  <p className="text-xs text-neutral-400">
                    Generate an environment-scoped API Key for Development to
                    start sending telemetry.
                  </p>
                  <Button
                    onClick={() => generateKeyMutation.mutate()}
                    disabled={generateKeyMutation.isPending}
                    variant="primary"
                    className="w-full text-xs py-2 rounded-lg"
                  >
                    {generateKeyMutation.isPending
                      ? "Generating..."
                      : "Generate API Key"}
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border border-[#262626] bg-black p-4 space-y-2">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                    Development API Key
                  </span>
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-mono text-neutral-300 truncate max-w-[80%]">
                      {rawApiKey ||
                        `${activeEnv?.apiKeys?.[0]?.keyPrefix}****************`}
                    </code>
                    {rawApiKey && (
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(rawApiKey);
                          setCopiedKey(true);
                          showToast("API Key copied to clipboard");
                          setTimeout(() => setCopiedKey(false), 2000);
                        }}
                        variant="icon"
                        size="icon"
                        className="bg-[#131313] border border-[#262626] h-8 w-8 text-neutral-400 hover:text-white"
                        tooltip="Copy API Key"
                      >
                        {copiedKey ? (
                          <Check className="h-3.5 w-3.5 text-white" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                  {!rawApiKey && (
                    <p className="text-[10px] text-white">
                      Existing keys are masked after creation. Generate a new
                      key if you need a copy-pasteable API key.
                    </p>
                  )}
                </div>
              )}

              {/* Staged Tracker */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider text-neutral-400">
                  Connection Checklist
                </h3>
                <div className="space-y-3">
                  {[
                    {
                      stage: 1,
                      label: "Initialize SDK in code",
                      desc: "Tellann SDK package added & configured.",
                    },
                    {
                      stage: 2,
                      label: "Establish session connection",
                      desc: "At least one telemetry session observed.",
                    },
                    {
                      stage: 3,
                      label: "Onboarding test event pass",
                      desc: "TELLANN_ONBOARDING_TEST event successfully received.",
                    },
                  ].map((s) => {
                    const isPassed =
                      currentStage > s.stage ||
                      (s.stage === 3 && installationTestPassed) ||
                      (s.stage === 2 && sdkConnected);
                    const isActive = currentStage === s.stage;
                    return (
                      <div
                        key={s.stage}
                        className={`flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200 ${isPassed ? "border-[#262626] bg-black" : isActive ? "border-[#262626] bg-[#131313]" : "border-neutral-850 bg-black/10"}`}
                      >
                        <div
                          className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${isPassed ? "border-white bg-white/20 text-white" : isActive ? "border-white bg-white/25 text-white animate-pulse" : "border-[#262626] text-neutral-500"}`}
                        >
                          {isPassed ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <span className="text-[10px] font-bold">
                              {s.stage}
                            </span>
                          )}
                        </div>
                        <div>
                          <span
                            className={`text-xs font-bold ${isPassed ? "text-white" : isActive ? "text-white" : "text-neutral-400"}`}
                          >
                            {s.label}
                          </span>
                          <p className="text-[10px] text-neutral-500 mt-0.5">
                            {s.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Code Integration Snippet */}
            <div className="md:col-span-3 space-y-4 flex flex-col justify-between">
              <div className="space-y-3 flex-1">
                <div className="flex items-center justify-between border-b border-[#262626] pb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                    <Terminal className="h-4 w-4 text-white" />
                    <span>Quickstart Snippet</span>
                  </span>
                  <div className="flex space-x-1.5">
                    {["react", "node"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setSelectedTab(tab as any)}
                        className={`text-[10px] px-2.5 py-1 rounded font-bold uppercase transition-colors ${selectedTab === tab ? "bg-white text-black font-bold" : "bg-black text-neutral-400 border border-[#262626] hover:text-white"}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative bg-black border border-[#262626] p-4 rounded-md font-mono text-[11px] text-neutral-300 leading-relaxed overflow-x-auto h-[280px]">
                  <pre className="whitespace-pre select-all">{sdkCode}</pre>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(sdkCode);
                      setCopiedSnippet(true);
                      showToast("Snippet copied to clipboard");
                      setTimeout(() => setCopiedSnippet(false), 2000);
                    }}
                    variant="icon"
                    size="icon"
                    className="absolute top-4 right-4 bg-[#131313] border border-[#262626] h-8 w-8 text-neutral-400 hover:text-white"
                    tooltip="Copy Snippet"
                  >
                    {copiedSnippet ? (
                      <Check className="h-3.5 w-3.5 text-white" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center text-xs text-neutral-500 bg-black/30 p-4 rounded-md border border-[#262626]">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-3.5 w-3.5 text-white animate-spin" />
                  <span>
                    {isCheckingSdkReadiness
                      ? "Verifying SDK connection..."
                      : "Waiting for telemetry signals..."}
                  </span>
                </div>
                <Button
                  onClick={() => {
                    void checkSdkReadiness();
                  }}
                  disabled={isCheckingSdkReadiness}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:underline hover:bg-transparent font-semibold p-0 h-auto"
                >
                  {isCheckingSdkReadiness ? "Checking..." : "Force check"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Stage 4: Run Demonstration Walkthrough
    if (
      onboardingProgress.installationTestPassed &&
      !onboardingProgress.demonstrationCompleted
    ) {
      const observed = demoStatus?.observedStates ?? 0;
      const required = demoStatus?.minStatesRequired ?? 3;
      const percent = Math.min(100, Math.round((observed / required) * 100));
      const ready = demoStatus?.readyForAnalysis ?? false;

      return (
        <div className="flex min-h-[80vh] items-center justify-center px-4">
          <div className="w-full max-w-xl space-y-8 rounded-md border border-[#262626] bg-[#131313] p-8 backdrop-blur-xl shadow-2xl text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-black border border-[#262626] text-white">
                <Play className="h-6 w-6 animate-pulse" />
              </div>
              <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
                Demonstrate Workflows
              </h2>
              <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto">
                Now start your app and interact with it. Go through at least{" "}
                <span className="font-semibold text-white">
                  {required} states
                </span>{" "}
                so Tellann can build its observed behavioral model.
              </p>
            </div>

            {/* Gauge */}
            <div className="relative py-6 flex flex-col items-center justify-center">
              <div className="w-36 h-36 rounded-full border-4 border-neutral-805 flex flex-col items-center justify-center relative bg-black">
                <div
                  className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin"
                  style={{ animationDuration: "6s" }}
                ></div>
                <span className="text-3xl font-black text-white font-mono">
                  {observed}
                </span>
                <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider mt-1">
                  Observed
                </span>
              </div>
              <div className="mt-4 text-xs text-neutral-400 font-mono">
                Target: {required} states (based on expected graph scale)
              </div>
            </div>

            <div className="space-y-4">
              <div className="w-full bg-black h-2 rounded-full overflow-hidden border border-[#262626]">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                ></div>
              </div>

              {ready ? (
                <div className="rounded-lg bg-[#131313] border border-[#262626] p-4 text-sm text-white flex items-start space-x-3 text-left">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-white flex-shrink-0" />
                  <div>
                    <span className="font-bold">
                      Observation threshold met!
                    </span>{" "}
                    You have recorded enough telemetry events to run a
                    reconciliation comparison. Click Analyze below to generate
                    your report.
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-black/40 border border-[#262626] p-4 text-xs text-neutral-400 text-left space-y-2">
                  <span className="font-bold text-white">
                    Expected Flow Walkthrough Guide:
                  </span>
                  <div className="text-[10px] text-neutral-500 mt-1">
                    To cover this profile, perform actions to visit these
                    declared states in your app:
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {activeFlow?.states.map((s: any) => (
                      <span
                        key={s.id}
                        className="px-2 py-0.5 bg-[#131313] border border-[#262626] rounded text-neutral-400 font-mono text-[9px]"
                      >
                        {s.stateName}
                      </span>
                    ))}
                  </div>
                  {activeFlow?.transitions &&
                    activeFlow.transitions.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <span className="font-semibold text-[11px] text-neutral-350">
                          Expected Transitions:
                        </span>
                        <div className="max-h-24 overflow-y-auto pr-1 text-[10px] text-neutral-550 font-mono space-y-0.5 mt-1">
                          {activeFlow.transitions.map((t: any) => (
                            <div
                              key={t.id}
                              className="flex items-center space-x-1.5"
                            >
                              <span className="text-neutral-400">
                                {t.fromState?.stateName || "Start"}
                              </span>
                              <span>→</span>
                              <span className="text-neutral-300">
                                {t.toState?.stateName || "End"}
                              </span>
                              {t.action && (
                                <span className="text-neutral-600">
                                  ({t.action})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}

              <Button
                onClick={() => analyzeDemoMutation.mutate()}
                disabled={analyzeDemoMutation.isPending || !ready}
                loading={analyzeDemoMutation.isPending}
                variant="primary"
                size="lg"
                className="w-full shadow-lg shadow-blue-600/15"
              >
                <span>Analyze Demonstration & Generate Report</span>
                {!analyzeDemoMutation.isPending && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      );
    }
  }

  if (!appId) {
    return <ApplicationRequiredState feature="Flow declaration" />;
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      {onboardingProgress &&
        !onboardingProgress.expectedFlowsDefined &&
        !flows?.some((flow) => flow.status === "COMPLETE") && (
        <div className="rounded-md border border-white/20 bg-white/5 p-4 flex items-start space-x-3 text-white">
          {/* <Info className="h-5 w-5 flex-shrink-0 mt-0.5" /> */}
          <div className="text-sm">
            <span className="font-semibold">
              Step 2: Define expected workflows.
            </span>{" "}
            We&apos;ve preloaded a standard flow graph. Feel free to drag states
            around to clean up the layout, add edges, or create states. Click{" "}
            <span className="font-semibold">Mark Complete & Compile</span> at
            the top right when you are ready to configure the SDK.
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#262626] pb-5 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-3">
            <span>Flow Declaration Builder</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Author top-down intent graphs and get real-time branch state
            suggestions.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Select
            value={selectedFlowId}
            onValueChange={setSelectedFlowId}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="-- Select a Declared Flow --">
                {(() => {
                  const f = flows?.find((fl) => fl.id === selectedFlowId);
                  return f ? `${f.name} (v${f.version}) [${f.status}]` : "";
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">-- Select a Declared Flow --</SelectItem>
              {flows?.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} (v{f.version}) [{f.status}]
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFlow && (
            <>
              {activeFlow.status === "DRAFT" ? (
                <Button
                  onClick={() => completeFlowMutation.mutate()}
                  disabled={
                    completeFlowMutation.isPending ||
                    activeFlow.states.length === 0
                  }
                  loading={completeFlowMutation.isPending}
                  variant="primary"
                >
                  {!completeFlowMutation.isPending && <Lock className="h-4 w-4" />}
                  <span>Publish Flow</span>
                </Button>
              ) : (
                <Button
                  onClick={() => reopenFlowMutation.mutate()}
                  disabled={reopenFlowMutation.isPending}
                  loading={reopenFlowMutation.isPending}
                  variant="secondary"
                >
                  {!reopenFlowMutation.isPending && <Unlock className="h-4 w-4" />}
                  <span>Create Flow Revision</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Panel 1: Flow List & Creator + Builder */}
        <div className="lg:col-span-2 flex flex-col space-y-6 min-h-0">
          {!selectedFlowId ? (
            <div className="flex-1 rounded-md border border-[#262626] bg-[#131313] backdrop-blur-xl p-8 flex flex-col items-center justify-center text-center space-y-6">
              <div className="max-w-sm space-y-2">
                <h3 className="text-lg font-bold text-white">
                  Declare Intent as a focused Flow
                </h3>
                <p className="text-xs text-neutral-400">
                  Choose an existing flow from the dropdown, or create a new
                  Flow to define one bounded functionality. Larger scopes reduce analysis and QA precision.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newFlowName.trim()) {
                    createFlowMutation.mutate({
                      name: newFlowName.trim(),
                      workflowType: newFlowType,
                      purpose: newFlowPurpose.trim(),
                      scopeStatement: newFlowScope.trim(),
                    });
                  }
                }}
                className="w-full max-w-sm space-y-4 border border-[#262626] bg-black p-6 rounded-md text-left"
              >
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">
                    FLOW NAME
                  </label>
                  <input
                    type="text"
                    required
                    value={newFlowName}
                    onChange={(e) => setNewFlowName(e.target.value)}
                    placeholder="e.g. Checkout Flow"
                    className="w-full rounded-lg border border-[#262626] bg-[#131313] px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">PURPOSE</label>
                  <input type="text" value={newFlowPurpose} onChange={(e) => setNewFlowPurpose(e.target.value)} placeholder="What should this functionality achieve?" className="w-full rounded-lg border border-[#262626] bg-[#131313] px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">SCOPE BOUNDARY</label>
                  <textarea required value={newFlowScope} onChange={(e) => setNewFlowScope(e.target.value)} placeholder="e.g. Guest opens sign-up through authenticated session" className="w-full rounded-lg border border-[#262626] bg-[#131313] px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none" />
                  <p className="mt-1 text-[11px] text-amber-300">Do not declare the whole project as one Flow. Prefer authentication, checkout, password reset, or another focused capability.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">
                    WORKFLOW TYPE
                  </label>
                  <Select
                    value={newFlowType}
                    onValueChange={setNewFlowType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select workflow type...">
                        {newFlowType === "CUSTOM" && "Custom"}
                        {newFlowType === "CHECKOUT" && "Checkout"}
                        {newFlowType === "AUTHENTICATION" && "Authentication"}
                        {newFlowType === "REGISTRATION" && "Registration"}
                        {newFlowType === "ASSESSMENT" && "Assessment"}
                        {newFlowType === "ENROLLMENT" && "Enrollment"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                      <SelectItem value="CHECKOUT">Checkout</SelectItem>
                      <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                      <SelectItem value="REGISTRATION">Registration</SelectItem>
                      <SelectItem value="ASSESSMENT">Assessment</SelectItem>
                      <SelectItem value="ENROLLMENT">Enrollment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  disabled={createFlowMutation.isPending || !newFlowName.trim() || !newFlowScope.trim()}
                  loading={createFlowMutation.isPending}
                  variant="primary"
                  className="w-full"
                >
                  {!createFlowMutation.isPending && <Plus className="h-4 w-4" />}
                  <span>Create Flow</span>
                </Button>
              </form>
            </div>
          ) : !activeFlow ? (
            <div className="flex-1 rounded-md border border-[#262626] bg-[#131313] backdrop-blur-xl p-8 flex items-center justify-center">
              <div className="text-neutral-400 animate-pulse text-sm">
                Loading flow details...
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-6 min-h-0">
              {/* Interactive Flow Visualizer */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#262626] bg-[#0d0d0d] p-2">
                <div className="flex flex-wrap gap-2" aria-label="Diagram type">
                  {(["FLOW", "SEQUENCE", "ACTIVITY", "STATE_MACHINE"] as const).map((kind) => (
                    <button key={kind} type="button" onClick={() => setDiagramKind(kind)} className={`rounded-md border px-3 py-1.5 text-xs ${diagramKind === kind ? "border-white bg-white text-black" : "border-[#262626] bg-[#131313] text-neutral-300 hover:border-neutral-500"}`}>
                      {kind.replace("_", " ")}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2" aria-label="Diagram actions">
                  <button
                    type="button"
                    onClick={() => void exportDiagramMarkdown()}
                    disabled={Boolean(exportingDiagram) || !selectedDiagramSource}
                    className="inline-flex items-center gap-2 rounded-md border border-[#262626] bg-[#131313] px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500 disabled:opacity-50"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {exportingDiagram === "markdown" ? "Exporting..." : "Markdown"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportDiagramPdf()}
                    disabled={Boolean(exportingDiagram)}
                    className="inline-flex items-center gap-2 rounded-md border border-[#262626] bg-[#131313] px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {exportingDiagram === "pdf" ? "Exporting..." : "PDF"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiagramFullscreen(true)}
                    className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Full screen
                  </button>
                </div>
              </div>
              <div
                className={diagramFullscreen
                  ? "fixed inset-0 z-[100] flex flex-col bg-[#050505] p-4"
                  : "flex h-[460px] flex-col overflow-hidden rounded-md border border-[#262626] bg-black"}
                role={diagramFullscreen ? "dialog" : undefined}
                aria-modal={diagramFullscreen ? true : undefined}
                aria-label={diagramFullscreen ? `${activeFlow.name} diagram full screen` : undefined}
              >
                {diagramFullscreen ? (
                  <div className="mb-3 flex items-center justify-between border-b border-[#262626] pb-3" data-export-ignore="true">
                    <div>
                      <p className="text-sm font-semibold text-white">{activeFlow.name}</p>
                      <p className="text-xs text-neutral-500">{diagramKind.replace("_", " ")} diagram - version {activeFlow.version}</p>
                    </div>
                    <button type="button" onClick={() => setDiagramFullscreen(false)} className="inline-flex items-center gap-2 rounded-md border border-[#262626] px-3 py-2 text-xs text-white hover:bg-white/10">
                      <Minimize2 className="h-4 w-4" /> Exit full screen
                    </button>
                  </div>
                ) : null}
                <div id="flow-diagram-capture" ref={diagramCaptureRef} className="relative min-h-0 flex-1 overflow-hidden bg-black">
                  <div className="absolute left-4 top-4 z-10 flex items-center space-x-2 rounded-lg border border-[#262626] bg-[#131313]/80 px-3 py-1.5 backdrop-blur">
                    <span className="h-2 w-2 rounded-full bg-white"></span>
                    <span className="text-xs font-semibold text-neutral-300">
                      {activeFlow.name} (v{activeFlow.version}) - {activeFlow.status}
                    </span>
                  </div>

                  {diagramKind !== "FLOW" && selectedDiagramSource ? (
                    <>
                      <pre className="h-full overflow-auto whitespace-pre-wrap p-16 text-xs text-neutral-300">{selectedDiagramSource}</pre>
                      <button type="button" data-export-ignore="true" onClick={() => setDiagramFullscreen((value) => !value)} className="absolute bottom-4 left-4 rounded border border-[#262626] bg-[#131313] p-2 text-neutral-300 hover:text-white" aria-label={diagramFullscreen ? "Exit diagram full screen" : "Open diagram full screen"} title={diagramFullscreen ? "Exit full screen" : "Open full screen"}>
                        {diagramFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                      </button>
                    </>
                  ) : nodes.length > 0 ? (
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      edgeTypes={declarationEdgeTypes}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      fitView
                    >
                      <Background color="#222" />
                      <Controls data-export-ignore="true">
                        <ControlButton onClick={() => setDiagramFullscreen((value) => !value)} title={diagramFullscreen ? "Exit full screen" : "Open full screen"} aria-label={diagramFullscreen ? "Exit diagram full screen" : "Open diagram full screen"}>
                          {diagramFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </ControlButton>
                      </Controls>
                    </ReactFlow>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500 font-mono">
                      [No nodes in diagram. Add states below to begin]
                    </div>
                  )}
                </div>
              </div>

              {/* Builder Controls */}
              {activeFlow.status === "DRAFT" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Add State */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (stateName.trim()) {
                        addStateMutation.mutate({
                          stateName: stateName.toUpperCase().trim(),
                          category: stateCategory,
                          provenance: "USER_AUTHORED",
                          role: stateRole,
                          terminalKind: stateRole === "TERMINAL" ? terminalKind : undefined,
                        });
                      }
                    }}
                    className="rounded-md border border-[#262626] bg-[#131313] p-5 space-y-4"
                  >
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <Plus className="h-4 w-4 text-white" />
                      <span>Add Declared State</span>
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 mb-1">
                          STATE NAME
                        </label>
                        <input
                          type="text"
                          required
                          value={stateName}
                          onChange={(e) => setStateName(e.target.value)}
                          placeholder="e.g. PAYMENT_FAILED"
                          className="w-full rounded-lg border border-[#262626] bg-black px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 mb-1">BOUNDARY ROLE</label>
                        <Select value={stateRole} onValueChange={(value) => setStateRole(value as typeof stateRole)}>
                          <SelectTrigger><SelectValue placeholder="Select boundary role" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NORMAL">Intermediate</SelectItem>
                            <SelectItem value="INITIAL">Initial state</SelectItem>
                            <SelectItem value="TERMINAL">Terminal state</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {stateRole === "TERMINAL" ? (
                        <div>
                          <label className="block text-[10px] font-semibold text-neutral-500 mb-1">TERMINAL OUTCOME</label>
                          <Select value={terminalKind} onValueChange={(value) => setTerminalKind(value as typeof terminalKind)}>
                            <SelectTrigger><SelectValue placeholder="Select terminal outcome" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SUCCESS">Success</SelectItem>
                              <SelectItem value="FAILURE">Failure</SelectItem>
                              <SelectItem value="CANCELLATION">Cancellation</SelectItem>
                              <SelectItem value="ALTERNATE">Alternate completion</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 mb-1">
                          CATEGORY
                        </label>
                        <Select
                          value={stateCategory}
                          onValueChange={setStateCategory}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Category...">
                              {stateCategory === "BUSINESS" && "Business"}
                              {stateCategory === "UI" && "UI / Interaction"}
                              {stateCategory === "NAVIGATION" && "Navigation"}
                              {stateCategory === "ERROR" && "Error Handling"}
                              {stateCategory === "SYSTEM" && "System/API"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BUSINESS">Business</SelectItem>
                            <SelectItem value="UI">UI / Interaction</SelectItem>
                            <SelectItem value="NAVIGATION">Navigation</SelectItem>
                            <SelectItem value="ERROR">Error Handling</SelectItem>
                            <SelectItem value="SYSTEM">System/API</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={addStateMutation.isPending || !stateName.trim()}
                      loading={addStateMutation.isPending}
                      variant="secondary"
                      className="w-full"
                    >
                      <span>Add State</span>
                    </Button>
                  </form>

                  {/* Add Transition */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (fromStateId && toStateId) {
                        addTransitionMutation.mutate({
                          fromStateId,
                          toStateId,
                          action: transAction.trim() || undefined,
                          provenance: "USER_AUTHORED",
                        });
                      }
                    }}
                    className="rounded-md border border-[#262626] bg-[#131313] p-5 space-y-4"
                  >
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <ArrowRight className="h-4 w-4 text-white" />
                      <span>Add Declared Transition</span>
                    </h3>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-neutral-500 mb-1">
                            FROM STATE
                          </label>
                          <Select
                            value={fromStateId}
                            onValueChange={setFromStateId}
                          >
                            <SelectTrigger className="px-2.5 py-1.5 text-xs">
                              <SelectValue placeholder="Select...">
                                {activeFlow.states.find((s) => s.id === fromStateId)?.stateName}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Select...</SelectItem>
                              {activeFlow.states.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.stateName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-neutral-500 mb-1">
                            TO STATE
                          </label>
                          <Select
                            value={toStateId}
                            onValueChange={setToStateId}
                          >
                            <SelectTrigger className="px-2.5 py-1.5 text-xs">
                              <SelectValue placeholder="Select...">
                                {activeFlow.states.find((s) => s.id === toStateId)?.stateName}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Select...</SelectItem>
                              {activeFlow.states.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.stateName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 mb-1">
                          ACTION (OPTIONAL)
                        </label>
                        <input
                          type="text"
                          value={transAction}
                          onChange={(e) => setTransAction(e.target.value)}
                          placeholder="e.g. CLICK_SUBMIT"
                          className="w-full rounded-lg border border-[#262626] bg-black px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={
                        addTransitionMutation.isPending ||
                        !fromStateId ||
                        !toStateId
                      }
                      loading={addTransitionMutation.isPending}
                      variant="secondary"
                      className="w-full"
                    >
                      <span>Add Transition</span>
                    </Button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel 2: Suggestions Panel & Reconciliation Summary */}
        <div className="flex flex-col space-y-6 min-h-0">
          {/* Suggestions List (Derivation Engine output) */}
          {activeFlow && activeFlow.status === "DRAFT" && (
            <div className="rounded-md border border-[#262626] bg-[#131313] p-5 flex flex-col h-[380px] min-h-0">
              <div className="flex items-center justify-between border-b border-[#262626] pb-3 flex-shrink-0">
                <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-white" />
                  <span>Flow Suggestions ({pendingSuggestions.length})</span>
                </h2>
                <Button
                  type="button"
                  aria-label="Refresh flow suggestions"
                  disabled={isSuggestionsLoading || !activeFlow}
                  onClick={() =>
                    activeFlow &&
                    generateSuggestions(
                      activeFlow,
                      "MANUAL_REFRESH",
                      true,
                    ).catch((error) => setSuggestionError(error.message))
                  }
                  variant="icon"
                  size="icon"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isSuggestionsLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>

              {suggestionError && (
                <div
                  role="alert"
                  className="mt-2 rounded border border-red-900 bg-red-950/30 p-2 text-[10px] text-red-300"
                >
                  {suggestionError}
                </div>
              )}

              <div className="flex-1 overflow-y-auto mt-3 space-y-3 pr-1">
                {pendingSuggestions.length > 0 ? (
                  pendingSuggestions.map((sug) => (
                    <div
                      key={sug.id}
                      className="rounded-md border border-[#262626] bg-black p-4 space-y-3 hover:border-neutral-700 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold text-white">
                            {sug.title ?? sug.suggestedStateName}
                          </span>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="text-[9px] bg-red-950 text-red-400 border border-red-900 px-1.5 py-0.25 rounded font-semibold">
                              {sug.suggestionType ?? sug.category}
                            </span>
                            <span className="text-[9px] text-neutral-500">
                              {sug.source === "AI"
                                ? "Experimental AI"
                                : sug.source === "HYBRID"
                                  ? "AI-assisted"
                                  : "Rule-based"}
                            </span>
                          </div>
                        </div>

                        {/* Confidence score progress bar */}
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-white font-mono">
                            {(sug.confidence * 100).toFixed(0)}%
                          </span>
                          <div className="w-12 h-1.5 bg-neutral-850 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-white rounded-full"
                              style={{ width: `${sug.confidence * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      <p className="text-[10px] text-neutral-400 leading-normal bg-[#131313]/50 p-2 rounded">
                        {sug.rationale}
                      </p>

                      {sug.suggestedStatesJson?.length ||
                      sug.suggestedTransitionsJson?.length ? (
                        <div className="text-[10px] text-neutral-500 font-mono">
                          {sug.suggestedStatesJson
                            ?.map((state) => state.name)
                            .join(", ")}
                          {sug.suggestedTransitionsJson
                            ?.map(
                              (transition) =>
                                ` ${transition.from} → ${transition.to}`,
                            )
                            .join(", ")}
                        </div>
                      ) : null}

                      <div className="flex space-x-2 pt-1">
                        <Button
                          onClick={() =>
                            acceptSuggestionMutation.mutate(sug.id)
                          }
                          disabled={acceptSuggestionMutation.isPending}
                          variant="primary"
                          size="sm"
                          className="flex-1 border border-white"
                        >
                          <Check className="h-3 w-3" />
                          <span>Accept</span>
                        </Button>
                        <Button
                          aria-label={`Edit ${sug.title ?? sug.suggestedStateName}`}
                          disabled={editSuggestionMutation.isPending}
                          onClick={() => {
                            const name = window.prompt(
                              "Suggested state name",
                              sug.suggestedStateName,
                            );
                            if (name?.trim())
                              editSuggestionMutation.mutate({
                                sugId: sug.id,
                                suggestedStateName: name.trim(),
                              });
                          }}
                          variant="secondary"
                          size="sm"
                          className="px-2 text-neutral-300"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={() => setRejectingSugId(sug.id)}
                          variant="danger"
                          size="sm"
                          className="flex-1"
                        >
                          <X className="h-3 w-3" />
                          <span>Reject</span>
                        </Button>
                        <Button
                          aria-label={`Dismiss ${sug.title ?? sug.suggestedStateName}`}
                          disabled={dismissSuggestionMutation.isPending}
                          onClick={() =>
                            dismissSuggestionMutation.mutate(sug.id)
                          }
                          variant="secondary"
                          size="sm"
                          className="px-2 text-neutral-400"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-center p-6 text-xs text-neutral-500">
                    No suggestions available. Add states to see suggestions.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reconciliation Report Summary (when complete) */}
          {activeFlow && activeFlow.status === "COMPLETE" && (
            <div className="rounded-md border border-[#262626] bg-[#131313] p-5 flex flex-col max-h-[500px] min-h-0">
              <h2 className="text-sm font-bold text-white flex items-center justify-between border-b border-[#262626] pb-3 flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <GitCompare className="h-4 w-4 text-white" />
                  <span>Reconciliation Status</span>
                </div>
                <Button
                  onClick={() => refetchReconciliation()}
                  variant="ghost"
                  size="sm"
                  className="text-[10px] text-white hover:text-white font-semibold p-0 h-auto hover:bg-transparent"
                >
                  Refresh
                </Button>
              </h2>

              {activeReport ? (
                <div className="flex-1 overflow-y-auto space-y-5 mt-4 pr-1">
                  {/* Hero Coverage Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-[#262626] bg-black p-4 text-center">
                      <div className="text-[10px] text-neutral-500 font-semibold tracking-wider uppercase">
                        STATE COV
                      </div>
                      <div className="text-2xl font-black text-white font-mono mt-1">
                        {(activeReport.expectedCoverageScore * 100).toFixed(0)}%
                      </div>
                      <div className="text-[9px] text-neutral-400 mt-1">
                        {activeReport.confirmedCount} /{" "}
                        {activeReport.confirmedCount +
                          activeReport.trueGapCount}{" "}
                        states
                      </div>
                    </div>

                    <div className="rounded-md border border-[#262626] bg-black p-4 text-center">
                      <div className="text-[10px] text-neutral-500 font-semibold tracking-wider uppercase">
                        TRANS COV
                      </div>
                      <div className="text-2xl font-black text-white font-mono mt-1">
                        {(activeReport.transitionCoverageScore * 100).toFixed(
                          0,
                        )}
                        %
                      </div>
                      <div className="text-[9px] text-neutral-400 mt-1">
                        {activeReport.confirmedTransitions} /{" "}
                        {activeReport.confirmedTransitions +
                          activeReport.trueGapTransitions}{" "}
                        edges
                      </div>
                    </div>
                  </div>

                  {/* True Gaps section */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-red-400 flex items-center space-x-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>True Gaps ({activeReport.trueGapCount})</span>
                    </h3>
                    <div className="space-y-1.5">
                      {activeReport.trueGaps.map((gap: any) => (
                        <div
                          key={gap.stateName}
                          className="flex items-center justify-between text-xs border border-red-950/40 bg-red-950/10 p-2.5 rounded-lg text-neutral-300"
                        >
                          <span className="font-mono">{gap.stateName}</span>
                          <span className="text-[9px] text-neutral-500">
                            {gap.provenance}
                          </span>
                        </div>
                      ))}
                      {activeReport.trueGapCount === 0 && (
                        <p className="text-[10px] text-neutral-500 italic">
                          No missing states detected.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Telemetry Promotion (Undeclared states) */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-white flex items-center space-x-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>
                        Undeclared States ({activeReport.undeclaredCount})
                      </span>
                    </h3>
                    <div className="space-y-1.5">
                      {activeReport.undeclared.map((und: any) => (
                        <div
                          key={und.stateName}
                          className="flex flex-col border border border-[#262626] bg-black p-3 rounded-lg text-neutral-300"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono">{und.stateName}</span>
                            <span className="text-[10px] font-semibold text-neutral-500">
                              {und.observationCount} visits
                            </span>
                          </div>

                          {/* Promote Button */}
                          <div className="flex space-x-2 mt-2 pt-1 border-t border-[#262626]">
                             <Button
                               onClick={() =>
                                 promoteStateMutation.mutate({
                                   stateName: und.stateName,
                                   accepted: true,
                                 })
                               }
                               variant="primary"
                               size="xs"
                               className="flex-1"
                             >
                               Promote to Declared
                             </Button>
                             <Button
                               onClick={() =>
                                 promoteStateMutation.mutate({
                                   stateName: und.stateName,
                                   accepted: false,
                                 })
                               }
                               variant="secondary"
                               size="xs"
                               className="px-2.5"
                             >
                               Ignore
                             </Button>
                          </div>
                        </div>
                      ))}
                      {activeReport.undeclaredCount === 0 && (
                        <p className="text-[10px] text-neutral-500 italic">
                          No unexpected states observed.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <Info className="h-8 w-8 text-neutral-600" />
                  <div className="max-w-[200px] text-[11px] text-neutral-400">
                    Reconciliation runs when telemetry events are observed for
                    this flow. Click Run below to force.
                  </div>
                  <Button
                     onClick={() => refetchReconciliation()}
                     variant="primary"
                     size="sm"
                   >
                     Run Reconciliation
                   </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Suggestion Rejection Modal */}
      {rejectingSugId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-md border border-[#262626] bg-[#131313] p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Reject Suggestion</h3>
            <p className="text-xs text-neutral-400">
              Provide an optional reason for rejecting this state suggestion
              (feedback will be collected to train patterns).
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. This state is not applicable to our user segment."
              className="w-full h-24 rounded-lg border border-[#262626] bg-black p-2.5 text-xs text-white placeholder-neutral-600 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
            />

             <div className="flex space-x-3 pt-2">
               <Button
                 onClick={() => setRejectingSugId(null)}
                 variant="secondary"
                 size="sm"
                 className="flex-1"
               >
                 Cancel
               </Button>
               <Button
                 onClick={() =>
                   rejectSuggestionMutation.mutate({
                     sugId: rejectingSugId,
                     reason: rejectionReason.trim(),
                   })
                 }
                 variant="danger"
                 size="sm"
                 className="flex-1"
               >
                 Reject
               </Button>
             </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-md border border-[#262626] bg-[#131313]/95 px-4 py-3 text-xs font-semibold text-white shadow-2xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="h-4 w-4 text-white shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default function DeclarePage() {
  return (
    <Suspense
      fallback={
        <div className="text-neutral-400 animate-pulse">Loading Builder...</div>
      }
    >
      <DeclareContent />
    </Suspense>
  );
}
