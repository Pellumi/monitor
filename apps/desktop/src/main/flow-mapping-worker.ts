import fs from 'node:fs';
import { parentPort, workerData } from 'node:worker_threads';
import { redactSecrets, retrieveFlowCheckpointCandidates } from '@tellann/project-intelligence';
import { resolveWithinWorkspace } from '@tellann/agent-policy';

/**
 * Rank a declared Flow against an analysed codebase, off the main process.
 *
 * Retrieval compares every checkpoint against every located entity, and reading
 * each shortlisted candidate's lines is synchronous file I/O on top of that. On
 * a real repository with a few dozen checkpoints that is seconds of work, and
 * doing it on the main process is what made the window stop repainting and
 * Windows offer to close it. None of it needs the main process, so none of it
 * runs there.
 */

if (!parentPort) throw new Error('FLOW_MAPPING_WORKER_PARENT_REQUIRED');

const port = parentPort;
const input = workerData as {
  analysis: Parameters<typeof retrieveFlowCheckpointCandidates>[0];
  flow: Parameters<typeof retrieveFlowCheckpointCandidates>[1];
  workspaceRoot: string;
};

/** Never send a whole file because a candidate's range happened to be wide. */
const MAX_LINES = 120;
const MAX_CHARS = 12_000;

type Excerpt = {
  candidateId: string;
  path: string;
  startLine: number | null;
  endLine: number | null;
  content: string;
  redactions: number;
};

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
        const start = Math.max(1, candidate.startLine ?? 1);
        const end = Math.min(lines.length, Math.max(start, candidate.endLine ?? start), start + MAX_LINES - 1);
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

try {
  const retrieval = retrieveFlowCheckpointCandidates(input.analysis, input.flow);
  const excerpts = extractExcerpts(input.workspaceRoot, retrieval.mappings as never);
  port.postMessage({ type: 'complete', retrieval, excerpts });
} catch (error) {
  port.postMessage({
    type: 'error',
    message: error instanceof Error ? error.message : 'FLOW_MAPPING_RETRIEVAL_FAILED',
  });
}
