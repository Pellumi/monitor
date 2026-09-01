"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type EdgeProps,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Plus,
  Check,
  X,
  Trash2,
  Pencil,
  RefreshCw,
  Lock,
  Unlock,
  Activity,
  Settings2,
  Workflow,
  ChevronRight,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSidebarMode } from "@/components/sidebar-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const API = "/api-gateway";

// Character limits for flow settings fields.
const FLOW_NAME_MAX = 20;
const FLOW_PURPOSE_MAX = 200;
const FLOW_SCOPE_MAX = 200;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface EditorState {
  id: string;
  stateName: string;
  category: string;
  provenance: string;
  role?: "NORMAL" | "INITIAL" | "TERMINAL";
  terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null;
}

interface EditorTransition {
  id: string;
  fromStateId: string;
  toStateId: string;
  action?: string | null;
  provenance: string;
}

interface EditorFlow {
  id: string;
  name: string;
  status: "DRAFT" | "COMPLETE";
  lifecycleStatus?: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SUPERSEDED";
  version: number;
  workflowType: string;
  purpose?: string | null;
  scopeStatement?: string | null;
  graphHash: string;
  states: EditorState[];
  transitions: EditorTransition[];
  publishedVersionId?: string | null;
  versions?: Array<{ id: string; version: number }>;
  aiDraftStatus?: string | null;
  aiDraftSourceName?: string | null;
}

interface FlowSuggestion {
  id: string;
  suggestedStateName: string;
  category: string;
  rationale: string;
  confidence: number;
  title?: string;
  description?: string;
  suggestionType?: string;
  source?: "RULE_ENGINE" | "AI" | "HYBRID";
  suggestedStatesJson?: Array<{ name: string; category: string }>;
  suggestedTransitionsJson?: Array<{ from: string; to: string; action?: string }>;
  status:
    | "PENDING"
    | "SUGGESTED"
    | "EDITED"
    | "ACCEPTED"
    | "REJECTED"
    | "DISMISSED"
    | "SUPERSEDED";
}

interface SuggestionsPayload {
  success: boolean;
  data: {
    graphVersion: number;
    graphHash: string;
    suggestions: FlowSuggestion[];
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

// ─────────────────────────────────────────────────────────────
// Graph rendering helpers
// ─────────────────────────────────────────────────────────────

const NODE_W = 190;
const NODE_MAX_W = 260;
const COL_GAP = 300;
const ROW_GAP = 130;

function layoutKey(flowId: string) {
  return `tellann_flow_layout:${flowId}`;
}

function readLayout(flowId: string): Record<string, { x: number; y: number }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(layoutKey(flowId)) ?? "{}");
  } catch {
    return {};
  }
}

function writeLayout(
  flowId: string,
  layout: Record<string, { x: number; y: number }>,
) {
  try {
    window.localStorage.setItem(layoutKey(flowId), JSON.stringify(layout));
  } catch {
    /* storage unavailable — positions stay in-memory for the session */
  }
}

function nodeStyle(state: EditorState, selected: boolean, proposed = false) {
  const isError = state.category === "ERROR";
  return {
    // Opaque fills so edges/labels routed behind a card never bleed through it.
    background: proposed ? "#161206" : "var(--rf-surface, #0d0d0d)",
    color: isError ? "#f87171" : "#e5e5e5",
    border: selected
      ? "1px solid #ffffff"
      : proposed
        ? "1px dashed #d97706"
        : state.role === "INITIAL"
          ? "1px solid #10b981"
          : state.role === "TERMINAL"
            ? "1px solid #6366f1"
            : isError
              ? "1px solid #7f1d1d"
              : "1px solid #262626",
    borderRadius: "8px",
    padding: "9px 14px",
    fontSize: "11px",
    fontWeight: 600,
    fontFamily: "monospace",
    // Responsive: shrink-wrap to the label between a sensible min and max,
    // and wrap long state names onto more lines instead of overflowing.
    width: "auto",
    minWidth: NODE_W,
    maxWidth: NODE_MAX_W,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    textAlign: "center",
    lineHeight: 1.35,
    boxShadow: selected ? "0 0 0 2px rgba(255,255,255,0.25)" : undefined,
  } as const;
}

function EditorTransitionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const label = String(data?.label ?? "");
  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth: selected ? 2 : 1.5,
          ...style,
          stroke: selected ? "#ffffff" : (style?.stroke ?? "#404040"),
        }}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute rounded border border-[#262626] bg-[#0a0a0a] px-1.5 py-0.5 font-mono text-[9px] text-neutral-400"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const editorEdgeTypes = { editorTransition: EditorTransitionEdge };

// ─────────────────────────────────────────────────────────────
// Editor
// ─────────────────────────────────────────────────────────────

export function FlowGraphEditor({
  appId,
  flowId,
  appName,
  envName,
  onClose,
}: {
  appId: string;
  flowId: string;
  appName?: string;
  envName?: string;
  onClose: () => void;
}) {
  const { setCollapsed } = useSidebarMode();
  const queryClient = useQueryClient();

  useEffect(() => {
    setCollapsed(true);
    return () => setCollapsed(false);
  }, [setCollapsed]);

  // ── Queries ────────────────────────────────────────────────
  const { data: flow, refetch: refetchFlow } = useQuery<EditorFlow>({
    queryKey: ["declared-flow-details", flowId],
    queryFn: async () => {
      const res = await authenticatedFetch(
        `${API}/v1/applications/${appId}/flows/${flowId}`,
      );
      if (!res.ok) throw new Error("Failed to load flow");
      return res.json();
    },
    enabled: !!flowId,
  });

  const { data: suggestionResponse, isFetching: suggestionsLoading } =
    useQuery<SuggestionsPayload>({
      queryKey: ["flow-suggestions", appId, flowId],
      queryFn: async () => {
        const res = await authenticatedFetch(
          `${API}/v1/applications/${appId}/declared-flows/${flowId}/suggestions`,
        );
        if (!res.ok) throw new Error("Failed to load suggestions");
        return res.json();
      },
      enabled: !!flowId,
    });

  const isDraft = (flow?.lifecycleStatus ?? flow?.status ?? "DRAFT") === "DRAFT";
  const draftPending = flow?.aiDraftStatus === "PENDING_REVIEW";

  const pendingSuggestions = useMemo(
    () =>
      (suggestionResponse?.data.suggestions ?? [])
        .filter((s) => ["PENDING", "SUGGESTED", "EDITED"].includes(s.status))
        .sort((a, b) => b.confidence - a.confidence),
    [suggestionResponse],
  );

  // ── Suggestion regeneration (debounced after graph edits) ──
  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regenerateSuggestions = useCallback(
    (
      trigger:
        | "STATE_ADDED"
        | "TRANSITION_ADDED"
        | "SUGGESTION_ACCEPTED"
        | "MANUAL_REFRESH",
    ) => {
      if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
      suggestionTimer.current = setTimeout(async () => {
        const fresh = await refetchFlow();
        const current = fresh.data;
        if (!current) return;
        try {
          const res = await authenticatedFetch(
            `${API}/v1/applications/${appId}/declared-flows/${flowId}/suggestions/generate`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                graphVersion: current.version,
                graphHash: current.graphHash,
                trigger,
                includeAi: true,
              }),
            },
          );
          const payload = await res.json().catch(() => null);
          if (res.ok && payload?.data) {
            queryClient.setQueryData(
              ["flow-suggestions", appId, flowId],
              payload,
            );
          }
        } catch {
          /* suggestion refresh is best-effort */
        }
      }, 400);
    },
    [appId, flowId, queryClient, refetchFlow],
  );

  useEffect(
    () => () => {
      if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    },
    [],
  );

  const invalidateFlow = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["declared-flow-details", flowId],
    });
    queryClient.invalidateQueries({ queryKey: ["declared-flows", appId] });
  }, [appId, flowId, queryClient]);

  // ── Local graph state ──────────────────────────────────────
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"build" | "suggestions" | "settings">(
    "build",
  );
  const [publishError, setPublishError] = useState<string | null>(null);
  const builtFlowIdRef = useRef<string>("");

  // ── Mutations ──────────────────────────────────────────────
  const addState = useMutation({
    mutationFn: async (body: {
      stateName: string;
      category: string;
      role: "NORMAL" | "INITIAL" | "TERMINAL";
      terminalKind?: string;
    }) => {
      const res = await authenticatedFetch(
        `${API}/applications/${appId}/declared-flow/${flowId}/states`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, provenance: "USER_AUTHORED" }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add state");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateFlow();
      regenerateSuggestions("STATE_ADDED");
    },
  });

  const editState = useMutation({
    mutationFn: async (body: {
      stateId: string;
      stateName: string;
      category: string;
      role: "NORMAL" | "INITIAL" | "TERMINAL";
      terminalKind?: string;
    }) => {
      const res = await authenticatedFetch(
        `${API}/applications/${appId}/declared-flow/${flowId}/states/${body.stateId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update state");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateFlow();
      regenerateSuggestions("MANUAL_REFRESH");
    },
  });

  const deleteState = useMutation({
    mutationFn: async (stateId: string) => {
      const res = await authenticatedFetch(
        `${API}/applications/${appId}/declared-flow/${flowId}/states/${stateId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete state");
      return res.json();
    },
    onSuccess: () => {
      setSelectedStateId(null);
      invalidateFlow();
      regenerateSuggestions("MANUAL_REFRESH");
    },
  });

  const addTransition = useMutation({
    mutationFn: async (body: {
      fromStateId: string;
      toStateId: string;
      action?: string;
    }) => {
      const res = await authenticatedFetch(
        `${API}/applications/${appId}/declared-flow/${flowId}/transitions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, provenance: "USER_AUTHORED" }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add transition");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateFlow();
      regenerateSuggestions("TRANSITION_ADDED");
    },
  });

  const editTransition = useMutation({
    mutationFn: async (body: { transitionId: string; action: string }) => {
      const res = await authenticatedFetch(
        `${API}/applications/${appId}/declared-flow/${flowId}/transitions/${body.transitionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: body.action }),
        },
      );
      if (!res.ok) throw new Error("Failed to update transition");
      return res.json();
    },
    onSuccess: () => invalidateFlow(),
  });

  const deleteTransition = useMutation({
    mutationFn: async (transitionId: string) => {
      const res = await authenticatedFetch(
        `${API}/applications/${appId}/declared-flow/${flowId}/transitions/${transitionId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete transition");
      return res.json();
    },
    onSuccess: () => {
      setSelectedEdgeId(null);
      invalidateFlow();
    },
  });

  const acceptSuggestion = useMutation({
    mutationFn: async (sid: string) => {
      const res = await authenticatedFetch(
        `${API}/v1/applications/${appId}/declared-flows/${flowId}/suggestions/${sid}/accept`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed to accept suggestion");
      return res.json();
    },
    onSuccess: () => {
      invalidateFlow();
      queryClient.invalidateQueries({
        queryKey: ["flow-suggestions", appId, flowId],
      });
      regenerateSuggestions("SUGGESTION_ACCEPTED");
    },
  });

  const rejectSuggestion = useMutation({
    mutationFn: async (payload: { sid: string; reason?: string }) => {
      const res = await authenticatedFetch(
        `${API}/v1/applications/${appId}/declared-flows/${flowId}/suggestions/${payload.sid}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejectionReason: payload.reason }),
        },
      );
      if (!res.ok) throw new Error("Failed to reject suggestion");
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["flow-suggestions", appId, flowId],
      }),
  });

  const dismissSuggestion = useMutation({
    mutationFn: async (sid: string) => {
      const res = await authenticatedFetch(
        `${API}/v1/applications/${appId}/declared-flows/${flowId}/suggestions/${sid}/dismiss`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed to dismiss suggestion");
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["flow-suggestions", appId, flowId],
      }),
  });

  const manualRefreshSuggestions = useMutation({
    mutationFn: async () => {
      if (!flow) return;
      const res = await authenticatedFetch(
        `${API}/v1/applications/${appId}/declared-flows/${flowId}/suggestions/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            graphVersion: flow.version,
            graphHash: flow.graphHash,
            trigger: "MANUAL_REFRESH",
            includeAi: true,
          }),
        },
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to refresh");
      return payload;
    },
    onSuccess: (payload) => {
      if (payload?.data)
        queryClient.setQueryData(
          ["flow-suggestions", appId, flowId],
          payload,
        );
    },
  });

  const updateFlow = useMutation({
    mutationFn: async (body: {
      name?: string;
      purpose?: string;
      scopeStatement?: string;
      workflowType?: string;
    }) => {
      const res = await authenticatedFetch(
        `${API}/v1/applications/${appId}/flows/${flowId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error("Failed to update flow");
      return res.json();
    },
    onSuccess: () => invalidateFlow(),
  });

  const publishFlow = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(
        `${API}/v1/applications/${appId}/flows/${flowId}/publish`,
        { method: "POST" },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(
          payload.validation?.issues
            ?.map((i: { message: string }) => i.message)
            .join(" ") || "Failed to publish flow",
        );
      }
      return res.json();
    },
    onSuccess: () => invalidateFlow(),
  });

  const reviseFlow = useMutation({
    mutationFn: async () => {
      const versionId =
        flow?.publishedVersionId ?? flow?.versions?.[0]?.id;
      const res = await authenticatedFetch(
        `${API}/v1/applications/${appId}/flows/${flowId}/versions/${versionId}/revise`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed to create revision");
      return res.json();
    },
    onSuccess: () => invalidateFlow(),
  });

  const acceptAiDraft = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(
        `${API}/v1/applications/${appId}/flows/${flowId}/ai-draft/accept`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed to accept draft");
      return res.json();
    },
    onSuccess: () => invalidateFlow(),
  });

  const declineAiDraft = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(
        `${API}/v1/applications/${appId}/flows/${flowId}/ai-draft/decline`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed to discard draft");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["declared-flows", appId] });
      onClose();
    },
  });

  // Rebuild nodes/edges whenever the flow data changes. Positions are restored
  // from localStorage; new states are auto-placed on a grid.
  useEffect(() => {
    if (!flow) return;
    const layout = readLayout(flow.id);
    const freshFlow = flow.id !== builtFlowIdRef.current;

    setNodes((prev) => {
      const prevPos = new Map(prev.map((n) => [n.id, n.position]));
      return flow.states.map((state, idx) => {
        const stored = layout[state.id];
        const kept = !freshFlow ? prevPos.get(state.id) : undefined;
        const position =
          kept ??
          stored ?? {
            x: (idx % 3) * COL_GAP + 40,
            y: Math.floor(idx / 3) * ROW_GAP + 40,
          };
        return {
          id: state.id,
          position,
          data: { label: state.stateName },
          style: nodeStyle(
            state,
            state.id === selectedStateId,
            flow.aiDraftStatus === "PENDING_REVIEW",
          ),
        } satisfies Node;
      });
    });

    const proposed = flow.aiDraftStatus === "PENDING_REVIEW";
    setEdges(
      flow.transitions.map((t) => ({
        id: t.id,
        source: t.fromStateId,
        target: t.toStateId,
        type: "editorTransition",
        data: { label: t.action ?? "" },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: proposed ? "#d97706" : "#525252",
        },
        style: proposed
          ? { stroke: "#d97706", strokeDasharray: "5 4" }
          : undefined,
        selected: t.id === selectedEdgeId,
      })),
    );

    builtFlowIdRef.current = flow.id;
  }, [flow, selectedStateId, selectedEdgeId]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const persistPositions = useCallback(() => {
    if (!flow) return;
    const layout: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) layout[n.id] = n.position;
    writeLayout(flow.id, layout);
  }, [flow, nodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !isDraft) return;
      addTransition.mutate({
        fromStateId: connection.source,
        toStateId: connection.target,
      });
    },
    [addTransition, isDraft],
  );

  // ── Build-panel form state ─────────────────────────────────
  const [stateName, setStateName] = useState("");
  const [stateCategory, setStateCategory] = useState("BUSINESS");
  const [stateRole, setStateRole] = useState<"NORMAL" | "INITIAL" | "TERMINAL">(
    "NORMAL",
  );
  const [terminalKind, setTerminalKind] = useState("SUCCESS");
  const [transFrom, setTransFrom] = useState("");
  const [transTo, setTransTo] = useState("");
  const [transAction, setTransAction] = useState("");

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const selectedState = flow?.states.find((s) => s.id === selectedStateId);
  const selectedEdge = flow?.transitions.find((t) => t.id === selectedEdgeId);

  const stateNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of flow?.states ?? []) map.set(s.id, s.stateName);
    return map;
  }, [flow]);

  function submitAddState(event: FormEvent) {
    event.preventDefault();
    if (!stateName.trim()) return;
    addState.mutate(
      {
        stateName: stateName.trim().toUpperCase().replace(/\s+/g, "_"),
        category: stateCategory,
        role: stateRole,
        terminalKind: stateRole === "TERMINAL" ? terminalKind : undefined,
      },
      { onSuccess: () => setStateName("") },
    );
  }

  function submitAddTransition(event: FormEvent) {
    event.preventDefault();
    if (!transFrom || !transTo || transFrom === transTo) return;
    addTransition.mutate(
      {
        fromStateId: transFrom,
        toStateId: transTo,
        action: transAction.trim() || undefined,
      },
      {
        onSuccess: () => {
          setTransAction("");
          setTransTo("");
        },
      },
    );
  }

  const flowName = flow?.name?.trim() || "New Flow";

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-30 flex flex-col bg-[#050505] md:left-16">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#1c1c1c] bg-[#0a0a0a] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to flows"
            className="rounded p-1 text-[#8e9192] transition-colors hover:bg-[#131313] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-[#8e9192]">
            <span className="hidden truncate sm:inline">{envName || "env"}</span>
            <ChevronRight className="hidden h-3 w-3 shrink-0 sm:inline" />
            <span className="hidden truncate md:inline">{appName || "app"}</span>
            <ChevronRight className="hidden h-3 w-3 shrink-0 md:inline" />
            {editingName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  const next = nameDraft.trim();
                  if (next && next !== flow?.name)
                    updateFlow.mutate({ name: next });
                  setEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="w-48 rounded border border-[#262626] bg-black px-2 py-1 text-sm font-semibold text-white focus:border-white focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNameDraft(flow?.name ?? "");
                  setEditingName(true);
                }}
                className="group inline-flex items-center gap-1.5 truncate text-sm font-semibold text-white"
                title="Rename flow"
              >
                {flowName}
                <Pencil className="h-3 w-3 shrink-0 text-neutral-600 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}
          </div>
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
              isDraft
                ? "border-amber-900/50 bg-amber-950/20 text-amber-300"
                : "border-emerald-900/60 bg-emerald-950/30 text-emerald-300"
            }`}
          >
            {(flow?.lifecycleStatus ?? flow?.status ?? "DRAFT").toLowerCase()} · v
            {flow?.version ?? 1}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isDraft ? (
            <Button
              variant="primary"
              size="sm"
              loading={publishFlow.isPending}
              disabled={publishFlow.isPending || !(flow?.states.length ?? 0)}
              onClick={() => {
                setPublishError(null);
                publishFlow.mutate(undefined, {
                  onError: (e) =>
                    setPublishError(
                      e instanceof Error ? e.message : "Publish failed",
                    ),
                });
              }}
            >
              {!publishFlow.isPending && <Lock className="h-3.5 w-3.5" />}
              Publish
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              loading={reviseFlow.isPending}
              onClick={() => reviseFlow.mutate()}
            >
              {!reviseFlow.isPending && <Unlock className="h-3.5 w-3.5" />}
              Create revision
            </Button>
          )}
        </div>
      </div>

      {publishError && (
        <div
          role="alert"
          className="shrink-0 border-b border-red-900/60 bg-red-950/30 px-4 py-2 text-xs text-red-300"
        >
          {publishError}
        </div>
      )}

      {draftPending && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-amber-900/50 bg-amber-950/20 px-4 py-2.5">
          <p className="text-xs text-amber-200">
            <span className="font-semibold">Draft generated</span>
            {flow?.aiDraftSourceName ? (
              <> from “{flow.aiDraftSourceName}”</>
            ) : null}
            . Review the proposed states and transitions, edit anything from the
            panel, then accept or discard.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={declineAiDraft.isPending}
              disabled={declineAiDraft.isPending || acceptAiDraft.isPending}
              onClick={() => declineAiDraft.mutate()}
            >
              Discard
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={acceptAiDraft.isPending}
              disabled={acceptAiDraft.isPending || declineAiDraft.isPending}
              onClick={() => acceptAiDraft.mutate()}
            >
              <Check className="h-3.5 w-3.5" /> Accept draft
            </Button>
          </div>
        </div>
      )}

      {/* Body: canvas + side panel */}
      <div className="flex min-h-0 flex-1">
        <div className="flow-graph-canvas relative min-w-0 flex-1">
          {/* Keep state cards painted above transition lines and their labels
              so nodes never end up hidden under an edge or its action pill. */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
                .flow-graph-canvas .react-flow__edges { z-index: 1 !important; }
                .flow-graph-canvas .react-flow__edgelabel-renderer { z-index: 4 !important; }
                .flow-graph-canvas .react-flow__nodes { z-index: 10; }
                .flow-graph-canvas .react-flow__node { z-index: 10 !important; }
                .flow-graph-canvas .react-flow__node.selected,
                .flow-graph-canvas .react-flow__node:focus-within { z-index: 1000 !important; }
              `,
            }}
          />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            edgeTypes={editorEdgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={persistPositions}
            onConnect={onConnect}
            onNodeClick={(_, node) => {
              setSelectedStateId(node.id);
              setSelectedEdgeId(null);
              setPanelTab("build");
            }}
            onEdgeClick={(_, edge) => {
              setSelectedEdgeId(edge.id);
              setSelectedStateId(null);
              setPanelTab("build");
            }}
            onPaneClick={() => {
              setSelectedStateId(null);
              setSelectedEdgeId(null);
            }}
            nodesConnectable={isDraft}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#222" gap={20} />
            <Controls />
            <MiniMap
              pannable
              zoomable
              maskColor="rgba(0,0,0,0.6)"
              style={{ background: "#0a0a0a", border: "1px solid #262626" }}
              nodeColor="#262626"
            />
          </ReactFlow>

          {flow && flow.states.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-[#0a0a0a]/80 px-6 py-5 text-center">
                <Workflow className="mx-auto h-6 w-6 text-neutral-600" />
                <p className="mt-2 text-sm font-semibold text-white">
                  Empty flow
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Add your first state from the panel on the right.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <aside className="flex w-[340px] shrink-0 flex-col border-l border-[#1c1c1c] bg-[#0a0a0a]">
          <div className="flex shrink-0 border-b border-[#1c1c1c]">
            {(
              [
                { id: "build", label: "Build", icon: Plus },
                { id: "suggestions", label: "Suggestions", icon: Activity },
                { id: "settings", label: "Settings", icon: Settings2 },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPanelTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-semibold transition-colors ${
                  panelTab === tab.id
                    ? "border-b-2 border-white text-white"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.id === "suggestions" && pendingSuggestions.length > 0 && (
                  <span className="rounded-full bg-white px-1.5 text-[9px] font-bold text-black">
                    {pendingSuggestions.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!isDraft && (
              <div className="mb-4 rounded-md border border-[#262626] bg-[#131313] p-3 text-[11px] text-neutral-400">
                This flow is published and read-only. Create a revision to make
                changes.
              </div>
            )}

            {panelTab === "build" && (
              <div className="space-y-6">
                {/* Selected state editor */}
                {selectedState && (
                  <SelectedStateEditor
                    key={selectedState.id}
                    state={selectedState}
                    disabled={!isDraft}
                    saving={editState.isPending}
                    deleting={deleteState.isPending}
                    onSave={(body) =>
                      editState.mutate({ stateId: selectedState.id, ...body })
                    }
                    onDelete={() => deleteState.mutate(selectedState.id)}
                    onClose={() => setSelectedStateId(null)}
                  />
                )}

                {/* Selected transition editor */}
                {selectedEdge && (
                  <SelectedEdgeEditor
                    key={selectedEdge.id}
                    fromName={
                      stateNameById.get(selectedEdge.fromStateId) ?? "?"
                    }
                    toName={stateNameById.get(selectedEdge.toStateId) ?? "?"}
                    action={selectedEdge.action ?? ""}
                    disabled={!isDraft}
                    saving={editTransition.isPending}
                    deleting={deleteTransition.isPending}
                    onSave={(action) =>
                      editTransition.mutate({
                        transitionId: selectedEdge.id,
                        action,
                      })
                    }
                    onDelete={() => deleteTransition.mutate(selectedEdge.id)}
                    onClose={() => setSelectedEdgeId(null)}
                  />
                )}

                {!selectedState && !selectedEdge && isDraft && (
                  <>
                    {/* Add state */}
                    <form onSubmit={submitAddState} className="space-y-3">
                      <h3 className="flex items-center gap-2 text-xs font-bold text-white">
                        <Plus className="h-3.5 w-3.5" /> Add state
                      </h3>
                      <input
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        placeholder="e.g. PAYMENT_FAILED"
                        className="w-full rounded-lg border border-[#262626] bg-black px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={stateRole}
                          onValueChange={(v) => setStateRole(v as any)}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NORMAL">Intermediate</SelectItem>
                            <SelectItem value="INITIAL">Initial</SelectItem>
                            <SelectItem value="TERMINAL">Terminal</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={stateCategory}
                          onValueChange={setStateCategory}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BUSINESS">Business</SelectItem>
                            <SelectItem value="UI">UI</SelectItem>
                            <SelectItem value="NAVIGATION">
                              Navigation
                            </SelectItem>
                            <SelectItem value="ERROR">Error</SelectItem>
                            <SelectItem value="SYSTEM">System</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {stateRole === "TERMINAL" && (
                        <Select
                          value={terminalKind}
                          onValueChange={setTerminalKind}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Outcome" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SUCCESS">Success</SelectItem>
                            <SelectItem value="FAILURE">Failure</SelectItem>
                            <SelectItem value="CANCELLATION">
                              Cancellation
                            </SelectItem>
                            <SelectItem value="ALTERNATE">
                              Alternate completion
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        type="submit"
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        loading={addState.isPending}
                        disabled={addState.isPending || !stateName.trim()}
                      >
                        Add state
                      </Button>
                    </form>

                    {/* Add transition */}
                    <form
                      onSubmit={submitAddTransition}
                      className="space-y-3 border-t border-[#1c1c1c] pt-5"
                    >
                      <h3 className="flex items-center gap-2 text-xs font-bold text-white">
                        <ChevronRight className="h-3.5 w-3.5" /> Add transition
                      </h3>
                      {flow && flow.states.length < 2 ? (
                        <p className="text-[11px] text-neutral-500">
                          Add at least two states to connect them. You can also
                          drag between nodes on the canvas.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <Select value={transFrom} onValueChange={setTransFrom}>
                              <SelectTrigger className="text-xs">
                                <SelectValue placeholder="From">
                                  {stateNameById.get(transFrom)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {flow?.states.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.stateName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={transTo} onValueChange={setTransTo}>
                              <SelectTrigger className="text-xs">
                                <SelectValue placeholder="To">
                                  {stateNameById.get(transTo)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {flow?.states.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.stateName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <input
                            value={transAction}
                            onChange={(e) => setTransAction(e.target.value)}
                            placeholder="Action (optional) e.g. CLICK_SUBMIT"
                            className="w-full rounded-lg border border-[#262626] bg-black px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-none"
                          />
                          <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            className="w-full"
                            loading={addTransition.isPending}
                            disabled={
                              addTransition.isPending ||
                              !transFrom ||
                              !transTo ||
                              transFrom === transTo
                            }
                          >
                            Add transition
                          </Button>
                        </>
                      )}
                    </form>

                    {/* State list */}
                    {flow && flow.states.length > 0 && (
                      <div className="border-t border-[#1c1c1c] pt-5">
                        <h3 className="mb-2 text-xs font-bold text-white">
                          States ({flow.states.length})
                        </h3>
                        <div className="space-y-1">
                          {flow.states.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setSelectedStateId(s.id)}
                              className="flex w-full items-center justify-between rounded border border-[#1e1e1e] bg-black/40 px-2.5 py-1.5 text-left text-[11px] font-mono text-neutral-300 hover:border-[#333] hover:text-white"
                            >
                              <span className="truncate">{s.stateName}</span>
                              <span className="ml-2 shrink-0 text-[9px] uppercase text-neutral-600">
                                {s.role && s.role !== "NORMAL" ? s.role : s.category}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {panelTab === "suggestions" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white">
                    Suggestions ({pendingSuggestions.length})
                  </h3>
                  <button
                    type="button"
                    aria-label="Refresh suggestions"
                    disabled={
                      manualRefreshSuggestions.isPending || suggestionsLoading
                    }
                    onClick={() => manualRefreshSuggestions.mutate()}
                    className="rounded p-1 text-neutral-400 hover:bg-[#131313] hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        manualRefreshSuggestions.isPending || suggestionsLoading
                          ? "animate-spin"
                          : ""
                      }`}
                    />
                  </button>
                </div>

                {pendingSuggestions.length === 0 ? (
                  <p className="py-8 text-center text-[11px] text-neutral-500">
                    No suggestions right now. Add states and transitions to get
                    branch-state and edge-case suggestions here.
                  </p>
                ) : (
                  pendingSuggestions.map((sug) => (
                    <div
                      key={sug.id}
                      className="space-y-2 rounded-md border border-[#262626] bg-black p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-bold text-white">
                          {sug.title ?? sug.suggestedStateName}
                        </span>
                        <span className="shrink-0 font-mono text-[9px] text-neutral-500">
                          {(sug.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="rounded bg-[#131313]/60 p-1.5 text-[10px] leading-normal text-neutral-400">
                        {sug.rationale}
                      </p>
                      {isDraft && (
                        <div className="flex gap-1.5">
                          <Button
                            size="xs"
                            variant="primary"
                            className="flex-1"
                            disabled={acceptSuggestion.isPending}
                            onClick={() => acceptSuggestion.mutate(sug.id)}
                          >
                            <Check className="h-3 w-3" /> Accept
                          </Button>
                          <Button
                            size="xs"
                            variant="danger"
                            className="flex-1"
                            disabled={rejectSuggestion.isPending}
                            onClick={() =>
                              rejectSuggestion.mutate({ sid: sug.id })
                            }
                          >
                            <X className="h-3 w-3" /> Reject
                          </Button>
                          <Button
                            size="xs"
                            variant="secondary"
                            className="px-2"
                            aria-label="Dismiss"
                            disabled={dismissSuggestion.isPending}
                            onClick={() => dismissSuggestion.mutate(sug.id)}
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {panelTab === "settings" && flow && (
              <FlowSettingsPanel
                key={flow.id}
                flow={flow}
                disabled={!isDraft}
                saving={updateFlow.isPending}
                onSave={(body) => updateFlow.mutate(body)}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Side-panel sub-components
// ─────────────────────────────────────────────────────────────

function SelectedStateEditor({
  state,
  disabled,
  saving,
  deleting,
  onSave,
  onDelete,
  onClose,
}: {
  state: EditorState;
  disabled: boolean;
  saving: boolean;
  deleting: boolean;
  onSave: (body: {
    stateName: string;
    category: string;
    role: "NORMAL" | "INITIAL" | "TERMINAL";
    terminalKind?: string;
  }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(state.stateName);
  const [category, setCategory] = useState(state.category);
  const [role, setRole] = useState(state.role ?? "NORMAL");
  const [terminalKind, setTerminalKind] = useState(
    state.terminalKind ?? "SUCCESS",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-3 rounded-md border border-white/20 bg-[#131313] p-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-bold text-white">
          <Pencil className="h-3.5 w-3.5" /> Edit state
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-500 hover:text-white"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        value={name}
        disabled={disabled}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-[#262626] bg-black px-3 py-2 text-sm text-white focus:border-white focus:outline-none disabled:opacity-60"
      />
      <div className="grid grid-cols-2 gap-2">
        <Select value={role} onValueChange={(v) => setRole(v as any)}>
          <SelectTrigger className="text-xs" disabled={disabled}>
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NORMAL">Intermediate</SelectItem>
            <SelectItem value="INITIAL">Initial</SelectItem>
            <SelectItem value="TERMINAL">Terminal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="text-xs" disabled={disabled}>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BUSINESS">Business</SelectItem>
            <SelectItem value="UI">UI</SelectItem>
            <SelectItem value="NAVIGATION">Navigation</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
            <SelectItem value="SYSTEM">System</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {role === "TERMINAL" && (
        <Select value={terminalKind} onValueChange={setTerminalKind}>
          <SelectTrigger className="text-xs" disabled={disabled}>
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SUCCESS">Success</SelectItem>
            <SelectItem value="FAILURE">Failure</SelectItem>
            <SelectItem value="CANCELLATION">Cancellation</SelectItem>
            <SelectItem value="ALTERNATE">Alternate completion</SelectItem>
          </SelectContent>
        </Select>
      )}
      {!disabled && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="primary"
            className="flex-1"
            loading={saving}
            disabled={saving || !name.trim()}
            onClick={() =>
              onSave({
                stateName: name.trim(),
                category,
                role,
                terminalKind: role === "TERMINAL" ? terminalKind : undefined,
              })
            }
          >
            Save
          </Button>
          {confirmDelete ? (
            <Button
              size="sm"
              variant="danger"
              loading={deleting}
              disabled={deleting}
              onClick={onDelete}
            >
              Confirm delete
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="px-2"
              aria-label="Delete state"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function SelectedEdgeEditor({
  fromName,
  toName,
  action,
  disabled,
  saving,
  deleting,
  onSave,
  onDelete,
  onClose,
}: {
  fromName: string;
  toName: string;
  action: string;
  disabled: boolean;
  saving: boolean;
  deleting: boolean;
  onSave: (action: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(action);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-3 rounded-md border border-white/20 bg-[#131313] p-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-bold text-white">
          <Pencil className="h-3.5 w-3.5" /> Edit transition
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-500 hover:text-white"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="font-mono text-[10px] text-neutral-400">
        {fromName} <span className="text-neutral-600">→</span> {toName}
      </p>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Action label (optional)"
        className="w-full rounded-lg border border-[#262626] bg-black px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-none disabled:opacity-60"
      />
      {!disabled && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="primary"
            className="flex-1"
            loading={saving}
            disabled={saving}
            onClick={() => onSave(value.trim())}
          >
            Save
          </Button>
          {confirmDelete ? (
            <Button
              size="sm"
              variant="danger"
              loading={deleting}
              disabled={deleting}
              onClick={onDelete}
            >
              Confirm delete
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="px-2"
              aria-label="Delete transition"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function FlowSettingsPanel({
  flow,
  disabled,
  saving,
  onSave,
}: {
  flow: EditorFlow;
  disabled: boolean;
  saving: boolean;
  onSave: (body: {
    name?: string;
    purpose?: string;
    scopeStatement?: string;
    workflowType?: string;
  }) => void;
}) {
  const [name, setName] = useState(flow.name ?? "");
  const [purpose, setPurpose] = useState(flow.purpose ?? "");
  const [scope, setScope] = useState(flow.scopeStatement ?? "");
  const [workflowType, setWorkflowType] = useState(flow.workflowType ?? "CUSTOM");

  const dirty =
    name !== (flow.name ?? "") ||
    purpose !== (flow.purpose ?? "") ||
    scope !== (flow.scopeStatement ?? "") ||
    workflowType !== (flow.workflowType ?? "CUSTOM");

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Flow name
        </label>
        <Input
          value={name}
          disabled={disabled}
          maxLength={FLOW_NAME_MAX}
          onChange={(e) =>
            setName(e.target.value.slice(0, FLOW_NAME_MAX))
          }
          className="rounded-lg border-[#262626] bg-black text-sm text-white focus:border-white! disabled:opacity-60"
        />
        <p className="mt-1 text-right text-[11px] text-neutral-500">
          {name.length}/{FLOW_NAME_MAX}
        </p>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Purpose
        </label>
        <Textarea
          value={purpose}
          disabled={disabled}
          maxLength={FLOW_PURPOSE_MAX}
          rows={3}
          onChange={(e) =>
            setPurpose(e.target.value.slice(0, FLOW_PURPOSE_MAX))
          }
          placeholder="What should this functionality achieve?"
          className="rounded-lg border-[#262626] bg-black text-sm text-white placeholder-neutral-600 focus:border-white! disabled:opacity-60"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Scope boundary
        </label>
        <Textarea
          value={scope}
          disabled={disabled}
          maxLength={FLOW_SCOPE_MAX}
          rows={3}
          onChange={(e) =>
            setScope(e.target.value.slice(0, FLOW_SCOPE_MAX))
          }
          placeholder="e.g. Guest lands on cart through order confirmation"
          className="rounded-lg border-[#262626] bg-black text-sm text-white placeholder-neutral-600 focus:border-white! disabled:opacity-60"
        />
        <p className="mt-1 text-[11px] text-amber-300">
          Required before publishing. Keep it to one focused capability.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Workflow type
        </label>
        <Select value={workflowType} onValueChange={setWorkflowType}>
          <SelectTrigger className="text-xs" disabled={disabled}>
            <SelectValue placeholder="Workflow type" />
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
      {!disabled && (
        <Button
          size="sm"
          variant="primary"
          className="w-full"
          loading={saving}
          disabled={saving || !dirty || !name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              purpose: purpose.trim(),
              scopeStatement: scope.trim(),
              workflowType,
            })
          }
        >
          Save changes
        </Button>
      )}
    </div>
  );
}
