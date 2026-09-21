/**
 * Layout and publish-readiness rules for declared flow graphs.
 *
 * Shared by the web dashboard and the desktop editor so both arrange a flow the
 * same way and agree on what a publishable flow needs. Pure functions over ids
 * and edges, with no dependencies.
 */

export type ArrangeDirection = 'TB' | 'LR';

export interface LayoutNode {
  id: string;
  label: string;
  role?: string | null;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface Point {
  x: number;
  y: number;
}

export const NODE_MIN_WIDTH = 190;
export const NODE_MAX_WIDTH = 260;
export const NODE_ESTIMATED_HEIGHT = 46;

/** Width of the web node card: monospace 11px, ~7px per character, 15px padding each side. */
export function estimateNodeWidth(label: string): number {
  return Math.min(NODE_MAX_WIDTH, Math.max(NODE_MIN_WIDTH, label.length * 7 + 30));
}

export interface AutoLayoutOptions {
  /** Width a node needs for its label; defaults to the web card estimate. */
  estimateWidth?: (label: string) => number;
  /** Height of a node card. */
  nodeHeight?: number;
  /** Narrowest a node card gets, used for left-to-right rank spacing. */
  minWidth?: number;
}

/**
 * Layered (Sugiyama-style) layout. Initial states come first and each state sits
 * one rank past its deepest predecessor, so terminals land last. Back-edges
 * (retry loops) are ignored for ranking so cycles do not break the layout, and
 * a few barycenter sweeps reduce edge crossings.
 */
export function computeAutoLayout(
  layoutNodes: LayoutNode[],
  layoutEdges: LayoutEdge[],
  direction: ArrangeDirection,
  options: AutoLayoutOptions = {},
): Map<string, Point> {
  const estimateWidth = options.estimateWidth ?? estimateNodeWidth;
  const nodeHeight = options.nodeHeight ?? NODE_ESTIMATED_HEIGHT;
  const minWidth = options.minWidth ?? NODE_MIN_WIDTH;
  const result = new Map<string, Point>();
  const ids = layoutNodes.map((node) => node.id);
  if (ids.length === 0) return result;

  const meta = new Map(layoutNodes.map((node) => [node.id, node]));
  const out = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]));
  const inc = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]));
  for (const edge of layoutEdges) {
    if (edge.source === edge.target) continue;
    if (!meta.has(edge.source) || !meta.has(edge.target)) continue;
    out.get(edge.source)!.add(edge.target);
    inc.get(edge.target)!.add(edge.source);
  }

  // 1. Break cycles: iterative DFS colouring, recording back-edges to skip.
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(ids.map((id) => [id, WHITE]));
  const backEdges = new Set<string>();
  const key = (source: string, target: string) => `${source} ${target}`;
  const rootSet = new Set(ids.filter((id) => meta.get(id)!.role === 'INITIAL' || inc.get(id)!.size === 0));
  const startOrder = [...ids.filter((id) => rootSet.has(id)), ...ids.filter((id) => !rootSet.has(id))];
  for (const start of startOrder) {
    if (color.get(start) !== WHITE) continue;
    color.set(start, GRAY);
    const stack: Array<{ id: string; iter: Iterator<string> }> = [{ id: start, iter: out.get(start)!.values() }];
    while (stack.length) {
      const top = stack[stack.length - 1];
      const step = top.iter.next();
      if (step.done) {
        color.set(top.id, BLACK);
        stack.pop();
        continue;
      }
      const next = step.value;
      const state = color.get(next);
      if (state === GRAY) {
        backEdges.add(key(top.id, next));
      } else if (state === WHITE) {
        color.set(next, GRAY);
        stack.push({ id: next, iter: out.get(next)!.values() });
      }
    }
  }
  const isForward = (source: string, target: string) => !backEdges.has(key(source, target));

  // 2. Longest-path ranking over the forward edges via Kahn ordering.
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const source of ids) {
    for (const target of out.get(source)!) {
      if (isForward(source, target)) indegree.set(target, indegree.get(target)! + 1);
    }
  }
  const ready = ids.filter((id) => indegree.get(id) === 0);
  const topo: string[] = [];
  const topoSet = new Set<string>();
  while (ready.length) {
    const current = ready.shift()!;
    topo.push(current);
    topoSet.add(current);
    for (const next of out.get(current)!) {
      if (!isForward(current, next)) continue;
      rank.set(next, Math.max(rank.get(next)!, rank.get(current)! + 1));
      indegree.set(next, indegree.get(next)! - 1);
      if (indegree.get(next) === 0) ready.push(next);
    }
  }
  // Safety net for any node the topological pass missed.
  for (const id of ids) {
    if (topoSet.has(id)) continue;
    let value = 0;
    for (const source of inc.get(id)!) value = Math.max(value, (rank.get(source) ?? 0) + 1);
    rank.set(id, value);
  }

  // 3. Bucket into layers, keeping the topological order within each layer.
  const maxRank = Math.max(...ids.map((id) => rank.get(id)!));
  const layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  const topoIndex = new Map(topo.map((id, index) => [id, index]));
  const ordered = [...ids].sort((a, b) => (topoIndex.get(a) ?? 0) - (topoIndex.get(b) ?? 0));
  for (const id of ordered) layers[rank.get(id)!].push(id);

  // 4. Crossing reduction: alternating down/up barycenter sweeps.
  const orderPos = new Map<string, number>();
  const reindex = () => layers.forEach((layer) => layer.forEach((id, index) => orderPos.set(id, index)));
  reindex();
  for (let sweep = 0; sweep < 8; sweep += 1) {
    const goingDown = sweep % 2 === 0;
    const indices = layers.map((_, index) => index);
    const order = goingDown ? indices.slice(1) : indices.slice(0, -1).reverse();
    for (const layerIndex of order) {
      const neighbours = goingDown ? inc : out;
      const adjacentRank = goingDown ? layerIndex - 1 : layerIndex + 1;
      const barycenter = new Map<string, number>();
      for (const id of layers[layerIndex]) {
        const near = [...neighbours.get(id)!].filter((neighbour) => rank.get(neighbour) === adjacentRank);
        barycenter.set(
          id,
          near.length ? near.reduce((sum, neighbour) => sum + orderPos.get(neighbour)!, 0) / near.length : orderPos.get(id)!,
        );
      }
      layers[layerIndex].sort(
        (a, b) => barycenter.get(a)! - barycenter.get(b)! || orderPos.get(a)! - orderPos.get(b)!,
      );
      layers[layerIndex].forEach((id, index) => orderPos.set(id, index));
    }
    reindex();
  }

  // 5. Coordinates. The main axis follows the flow direction; layers are
  //    centred on the cross axis so the graph reads as a symmetric tree.
  const rankGap = direction === 'TB' ? 140 : 190;
  const siblingGap = direction === 'TB' ? 48 : 40;
  const crossSize = (id: string) => (direction === 'TB' ? estimateWidth(meta.get(id)!.label) : nodeHeight);
  const layerCross = layers.map((layer) =>
    layer.reduce((sum, id, index) => sum + crossSize(id) + (index > 0 ? siblingGap : 0), 0),
  );
  const maxCross = Math.max(1, ...layerCross);

  let mainCursor = 0;
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const layer = layers[layerIndex];
    const layerMain = direction === 'TB'
      ? nodeHeight
      : Math.max(minWidth, ...layer.map((id) => estimateWidth(meta.get(id)!.label)));
    let crossCursor = (maxCross - layerCross[layerIndex]) / 2;
    for (const id of layer) {
      result.set(
        id,
        direction === 'TB'
          ? { x: Math.round(crossCursor), y: Math.round(mainCursor) }
          : { x: Math.round(mainCursor), y: Math.round(crossCursor) },
      );
      crossCursor += crossSize(id) + siblingGap;
    }
    mainCursor += layerMain + rankGap;
  }
  return result;
}

export type PublishCheckId = 'initial' | 'terminal' | 'reachable' | 'scope';

export interface PublishCheck {
  id: PublishCheckId;
  label: string;
  passed: boolean;
  /** What is missing, in a sentence the author can act on. Empty when passed. */
  detail: string;
}

export interface ReadinessState {
  id: string;
  stateName: string;
  role?: string | null;
}

export interface ReadinessTransition {
  fromStateId: string;
  toStateId: string;
}

export interface PublishReadiness {
  checks: PublishCheck[];
  passedCount: number;
  ready: boolean;
  /** States that cannot be reached from the single initial state. */
  unreachableStateIds: string[];
}

function listNames(states: ReadinessState[]): string {
  const names = states.map((state) => state.stateName);
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/**
 * What a flow needs before it can be published: exactly one initial state, a
 * terminal state reachable from it, no states cut off from it, and a scope
 * boundary. Evaluated live so authors see what is missing before publishing.
 */
export function evaluatePublishReadiness(input: {
  states: ReadinessState[];
  transitions: ReadinessTransition[];
  scopeStatement?: string | null;
}): PublishReadiness {
  const { states, transitions } = input;
  const initials = states.filter((state) => state.role === 'INITIAL');
  const terminals = states.filter((state) => state.role === 'TERMINAL');
  const singleInitial = initials.length === 1 ? initials[0] : null;

  const reachable = new Set<string>();
  if (singleInitial) {
    const outgoing = new Map<string, string[]>();
    for (const transition of transitions) {
      const targets = outgoing.get(transition.fromStateId) ?? [];
      targets.push(transition.toStateId);
      outgoing.set(transition.fromStateId, targets);
    }
    const queue = [singleInitial.id];
    reachable.add(singleInitial.id);
    while (queue.length) {
      const current = queue.shift()!;
      for (const next of outgoing.get(current) ?? []) {
        if (reachable.has(next)) continue;
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  const unreachable = singleInitial ? states.filter((state) => !reachable.has(state.id)) : [];
  const needsInitial = 'Needs exactly one initial state before reachability can be checked.';

  const checks: PublishCheck[] = [
    {
      id: 'initial',
      label: 'One initial state',
      passed: Boolean(singleInitial),
      detail: singleInitial
        ? ''
        : states.length === 0
          ? 'Add a state and mark it as the initial state.'
          : initials.length === 0
            ? 'Mark one state as the initial state.'
            : `Only one state can be initial; ${initials.length} are.`,
    },
    {
      id: 'terminal',
      label: 'A reachable terminal state',
      passed: Boolean(singleInitial) && terminals.some((state) => reachable.has(state.id)),
      detail: terminals.length === 0
        ? 'Mark at least one state as a terminal state.'
        : !singleInitial
          ? needsInitial
          : terminals.some((state) => reachable.has(state.id))
            ? ''
            : 'No terminal state can be reached from the initial state. Connect a path to one.',
    },
    {
      id: 'reachable',
      label: 'No orphaned states',
      passed: states.length > 0 && Boolean(singleInitial) && unreachable.length === 0,
      detail: states.length === 0
        ? 'Add states first.'
        : !singleInitial
          ? needsInitial
          : unreachable.length
            ? `${listNames(unreachable)} can't be reached from the initial state.`
            : '',
    },
    {
      id: 'scope',
      label: 'Scope filled in',
      passed: Boolean(input.scopeStatement?.trim()),
      detail: input.scopeStatement?.trim() ? '' : 'Add a scope boundary in Settings.',
    },
  ];
  const passedCount = checks.filter((check) => check.passed).length;
  return {
    checks,
    passedCount,
    ready: passedCount === checks.length,
    unreachableStateIds: unreachable.map((state) => state.id),
  };
}
