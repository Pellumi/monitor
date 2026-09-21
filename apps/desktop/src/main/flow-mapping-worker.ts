import fs from 'node:fs';
import { parentPort } from 'node:worker_threads';
import type { CodebaseAnalysis } from '@tellann/desktop-contracts';
import {
  flowRetrievalIndexFor,
  redactSecrets,
  retrieveFlowCheckpointCandidates,
  type RetrievalIndex,
} from '@tellann/project-intelligence';
import { resolveWithinWorkspace } from '@tellann/agent-policy';

/**
 * Rank declared Flows against an analysed codebase, off the main process.
 *
 * Retrieval compares every checkpoint against the located entities, and reading
 * each shortlisted candidate's lines is synchronous file I/O on top of that. On
 * a real repository with a few dozen checkpoints that is seconds of work, and
 * doing it on the main process is what made the window stop repainting and
 * Windows offer to close the app. None of it needs the main process, so none of
 * it runs there.
 *
 * The worker outlives a single mapping run and keeps the analysis it was given.
 * A fresh worker per Flow meant structured-cloning the whole graph across the
 * thread boundary and rebuilding the term index from scratch every time, so
 * initializing a second Flow against an unchanged codebase cost exactly as much
 * as the first. Now it costs the ranking alone.
 */

if (!parentPort) throw new Error('FLOW_MAPPING_WORKER_PARENT_REQUIRED');

const port = parentPort;

/** Lines of context kept around a candidate's anchor. */
const EXCERPT_CONTEXT_LINES = 40;
const MAX_CHARS = 12_000;

type Excerpt = {
  candidateId: string;
  path: string;
  startLine: number | null;
  endLine: number | null;
  content: string;
  redactions: number;
};

type LoadedAnalysis = { analysis: CodebaseAnalysis; index: RetrievalIndex };

let loaded: LoadedAnalysis | null = null;

function extractExcerpts(
  workspaceRoot: string,
  mappings: Array<{ candidates: Array<{ id: string; path: string; startLine: number | null; endLine: number | null; evidence: Array<{ excerpt?: string | null }> }> }>,
): Excerpt[] {
  const excerpts: Excerpt[] = [];
  // Candidates cluster in the same files, so read each one once.
  const files = new Map<string, string[] | null>();
  const linesOf = (relative: string): string[] | null => {
    if (files.has(relative)) return files.get(relative)!;
    let lines: string[] | null = null;
    try {
      const absolute = resolveWithinWorkspace(workspaceRoot, relative);
      lines = fs.readFileSync(absolute, 'utf8').replaceAll('\r\n', '\n').split('\n');
    } catch {
      lines = null;
    }
    files.set(relative, lines);
    return lines;
  };

  for (const mapping of mappings) {
    for (const candidate of mapping.candidates ?? []) {
      if (!candidate.path || !candidate.id) continue;
      const lines = linesOf(candidate.path);
      let raw: string | null;
      if (lines) {
        // A window around the anchor rather than the declaration's full body.
        // What decides a placement is the code immediately around the point, and
        // a candidate whose body runs to a hundred and twenty lines was sending
        // all of them — multiplied by every candidate of every checkpoint, that
        // was most of a prompt too large to be answered.
        const anchor = Math.max(1, candidate.startLine ?? 1);
        const start = Math.max(1, anchor - EXCERPT_CONTEXT_LINES);
        const end = Math.min(lines.length, Math.max(candidate.endLine ?? anchor, anchor + EXCERPT_CONTEXT_LINES));
        raw = lines.slice(start - 1, end).join('\n');
      } else {
        // The file moved since analysis; the graph still holds what it captured.
        raw = candidate.evidence?.find((item) => item.excerpt)?.excerpt ?? null;
      }
      if (!raw?.trim()) continue;
      const redacted = redactSecrets(raw.slice(0, MAX_CHARS));
      excerpts.push({
        candidateId: String(candidate.id), path: String(candidate.path),
        startLine: candidate.startLine ?? null, endLine: candidate.endLine ?? null,
        content: redacted.content, redactions: redacted.redactions,
      });
    }
  }
  return excerpts;
}

type IncomingMessage =
  | { type: 'analysis'; analysisId: string; analysis: CodebaseAnalysis }
  | { type: 'map'; requestId: string; flow: unknown; workspaceRoot: string };

port.on('message', (message: IncomingMessage) => {
  if (message.type === 'analysis') {
    // Building the index here, rather than on the first mapping request, keeps
    // the cost out of the run the user is waiting on.
    loaded = { analysis: message.analysis, index: flowRetrievalIndexFor(message.analysis) };
    port.postMessage({ type: 'analysis-ready', analysisId: message.analysisId });
    return;
  }

  if (message.type !== 'map') return;
  const { requestId } = message;
  try {
    if (!loaded) throw new Error('FLOW_MAPPING_ANALYSIS_NOT_LOADED');
    const retrieval = retrieveFlowCheckpointCandidates(
      loaded.analysis,
      message.flow as never,
      {
        index: loaded.index,
        onProgress: (completed, total) => port.postMessage({ type: 'progress', requestId, completed, total }),
      },
    );
    const excerpts = extractExcerpts(message.workspaceRoot, retrieval.mappings as never);
    port.postMessage({ type: 'complete', requestId, retrieval, excerpts });
  } catch (error) {
    port.postMessage({
      type: 'error',
      requestId,
      message: error instanceof Error ? error.message : 'FLOW_MAPPING_RETRIEVAL_FAILED',
    });
  }
});
