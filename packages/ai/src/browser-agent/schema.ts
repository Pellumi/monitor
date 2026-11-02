import { z } from 'zod';

/**
 * What the model is allowed to answer with for each of `BrowserAgentModel`'s three questions.
 *
 * `plan()`'s `TestPlan` only ever names scenarios and the contract-declared state keys they
 * should reach — never a DOM selector, a coordinate, or a literal click sequence. Routing to a
 * named state is the deterministic engine's own job (`planFlowPath`); the model's job is
 * choosing *which* states, in what order, satisfy the English goal.
 *
 * `decide()`'s `ActionProposal` is used only for the narrow undeclared-control fallback (an
 * on-screen situation the contract never anticipated). `targetRef` must be one of the refs the
 * caller already found on the live page — the same rule `AmbiguityProposal.choice` in
 * `@tellann/automation-engine`'s `ambiguity.ts` already follows: a proposal can choose among
 * candidates that exist, never invent one.
 */

export const TestPlanScenarioSchema = z.object({
  key: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  /** Contract-declared state keys this scenario should reach, in order. Checked against the real contract after generation. */
  targetStateKeys: z.array(z.string().min(1).max(80)).min(1).max(5),
  successCriteria: z.array(z.string().min(1).max(300)).max(10),
  /** True when this scenario may need to navigate a screen the contract does not declare. */
  exploratory: z.boolean().default(false),
});
export type TestPlanScenario = z.infer<typeof TestPlanScenarioSchema>;

export const TestPlanSchema = z.object({
  goal: z.string().min(1).max(2000),
  scenarios: z.array(TestPlanScenarioSchema).min(1).max(20),
});
export type TestPlan = z.infer<typeof TestPlanSchema>;

export const ACTION_PROPOSAL_ACTIONS = ['CLICK', 'FILL', 'SELECT', 'CHECK', 'WAIT'] as const;

export const ActionProposalSchema = z.object({
  action: z.enum(ACTION_PROPOSAL_ACTIONS),
  /** Must be one of the candidate refs offered in the prompt. Never a free-text selector. */
  targetRef: z.string().min(1).max(200),
  /** For FILL/SELECT/CHECK; never a secret value — the caller fills those itself. */
  value: z.string().max(4000).nullable().default(null),
  rationale: z.string().min(1).max(500),
});
export type ActionProposal = z.infer<typeof ActionProposalSchema>;

export const FAILURE_LIKELY_CAUSES = ['APPLICATION_DEFECT', 'TEST_SETUP', 'TRANSIENT', 'UNKNOWN'] as const;
export const FAILURE_SUGGESTED_RECOVERIES = ['RETRY', 'ALTERNATIVE_SELECTOR', 'REPLAN', 'ASK_HUMAN', 'GIVE_UP'] as const;
export const FAILURE_CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const;

export const FailureExplanationSchema = z.object({
  likelyCause: z.enum(FAILURE_LIKELY_CAUSES),
  explanation: z.string().min(1).max(1000),
  suggestedRecovery: z.enum(FAILURE_SUGGESTED_RECOVERIES),
  confidence: z.enum(FAILURE_CONFIDENCE_LEVELS),
});
export type FailureExplanation = z.infer<typeof FailureExplanationSchema>;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface ContractStateSummary {
  key: string;
  name: string;
  role: 'INITIAL' | 'NORMAL' | 'TERMINAL';
  terminalKind: string | null;
}

export interface ContractTransitionSummary {
  from: string;
  to: string;
  action: string | null;
}

export interface PlanningContext {
  goal: string;
  states: ContractStateSummary[];
  transitions: ContractTransitionSummary[];
}

export interface DecisionCandidate {
  ref: string;
  role: string | null;
  name: string | null;
  label: string | null;
}

export interface DecisionContext {
  goal: string;
  scenarioTitle: string;
  /** What the page shows now: title, headings and the candidates found on it. Never a screenshot. */
  path: string;
  title: string | null;
  headings: string[];
  candidates: DecisionCandidate[];
  /** What was already tried on this screen this scenario, most recent last. */
  history: string[];
}

export interface FailureContext {
  scenarioTitle: string;
  attemptedAction: string;
  expected: string;
  observed: string;
}
