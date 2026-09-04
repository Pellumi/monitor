import fs from 'node:fs';
import path from 'node:path';
import { IGNORED_DIRECTORIES } from '@tellann/project-intelligence';

/** One `TELLANN.trackEvent('FLOW_...', ...)` call found in the attached project. */
export type FlowMarkerHit = {
  file: string;
  line: number;
  eventType: string;
  flow: string | null;
  state: string | null;
  transition: string | null;
  /** Markers written by an older Tellann carry the raw checkpoint id instead. */
  checkpointId: string | null;
};

export type FlowMarkerScanResult = {
  matches: FlowMarkerHit[];
  filesScanned: number;
  truncated: boolean;
};

const SCANNABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs', '.vue', '.svelte', '.astro',
  '.py', '.rb', '.go', '.java', '.kt', '.kts', '.cs', '.php', '.swift', '.rs', '.scala', '.dart', '.ex', '.exs',
]);

const EVENT_TYPES = ['FLOW_INITIAL_STATE', 'FLOW_TERMINAL_STATE', 'FLOW_STATE_REACHED', 'FLOW_TRANSITION'] as const;
const EVENT_TYPE_PATTERN = new RegExp(EVENT_TYPES.join('|'), 'g');

/**
 * How far past the event type we look for the marker's fields. A marker is one
 * call, but it can be wrapped across several lines by a formatter, and the object
 * may carry extra keys of the user's own.
 */
const MARKER_WINDOW = 400;

// Deliberately tolerant about syntax: the same marker has to be recognisable in
// TypeScript (`flow: 'checkout'`), Python (`"flow": "checkout"`), Ruby
// (`flow => "checkout"`) and anything else a user instruments in.
const FIELD_PATTERN = /["'`]?\b(flow|state|transition|checkpointId)\b["'`]?\s*(?::|=>|=)\s*["'`]([^"'`]{1,120})["'`]/g;

function markerFields(window: string): Record<string, string | undefined> {
  const found: Record<string, string | undefined> = {};
  FIELD_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FIELD_PATTERN.exec(window)) !== null) {
    // First occurrence wins: anything later in the window belongs to whatever
    // call comes after this one.
    if (!found[match[1]]) found[match[1]] = match[2].trim() || undefined;
  }
  return found;
}

export function extractFlowMarkers(file: string, content: string): FlowMarkerHit[] {
  if (!content.includes('FLOW_')) return [];
  const hits: FlowMarkerHit[] = [];
  EVENT_TYPE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EVENT_TYPE_PATTERN.exec(content)) !== null) {
    const fields = markerFields(content.slice(match.index, match.index + MARKER_WINDOW));
    const flow = fields.flow ?? null;
    const state = fields.state ?? null;
    const transition = fields.transition ?? null;
    const checkpointId = fields.checkpointId ?? null;
    // The bare event-type string on its own (a switch case, a type union, this
    // scanner's own source) is not a checkpoint.
    if (!checkpointId && !(flow && (state || transition))) continue;
    hits.push({
      file,
      line: content.slice(0, match.index).split('\n').length,
      eventType: match[0],
      flow,
      state,
      transition,
      checkpointId,
    });
  }
  return hits;
}

/**
 * Search an attached project for flow markers. Runs entirely on this device: only
 * the matched marker names, file paths and line numbers are ever sent onward.
 */
export function scanWorkspaceForFlowMarkers(
  root: string,
  options: { maxFiles?: number; maxFileBytes?: number } = {},
): FlowMarkerScanResult {
  const maxFiles = options.maxFiles ?? 20_000;
  const maxFileBytes = options.maxFileBytes ?? 1_500_000;
  const matches: FlowMarkerHit[] = [];
  let filesScanned = 0;
  let truncated = false;

  const visit = (directory: string) => {
    if (truncated) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (truncated) return;
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        visit(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!SCANNABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      if (filesScanned >= maxFiles) {
        truncated = true;
        return;
      }
      let content: string;
      try {
        if (fs.statSync(absolute).size > maxFileBytes) continue;
        content = fs.readFileSync(absolute, 'utf8');
      } catch {
        continue;
      }
      filesScanned += 1;
      matches.push(...extractFlowMarkers(path.relative(root, absolute).split(path.sep).join('/'), content));
    }
  };

  visit(root);
  return { matches, filesScanned, truncated };
}

/**
 * One hit per distinct marker. A checkpoint only needs a single piece of evidence,
 * and a marker inside a helper that is called from a dozen places would otherwise
 * repeat itself all the way into the request body.
 */
export function distinctMarkers(matches: FlowMarkerHit[], limit = 500): FlowMarkerHit[] {
  const seen = new Set<string>();
  const unique: FlowMarkerHit[] = [];
  for (const hit of matches) {
    const key = `${hit.flow ?? ''}|${hit.state ?? ''}|${hit.transition ?? ''}|${hit.checkpointId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(hit);
    if (unique.length >= limit) break;
  }
  return unique;
}
