import { createHash } from "node:crypto";
import { buildLoginEdge, buildNavigationGraph } from "@tellann/project-intelligence";
import { compileExecutableContract } from "@tellann/automation-engine";
import type { CheckpointLike, CodeEntityLike, CodeRelationshipLike, ExecutableContract, NavigationGraph } from "@tellann/automation-engine";
import type { CodebaseAnalysis, ContractSummary } from "@tellann/desktop-contracts";
import type { KeyValueStore } from "./persona-store";
import { localKeyValueStore } from "./persona-store";

/**
 * Getting from what the platform and the code analysis know to something a run can execute.
 *
 * Three things are needed and they live in three places: the published Flow (the platform), how each of its
 * checkpoints maps into the code (the platform, from the Flow's initialization), and the code itself, analysed
 * on this machine. The contract is compiled here, on this machine, from all three, and never leaves it: it names files,
 * symbols and control labels from the developer's source. What is sent on is a hash and some counts.
 *
 * A published Flow version and a completed initialization are immutable, so the two documents fetched from the platform
 * are kept locally by id and a run never waits on the network for something that cannot have changed. The analysis is
 * *not* cached here: it is the local analysis of the folder as it stands, read fresh.
 */

export interface FlowVersionDocument {
  states: Array<Record<string, unknown>>;
  transitions: Array<Record<string, unknown>>;
}

export interface InitializationManifest {
  checkpoints: Array<{ id: string; mapping: Record<string, unknown> }>;
}

export interface ContractInputs {
  applicationId: string;
  flowId: string;
  flowVersionId: string;
  flowInitializationId: string;
  /** Confirmed by a person; the code is never trusted to say where the sign-in page is. */
  loginRoute: string | null;
  /** `data-tellann-action` values that were actually applied to controls, by transition id. */
  anchors?: Record<string, string>;
}

export interface ContractPipelineDeps {
  fetchFlowVersion(): Promise<FlowVersionDocument>;
  fetchManifest(): Promise<InitializationManifest | null>;
  /** The local analysis of this workspace, or null when there is none yet. */
  loadAnalysis(): CodebaseAnalysis | null;
  cache?: KeyValueStore;
}

export type LoginEdgeStatus = "BUILT" | "NOT_NEEDED" | "NOT_CONFIGURED" | "NO_FORM_FOUND";

export interface PreparedContract {
  contract: ExecutableContract;
  navigation: NavigationGraph;
  summary: ContractSummary;
  login: LoginEdgeStatus;
  /** Where each fetched document came from, so a slow start can be explained. */
  sources: { flowVersion: "CACHE" | "PLATFORM"; manifest: "CACHE" | "PLATFORM" };
}

export class ContractPipelineError extends Error {
  constructor(
    readonly code: "CODE_ANALYSIS_REQUIRED" | "FLOW_MAPPING_REQUIRED" | "FLOW_INVALID",
    message: string,
  ) {
    super(message);
  }
}

const versionKey = (applicationId: string, flowVersionId: string) => `automation-flow-version:${applicationId}:${flowVersionId}`;
const manifestKey = (initializationId: string) => `automation-flow-manifest:${initializationId}`;

const text = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);

async function cached<T>(store: KeyValueStore, key: string, fetch: () => Promise<T | null>): Promise<{ value: T | null; from: "CACHE" | "PLATFORM" }> {
  const hit = store.read<T>(key);
  if (hit) return { value: hit, from: "CACHE" };
  const fresh = await fetch();
  // Only what the platform actually returned is kept; a miss is not remembered as an answer.
  if (fresh) store.write(key, fresh);
  return { value: fresh, from: "PLATFORM" };
}

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function prepareContract(input: ContractInputs, deps: ContractPipelineDeps): Promise<PreparedContract> {
  const store = deps.cache ?? localKeyValueStore;

  const analysis = deps.loadAnalysis();
  if (!analysis || !["COMPLETED", "PARTIAL"].includes(analysis.status)) {
    throw new ContractPipelineError(
      "CODE_ANALYSIS_REQUIRED",
      "Automated Run reads your code to work out what to click, and this application has not been analysed yet. Analyse it from the Applications page, then start the run again.",
    );
  }

  const version = await cached(store, versionKey(input.applicationId, input.flowVersionId), async () => deps.fetchFlowVersion());
  if (!version.value || version.value.states.length === 0) {
    throw new ContractPipelineError("FLOW_INVALID", "The Flow version this run is pinned to could not be read, or has no states.");
  }
  const manifest = await cached(store, manifestKey(input.flowInitializationId), async () => deps.fetchManifest());
  if (!manifest.value || manifest.value.checkpoints.length === 0) {
    throw new ContractPipelineError("FLOW_MAPPING_REQUIRED", "This Flow has not been mapped to your code yet, so Tellann does not know which controls to use. Initialise the Flow first, then start the run again.");
  }

  const code = {
    entities: analysis.entities as unknown as CodeEntityLike[],
    relationships: analysis.relationships as unknown as CodeRelationshipLike[],
  };
  const checkpoints: CheckpointLike[] = manifest.value.checkpoints.map((checkpoint) => {
    const mapping = checkpoint.mapping ?? {};
    const status = text(mapping.status);
    return {
      id: checkpoint.id,
      mapping: {
        // A manifest from before mappings recorded a status, or without the entity a control can be found from, resolves
        // to nothing here: said plainly by the preflight, never guessed.
        status: status === "RESOLVED" || status === "AMBIGUOUS" || status === "UNSUPPORTED" ? status : "UNRESOLVED",
        entityId: text(mapping.entityId),
        file: text(mapping.file),
        symbol: text(mapping.symbol),
      },
    };
  });

  const contract = compileExecutableContract({
    flowVersionId: input.flowVersionId,
    flow: {
      states: version.value.states.map((state) => ({
        id: String(state.id ?? ""),
        stateId: text(state.stateId),
        stateName: text(state.stateName),
        name: text(state.name),
        behaviorKey: text(state.behaviorKey),
        role: state.role === "INITIAL" || state.role === "TERMINAL" ? state.role : "NORMAL",
        terminalKind: text(state.terminalKind),
      })),
      transitions: version.value.transitions.map((transition) => ({
        id: String(transition.id ?? ""),
        fromStateId: text(transition.fromStateId) ?? undefined,
        toStateId: text(transition.toStateId) ?? undefined,
        fromNodeId: text(transition.fromNodeId) ?? undefined,
        toNodeId: text(transition.toNodeId) ?? undefined,
        action: text(transition.action),
        expectedInput: transition.expectedInput,
      })),
    },
    checkpoints,
    code,
    analysisIdentity: analysis.contentHash ?? analysis.id ?? null,
    anchors: input.anchors,
  });
  if (!contract.initialStateKey || contract.states.length === 0) {
    throw new ContractPipelineError("FLOW_INVALID", "The Flow has no starting state, so there is nowhere for a run to begin.");
  }

  const navigation = buildNavigationGraph(analysis);
  const initial = contract.states.find((state) => state.key === contract.initialStateKey);
  let login: LoginEdgeStatus = "NOT_NEEDED";
  if (input.loginRoute) {
    // The destination is a hint only (the entry sequence plans onward from wherever signing in actually lands).
    const edge = buildLoginEdge(analysis, input.loginRoute, initial?.routePatterns[0] ?? "/");
    if (edge) {
      navigation.edges.push(edge);
      if (!navigation.nodes.includes(edge.from)) navigation.nodes.push(edge.from);
      login = "BUILT";
    } else {
      login = "NO_FORM_FOUND";
    }
  } else {
    login = "NOT_CONFIGURED";
  }

  const summary: ContractSummary = {
    hash: sha(contract),
    flowHash: contract.flowHash,
    analysisIdentity: contract.analysisIdentity,
    states: contract.states.length,
    transitions: contract.transitions.length,
    controlsDerived: contract.transitions.filter((transition) => transition.control !== null).length,
    controlsMissing: contract.transitions.filter((transition) => transition.control === null).length,
    anchored: contract.transitions.filter((transition) => transition.control?.actionAnchor).length,
  };
  return { contract, navigation, summary, login, sources: { flowVersion: version.from, manifest: manifest.from } };
}
