"use client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { ApplicationRequiredState } from "@/components/application-required-state";
import { EmptyState } from "@/components/empty-state";
import { useSelectedApplication } from "@/hooks/use-selected-application";
import { usePersistedFilter } from "@/hooks/use-persisted-filter";
import { useSidebarMode } from "@/components/sidebar-mode";
import { FlowGraphEditor } from "./flow-graph-editor";
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
  type CSSProperties,
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
  LayoutGrid,
  List,
  Search,
  ArrowUpDown,
  ArrowLeft,
  ShoppingCart,
  GraduationCap,
  FilePlus2,
  UploadCloud,
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
  createdAt?: string;
  updatedAt?: string;
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
  const { appId, selectedOrgId, selectedApplication } = useSelectedApplication();
  const queryClient = useQueryClient();

  // Flow create canvas visibility (collapses the sidebar, shows the type picker).
  const [isCreating, setIsCreating] = useState(false);

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
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["onboarding-progress", appId],
      });
      queryClient.invalidateQueries({ queryKey: ["declared-flows", appId] });
      setIsCreating(false);
      // Templates (E-commerce / LMS) seed a graph server-side — open it straight
      // in the editor. A blank profile returns no graphId.
      if (data?.graphId) setSelectedFlowId(data.graphId);
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

  // Organisation entitlement — gates document-based flow generation.
  const { data: planEntitlement } = useQuery<{
    features?: Record<string, boolean | string>;
  }>({
    queryKey: ["sidebar-entitlement", selectedOrgId],
    queryFn: async () => {
      const res = await authenticatedFetch(
        `/api-gateway/organizations/${selectedOrgId}/entitlement`,
      );
      if (!res.ok) throw new Error("Failed to fetch entitlement");
      return res.json();
    },
    enabled: !!selectedOrgId,
  });
  const docFlowInferenceEnabled = (() => {
    const value = planEntitlement?.features?.DOCUMENT_FLOW_INFERENCE;
    return value === true || (typeof value === "string" && value !== "false");
  })();

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
      setIsCreating(false);
      // Keep onboarding moving when the first flow is a blank custom canvas.
      if (onboardingProgress && !onboardingProgress.templateSelected) {
        patchProgressMutation.mutate({ templateSelected: true });
      }
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

  // The Flow Declaration Overview is the landing view; a flow is opened into the
  // builder only when the user picks one, so no flow is auto-selected here.

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

  // Focused "create a flow" canvas — takes over the screen and collapses the
  // sidebar to icon mode. Shown from the overview's "New Flow" action.
  if (appId && isCreating) {
    return (
      <FlowCreateView
        appId={appId}
        entitledToDocs={docFlowInferenceEnabled}
        creating={
          selectProfileMutation.isPending || createFlowMutation.isPending
        }
        onSelectProfile={(profileId) =>
          selectProfileMutation.mutate(profileId)
        }
        onCreateCustom={(data) => createFlowMutation.mutate(data)}
        onGenerated={(flowId) => {
          setIsCreating(false);
          setSelectedFlowId(flowId);
        }}
        onCancel={() => setIsCreating(false)}
      />
    );
  }

  if (onboardingIsActive && flowsLoading) {
    return <FlowsSkeleton view="grid" />;
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
        return <FlowsSkeleton view="grid" />;
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

      // No declared flows yet — land on the empty Flow Declaration Overview.
      // Its "New Flow" action opens the focused create canvas (with the
      // E-commerce / LMS / Custom templates), which drives the same
      // profile-selection step onboarding needs.
      if (!flows?.length) {
        return (
          <FlowOverview
            flows={[]}
            isLoading={flowsLoading}
            isError={flowsFailed}
            onOpen={setSelectedFlowId}
            onCreate={() => setIsCreating(true)}
            onRetry={() => void refetchFlows()}
          />
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

  // Landing view: the Flow Declaration Overview. The builder below is shown only
  // once a flow has been opened.
  if (!selectedFlowId) {
    return (
      <FlowOverview
        flows={flows ?? []}
        isLoading={flowsLoading}
        isError={flowsFailed}
        onOpen={setSelectedFlowId}
        onCreate={() => setIsCreating(true)}
        onRetry={() => void refetchFlows()}
      />
    );
  }

  // A flow is open — hand off to the full-screen graph editor.
  return (
    <FlowGraphEditor
      appId={appId}
      flowId={selectedFlowId}
      appName={selectedApplication?.name}
      envName={activeEnv?.name}
      onClose={() => setSelectedFlowId("")}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Flow Declaration Overview
// ─────────────────────────────────────────────────────────────

function timeAgo(iso?: string) {
  if (!iso) return "unknown";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function flowStatusOf(flow: DeclaredFlow) {
  return (flow.lifecycleStatus ?? flow.status ?? "DRAFT").toUpperCase();
}

function flowVersionOf(flow: DeclaredFlow) {
  return flow.versions?.[0]?.version ?? flow.version ?? 1;
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "PUBLISHED" || status === "COMPLETE"
      ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-300"
      : status === "ARCHIVED" || status === "SUPERSEDED"
        ? "border-[#333] bg-[#151515] text-neutral-400"
        : "border-amber-900/50 bg-amber-950/20 text-amber-300";
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {status}
    </span>
  );
}

const DOT_GRID_STYLE: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
  backgroundSize: "14px 14px",
};

function FlowMiniGraph() {
  return (
    <svg
      viewBox="0 0 240 96"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <line
        x1="46"
        y1="34"
        x2="120"
        y2="34"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="1.5"
      />
      <line
        x1="120"
        y1="34"
        x2="194"
        y2="62"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="1.5"
      />
      {(
        [
          [46, 34],
          [120, 34],
          [194, 62],
        ] as const
      ).map(([x, y], i) => (
        <rect
          key={i}
          x={x - 15}
          y={y - 9}
          width="30"
          height="18"
          rx="4"
          fill="#141414"
          stroke="rgba(255,255,255,0.22)"
        />
      ))}
    </svg>
  );
}

function FlowCard({
  flow,
  onOpen,
}: {
  flow: DeclaredFlow;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-lg border border-[#262626] bg-[#0d0d0d] text-left transition-colors hover:border-white/40"
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">
            {flow.name}
          </h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {(flow.workflowType ?? "Custom").replace(/_/g, " ")} · v
            {flowVersionOf(flow)}
          </p>
        </div>
        <StatusPill status={flowStatusOf(flow)} />
      </div>
      <div
        className="relative h-24 border-t border-[#1e1e1e]"
        style={DOT_GRID_STYLE}
      >
        <FlowMiniGraph />
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 text-[11px] text-neutral-500">
        <span>Updated {timeAgo(flow.updatedAt)}</span>
        <span className="inline-flex items-center gap-1 text-neutral-400 group-hover:text-white">
          Open <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}

function FlowRow({
  flow,
  onOpen,
}: {
  flow: DeclaredFlow;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-[#131313]"
    >
      {/* <ClipboardList className="h-4 w-4 shrink-0 text-neutral-500" /> */}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">
          {flow.name}
        </span>
        <span className="block text-[11px] text-neutral-500">
          {(flow.workflowType ?? "Custom").replace(/_/g, " ")} · v
          {flowVersionOf(flow)} · updated {timeAgo(flow.updatedAt)}
        </span>
      </span>
      <StatusPill status={flowStatusOf(flow)} />
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600" />
    </button>
  );
}

function FlowsSkeleton({ view }: { view: "grid" | "list" }) {
  if (view === "grid") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-lg border border-[#262626] bg-[#0d0d0d]"
          >
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="space-y-2 min-w-0 flex-1">
                <div className="h-4 w-3/5 rounded bg-neutral-800" />
                <div className="h-3 w-2/5 rounded bg-neutral-800/60" />
              </div>
              <div className="h-5 w-14 rounded bg-neutral-800/60 shrink-0" />
            </div>
            <div
              className="h-24 border-t border-[#1e1e1e] bg-neutral-900/30 flex items-center justify-center"
              style={DOT_GRID_STYLE}
            >
              <div className="h-8 w-28 rounded bg-neutral-800/40" />
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="h-3 w-24 rounded bg-neutral-800/40" />
              <div className="h-3 w-10 rounded bg-neutral-800/40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#1e1e1e] overflow-hidden rounded-md border border-[#262626] bg-[#0d0d0d] animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex w-full items-center gap-4 px-4 py-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-neutral-800" />
            <div className="h-3 w-64 rounded bg-neutral-800/60" />
          </div>
          <div className="h-5 w-14 rounded bg-neutral-800/60 shrink-0" />
          <div className="h-4 w-4 rounded bg-neutral-800/40 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function FlowOverview({
  flows,
  isLoading,
  isError,
  onOpen,
  onCreate,
  onRetry,
}: {
  flows: DeclaredFlow[];
  isLoading: boolean;
  isError: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onRetry: () => void;
}) {
  const [view, setView] = usePersistedFilter("declare:view", "grid");
  const [sort, setSort] = usePersistedFilter("declare:sort", "recent");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const listable = flows.filter(
      (flow) => (flow.lifecycleStatus ?? "DRAFT") !== "ARCHIVED",
    );
    const filtered = query
      ? listable.filter((flow) => flow.name.toLowerCase().includes(query))
      : listable.slice();
    filtered.sort((a, b) => {
      if (sort === "alpha") return a.name.localeCompare(b.name);
      if (sort === "created")
        return (
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
        );
      return (
        new Date(b.updatedAt ?? 0).getTime() -
        new Date(a.updatedAt ?? 0).getTime()
      );
    });
    return filtered;
  }, [flows, search, sort]);

  const total = flows.filter(
    (flow) => (flow.lifecycleStatus ?? "DRAFT") !== "ARCHIVED",
  ).length;
  const sortLabel =
    sort === "alpha"
      ? "Alphabetical"
      : sort === "created"
        ? "Creation date"
        : "Recent activity";

  return (
    <div className="flex h-full flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[#262626] pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Flow Declaration Overview
          </h1>
          {/* <p className="mt-1 text-sm text-neutral-400">
            Author focused intent graphs and reconcile them against real
            behaviour.
          </p> */}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search flows by title…"
              className="w-full rounded-md border border-[#262626] bg-[#131313] py-2 pl-9 pr-3 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none md:w-[260px]"
            />
          </div>
          <Button variant="primary" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            <span>New Flow</span>
          </Button>
        </div>
      </div>

      {/* Sub-header: count · sort · view toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-white">
            {/* <ClipboardList className="h-4 w-4 text-neutral-400" /> */}
            {total} {total === 1 ? "Flow" : "Flows"}
          </span>
          <span className="text-neutral-700">|</span>
          <div className="flex items-center gap-2 text-neutral-400">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="text-xs">Sort by</span>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Recent activity">
                  {sortLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent activity</SelectItem>
                <SelectItem value="alpha">Alphabetical</SelectItem>
                <SelectItem value="created">Creation date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-1 self-start rounded-md border border-[#262626] bg-[#131313] p-0.5">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={`rounded p-1.5 transition-colors ${view === "grid" ? "bg-white text-black" : "text-neutral-400 hover:text-white"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`rounded p-1.5 transition-colors ${view === "list" ? "bg-white text-black" : "text-neutral-400 hover:text-white"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <FlowsSkeleton view={view === "grid" ? "grid" : "list"} />
      ) : isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-neutral-400">
            Declared flows could not be loaded.
          </p>
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : total === 0 ? (
        <EmptyState
          variant="activation"
          illustration="flow"
          eyebrow="Flow Declaration"
          title="Declare your first flow"
          description="Create a focused intent graph — checkout, onboarding, password reset — and Tellann will reconcile it against what your users actually do."
          primaryAction={{ label: "Create a flow", onClick: onCreate }}
        />
      ) : visible.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
          No flows match “{search.trim()}”.
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onOpen={() => onOpen(flow.id)}
            />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-[#1e1e1e] overflow-hidden rounded-md border border-[#262626] bg-[#0d0d0d]">
          {visible.map((flow) => (
            <FlowRow key={flow.id} flow={flow} onOpen={() => onOpen(flow.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Flow create canvas (focused mode — collapses the sidebar)
// ─────────────────────────────────────────────────────────────

type CreateTemplate = "ECOMMERCE" | "LMS" | "CUSTOM";

const CREATE_OPTIONS: Array<{
  id: CreateTemplate;
  label: string;
  desc: string;
  icon: typeof ShoppingCart;
  workflowType: string;
}> = [
  {
    id: "ECOMMERCE",
    label: "E-commerce store",
    desc: "Preload a typical shop journey: Browse → Product → Cart → Checkout → Success.",
    icon: ShoppingCart,
    workflowType: "CHECKOUT",
  },
  {
    id: "LMS",
    label: "Education / LMS",
    desc: "Preload a typical learning journey: Courses → Enrol → Lesson → Complete.",
    icon: GraduationCap,
    workflowType: "ENROLLMENT",
  },
  {
    id: "CUSTOM",
    label: "Custom (Empty Flow)",
    desc: "Start from a blank canvas and declare every state and transition yourself.",
    icon: FilePlus2,
    workflowType: "CUSTOM",
  },
];

function FlowCreateView({
  appId,
  entitledToDocs,
  creating,
  onSelectProfile,
  onCreateCustom,
  onGenerated,
  onCancel,
}: {
  appId: string;
  entitledToDocs: boolean;
  creating: boolean;
  onSelectProfile: (profileId: CreateTemplate) => void;
  onCreateCustom: (data: {
    name: string;
    workflowType: string;
    purpose: string;
    scopeStatement: string;
  }) => void;
  onGenerated: (flowId: string) => void;
  onCancel: () => void;
}) {
  const { setCollapsed } = useSidebarMode();
  const [selected, setSelected] = useState<CreateTemplate | "DOCUMENT" | null>(
    null,
  );

  useEffect(() => {
    setCollapsed(true);
    return () => setCollapsed(false);
  }, [setCollapsed]);

  // Picking a starting point creates the flow immediately and hands off to the
  // full-screen graph editor — the flow gets a generic "New Flow" name that the
  // author can change from the editor's top bar.
  function choose(id: CreateTemplate) {
    if (id === "CUSTOM") {
      onCreateCustom({
        name: "New Flow",
        workflowType: "CUSTOM",
        purpose: "",
        scopeStatement: "",
      });
      return;
    }
    // E-commerce / LMS — seed states and transitions from the domain template.
    onSelectProfile(id);
  }

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-30 overflow-auto bg-[#050505] md:left-16">
      {/* Graph-style backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)",
          backgroundSize: "26px 26px",
        }}
      />
      {/* <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1200 800"
      >
        {(
          [
            [140, 160, 380, 240],
            [380, 240, 320, 470],
            [380, 240, 700, 200],
            [700, 200, 940, 360],
            [320, 470, 640, 600],
            [940, 360, 1040, 610],
          ] as const
        ).map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="2"
          />
        ))}
        {(
          [
            [140, 160],
            [380, 240],
            [700, 200],
            [320, 470],
            [940, 360],
            [640, 600],
            [1040, 610],
          ] as const
        ).map(([x, y], i) => (
          <rect
            key={i}
            x={x - 34}
            y={y - 16}
            width="68"
            height="32"
            rx="7"
            fill="#0c0c0c"
            stroke="rgba(255,255,255,0.10)"
          />
        ))}
      </svg> */}

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between border-b h-14 border-[#1c1c1c] bg-[#050505]/80 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-xs font-mono text-[#8e9192] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to flows
        </button>
        <span className="border border-[#444748] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[#8e9192]">
          FLOW // NEW
        </span>
      </div>

      {/* Centred picker */}
      <div className="relative z-10 flex min-h-[calc(100%-56px)] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-[#262626] bg-[#0c0c0c]/95 p-6 shadow-2xl backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-white">Create a flow</h2>
          <p className="mt-1 text-xs text-neutral-400">
            Pick a starting point. Every state and transition stays editable
            afterwards.
          </p>

          {
            <div className="mt-5 space-y-2">
              {CREATE_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={creating}
                    onClick={() => choose(option.id)}
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-[#262626] bg-black/40 px-4 py-3 text-left transition-colors  hover:bg-[#131313] disabled:opacity-50"
                  >
                    {/* <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#262626] bg-[#131313] text-neutral-300 group-hover:text-white"> */}
                      <Icon className="h-4 w-4" />
                    {/* </span> */}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white">
                        {option.label}
                      </span>
                      {/* <span className="block text-[11px] leading-snug text-neutral-400">
                        {option.desc}
                      </span> */}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600 group-hover:text-white" />
                  </button>
                );
              })}

              {entitledToDocs ? (
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setSelected("DOCUMENT")}
                  className={`group flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors disabled:opacity-50 ${
                    selected === "DOCUMENT"
                      ? "border-white/50 bg-[#131313]"
                      : "border-[#262626] bg-black/40 hover:border-white/40 hover:bg-[#131313]"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#262626] bg-[#131313] text-neutral-300 group-hover:text-white">
                    <UploadCloud className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">
                      Generate from a document
                    </span>
                    <span className="block text-[11px] leading-snug text-neutral-400">
                      Upload a requirements, PRD or OpenAPI file and Tellann
                      infers a reviewable flow.
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600 group-hover:text-white" />
                </button>
              ) : (
                <div className="flex w-full items-center gap-3 rounded-lg border border-dashed border-[#262626] bg-black/20 px-4 py-3 opacity-75">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#262626] bg-[#131313] text-neutral-500">
                    <UploadCloud className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-neutral-300">
                      Generate from a document
                    </span>
                    <span className="block text-[11px] leading-snug text-neutral-500">
                      Upgrade your plan to infer flows from requirement or spec
                      documents.
                    </span>
                  </span>
                  <Lock className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                </div>
              )}

              {selected === "DOCUMENT" && (
                <DocumentUploadPanel appId={appId} onGenerated={onGenerated} />
              )}

              {/* <button
                type="button"
                onClick={onCancel}
                className="mt-2 w-full text-center text-[11px] text-neutral-500 hover:text-neutral-300"
              >
                Cancel
              </button> */}
            </div>
          }
        </div>
      </div>
    </div>
  );
}

const DOC_MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
  html: "text/html",
  htm: "text/html",
  json: "application/json",
  yaml: "application/x-yaml",
  yml: "application/x-yaml",
};
const DOC_MAX_BYTES = 15 * 1024 * 1024;

function DocumentUploadPanel({
  appId,
  onGenerated,
}: {
  appId: string;
  onGenerated: (flowId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "reading" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const busy = phase !== "idle";

  const readAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the file."));
      reader.onload = () => {
        const result = String(reader.result ?? "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.readAsDataURL(file);
    });

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    if (file.size > DOC_MAX_BYTES) {
      setError("That file is over the 15 MB limit.");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = file.type || DOC_MIME_BY_EXT[ext] || "";
    if (!mimeType || !Object.values(DOC_MIME_BY_EXT).includes(mimeType)) {
      setError("Unsupported file type. Use PDF, DOCX, Markdown, text, HTML, or OpenAPI.");
      return;
    }
    try {
      setPhase("reading");
      const dataBase64 = await readAsBase64(file);
      setPhase("generating");
      const res = await authenticatedFetch(
        `${ONBOARDING_API}/applications/${appId}/source-documents/generate-flow`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, mimeType, dataBase64 }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const map: Record<string, string> = {
          UNSUPPORTED_DOCUMENT_TYPE: "Unsupported file type.",
          DOCUMENT_TOO_LARGE: "That file is too large.",
          EMPTY_DOCUMENT: "That file looks empty.",
          FEATURE_NOT_ENTITLED: "Your plan does not include document flow generation.",
          DOCUMENT_FLOW_GENERATION_FAILED:
            res.status === 503
              ? "Document generation is not configured on this environment."
              : "Couldn't derive a flow from this document. Try a clearer requirements doc.",
        };
        throw new Error(map[payload.error] ?? payload.error ?? "Generation failed.");
      }
      onGenerated(payload.flowId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
      setPhase("idle");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#262626] bg-black/40 p-4">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.md,.markdown,.txt,.html,.htm,.json,.yaml,.yml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      {busy ? (
        <div className="relative overflow-hidden rounded-lg border border-[#262626] bg-[#090909] p-5 space-y-4">
          {/* Top header & file badge */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <span>
                {phase === "reading"
                  ? "Analyzing Document Content…"
                  : "Synthesizing Intent Graph & Flow States…"}
              </span>
            </div>
            {fileName && (
              <span className="inline-flex max-w-[160px] items-center gap-1.5 truncate rounded-full border border-[#262626] bg-[#141414] px-2.5 py-0.5 font-mono text-[10px] text-neutral-400">
                <FileText className="h-3 w-3 shrink-0 text-neutral-500" />
                <span className="truncate">{fileName}</span>
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-900">
              <div
                className="h-full rounded-full bg-gradient-to-r from-neutral-600 via-white to-neutral-600 transition-all duration-700 ease-out"
                style={{
                  width: phase === "reading" ? "35%" : "82%",
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-neutral-500">
              <span>{phase === "reading" ? "Step 1/2: Parsing text" : "Step 2/2: Building graph"}</span>
              <span>{phase === "reading" ? "35%" : "82%"}</span>
            </div>
          </div>

          {/* Skeleton Graph Preview */}
          <div className="flex items-center justify-between gap-2 rounded-md border border-[#1f1f1f] bg-black/60 p-3.5">
            <div className="flex h-8 w-24 shrink-0 animate-pulse items-center justify-center rounded border border-[#282828] bg-[#121212]">
              <div className="h-2 w-14 rounded bg-neutral-700" />
            </div>
            <div className="relative h-[2px] flex-1 overflow-hidden bg-neutral-800">
              <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-neutral-400 to-transparent" />
            </div>
            <div className="flex h-8 w-28 shrink-0 animate-pulse items-center justify-center rounded border border-neutral-700 bg-neutral-800/80 shadow-[0_0_12px_rgba(255,255,255,0.06)]">
              <div className="h-2 w-16 rounded bg-neutral-300" />
            </div>
            <div className="relative h-[2px] flex-1 overflow-hidden bg-neutral-800">
              <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-neutral-400 to-transparent" />
            </div>
            <div className="flex h-8 w-24 shrink-0 animate-pulse items-center justify-center rounded border border-[#282828] bg-[#121212]">
              <div className="h-2 w-12 rounded bg-neutral-700" />
            </div>
          </div>

          {/* Subtext */}
          <p className="text-[11px] leading-relaxed text-neutral-400">
            {phase === "reading"
              ? "Reading document specifications, requirements, and endpoints…"
              : "Tellann AI is extracting states, transitions, and user journeys into an editable flow graph."}
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-[#333] bg-[#0a0a0a] px-4 py-6 text-center transition-colors hover:border-white/40"
          >
            <UploadCloud className="h-6 w-6 text-neutral-400" />
            <span className="text-sm font-semibold text-white">
              Choose a document
            </span>
            <span className="text-[11px] text-neutral-500">
              PDF, DOCX, Markdown, text, HTML or OpenAPI · up to 15 MB
            </span>
          </button>
          {fileName && !error && (
            <p className="truncate text-[11px] text-neutral-500">{fileName}</p>
          )}
          {error && (
            <p className="text-[11px] text-red-400" role="alert">
              {error}
            </p>
          )}
          <p className="text-[11px] leading-relaxed text-neutral-500">
            The file is sent to Tellann&apos;s model, which drafts a flow you
            review in the editor before accepting.
          </p>
        </>
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
