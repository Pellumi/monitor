import fs from "node:fs";
import { resolveWithinWorkspace } from "@tellann/agent-policy";
import { expandForFailure } from "@tellann/automation-engine";
import type { AutomationPorts, CodeEvidenceSource, CodeGraphView, ExecutableContract } from "@tellann/automation-engine";
import type { QA_AUTOMATION_EVENT_TYPES } from "@tellann/desktop-contracts";

/**
 * The deep-diagnostics half of an Automated Run, wired between the engine and the browser observer.
 *
 * The engine decides *when* something is worth keeping (`decideCapture`): a screenshot and DOM
 * snapshot, a browser trace, an explanation from the code. This adapter does the keeping — and
 * nothing else. It has no policy of its own, so what is kept for a failing run is exactly what the
 * engine asked for, and a run that goes to plan asks for nothing.
 *
 * Everything here is best-effort by construction: the engine swallows failures from these ports, and
 * this adapter reports them as "nothing was kept", never as an error, because losing a diagnostic
 * must not end a run.
 */

/** The parts of the browser observer this adapter uses (`BrowserObserver` satisfies it). */
export interface DiagnosticsObserver {
  captureAnomalyArtifacts(): Promise<boolean>;
  beginAutomationTraceChunk(label: string): Promise<boolean>;
  endAutomationTraceChunk(options: { retain: boolean; stateKey: string | null; reasons?: string[] }): Promise<boolean>;
  recordAutomationEvent(type: (typeof QA_AUTOMATION_EVENT_TYPES)[number], metadata: Record<string, unknown>): string | null;
  /** What the watched components rendered since the last read. Absent on an observer without render timing. */
  takeRenderTiming?(): Promise<Array<{ component: string; mounts: number; updates: number; totalMs: number; maxMs: number }>>;
}

export interface DiagnosticsOptions {
  observer: DiagnosticsObserver;
  contract: ExecutableContract;
  /** The code the contract was derived from. Without it, failures are captured but not explained from code. */
  code?: CodeEvidenceSource | null;
  /**
   * The watched components and the states each is the code for. Present only when the run opted in
   * to render timing; without it nothing is read and nothing is recorded.
   */
  renderTiming?: Record<string, string[]> | null;
}

export type DiagnosticsPorts = Required<Pick<AutomationPorts, "captureEvidence" | "traceChunks">>;

export function createDiagnosticsPorts(options: DiagnosticsOptions): DiagnosticsPorts {
  const { observer, contract, code, renderTiming } = options;
  return {
    async captureEvidence(decision, stateKey, subject) {
      if (decision.artifacts.screenshot || decision.artifacts.fullDom) {
        await observer.captureAnomalyArtifacts();
      }
      if (decision.artifacts.codeEvidence && code) {
        const evidence = expandForFailure(contract, { transitionId: subject?.transitionId ?? null, stateKey }, code);
        // What travels is locations, a hash and a sentence; `expandForFailure` never includes source text.
        if (evidence) observer.recordAutomationEvent("QA_AUTOMATION_CODE_EVIDENCE", { ...evidence, stateKey, reasons: decision.reasons });
      }
    },
    traceChunks: {
      async begin(label) {
        await observer.beginAutomationTraceChunk(label);
      },
      async end({ stateKey, retain, reasons }) {
        const kept = await observer.endAutomationTraceChunk({ retain, stateKey, reasons });
        if (kept) observer.recordAutomationEvent("QA_AUTOMATION_TRACE_RETAINED", { stateKey, reasons });
        // A state visit closing is the natural point to read what rendered. Each component is labelled
        // with the states it is the code for, so the reading stays attributable even though the run has
        // already moved on by the time it is taken.
        if (renderTiming && observer.takeRenderTiming) {
          const samples = (await observer.takeRenderTiming()).map((sample) => ({ ...sample, states: renderTiming[sample.component] ?? [] }));
          if (samples.length > 0) observer.recordAutomationEvent("QA_AUTOMATION_RENDER_TIMING", { stateKey, samples });
        }
      },
    },
  };
}

/** Largest file read to hash a range. A generated bundle is not the code a Flow step maps to. */
const MAX_SOURCE_BYTES = 1_000_000;

/**
 * A `CodeEvidenceSource` over a local workspace. Paths are resolved inside the workspace root, so a
 * mapping that points outside it (a symlink, a `..`) reads nothing rather than something it should not.
 */
export function workspaceCodeEvidenceSource(workspaceRoot: string, graph: CodeGraphView): CodeEvidenceSource {
  return {
    graph,
    readSource(file) {
      try {
        const resolved = resolveWithinWorkspace(workspaceRoot, file);
        if (fs.statSync(resolved).size > MAX_SOURCE_BYTES) return null;
        return fs.readFileSync(resolved, "utf8");
      } catch {
        return null;
      }
    },
  };
}
