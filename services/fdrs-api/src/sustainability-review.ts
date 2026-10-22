import crypto from 'node:crypto';
import { lintWorkflowLanguage } from '@tellann/ai';
import type { FlowNarrationResponse, LanguageWorkflow } from '@tellann/ai';
import { findRouteCollisions } from '@tellann/automation-engine';
import type { ExecutableState } from '@tellann/automation-engine';

/**
 * The free, deterministic half of a pre-publish Flow Sustainability Review: everything that
 * can be judged from the declared draft graph alone, with no AI call and no running
 * application. Ships for every plan, with no entitlement check — see docs on the AI-judgment
 * and live-coverage-walk halves (gated) elsewhere.
 *
 * Deliberately a pure module, exactly like `automated-reconciliation.ts`'s own reasoning for
 * staying separate from the DB-interleaved route handlers: the classification rules here are
 * exactly the kind of logic that should be verified without a database or a live app.
 */

export type SustainabilityCriterion =
  | 'INTERPRETABLE_END_TO_END'
  | 'CODEBASE_MAPPING'
  | 'ROUTE_DISAMBIGUATION'
  | 'BUSINESS_INTENT_DERIVABLE'
  | 'DATA_ACTION_COMPLETENESS';

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface SustainabilityFindingDraft {
  criterion: SustainabilityCriterion;
  code: string;
  severity: FindingSeverity;
  message: string;
  nodeIds: string[];
  edgeIds: string[];
  rationale?: string | null;
  source: 'STATIC' | 'AI' | 'COVERAGE_WALK';
}

/** The columns this module reads off a draft's nodes and edges. A subset of the full Prisma row, so this stays testable with plain fixtures. */
export interface SustainabilityGraphNode {
  id: string;
  stateName: string;
  role: string;
  terminalKind?: string | null;
  behaviorKey?: string | null;
  /** `{ routes?: string[], headings?: string[], texts?: string[] }`, as declared on the node. */
  recognizer?: unknown;
  expectedInput?: unknown;
  expectedOutput?: unknown;
}

export interface SustainabilityGraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  action?: string | null;
  expectedInput?: unknown;
  control?: unknown;
}

/**
 * A content fingerprint of a draft, used to cache a review so an unchanged draft never
 * re-runs the (costly) AI or coverage-walk parts on a repeated publish attempt.
 *
 * Deliberately broader than `index.ts`'s `graphRevisionHash`, which hashes only each node's
 * `{stateName, category}` and each edge's `{from, to, action}` — it does not change when only
 * a transition's declared `expectedInput` changes. Reusing it as-is here would mean fixing
 * exactly the class of bug this review exists to catch (adding a missing declared field)
 * would not invalidate the cached review.
 */
export function buildReviewHash(nodes: SustainabilityGraphNode[], edges: SustainabilityGraphEdge[]): string {
  const payload = {
    states: [...nodes]
      .map((node) => ({
        name: node.stateName, role: node.role, terminalKind: node.terminalKind ?? null,
        recognizer: node.recognizer ?? null, expectedInput: node.expectedInput ?? null, expectedOutput: node.expectedOutput ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    transitions: [...edges]
      .map((edge) => ({
        from: edge.fromNodeId, to: edge.toNodeId, action: edge.action ?? '',
        expectedInput: edge.expectedInput ?? null, control: edge.control ?? null,
      }))
      .sort((a, b) => `${a.from}:${a.to}:${a.action}`.localeCompare(`${b.from}:${b.to}:${b.action}`)),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** The draft, reshaped into what `lintWorkflowLanguage` (packages/ai) already knows how to check. */
function toLanguageWorkflow(nodes: SustainabilityGraphNode[], edges: SustainabilityGraphEdge[]): LanguageWorkflow {
  const nameById = new Map(nodes.map((node) => [node.id, node.stateName]));
  return {
    key: 'draft', name: 'draft',
    states: nodes.map((node) => ({ key: node.stateName, name: node.stateName, role: node.role })),
    transitions: edges.map((edge) => ({
      from: nameById.get(edge.fromNodeId) ?? edge.fromNodeId,
      to: nameById.get(edge.toNodeId) ?? edge.toNodeId,
      ...(edge.action ? { action: edge.action } : {}),
    })),
  };
}

// `NO_INITIAL_STATE` / `MULTIPLE_INITIAL_STATES` / `NO_TERMINAL_STATE` are intentionally left
// out here: `validateFlow` already hard-blocks publish on those, so surfacing them again as
// an advisory finding would just be the same fact said twice.
const INTERPRETABILITY_CODES = new Set(['UNREACHABLE_STATE', 'DEAD_END_STATE']);
// Vague naming is exactly what blocks a reader from deriving business intent from the graph
// alone — a free, deterministic signal worth surfacing before criterion 4's gated AI narrative.
const NAMING_CODES = new Set(['STATE_NAME_NOT_COMPACT', 'ACTION_MISSING', 'ACTION_GENERIC']);

function nodeIdFor(nodes: SustainabilityGraphNode[], stateKey: string | undefined): string[] {
  const match = nodes.find((node) => node.stateName === stateKey);
  return match ? [match.id] : [];
}

/** Criterion 1 (reachability/dead ends) and criterion 4's free naming pre-check, both via `lintWorkflowLanguage`. */
export function languageFindings(nodes: SustainabilityGraphNode[], edges: SustainabilityGraphEdge[]): SustainabilityFindingDraft[] {
  const issues = lintWorkflowLanguage(toLanguageWorkflow(nodes, edges));
  return issues.flatMap((issue): SustainabilityFindingDraft[] => {
    if (INTERPRETABILITY_CODES.has(issue.code)) {
      return [{
        criterion: 'INTERPRETABLE_END_TO_END', code: issue.code,
        severity: issue.severity === 'ERROR' ? 'CRITICAL' : 'MEDIUM',
        message: issue.message, nodeIds: nodeIdFor(nodes, issue.target), edgeIds: [], source: 'STATIC',
      }];
    }
    if (NAMING_CODES.has(issue.code)) {
      return [{
        criterion: 'BUSINESS_INTENT_DERIVABLE', code: issue.code, severity: 'LOW',
        message: issue.message, nodeIds: nodeIdFor(nodes, issue.target), edgeIds: [], source: 'STATIC',
      }];
    }
    return [];
  });
}

/** The draft's nodes, reshaped into what `findRouteCollisions` (packages/automation-engine) needs: only what a node itself declares, nothing resolved by a code-mapping pass. */
function toExecutableStates(nodes: SustainabilityGraphNode[]): ExecutableState[] {
  return nodes.map((node) => {
    const recognizer = (node.recognizer ?? {}) as { routes?: string[]; headings?: string[]; texts?: string[] };
    const role = node.role === 'INITIAL' || node.role === 'TERMINAL' ? node.role : 'NORMAL';
    return {
      key: node.stateName, name: node.stateName, role, terminalKind: node.terminalKind ?? null,
      routePatterns: recognizer.routes ?? [], headings: recognizer.headings ?? [], texts: recognizer.texts ?? [],
      // Required elements come from a code-mapping pass this pre-publish check does not run;
      // the coverage walk (gated) can add that evidence later. Route and SDK-signal evidence,
      // declared directly on the node, is what is checked here.
      requiredElements: [], optionalElements: [],
      sdkStateSignals: node.behaviorKey ? [node.behaviorKey] : [],
      expectedApi: [], codeRefs: [], derivation: 'UNRESOLVED',
    };
  });
}

/** Criterion 3: terminal/intermediate route collisions, via `findRouteCollisions`. */
export function routeCollisionFindings(nodes: SustainabilityGraphNode[]): SustainabilityFindingDraft[] {
  const states = toExecutableStates(nodes);
  return findRouteCollisions(states).map((finding): SustainabilityFindingDraft => ({
    criterion: 'ROUTE_DISAMBIGUATION', code: finding.code,
    severity: finding.severity === 'CRITICAL' ? 'CRITICAL' : 'INFO',
    message: finding.detail,
    nodeIds: finding.stateKeys.flatMap((key) => nodeIdFor(nodes, key)),
    edgeIds: [], source: 'STATIC',
  }));
}

/** Every free, deterministic finding this review produces. No AI call, no running app, no entitlement check. */
export function runStaticSustainabilityChecks(nodes: SustainabilityGraphNode[], edges: SustainabilityGraphEdge[]): SustainabilityFindingDraft[] {
  return [...languageFindings(nodes, edges), ...routeCollisionFindings(nodes)];
}

// ─────────────────────────────────────────────────────────────
// Gated half: criteria 1's narration, 2's mapping-ambiguity proxy, and 4's business-intent
// judgment, all from one `generateFlowNarration` call (packages/ai). Entitlement-checked by
// the caller before this is ever invoked — nothing here checks access on its own.
// ─────────────────────────────────────────────────────────────

/** The draft, reshaped into what `generateFlowNarration` (packages/ai) takes as input. */
export function toNarrationInput(flowName: string, nodes: SustainabilityGraphNode[], edges: SustainabilityGraphEdge[]): {
  flowName: string;
  states: Array<{ key: string; name: string; role?: string; terminalKind?: string | null }>;
  transitions: Array<{ from: string; to: string; action?: string | null }>;
} {
  const nameById = new Map(nodes.map((node) => [node.id, node.stateName]));
  return {
    flowName,
    states: nodes.map((node) => ({ key: node.stateName, name: node.stateName, role: node.role, terminalKind: node.terminalKind ?? null })),
    transitions: edges.map((edge) => ({
      from: nameById.get(edge.fromNodeId) ?? edge.fromNodeId,
      to: nameById.get(edge.toNodeId) ?? edge.toNodeId,
      action: edge.action ?? null,
    })),
  };
}

function edgeIdFor(nodes: SustainabilityGraphNode[], edges: SustainabilityGraphEdge[], fromKey: string | null | undefined, toKey: string | null | undefined): string[] {
  if (!fromKey || !toKey) return [];
  const fromId = nodes.find((node) => node.stateName === fromKey)?.id;
  const toId = nodes.find((node) => node.stateName === toKey)?.id;
  if (!fromId || !toId) return [];
  const match = edges.find((edge) => edge.fromNodeId === fromId && edge.toNodeId === toId);
  return match ? [match.id] : [];
}

/**
 * A model's narration turned into findings for criteria 1 (interpretability), 2 (mapping
 * ambiguity — a proxy; see the schema doc on why the real mapping pipeline cannot run
 * pre-publish) and 4 (business intent). One call answers all three, so this is one mapper
 * rather than three.
 */
export function narrationFindings(
  narration: FlowNarrationResponse,
  nodes: SustainabilityGraphNode[],
  edges: SustainabilityGraphEdge[],
): SustainabilityFindingDraft[] {
  const findings: SustainabilityFindingDraft[] = [];

  if (!narration.canNarrateEndToEnd) {
    findings.push({
      criterion: 'INTERPRETABLE_END_TO_END', code: 'NARRATION_INCOMPLETE', severity: 'MEDIUM',
      message: 'A model could not narrate this Flow from its initial state to each terminal state using only what is declared.',
      nodeIds: [], edgeIds: [], rationale: narration.narrative, source: 'AI',
    });
  }
  for (const hedge of narration.hedges) {
    findings.push({
      criterion: 'INTERPRETABLE_END_TO_END', code: 'NARRATION_HEDGE', severity: 'LOW',
      message: hedge.reason,
      nodeIds: hedge.stateKey ? nodeIdFor(nodes, hedge.stateKey) : [],
      edgeIds: edgeIdFor(nodes, edges, hedge.fromStateKey, hedge.toStateKey),
      source: 'AI',
    });
  }

  if (!narration.canDeriveBusinessIntent) {
    findings.push({
      criterion: 'BUSINESS_INTENT_DERIVABLE', code: 'BUSINESS_INTENT_UNCLEAR', severity: 'MEDIUM',
      message: 'A model could not state this Flow\'s business purpose from its declared names and structure alone.',
      nodeIds: [], edgeIds: [], rationale: narration.businessIntentSummary, source: 'AI',
    });
  }

  for (const ambiguous of narration.ambiguousIdentifiers) {
    findings.push({
      criterion: 'CODEBASE_MAPPING', code: 'IDENTIFIER_LIKELY_AMBIGUOUS', severity: 'LOW',
      message: ambiguous.reason,
      nodeIds: ambiguous.stateKey ? nodeIdFor(nodes, ambiguous.stateKey) : [],
      edgeIds: edgeIdFor(nodes, edges, ambiguous.fromStateKey, ambiguous.toStateKey),
      source: 'AI',
    });
  }

  return findings;
}
