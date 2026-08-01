import crypto from 'node:crypto';
import path from 'node:path';
import yaml from 'js-yaml';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { sanitizeAiInputFull } from '@sots/ai';

export const DOCUMENT_PROCESSOR_VERSION = 'document-intelligence/1.0.0';
export const SUPPORTED_DOCUMENT_EXTENSIONS = new Set(['.pdf', '.docx', '.md', '.markdown', '.txt', '.html', '.htm', '.json', '.yaml', '.yml']);
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_CHARS = 500_000;

export type DocumentKind = 'PDF' | 'DOCX' | 'MARKDOWN' | 'TEXT' | 'HTML' | 'OPENAPI';
export type EvidenceSegment = {
  id: string;
  heading: string | null;
  excerpt: string;
  locator: string;
  confidence: number;
  excludedFromAi: boolean;
  exclusionReason?: 'PROMPT_INJECTION';
};
export type ExtractedDocument = {
  filename: string;
  mimeType: string;
  kind: DocumentKind;
  checksum: string;
  processorVersion: string;
  title: string;
  summary: string;
  aiSafeText: string;
  segments: EvidenceSegment[];
  structure: { headings: string[]; openapi?: { title?: string; version?: string; operations: number } };
  redaction: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    redactions: Array<{ type: string; count: number }>;
    promptInjectionDetected: boolean;
    excludedSegmentCount: number;
  };
};

export type IntentDraftProposal = {
  source: 'DOCUMENT' | 'HYBRID_ANALYSIS';
  confidence: number;
  actors: string[];
  assumptions: string[];
  unresolvedQuestions: string[];
  conflicts: Array<{ key: string; description: string; evidenceIds: string[] }>;
  workflows: Array<{
    key: string;
    name: string;
    description: string;
    confidence: number;
    evidenceIds: string[];
    states: Array<{ key: string; name: string; category: 'NAVIGATION' | 'UI' | 'BUSINESS' | 'ERROR' | 'SYSTEM'; confidence: number; evidenceIds: string[] }>;
    transitions: Array<{ from: string; to: string; action: string; confidence: number; evidenceIds: string[] }>;
  }>;
};

function checksum(value: Buffer | string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function decodeEntities(value: string): string {
  return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
}

function htmlToText(value: string): string {
  return decodeEntities(value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(?:p|div|h[1-6]|li|tr|section|article)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '));
}

function openApiText(input: unknown): { text: string; title: string; headings: string[]; operations: number; version?: string } {
  const spec = input && typeof input === 'object' ? input as Record<string, any> : {};
  const lines: string[] = [];
  const title = String(spec.info?.title ?? 'OpenAPI specification');
  if (spec.info?.description) lines.push(String(spec.info.description));
  let operations = 0;
  for (const [route, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method.toLowerCase())) continue;
      operations += 1;
      const value = operation as Record<string, any>;
      lines.push(`# ${method.toUpperCase()} ${route}`);
      lines.push(String(value.summary ?? value.description ?? value.operationId ?? 'API operation'));
      for (const response of Object.keys(value.responses ?? {})) lines.push(`Response ${response}`);
    }
  }
  return { text: lines.join('\n'), title, headings: lines.filter((line) => line.startsWith('# ')).map((line) => line.slice(2)), operations, version: spec.info?.version };
}

async function extractRaw(buffer: Buffer, filename: string, mimeType: string): Promise<{ kind: DocumentKind; text: string; title: string; openapi?: ExtractedDocument['structure']['openapi'] }> {
  const extension = path.extname(filename).toLowerCase();
  if (!SUPPORTED_DOCUMENT_EXTENSIONS.has(extension)) throw new Error('UNSUPPORTED_DOCUMENT_TYPE');
  if (buffer.length === 0 || buffer.length > MAX_DOCUMENT_BYTES) throw new Error('INVALID_DOCUMENT_SIZE');
  if (extension === '.pdf' || mimeType === 'application/pdf') {
    const parsed = await pdfParse(buffer);
    return { kind: 'PDF', text: parsed.text, title: path.basename(filename, extension) };
  }
  if (extension === '.docx' || mimeType.includes('wordprocessingml')) {
    const parsed = await mammoth.extractRawText({ buffer });
    return { kind: 'DOCX', text: parsed.value, title: path.basename(filename, extension) };
  }
  const source = buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (extension === '.html' || extension === '.htm' || mimeType === 'text/html') {
    const title = decodeEntities(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? path.basename(filename, extension));
    return { kind: 'HTML', text: htmlToText(source), title };
  }
  if (extension === '.json' || extension === '.yaml' || extension === '.yml') {
    const parsed = extension === '.json' ? JSON.parse(source) : yaml.load(source);
    if ((parsed as any)?.openapi || (parsed as any)?.swagger || (parsed as any)?.paths) {
      const api = openApiText(parsed);
      return { kind: 'OPENAPI', text: api.text, title: api.title, openapi: { title: api.title, version: api.version, operations: api.operations } };
    }
    throw new Error('STRUCTURED_DOCUMENT_IS_NOT_OPENAPI');
  }
  return { kind: extension === '.md' || extension === '.markdown' ? 'MARKDOWN' : 'TEXT', text: source, title: path.basename(filename, extension) };
}

function segmentText(text: string): Array<{ heading: string | null; text: string; locator: string }> {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const result: Array<{ heading: string | null; text: string; locator: string }> = [];
  let heading: string | null = null;
  let chunk: string[] = [];
  let start = 1;
  const flush = (end: number) => {
    const value = chunk.join('\n').trim();
    if (value) result.push({ heading, text: value, locator: `lines:${start}-${end}` });
    chunk = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const markdownHeading = line.match(/^#{1,6}\s+(.+)/)?.[1];
    const plainHeading = !markdownHeading && line.length < 100 && /:$/.test(line) ? line.slice(0, -1) : null;
    if (markdownHeading || plainHeading || chunk.join('\n').length > 3_000) {
      flush(index);
      heading = markdownHeading ?? plainHeading ?? heading;
      start = index + 1;
      if (!markdownHeading && !plainHeading) chunk.push(line);
    } else chunk.push(line);
  }
  flush(lines.length);
  return result.slice(0, 250);
}

export async function extractDocument(input: { buffer: Buffer; filename: string; mimeType?: string }): Promise<ExtractedDocument> {
  const mimeType = input.mimeType || 'application/octet-stream';
  const raw = await extractRaw(input.buffer, input.filename, mimeType);
  const normalized = raw.text.replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT_CHARS);
  const segments = segmentText(normalized).map((segment, index): EvidenceSegment => {
    const sanitized = sanitizeAiInputFull(segment.text);
    return {
      id: checksum(`${input.filename}:${segment.locator}:${segment.text}`).slice(0, 24),
      heading: segment.heading,
      excerpt: sanitized.sanitizedText.slice(0, 1_200),
      locator: segment.locator,
      confidence: sanitized.riskLevel === 'HIGH' ? 0.7 : 0.92,
      excludedFromAi: sanitized.promptInjectionRisk,
      ...(sanitized.promptInjectionRisk ? { exclusionReason: 'PROMPT_INJECTION' as const } : {}),
    };
  });
  const allSanitized = sanitizeAiInputFull(normalized);
  const safeSegments = segments.filter((segment) => !segment.excludedFromAi);
  return {
    filename: path.basename(input.filename), mimeType, kind: raw.kind, checksum: checksum(input.buffer), processorVersion: DOCUMENT_PROCESSOR_VERSION,
    title: raw.title,
    summary: safeSegments.slice(0, 12).map((segment) => segment.excerpt).join('\n\n').slice(0, 12_000),
    aiSafeText: `<untrusted_product_document instructions="disabled">\n${safeSegments.map((segment) => segment.excerpt).join('\n\n')}\n</untrusted_product_document>`,
    segments,
    structure: { headings: segments.flatMap((segment) => segment.heading ? [segment.heading] : []), ...(raw.openapi ? { openapi: raw.openapi } : {}) },
    redaction: {
      riskLevel: allSanitized.riskLevel,
      redactions: allSanitized.redactions,
      promptInjectionDetected: segments.some((segment) => segment.excludedFromAi),
      excludedSegmentCount: segments.filter((segment) => segment.excludedFromAi).length,
    },
  };
}

function key(value: string): string {
  return value.trim().replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase().slice(0, 80) || 'WORKFLOW';
}

/** Deterministic, review-only baseline. It never writes graph truth. */
export function inferEvidenceBackedIntent(documents: ExtractedDocument[]): IntentDraftProposal {
  const usable = documents.flatMap((document) => document.segments.filter((segment) => !segment.excludedFromAi).map((segment) => ({ document, segment })));
  const grouped = new Map<string, typeof usable>();
  for (const item of usable) {
    const name = item.segment.heading ?? item.document.title;
    const groupKey = key(name);
    const values = grouped.get(groupKey) ?? [];
    values.push(item);
    grouped.set(groupKey, values);
  }
  const workflows = [...grouped.entries()].slice(0, 30).map(([workflowKey, items]) => {
    const evidenceIds = items.map((item) => item.segment.id);
    const sentences = items.flatMap((item) => item.segment.excerpt.split(/(?:\n|(?<=[.!?])\s+)/)).map((value) => value.trim()).filter((value) => value.length > 12).slice(0, 12);
    const stateNames = sentences.length ? sentences : [items[0].segment.heading ?? items[0].document.title];
    const states = stateNames.map((name, index) => ({ key: `${workflowKey}_${index + 1}`, name: name.slice(0, 120), category: /fail|error|invalid|denied|cancel/i.test(name) ? 'ERROR' as const : 'BUSINESS' as const, confidence: 0.72, evidenceIds }));
    const transitions = states.slice(1).map((state, index) => ({ from: states[index].key, to: state.key, action: 'NEXT', confidence: 0.64, evidenceIds }));
    return { key: workflowKey, name: items[0].segment.heading ?? items[0].document.title, description: items[0].segment.excerpt.slice(0, 300), confidence: 0.72, evidenceIds, states, transitions };
  });
  const conflicts: IntentDraftProposal['conflicts'] = [];
  for (const [workflowKey, items] of grouped) {
    const normalized = new Set(items.map((item) => item.segment.excerpt.toLowerCase().replace(/\s+/g, ' ').slice(0, 240)));
    if (items.length > 1 && normalized.size > 1) conflicts.push({ key: workflowKey, description: `Sources provide differing descriptions for ${items[0].segment.heading ?? items[0].document.title}.`, evidenceIds: items.map((item) => item.segment.id) });
  }
  return {
    source: documents.length > 1 ? 'HYBRID_ANALYSIS' : 'DOCUMENT', confidence: workflows.length ? 0.72 : 0,
    actors: [], assumptions: ['Document order is treated as workflow order until reviewed.'],
    unresolvedQuestions: workflows.length ? [] : ['No workflow-like requirements were found in the approved document summary.'],
    conflicts, workflows,
  };
}
