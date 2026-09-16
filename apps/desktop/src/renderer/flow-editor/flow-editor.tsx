import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  computeAutoLayout,
  evaluatePublishReadiness,
  type ArrangeDirection,
  type Point,
  type PublishCheckId,
  type PublishReadiness,
} from '@tellann/flow-layout';
import {
  Activity,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  History,
  Lock,
  Maximize,
  MoveHorizontal,
  MoveVertical,
  Network,
  Settings2,
  SquarePlus,
  TriangleAlert,
  Unlock,
  Workflow,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { confirmAction, showMenu } from '../components/desktop-ui';
import { useDesktop } from '../desktop-context';
import { flowInitializationHref, nonProductionEnvironmentId } from '../flow-initialization';
import {
  estimateStateWidth,
  flowEdgeTypes,
  flowNodeTypes,
  type StateNodeType,
  type TransitionEdgeType,
} from './graph-elements';
import {
  AddStateForm,
  AddTransitionForm,
  DeleteFlowDialog,
  HistoryPanel,
  SelectedStateEditor,
  SelectedTransitionEditor,
  SettingsPanel,
  StateList,
  StatusPill,
  STATE_CATEGORIES,
  SuggestionsPanel,
  TERMINAL_KINDS,
} from './panels';
import {
  flowIsEditable,
  useFlowEditor,
  type FlowDetail,
  type FlowState,
  type FlowTransition,
  type StateRole,
  type TerminalKind,
} from './use-flow-editor';
import './flow-editor.css';

type PanelTab = 'build' | 'suggestions' | 'history' | 'settings';
type Selection = { kind: 'state' | 'transition'; id: string } | null;
type Placement = { left: number; top: number; position: { x: number; y: number } };
type Layout = Record<string, { x: number; y: number }>;

type FlowEditorProps = {
  projectId: string;
  flowId: string;
  onClose(): void;
  onDeleted(): void;
};

const DIRECTION_KEY = 'tellann:flow-arrange-direction';
const PANEL_WIDTH_KEY = 'tellann:flow-panel-width';
const PANEL_MIN = 280;
const PANEL_MAX = 560;
const PANEL_DEFAULT = 340;
const RANK_GAP = { TB: 140, LR: 260 } as const;

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Layout preferences are conveniences; losing them is harmless.
  }
}

const layoutKey = (flowId: string) => `tellann:flow-layout:${flowId}`;

function readLayout(flowId: string): Layout {
  try {
    const parsed = JSON.parse(readStorage(layoutKey(flowId)) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed as Layout : {};
  } catch {
    return {};
  }
}

const clampPanel = (value: number) => Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(value)));

function autoLayout(flow: FlowDetail, direction: ArrangeDirection) {
  return computeAutoLayout(
    flow.states.map((state) => ({ id: state.id, label: state.stateName, role: state.role })),
    flow.transitions.map((transition) => ({ source: transition.fromStateId, target: transition.toStateId })),
    direction,
    { estimateWidth: estimateStateWidth, minWidth: 168 },
  );
}

/** A state added outside the canvas goes after its predecessor, or past the existing graph. */
function placeAfterGraph(state: FlowState, flow: FlowDetail, layout: Layout, direction: ArrangeDirection) {
  const placed = Object.values(layout);
  const predecessor = flow.transitions.find((transition) => transition.toStateId === state.id && layout[transition.fromStateId]);
  if (predecessor) {
    const from = layout[predecessor.fromStateId];
    return direction === 'TB' ? { x: from.x, y: from.y + RANK_GAP.TB } : { x: from.x + RANK_GAP.LR, y: from.y };
  }
  if (!placed.length) return { x: 0, y: 0 };
  return direction === 'TB'
    ? { x: Math.min(...placed.map((point) => point.x)), y: Math.max(...placed.map((point) => point.y)) + RANK_GAP.TB }
    : { x: Math.max(...placed.map((point) => point.x)) + RANK_GAP.LR, y: Math.min(...placed.map((point) => point.y)) };
}

/** A state the selected review would add, as returned by the preview endpoint. */
type ProposedState = {
  id: string;
  stateName: string;
  category?: string | null;
  role?: string | null;
  terminalKind?: string | null;
};
type ProposedTransition = { id: string; fromNodeId: string; toNodeId: string; action?: string | null };
type PreviewPatch = { proposedStates?: unknown; proposedTransitions?: unknown };

const proposedStatesOf = (preview: PreviewPatch | null) =>
  (Array.isArray(preview?.proposedStates) ? preview.proposedStates : []) as ProposedState[];
const proposedTransitionsOf = (preview: PreviewPatch | null) =>
  (Array.isArray(preview?.proposedTransitions) ? preview.proposedTransitions : []) as ProposedTransition[];

function graphEdge(points: Point[], direction: ArrangeDirection): Point {
  if (!points.length) return { x: 0, y: 0 };
  return direction === 'TB'
    ? { x: Math.min(...points.map((point) => point.x)), y: Math.max(...points.map((point) => point.y)) }
    : { x: Math.max(...points.map((point) => point.x)), y: Math.min(...points.map((point) => point.y)) };
}

/**
 * Positions for proposed states: each sits after the state it follows (or
 * before the one it leads to), nudged sideways until it has a clear spot, so
 * the proposal reads in place on the graph instead of in a separate diagram.
 */
function proposedPositions(
  preview: PreviewPatch | null,
  positionById: Map<string, Point>,
  direction: ArrangeDirection,
): Map<string, Point> {
  const placed = new Map<string, Point>();
  const anchorFor = (id: string) => positionById.get(id) ?? placed.get(id);
  const occupied = () => [...positionById.values(), ...placed.values()];
  const step = direction === 'TB' ? { x: 0, y: RANK_GAP.TB } : { x: RANK_GAP.LR, y: 0 };
  const nudge = direction === 'TB' ? { x: 230, y: 0 } : { x: 0, y: 120 };
  const transitions = proposedTransitionsOf(preview);

  for (const state of proposedStatesOf(preview)) {
    const predecessor = transitions.find((edge) => edge.toNodeId === state.id && anchorFor(edge.fromNodeId));
    const successor = transitions.find((edge) => edge.fromNodeId === state.id && anchorFor(edge.toNodeId));
    const anchor = predecessor
      ? anchorFor(predecessor.fromNodeId)!
      : successor
        ? anchorFor(successor.toNodeId)!
        : graphEdge(occupied(), direction);
    let point = { x: anchor.x + step.x, y: anchor.y + step.y };
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const clash = occupied().some((taken) => Math.abs(taken.x - point.x) < 80 && Math.abs(taken.y - point.y) < 50);
      if (!clash) break;
      point = { x: point.x + nudge.x, y: point.y + nudge.y };
    }
    placed.set(state.id, point);
  }
  return placed;
}

function focusField(id: string) {
  requestAnimationFrame(() => {
    const field = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    field?.focus();
    field?.select();
  });
}

export function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorWorkspace {...props} />
    </ReactFlowProvider>
  );
}

function FlowEditorWorkspace({ projectId, flowId, onClose, onDeleted }: FlowEditorProps) {
  const editor = useFlowEditor(projectId, flowId);
  const { flow } = editor;
  const reactFlow = useReactFlow<StateNodeType, TransitionEdgeType>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<Layout>({});
  const layoutFlowId = useRef<string | null>(null);
  const fittedFlowId = useRef<string | null>(null);

  const [nodes, setNodes] = useState<StateNodeType[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<PanelTab>('build');
  const [direction, setDirection] = useState<ArrangeDirection>(() => (readStorage(DIRECTION_KEY) === 'LR' ? 'LR' : 'TB'));
  const [panelWidth, setPanelWidth] = useState(() => clampPanel(Number(readStorage(PANEL_WIDTH_KEY)) || PANEL_DEFAULT));
  const [resizing, setResizing] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const editable = flowIsEditable(flow);
  const proposed = (flow as { aiDraftStatus?: string | null } | null)?.aiDraftStatus === 'PENDING_REVIEW';

  // Publishing a Flow does not bind it to the attached project — Instrumentation
  // does that, and it needs the Flow's context in the URL to offer the analysis
  // step at all. Offer the jump from here while the Flow is in front of the user.
  const { applications } = useDesktop();
  const application = applications.find((item) => item.id === projectId);
  const projectBinding = (flow as { projectBindings?: Array<{ status?: string }> } | null)
    ?.projectBindings?.[0];
  const initializeHref = editable || projectBinding?.status === 'ACTIVE'
    ? null
    : flowInitializationHref(projectId, flow, nonProductionEnvironmentId(application));
  const readiness = useMemo<PublishReadiness>(
    () => evaluatePublishReadiness({
      states: flow?.states ?? [],
      transitions: flow?.transitions ?? [],
      scopeStatement: flow?.scopeStatement,
    }),
    [flow],
  );
  const unreachableIds = useMemo(() => new Set(readiness.unreachableStateIds), [readiness]);
  const stateNameById = useMemo(() => new Map((flow?.states ?? []).map((state) => [state.id, state.stateName])), [flow]);
  const selectedState = selection?.kind === 'state' ? flow?.states.find((state) => state.id === selection.id) ?? null : null;
  const selectedTransition = selection?.kind === 'transition'
    ? flow?.transitions.find((transition) => transition.id === selection.id) ?? null
    : null;
  const badgeCount = editor.suggestions.length + editor.review.suggestions.length;

  if (flow && layoutFlowId.current !== flow.id) {
    layoutFlowId.current = flow.id;
    layoutRef.current = readLayout(flow.id);
  }

  const persistLayout = useCallback(() => {
    if (layoutFlowId.current) writeStorage(layoutKey(layoutFlowId.current), JSON.stringify(layoutRef.current));
  }, []);

  // Drop the selection when the selected state or transition no longer exists.
  useEffect(() => {
    if (!flow || !selection) return;
    const exists = selection.kind === 'state'
      ? flow.states.some((state) => state.id === selection.id)
      : flow.transitions.some((transition) => transition.id === selection.id);
    if (!exists) setSelection(null);
  }, [flow, selection]);

  // Rebuild nodes from the flow, keeping dragged positions and saved layout.
  useEffect(() => {
    if (!flow) return;
    const layout = layoutRef.current;
    const missing = flow.states.filter((state) => !layout[state.id]);
    if (missing.length) {
      if (Object.keys(layout).length === 0) {
        autoLayout(flow, direction).forEach((point, id) => {
          layout[id] = point;
        });
      } else {
        for (const state of missing) layout[state.id] = placeAfterGraph(state, flow, layout, direction);
      }
      persistLayout();
    }
    setNodes((previous) => {
      const previousPosition = new Map(previous.map((node) => [node.id, node.position]));
      return flow.states.map((state) => ({
        id: state.id,
        type: 'state' as const,
        position: previousPosition.get(state.id) ?? layout[state.id] ?? { x: 0, y: 0 },
        data: { state, unreachable: unreachableIds.has(state.id), proposed },
        selected: selection?.kind === 'state' && selection.id === state.id,
        sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
        targetPosition: direction === 'TB' ? Position.Top : Position.Left,
      }));
    });
  }, [direction, flow, persistLayout, proposed, selection, unreachableIds]);

  const edges = useMemo<TransitionEdgeType[]>(
    () => (flow?.transitions ?? []).map((transition) => ({
      id: transition.id,
      source: transition.fromStateId,
      target: transition.toStateId,
      type: 'transition' as const,
      data: { label: transition.action ?? '', proposed },
      selected: selection?.kind === 'transition' && selection.id === transition.id,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'var(--text-subtle)' },
    })),
    [flow, proposed, selection],
  );

  // The selected review's proposals ride along on the canvas in yellow until
  // they are applied or declined. They are never draggable or selectable:
  // nothing exists in the graph yet.
  const previewPatch = editor.review.selectedIds.size ? (editor.review.preview as PreviewPatch | null) : null;
  const positionById = useMemo(() => new Map(nodes.map((node) => [node.id, node.position])), [nodes]);

  const ghostNodes = useMemo<StateNodeType[]>(() => {
    const positions = proposedPositions(previewPatch, positionById, direction);
    return proposedStatesOf(previewPatch).map((state) => ({
      id: state.id,
      type: 'state' as const,
      position: positions.get(state.id) ?? { x: 0, y: 0 },
      draggable: false,
      selectable: false,
      connectable: false,
      deletable: false,
      data: {
        state: {
          id: state.id,
          stateName: state.stateName,
          category: state.category ?? 'BUSINESS',
          provenance: 'PROPOSED',
          role: (state.role ?? 'NORMAL') as FlowState['role'],
          terminalKind: (state.terminalKind ?? null) as FlowState['terminalKind'],
        } as FlowState,
        unreachable: false,
        proposed: true,
      },
      sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
      targetPosition: direction === 'TB' ? Position.Top : Position.Left,
    }));
  }, [direction, positionById, previewPatch]);

  const ghostEdges = useMemo<TransitionEdgeType[]>(
    () => proposedTransitionsOf(previewPatch).map((edge) => ({
      id: edge.id,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      type: 'transition' as const,
      selectable: false,
      deletable: false,
      data: { label: edge.action ?? '', proposed: true },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'var(--warning)' },
    })),
    [previewPatch],
  );

  const canvasNodes = useMemo(() => (ghostNodes.length ? [...nodes, ...ghostNodes] : nodes), [ghostNodes, nodes]);
  const canvasEdges = useMemo(() => (ghostEdges.length ? [...edges, ...ghostEdges] : edges), [edges, ghostEdges]);

  useEffect(() => {
    if (!flow || !nodes.length || fittedFlowId.current === flow.id) return;
    fittedFlowId.current = flow.id;
    requestAnimationFrame(() => void reactFlow.fitView({ padding: 0.25, maxZoom: 1.1 }));
  }, [flow, nodes.length, reactFlow]);

  // Bring newly proposed states into view so the change is not off-screen.
  const ghostSignature = ghostNodes.map((node) => node.id).join(',');
  const fittedGhosts = useRef('');
  useEffect(() => {
    if (fittedGhosts.current === ghostSignature) return;
    fittedGhosts.current = ghostSignature;
    if (!ghostSignature) return;
    requestAnimationFrame(() => void reactFlow.fitView({ padding: 0.25, maxZoom: 1.1, duration: 300 }));
  }, [ghostSignature, reactFlow]);

  const fitView = useCallback(() => {
    void reactFlow.fitView({ padding: 0.25, maxZoom: 1.1, duration: 250 });
  }, [reactFlow]);

  const focusState = useCallback((stateId: string) => {
    setSelection({ kind: 'state', id: stateId });
    setTab('build');
    requestAnimationFrame(() => void reactFlow.fitView({ nodes: [{ id: stateId }], padding: 0.8, maxZoom: 1.1, duration: 250 }));
  }, [reactFlow]);

  const autoArrange = useCallback((next: ArrangeDirection) => {
    if (!flow?.states.length) return;
    setDirection(next);
    writeStorage(DIRECTION_KEY, next);
    const positions = autoLayout(flow, next);
    positions.forEach((point, id) => {
      layoutRef.current[id] = point;
    });
    persistLayout();
    setNodes((current) => current.map((node) => (positions.has(node.id) ? { ...node, position: positions.get(node.id)! } : node)));
    requestAnimationFrame(() => void reactFlow.fitView({ padding: 0.25, maxZoom: 1.1, duration: 300 }));
  }, [flow, persistLayout, reactFlow]);

  const onNodesChange = useCallback((changes: NodeChange<StateNodeType>[]) => {
    // Selection and removal go through the editor, so only apply moves and sizing.
    setNodes((current) => applyNodeChanges(changes.filter((change) => change.type === 'position' || change.type === 'dimensions'), current));
  }, []);

  const renameSelection = useCallback(() => {
    if (!selection) return;
    setTab('build');
    focusField(selection.kind === 'state' ? 'flow-selected-state-name' : 'flow-selected-transition-action');
  }, [selection]);

  const deleteState = useCallback(async (state: FlowState) => {
    if (!flow || !editable) return;
    const connected = flow.transitions.filter((transition) => transition.fromStateId === state.id || transition.toStateId === state.id).length;
    if (connected) {
      const confirmed = await confirmAction({
        title: 'Delete state',
        message: `Delete ${state.stateName}?`,
        detail: `Its ${connected} connected transition${connected === 1 ? '' : 's'} will be deleted too.`,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!confirmed) return;
    }
    setSelection(null);
    if (await editor.deleteState(state.id)) {
      delete layoutRef.current[state.id];
      persistLayout();
    }
  }, [editable, editor, flow, persistLayout]);

  const deleteTransition = useCallback(async (transition: FlowTransition) => {
    if (!editable) return;
    setSelection(null);
    await editor.deleteTransition(transition.id);
  }, [editable, editor]);

  const deleteSelection = useCallback(() => {
    if (selectedState) void deleteState(selectedState);
    else if (selectedTransition) void deleteTransition(selectedTransition);
  }, [deleteState, deleteTransition, selectedState, selectedTransition]);

  const startPlacement = useCallback((clientX: number, clientY: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!editable || !bounds) return;
    setSelection(null);
    setPlacement({
      left: clientX - bounds.left,
      top: clientY - bounds.top,
      position: reactFlow.screenToFlowPosition({ x: clientX, y: clientY }),
    });
  }, [editable, reactFlow]);

  const addStateAt = useCallback(async (name: string) => {
    if (!placement || !flow) return;
    const { position } = placement;
    const width = estimateStateWidth(name);
    const added = await editor.addState(
      { stateName: name, category: 'BUSINESS', role: flow.states.length === 0 ? 'INITIAL' : 'NORMAL', terminalKind: 'SUCCESS' },
      (stateId) => {
        layoutRef.current[stateId] = { x: Math.round(position.x - width / 2), y: Math.round(position.y - 23) };
        persistLayout();
      },
    );
    if (added) setPlacement(null);
  }, [editor, flow, persistLayout, placement]);

  // Keyboard: Delete removes, Enter or F2 renames, Esc clears, Shift+1 fits the view.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || deleteOpen) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], .desktop-modal, .palette, .select-content')) return;
      if ((event.shiftKey && event.code === 'Digit1') || ((event.ctrlKey || event.metaKey) && event.key === '0')) {
        event.preventDefault();
        fitView();
        return;
      }
      if (event.key === 'Escape') {
        if (placement) setPlacement(null);
        else if (selection) setSelection(null);
        return;
      }
      if (!selection || event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && editable) {
        event.preventDefault();
        deleteSelection();
      } else if (event.key === 'Enter' || event.key === 'F2') {
        event.preventDefault();
        renameSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteOpen, deleteSelection, editable, fitView, placement, renameSelection, selection]);

  const onNodeContextMenu = useCallback((event: ReactMouseEvent, node: StateNodeType) => {
    const state = flow?.states.find((item) => item.id === node.id);
    if (!state) return;
    setSelection({ kind: 'state', id: state.id });
    const role = (state.role ?? 'NORMAL') as StateRole;
    void showMenu(event, [
      { id: 'rename', label: 'Rename', accelerator: 'F2', enabled: editable },
      { type: 'separator' },
      { id: 'role:INITIAL', label: 'Set as initial state', enabled: editable && role !== 'INITIAL' },
      {
        id: 'terminal',
        label: 'Set as terminal state',
        enabled: editable,
        submenu: TERMINAL_KINDS.map((kind) => ({
          id: `terminal:${kind.value}`,
          label: kind.label,
          type: 'checkbox' as const,
          checked: role === 'TERMINAL' && (state.terminalKind ?? 'SUCCESS') === kind.value,
        })),
      },
      { id: 'role:NORMAL', label: 'Set as intermediate state', enabled: editable && role !== 'NORMAL' },
      {
        id: 'category',
        label: 'Category',
        enabled: editable,
        submenu: STATE_CATEGORIES.map((category) => ({
          id: `category:${category.value}`,
          label: category.label,
          type: 'checkbox' as const,
          checked: (state.category || 'BUSINESS') === category.value,
        })),
      },
      { type: 'separator' },
      { id: 'delete', label: 'Delete', accelerator: 'Delete', enabled: editable },
    ]).then((choice) => {
      if (!choice) return;
      if (choice === 'rename') {
        setTab('build');
        focusField('flow-selected-state-name');
      } else if (choice === 'role:INITIAL') void editor.setInitialState(state);
      else if (choice === 'role:NORMAL') void editor.updateState(state, { role: 'NORMAL' });
      else if (choice.startsWith('terminal:')) void editor.updateState(state, { role: 'TERMINAL', terminalKind: choice.slice(9) as TerminalKind });
      else if (choice.startsWith('category:')) void editor.updateState(state, { category: choice.slice(9) });
      else if (choice === 'delete') void deleteState(state);
    });
  }, [deleteState, editable, editor, flow]);

  const onEdgeContextMenu = useCallback((event: ReactMouseEvent, edge: TransitionEdgeType) => {
    const transition = flow?.transitions.find((item) => item.id === edge.id);
    if (!transition) return;
    setSelection({ kind: 'transition', id: transition.id });
    void showMenu(event, [
      { id: 'label', label: 'Edit action label', accelerator: 'F2', enabled: editable },
      { type: 'separator' },
      { id: 'delete', label: 'Delete transition', accelerator: 'Delete', enabled: editable },
    ]).then((choice) => {
      if (choice === 'label') {
        setTab('build');
        focusField('flow-selected-transition-action');
      } else if (choice === 'delete') void deleteTransition(transition);
    });
  }, [deleteTransition, editable, flow]);

  const onPaneContextMenu = useCallback((event: ReactMouseEvent | MouseEvent) => {
    const { clientX, clientY } = event;
    void showMenu(event, [
      { id: 'add', label: 'Add state here', enabled: editable },
      { type: 'separator' },
      { id: 'arrange', label: 'Auto arrange', enabled: (flow?.states.length ?? 0) > 1 },
      { id: 'fit', label: 'Fit to view', accelerator: 'Shift+1' },
    ]).then((choice) => {
      if (choice === 'add') startPlacement(clientX, clientY);
      else if (choice === 'arrange') autoArrange(direction);
      else if (choice === 'fit') fitView();
    });
  }, [autoArrange, direction, editable, fitView, flow?.states.length, startPlacement]);

  const onConnect = useCallback((connection: Connection) => {
    if (!editable || !connection.source || !connection.target || connection.source === connection.target) return;
    void editor.addTransition(connection.source, connection.target);
  }, [editable, editor]);

  const beginPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidth;
    setResizing(true);
    const onMove = (moveEvent: PointerEvent) => setPanelWidth(clampPanel(startWidth + (startX - moveEvent.clientX)));
    const onUp = () => {
      setResizing(false);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      setPanelWidth((width) => {
        writeStorage(PANEL_WIDTH_KEY, String(width));
        return width;
      });
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const fixCheck = useCallback((checkId: PublishCheckId) => {
    if (checkId === 'scope') {
      setTab('settings');
      focusField('flow-settings-scope');
    } else if (checkId === 'reachable' && readiness.unreachableStateIds[0]) {
      focusState(readiness.unreachableStateIds[0]);
    } else {
      setSelection(null);
      setTab('build');
    }
  }, [focusState, readiness.unreachableStateIds]);

  if (editor.loadError) {
    return (
      <div className="page page-fill flow-editor">
        <header className="page-toolbar">
          <div className="page-toolbar-title">
            <Link className="flow-breadcrumb" to={`/applications/${projectId}/intent`}>Intent</Link>
          </div>
        </header>
        <div className="page-body">
          <div className="infobar" data-tone="danger" role="alert">
            <TriangleAlert size={16} />
            <span>This flow could not be loaded. {editor.loadError}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="page page-fill flow-editor">
        <div className="loading-skeleton" role="status" aria-label="Loading flow">
          <div className="skeleton-line is-title" style={{ width: '24%' }} />
          <div className="skeleton-block" style={{ height: 320 }} />
        </div>
      </div>
    );
  }

  const draftSeq = (flow as { draftSeq?: number }).draftSeq ?? 0;
  const statusLabel = editable
    ? `Draft · v${flow.version ?? 1}${draftSeq > 0 ? ` · d${draftSeq}` : ''}`
    : `Published · v${flow.version ?? 1}`;
  const missing = readiness.checks.filter((check) => !check.passed);
  const pending = Boolean(editor.pendingAction);

  return (
    <div className="page page-fill flow-editor">
      <header className="page-toolbar flow-toolbar">
        <div className="page-toolbar-title">
          <Link className="flow-breadcrumb" to={`/applications/${projectId}/intent`} title="Back to Intent">
            Intent
          </Link>
          <span className="titlebar-separator" aria-hidden="true">/</span>
          <FlowName name={flow.name} editable={editable} onRename={(name) => editor.updateFlow({ name })} />
          <StatusPill tone={editable ? 'warning' : 'success'}>{statusLabel}</StatusPill>
        </div>
        <div className="page-toolbar-spacer" />
        <div className="page-actions">
          {editable ? (
            <>
              <PublishChecklist readiness={readiness} onFix={fixCheck} />
              <span
                className="flow-tooltip-wrap"
                title={readiness.ready ? 'Publish this version' : `Before publishing: ${missing.map((check) => check.label.toLowerCase()).join(', ')}`}
              >
                <button
                  className="button primary"
                  type="button"
                  disabled={!readiness.ready || pending}
                  onClick={() => void editor.publish()}
                >
                  <Lock size={14} />
                  {editor.pendingAction === 'publish' ? 'Publishing…' : 'Publish'}
                </button>
              </span>
            </>
          ) : (
            <>
              {initializeHref ? (
                <Link
                  className="button primary"
                  to={initializeHref}
                  title="Map this Flow onto the attached project so QA runs can start"
                >
                  <Workflow size={14} />
                  Initialize in project
                </Link>
              ) : null}
              <button className="button" type="button" disabled={pending} onClick={() => void editor.revise()}>
                <Unlock size={14} />
                {editor.pendingAction === 'revise' ? 'Creating…' : 'Create revision'}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="page-body flow-editor-body">
        {editor.error ? (
          <div className="infobar" data-tone="danger" role="alert">
            <TriangleAlert size={16} />
            <span>{editor.error}</span>
            <button className="flow-icon-button" type="button" aria-label="Dismiss" onClick={editor.clearError}>
              <X size={14} />
            </button>
          </div>
        ) : null}
        {proposed ? (
          <div className="infobar" data-tone="warning" role="status">
            <Workflow size={16} />
            <span>
              <strong>Generated draft.</strong> Review the proposed states and transitions and edit anything before accepting.
            </span>
            <div className="flow-actions">
              <button
                className="button"
                type="button"
                disabled={pending}
                onClick={() => {
                  void confirmAction({
                    title: 'Discard draft',
                    message: 'Discard this generated draft?',
                    detail: 'The proposed flow is removed. Your documents are kept.',
                    confirmLabel: 'Discard',
                    danger: true,
                  }).then(async (confirmed) => {
                    if (confirmed && (await editor.resolveAiDraft('decline'))) onClose();
                  });
                }}
              >
                Discard
              </button>
              <button className="button primary" type="button" disabled={pending} onClick={() => void editor.resolveAiDraft('accept')}>
                Accept draft
              </button>
            </div>
          </div>
        ) : null}

        <div className="flow-editor-main">
          <div
            className="flow-canvas"
            ref={canvasRef}
            onDoubleClick={(event) => {
              if ((event.target as HTMLElement).classList.contains('react-flow__pane')) startPlacement(event.clientX, event.clientY);
            }}
          >
            <ReactFlow<StateNodeType, TransitionEdgeType>
              nodes={canvasNodes}
              edges={canvasEdges}
              nodeTypes={flowNodeTypes}
              edgeTypes={flowEdgeTypes}
              colorMode="system"
              onNodesChange={onNodesChange}
              onNodeDragStop={(_event, _node, dragged) => {
                for (const item of dragged) layoutRef.current[item.id] = item.position;
                persistLayout();
              }}
              onConnect={onConnect}
              onNodeClick={(_event, node) => {
                setPlacement(null);
                setSelection({ kind: 'state', id: node.id });
                setTab('build');
              }}
              onEdgeClick={(_event, edge) => {
                setPlacement(null);
                setSelection({ kind: 'transition', id: edge.id });
                setTab('build');
              }}
              onPaneClick={() => {
                setPlacement(null);
                setSelection(null);
              }}
              onNodeContextMenu={onNodeContextMenu}
              onEdgeContextMenu={onEdgeContextMenu}
              onPaneContextMenu={onPaneContextMenu}
              nodesConnectable={editable}
              nodesDraggable
              deleteKeyCode={null}
              zoomOnDoubleClick={false}
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
              <Controls showInteractive={false} position="bottom-left" />
              <MiniMap pannable zoomable position="bottom-right" />
              {ghostNodes.length || ghostEdges.length ? (
                <Panel position="top-right">
                  <div className="flow-canvas-legend" role="status">
                    <span className="flow-canvas-legend-swatch" aria-hidden="true" />
                    <span>
                      {ghostNodes.length ? `${ghostNodes.length} proposed state${ghostNodes.length === 1 ? '' : 's'}` : null}
                      {ghostNodes.length && ghostEdges.length ? ' · ' : null}
                      {ghostEdges.length ? `${ghostEdges.length} transition${ghostEdges.length === 1 ? '' : 's'}` : null}
                    </span>
                    <button type="button" onClick={() => setTab('suggestions')}>
                      Review
                    </button>
                  </div>
                </Panel>
              ) : null}
              <Panel position="top-left">
                <div className="flow-canvas-tools" role="toolbar" aria-label="Canvas">
                  <button
                    type="button"
                    disabled={flow.states.length < 2}
                    onClick={() => autoArrange(direction)}
                    title="Lay states out along the flow"
                  >
                    <Network size={14} /> Auto arrange
                  </button>
                  <span className="flow-canvas-tools-separator" aria-hidden="true" />
                  <button type="button" aria-pressed={direction === 'TB'} title="Top to bottom" onClick={() => autoArrange('TB')}>
                    <MoveVertical size={14} />
                  </button>
                  <button type="button" aria-pressed={direction === 'LR'} title="Left to right" onClick={() => autoArrange('LR')}>
                    <MoveHorizontal size={14} />
                  </button>
                  <span className="flow-canvas-tools-separator" aria-hidden="true" />
                  <button type="button" title="Fit to view (Shift+1)" onClick={fitView}>
                    <Maximize size={14} />
                  </button>
                </div>
              </Panel>
            </ReactFlow>

            {flow.states.length === 0 && !placement ? (
              <div className="flow-canvas-empty">
                <div>
                  <SquarePlus size={24} />
                  <strong>Start with the first state</strong>
                  <span>
                    {editable ? 'Double-click the canvas or use Add state in the panel. The first state becomes the initial state.' : 'This flow has no states.'}
                  </span>
                </div>
              </div>
            ) : null}

            {placement ? (
              <QuickAddState
                left={placement.left}
                top={placement.top}
                busy={editor.pendingAction === 'add-state'}
                firstState={flow.states.length === 0}
                onSubmit={(name) => void addStateAt(name)}
                onCancel={() => setPlacement(null)}
              />
            ) : null}
          </div>

          <aside className="flow-panel" style={{ width: panelWidth } as CSSProperties} aria-label="Flow panel">
            <div
              className="flow-panel-resize"
              data-active={resizing ? 'true' : undefined}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panel"
              onPointerDown={beginPanelResize}
            />
            <div className="flow-panel-tabs" role="tablist" aria-label="Flow panel">
              {([
                { id: 'build', label: 'Build', icon: Workflow },
                { id: 'suggestions', label: 'Suggestions', icon: Activity },
                { id: 'history', label: 'History', icon: History },
                { id: 'settings', label: 'Settings', icon: Settings2 },
              ] as const).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  title={item.label}
                  onClick={() => setTab(item.id)}
                >
                  <item.icon size={14} />
                  {panelWidth >= 330 ? item.label : null}
                  {item.id === 'suggestions' && badgeCount ? <span className="flow-tab-badge">{badgeCount}</span> : null}
                </button>
              ))}
            </div>
            <div className="flow-panel-body" role="tabpanel">
              {!editable && tab !== 'history' ? (
                <p className="flow-status-line">
                  <Lock size={13} /> Published versions are read-only. Create a revision to change this flow.
                </p>
              ) : null}

              {tab === 'build' ? (
                selectedState ? (
                  <SelectedStateEditor
                    state={selectedState}
                    editable={editable}
                    connectedCount={flow.transitions.filter((item) => item.fromStateId === selectedState.id || item.toStateId === selectedState.id).length}
                    onSave={(input) => editor.updateState(selectedState, input)}
                    onDelete={() => void deleteState(selectedState)}
                    onClose={() => setSelection(null)}
                  />
                ) : selectedTransition ? (
                  <SelectedTransitionEditor
                    transition={selectedTransition}
                    fromName={stateNameById.get(selectedTransition.fromStateId) ?? 'Unknown state'}
                    toName={stateNameById.get(selectedTransition.toStateId) ?? 'Unknown state'}
                    editable={editable}
                    onSave={(action) => editor.updateTransition(selectedTransition.id, action)}
                    onDelete={() => void deleteTransition(selectedTransition)}
                    onClose={() => setSelection(null)}
                  />
                ) : (
                  <>
                    {editable ? (
                      <>
                        <AddStateForm stateCount={flow.states.length} disabled={pending} onAdd={(input) => editor.addState(input)} />
                        <AddTransitionForm
                          states={flow.states}
                          disabled={pending}
                          onAdd={(from, to, action) => editor.addTransition(from, to, action)}
                        />
                      </>
                    ) : null}
                    <StateList
                      states={flow.states}
                      selectedId={null}
                      unreachableIds={unreachableIds}
                      onSelect={focusState}
                    />
                  </>
                )
              ) : null}

              {tab === 'suggestions' ? (
                <SuggestionsPanel
                  editable={editable}
                  stateCount={flow.states.length}
                  suggestions={editor.suggestions}
                  meta={editor.suggestionMeta}
                  loading={editor.suggestionsLoading}
                  actionId={editor.suggestionActionId}
                  unappliableIds={editor.unappliableIds}
                  onRefresh={editor.refreshSuggestions}
                  onAct={(id, action) => void editor.actOnSuggestion(id, action)}
                  review={{
                    ...editor.review,
                    request: () => void editor.review.request(),
                    apply: () => void editor.review.apply(),
                    decline: () => void editor.review.decline(),
                  }}
                />
              ) : null}

              {tab === 'history' ? (
                <HistoryPanel
                  history={editor.history}
                  loading={editor.historyLoading}
                  editable={editable}
                  restoringId={editor.restoringId}
                  onLoad={editor.loadHistory}
                  onRestore={(snapshotId) => void editor.restoreDraft(snapshotId)}
                />
              ) : null}

              {tab === 'settings' ? (
                <SettingsPanel
                  flow={flow}
                  editable={editable}
                  onSave={(input) => editor.updateFlow(input)}
                  onDelete={() => setDeleteOpen(true)}
                />
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      {deleteOpen ? (
        <DeleteFlowDialog
          flowName={flow.name}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={async () => {
            await editor.deleteFlow();
            setDeleteOpen(false);
            onDeleted();
          }}
        />
      ) : null}
    </div>
  );
}

function FlowName({ name, editable, onRename }: { name: string; editable: boolean; onRename(name: string): Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (!editing) {
    return (
      <button
        className="flow-name"
        type="button"
        disabled={!editable}
        title={editable ? 'Rename flow' : name}
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
      >
        {name}
      </button>
    );
  }

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== name) void onRename(next);
  };

  return (
    <input
      className="flow-name-input"
      aria-label="Flow name"
      autoFocus
      value={draft}
      maxLength={20}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          event.preventDefault();
          setEditing(false);
        }
      }}
    />
  );
}

/** "2 of 4 ready", with each missing requirement explained and one click away from its fix. */
function PublishChecklist({ readiness, onFix }: { readiness: PublishReadiness; onFix(checkId: PublishCheckId): void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="flow-readiness" ref={containerRef}>
      <button
        className="button"
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        {readiness.ready ? <CircleCheck size={14} className="is-ready" /> : <CircleAlert size={14} className="is-pending" />}
        {readiness.passedCount} of {readiness.checks.length} ready
        <ChevronDown size={13} />
      </button>
      {open ? (
        <div className="flow-readiness-popover" role="dialog" aria-label="Publish checklist">
          <ul>
            {readiness.checks.map((check) => (
              <li key={check.id} data-passed={check.passed ? 'true' : undefined}>
                {check.passed ? <CircleCheck size={15} className="is-ready" /> : <CircleAlert size={15} className="is-pending" />}
                <div>
                  <strong>{check.label}</strong>
                  {!check.passed ? <span>{check.detail}</span> : null}
                </div>
                {!check.passed ? (
                  <button
                    className="button"
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onFix(check.id);
                    }}
                  >
                    Fix
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function QuickAddState({
  left,
  top,
  busy,
  firstState,
  onSubmit,
  onCancel,
}: {
  left: number;
  top: number;
  busy: boolean;
  firstState: boolean;
  onSubmit(name: string): void;
  onCancel(): void;
}) {
  const [name, setName] = useState('');
  return (
    <form
      className="flow-quick-add"
      style={{ left, top }}
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() && !busy) onSubmit(name.trim());
      }}
    >
      <input
        autoFocus
        aria-label="New state name"
        value={name}
        disabled={busy}
        spellCheck={false}
        placeholder={firstState ? 'Initial state name' : 'State name'}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (!name.trim()) onCancel();
        }}
      />
      <small>{busy ? 'Adding…' : 'Enter to add · Esc to cancel'}</small>
    </form>
  );
}
