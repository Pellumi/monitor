import { createHash } from 'node:crypto';
import { canonicalPattern, normalizeStateKey } from './keys';
import { classifyAction } from './policy';
import { stateAliasesOf } from './sdk-signals';
import type {
  ApiCondition,
  CodeRef,
  ControlDescriptor,
  DerivationStatus,
  ExecutableContract,
  ExecutableState,
  ExecutableTransition,
  FormInput,
} from './types';

/**
 * Compiling a declared Flow into something executable.
 *
 * A Flow says "COURSE_DETAILS, then CREATE_EXAM, then EXAM_FORM". That is intent.
 * To act on it the executor needs to know how to *prove* COURSE_DETAILS is on
 * screen and which control performs CREATE_EXAM. Flow initialization already
 * mapped every state and transition to the code that implements it; this module
 * follows that mapping through the code graph to the DOM-facing facts:
 *
 *   transition checkpoint -> handler entity -> the `ui_action` (button, form, link)
 *   that invokes it -> what that control looks like (labels, test id, element)
 *   and which endpoint it ends up calling (the API condition, and how dangerous it is).
 *
 * Nothing is guessed. Where the code gives no evidence the contract says so
 * (`UNRESOLVED`, `control: null`) and the executor stops instead of clicking a
 * plausible button. The published Flow is never modified.
 */

// -- structural inputs -------------------------------------------------------
// Deliberately minimal and structural rather than the zod types: the compiler
// only needs a handful of fields, and the desktop passes the real objects.

export interface FlowSnapshotLike {
  states: Array<{
    id: string;
    stateId?: string | null;
    stateName?: string | null;
    name?: string | null;
    behaviorKey?: string | null;
    role: 'INITIAL' | 'NORMAL' | 'TERMINAL';
    terminalKind?: string | null;
  }>;
  transitions: Array<{
    id: string;
    fromNodeId?: string;
    toNodeId?: string;
    fromStateId?: string;
    toStateId?: string;
    action?: string | null;
    expectedInput?: unknown;
  }>;
}

export interface CheckpointLike {
  /** `state:<stateId>` or `transition:<transitionId>`. */
  id: string;
  mapping: {
    status: 'RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED' | 'UNSUPPORTED';
    entityId: string | null;
    file: string | null;
    symbol: string | null;
  };
}

export interface CodeEntityLike {
  id: string;
  type: string;
  name: string;
  path: string | null;
  metadata: Record<string, unknown>;
}

export interface CodeRelationshipLike {
  source: string;
  target: string;
  type: string;
  confidence: number;
}

export interface CompileInput {
  flowVersionId: string;
  flow: FlowSnapshotLike;
  checkpoints: CheckpointLike[];
  code: { entities: CodeEntityLike[]; relationships: CodeRelationshipLike[] };
  analysisIdentity?: string | null;
}

const MAX_CALLER_DEPTH = 2;
const MAX_OPTIONAL_ELEMENTS = 20;

export function compileExecutableContract(input: CompileInput): ExecutableContract {
  const index = new CodeIndex(input.code.entities, input.code.relationships);
  const checkpoint = new Map(input.checkpoints.map((item) => [item.id, item]));

  const keyOf = new Map<string, string>();
  for (const state of input.flow.states) {
    keyOf.set(state.id, normalizeStateKey(state.behaviorKey ?? state.stateName ?? state.name ?? state.id));
  }

  const states = input.flow.states.map((state) => compileState(state, keyOf.get(state.id)!, checkpoint.get(`state:${state.id}`), index));
  const transitions = input.flow.transitions.flatMap((transition) => {
    const from = keyOf.get(transition.fromNodeId ?? transition.fromStateId ?? '');
    const to = keyOf.get(transition.toNodeId ?? transition.toStateId ?? '');
    if (!from || !to) return [];
    return [compileTransition(transition, from, to, checkpoint.get(`transition:${transition.id}`), index)];
  });

  const initial = input.flow.states.find((state) => state.role === 'INITIAL');
  return {
    flowVersionId: input.flowVersionId,
    flowHash: createHash('sha256').update(JSON.stringify(input.flow)).digest('hex'),
    analysisIdentity: input.analysisIdentity ?? null,
    initialStateKey: initial ? keyOf.get(initial.id)! : '',
    stateAliases: stateAliasesOf(input.flow.states),
    states,
    transitions,
  };
}

// -- states ------------------------------------------------------------------

function compileState(
  state: FlowSnapshotLike['states'][number],
  key: string,
  checkpoint: CheckpointLike | undefined,
  index: CodeIndex,
): ExecutableState {
  const entity = checkpoint?.mapping.entityId ? index.entity(checkpoint.mapping.entityId) : undefined;
  const routePatterns = entity ? index.routesFor(entity) : [];
  const optional = entity ? index.controlsInFile(entity).slice(0, MAX_OPTIONAL_ELEMENTS) : [];
  return {
    key,
    name: state.stateName ?? state.name ?? key,
    role: state.role,
    terminalKind: state.terminalKind ?? null,
    routePatterns,
    requiredElements: [],
    optionalElements: optional,
    // The application's own SDK marker is the strongest evidence and is required by the
    // prerequisites for an automated run, so every state carries the key it will report.
    sdkStateSignals: [key],
    expectedApi: [],
    codeRefs: codeRefs(checkpoint, entity),
    derivation: derivationFor(checkpoint),
  };
}

// -- transitions -------------------------------------------------------------

function compileTransition(
  transition: FlowSnapshotLike['transitions'][number],
  from: string,
  to: string,
  checkpoint: CheckpointLike | undefined,
  index: CodeIndex,
): ExecutableTransition {
  const entity = checkpoint?.mapping.entityId ? index.entity(checkpoint.mapping.entityId) : undefined;
  const found = entity ? index.controlsFor(entity) : { controls: [], endpoints: [], traced: false };
  const control = mergeControls(found.controls.map((item) => item.descriptor));
  const distinct = new Set(found.controls.map((item) => descriptorIdentity(item.descriptor)));

  const methods = found.endpoints.map((endpoint) => endpoint.method);
  const isNavigation = found.controls.some((item) => item.descriptor.element?.toLowerCase() === 'a' || item.descriptor.href !== null);
  const submitsForm = found.controls.some((item) => item.descriptor.event === 'onSubmit');

  let derivation: DerivationStatus = derivationFor(checkpoint);
  if (derivation === 'RESOLVED') {
    if (found.controls.length === 0) derivation = 'UNRESOLVED';
    else if (distinct.size > 1) derivation = 'AMBIGUOUS';
  }

  return {
    id: transition.id,
    from,
    to,
    action: transition.action ?? null,
    control: found.controls.length > 0 ? control : null,
    inputs: inputsFrom(transition.expectedInput),
    // No evidence about the handler classifies as CLIENT_STATE_MUTATION, never READ; see classifyAction.
    actionClass: classifyAction({
      methods,
      labels: control.labels,
      isNavigation,
      handlerTraced: found.traced,
      submitsForm,
    }),
    expectedApi: found.endpoints.map((endpoint): ApiCondition => ({ method: endpoint.method, route: endpoint.route, expectStatus: null })),
    codeRefs: codeRefs(checkpoint, entity),
    derivation,
  };
}

function derivationFor(checkpoint: CheckpointLike | undefined): DerivationStatus {
  const status = checkpoint?.mapping.status;
  if (status === 'RESOLVED') return 'RESOLVED';
  if (status === 'AMBIGUOUS') return 'AMBIGUOUS';
  return 'UNRESOLVED';
}

function codeRefs(checkpoint: CheckpointLike | undefined, entity: CodeEntityLike | undefined): CodeRef[] {
  const file = checkpoint?.mapping.file ?? entity?.path ?? null;
  if (!file) return [];
  return [{ file, symbol: checkpoint?.mapping.symbol ?? entity?.name ?? null, entityId: entity?.id ?? checkpoint?.mapping.entityId ?? null }];
}

function inputsFrom(expected: unknown): FormInput[] {
  if (!expected) return [];
  const raw: unknown[] = Array.isArray(expected)
    ? expected
    : typeof expected === 'object' ? Object.keys(expected as object) : [];
  return raw.flatMap((item): FormInput[] => {
    if (typeof item === 'string' && item.trim()) return [{ name: item, label: null, dataKey: item }];
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name : typeof record.field === 'string' ? record.field : null;
      if (!name) return [];
      return [{
        name,
        label: typeof record.label === 'string' ? record.label : null,
        dataKey: typeof record.dataKey === 'string' ? record.dataKey : name,
      }];
    }
    return [];
  });
}

// -- descriptors -------------------------------------------------------------

/**
 * A `ControlDescriptor` from a code entity's metadata (a `ui_action`, or anything shaped like
 * one). Shared with the navigation-graph builder in `@tellann/project-intelligence`, so a link
 * or nav-graph edge is described exactly the way a Flow transition's control is.
 */
export function controlDescriptorFromMetadata(metadata: Record<string, unknown>): ControlDescriptor {
  const labels = Array.isArray(metadata.labels) ? metadata.labels.filter((label): label is string => typeof label === 'string' && label.trim().length > 0) : [];
  return {
    labels,
    testId: str(metadata.testId),
    domId: str(metadata.domId),
    element: str(metadata.element),
    event: str(metadata.event),
    actionAnchor: null,
    href: str(metadata.href),
  };
}

function descriptorFrom(entity: CodeEntityLike): ControlDescriptor {
  return controlDescriptorFromMetadata(entity.metadata);
}

function descriptorIdentity(descriptor: ControlDescriptor): string {
  return [descriptor.testId ?? '', descriptor.domId ?? '', [...descriptor.labels].sort().join('|')].join('::');
}

/**
 * Several `ui_action`s can share a handler (the same "save" function behind two buttons). They
 * are merged into one descriptor: the union of labels, and an identifying id only if they agree
 * on it. Live ranking then decides which of them is actually on screen.
 */
function mergeControls(descriptors: ControlDescriptor[]): ControlDescriptor {
  const labels = [...new Set(descriptors.flatMap((descriptor) => descriptor.labels))];
  const testIds = new Set(descriptors.map((descriptor) => descriptor.testId).filter(Boolean));
  const domIds = new Set(descriptors.map((descriptor) => descriptor.domId).filter(Boolean));
  return {
    labels,
    testId: testIds.size === 1 ? [...testIds][0]! : null,
    domId: domIds.size === 1 ? [...domIds][0]! : null,
    element: descriptors.find((descriptor) => descriptor.element)?.element ?? null,
    event: descriptors.find((descriptor) => descriptor.event)?.event ?? null,
    actionAnchor: null,
    href: descriptors.find((descriptor) => descriptor.href)?.href ?? null,
  };
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

// -- code graph queries ------------------------------------------------------

interface FoundControls {
  controls: Array<{ entity: CodeEntityLike; descriptor: ControlDescriptor }>;
  endpoints: Array<{ method: string; route: string }>;
  /** Whether we could follow the handler at all (found an action or an endpoint). */
  traced: boolean;
}

/** Read-only queries over the analysis, indexed once per compile. */
class CodeIndex {
  private readonly byId = new Map<string, CodeEntityLike>();
  private readonly touching = new Map<string, CodeRelationshipLike[]>();
  private readonly routes: CodeEntityLike[] = [];
  private readonly actions: CodeEntityLike[] = [];

  constructor(entities: CodeEntityLike[], relationships: CodeRelationshipLike[]) {
    for (const entity of entities) {
      this.byId.set(entity.id, entity);
      if (entity.type === 'ui_route') this.routes.push(entity);
      if (entity.type === 'ui_action') this.actions.push(entity);
    }
    for (const relationship of relationships) {
      for (const id of [relationship.source, relationship.target]) {
        const list = this.touching.get(id);
        if (list) list.push(relationship);
        else this.touching.set(id, [relationship]);
      }
    }
  }

  entity(id: string): CodeEntityLike | undefined {
    return this.byId.get(id);
  }

  /** Canonical route patterns identifying the page an entity belongs to. */
  routesFor(entity: CodeEntityLike): string[] {
    const patterns = new Set<string>();
    const add = (route: CodeEntityLike) => {
      const value = str(route.metadata.route);
      if (value) patterns.add(canonicalPattern(value));
    };
    if (entity.type === 'ui_route') add(entity);
    for (const relationship of this.touching.get(entity.id) ?? []) {
      const other = this.byId.get(relationship.source === entity.id ? relationship.target : relationship.source);
      if (other?.type === 'ui_route') add(other);
    }
    // A Next.js page: the route entity and the component share a file.
    if (entity.path) for (const route of this.routes) if (route.path === entity.path) add(route);
    return [...patterns];
  }

  /** Every control declared in the same file as `entity`: what the page it defines exposes. */
  controlsInFile(entity: CodeEntityLike): ControlDescriptor[] {
    if (!entity.path) return [];
    return this.actions
      .filter((action) => action.path === entity.path)
      .map(descriptorFrom)
      .filter((descriptor) => descriptor.labels.length > 0 || descriptor.testId !== null);
  }

  /**
   * The controls that invoke `entity`, and the endpoints performing them ends up calling.
   *
   * Three passes, because the direction matters. Walking up from an endpoint finds its callers; walking
   * down from a handler finds its endpoints; doing both from every node would attribute another button's
   * calls to this transition.
   *
   *   1. handlers: `entity` itself, plus whatever calls it (a bounded number of hops up).
   *   2. controls: the `ui_action`s wired to a handler (or `entity` if it is itself a control).
   *   3. endpoints: `entity` if it is one, plus what the wired handlers call directly.
   */
  controlsFor(entity: CodeEntityLike): FoundControls {
    const handlers = new Map<string, CodeEntityLike>([[entity.id, entity]]);
    let frontier: CodeEntityLike[] = [entity];
    for (let depth = 0; depth < MAX_CALLER_DEPTH; depth += 1) {
      const next: CodeEntityLike[] = [];
      for (const current of frontier) {
        for (const relationship of this.touching.get(current.id) ?? []) {
          if (relationship.type !== 'CALLS' || relationship.target !== current.id) continue;
          const caller = this.byId.get(relationship.source);
          // A control is a leaf: what it calls is its own handler, already covered in pass 3.
          if (!caller || caller.type === 'ui_action' || handlers.has(caller.id)) continue;
          handlers.set(caller.id, caller);
          next.push(caller);
        }
      }
      frontier = next;
    }

    const controls = new Map<string, { entity: CodeEntityLike; descriptor: ControlDescriptor }>();
    const wired = new Map<string, CodeEntityLike>();
    const addControl = (action: CodeEntityLike) => controls.set(action.id, { entity: action, descriptor: descriptorFrom(action) });
    if (entity.type === 'ui_action') addControl(entity);
    for (const handler of handlers.values()) {
      for (const relationship of this.touching.get(handler.id) ?? []) {
        if (relationship.target !== handler.id || (relationship.type !== 'ROUTES_TO' && relationship.type !== 'HANDLED_BY')) continue;
        const action = this.byId.get(relationship.source);
        if (action?.type === 'ui_action') { addControl(action); wired.set(handler.id, handler); }
      }
    }

    const endpoints = new Map<string, { method: string; route: string }>();
    const addEndpoint = (candidate: CodeEntityLike | undefined) => {
      if (candidate?.type !== 'endpoint') return;
      const method = str(candidate.metadata.method)?.toUpperCase();
      const route = str(candidate.metadata.route);
      if (method && route) endpoints.set(`${method} ${route}`, { method, route: canonicalPattern(route) });
    };
    addEndpoint(entity);
    // What the control's handlers call is what clicking it does. A control that is itself the root has its
    // own outgoing calls; a wired handler has its own.
    for (const source of [...(entity.type === 'ui_action' ? [entity] : []), ...wired.values()]) {
      for (const relationship of this.touching.get(source.id) ?? []) {
        if (relationship.source === source.id && relationship.type === 'CALLS') addEndpoint(this.byId.get(relationship.target));
      }
    }
    // A control routed to a handler: follow the routing edge outward to that handler's calls too.
    for (const { entity: action } of controls.values()) {
      for (const relationship of this.touching.get(action.id) ?? []) {
        if (relationship.source !== action.id || (relationship.type !== 'ROUTES_TO' && relationship.type !== 'HANDLED_BY')) continue;
        const handler = this.byId.get(relationship.target);
        if (!handler || handler.type === 'ui_route' || handler.type === 'file') continue;
        for (const call of this.touching.get(handler.id) ?? []) {
          if (call.source === handler.id && call.type === 'CALLS') addEndpoint(this.byId.get(call.target));
        }
      }
    }

    return {
      controls: [...controls.values()],
      endpoints: [...endpoints.values()],
      traced: controls.size > 0 || endpoints.size > 0,
    };
  }
}
