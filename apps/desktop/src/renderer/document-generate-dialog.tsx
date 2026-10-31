import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, LoaderCircle, UploadCloud, X } from 'lucide-react';
import './flow-editor/flow-editor.css';
import './document-generate-dialog.css';

const DOC_MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
  json: 'application/json',
  yaml: 'application/x-yaml',
  yml: 'application/x-yaml',
};
const DOC_MAX_BYTES = 15 * 1024 * 1024;

const SINGLE_FLOW_ACTIVITY = [
  'Analysing the document structure and requirements…',
  'Identifying the main journey and key decisions…',
  'Drafting states, actions, and transitions…',
  'Checking the draft for a coherent sequence…',
];

const MULTI_FLOW_ACTIVITY = [
  'Analysing the document structure and requirements…',
  'Separating distinct journeys in the document…',
  'Drafting states and transitions for each journey…',
  'Checking the generated flows for a coherent sequence…',
];

type MultiFlowResult = { flowId: string; name: string; stateCount: number; transitionCount: number };
type MultiFlowFailure = { journey: string; reason: string };
type MultiFlowResponse = {
  sourceName: string;
  journeyCount: number;
  flows: MultiFlowResult[];
  failed: MultiFlowFailure[];
  skippedJourneys?: string[];
  meta: { decomposeMs: number; totalMs: number; totalProviderCalls: number };
};

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function cleanIpcError(cause: unknown, fallback: string): string {
  return String(cause instanceof Error ? cause.message : cause)
    .replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/i, '')
    .slice(0, 240) || fallback;
}

/**
 * One document → one or more draft declared flows pending review, via the same
 * Gemini-multimodal pipeline the web dashboard's "Generate from a document" panel uses
 * (services/onboarding-api's generate-flow / generate-flows). This is a separate, simpler
 * path from the desktop app's existing multi-document evidence-library import flow
 * (DocumentImportManager / intent drafts) — a quick single-upload option alongside it,
 * not a replacement.
 */
export function DocumentGenerateDialog({
  projectId,
  onClose,
  onOpenFlow,
}: {
  projectId: string;
  onClose(): void;
  onOpenFlow(flowId: string): void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'idle' | 'reading' | 'generating'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [splitIntoFlows, setSplitIntoFlows] = useState(false);
  const [skipConsistencyCheck, setSkipConsistencyCheck] = useState(false);
  const [multiResult, setMultiResult] = useState<MultiFlowResponse | null>(null);
  const [activityIndex, setActivityIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const busy = phase !== 'idle';

  useEffect(() => {
    if (!busy) {
      setActivityIndex(0);
      setElapsedSeconds(0);
      return;
    }

    setActivityIndex(0);
    setElapsedSeconds(0);
    const elapsedTimer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1_000);
    const activityTimer = phase === 'generating'
      ? window.setInterval(() => {
          setActivityIndex((index) => (index + 1) % SINGLE_FLOW_ACTIVITY.length);
        }, 4_500)
      : null;

    return () => {
      window.clearInterval(elapsedTimer);
      if (activityTimer !== null) window.clearInterval(activityTimer);
    };
  }, [busy, phase]);

  // Electron's ipcMain/ipcRenderer error boundary only reliably carries `.message`
  // across — not the `.status`/`.code` properties cloud-client.ts's jsonRequest()
  // attaches in the main process — so errors are matched by the code jsonRequest
  // already folds into `.message` (`payload.error`, e.g. "DOCUMENT_TOO_LARGE"), read
  // back out of the cleaned message rather than a structured property.
  const friendlyMessageFor = (cleaned: string): string => {
    const map: Record<string, string> = {
      UNSUPPORTED_DOCUMENT_TYPE: 'Unsupported file type.',
      DOCUMENT_TOO_LARGE: 'That file is too large.',
      EMPTY_DOCUMENT: 'That file looks empty.',
      FEATURE_NOT_ENTITLED: 'Your plan does not include document flow generation.',
      NO_JOURNEYS_FOUND: "Couldn't find a distinct journey in this document.",
      DOCUMENT_DECOMPOSITION_FAILED: "Couldn't split this document into journeys. Try generating a single flow instead.",
      DOCUMENT_FLOW_GENERATION_FAILED: "Couldn't derive a flow from this document. Try a clearer requirements doc.",
      DOCUMENT_FLOW_PROVIDER_UNCONFIGURED: 'Document generation is not configured on this environment.',
    };
    return map[cleaned] ?? cleaned;
  };

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setMultiResult(null);
    if (file.size > DOC_MAX_BYTES) {
      setError('That file is over the 15 MB limit.');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = file.type || DOC_MIME_BY_EXT[ext] || '';
    if (!mimeType || !Object.values(DOC_MIME_BY_EXT).includes(mimeType)) {
      setError('Unsupported file type. Use PDF, DOCX, Markdown, text, HTML, or OpenAPI.');
      return;
    }
    try {
      setPhase('reading');
      const dataBase64 = await readAsBase64(file);
      setPhase('generating');
      const input = { filename: file.name, mimeType, dataBase64, skipConsistencyCheck };
      if (splitIntoFlows) {
        const result = await window.tellann?.intent.generateFlowsFromDocument(projectId, input);
        if (!result) throw new Error('Open Tellann in the desktop app to generate flows.');
        setMultiResult(result as MultiFlowResponse);
        setPhase('idle');
      } else {
        const result = await window.tellann?.intent.generateFlowFromDocument(projectId, input);
        if (!result) throw new Error('Open Tellann in the desktop app to generate flows.');
        onOpenFlow((result as { flowId: string }).flowId);
      }
    } catch (cause) {
      setError(friendlyMessageFor(cleanIpcError(cause, 'Generation failed.')));
      setPhase('idle');
    }
  }

  return (
    <div
      className="desktop-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="desktop-modal document-generate-dialog" role="dialog" aria-modal="true" aria-labelledby="document-generate-title">
        <div className="document-generate-header">
          <h2 id="document-generate-title">Generate from a document</h2>
          <button type="button" className="flow-icon-button" aria-label="Close" disabled={busy} onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {multiResult ? (
          <div className="document-generate-results">
            <p className="flow-section-hint">
              {multiResult.flows.length} of {multiResult.journeyCount} journey
              {multiResult.journeyCount === 1 ? '' : 's'} generated from {multiResult.sourceName}
              {' · '}
              {Math.round(multiResult.meta.totalMs / 100) / 10}s · {multiResult.meta.totalProviderCalls} calls
            </p>
            <ul className="document-generate-result-list">
              {multiResult.flows.map((flow) => (
                <li key={flow.flowId} className="flow-card">
                  <span>
                    <CheckCircle2 size={14} className="is-success" />
                    {flow.name}
                    <small>{flow.stateCount} states · {flow.transitionCount} transitions</small>
                  </span>
                  <button type="button" onClick={() => onOpenFlow(flow.flowId)}>Open</button>
                </li>
              ))}
              {multiResult.failed.map((failure) => (
                <li key={failure.journey} className="flow-card" data-warning="true">
                  <span>
                    <AlertCircle size={14} className="is-warning" />
                    <strong>{failure.journey}</strong> could not be generated: {failure.reason}
                  </span>
                </li>
              ))}
            </ul>
            {multiResult.skippedJourneys?.length ? (
              <p className="flow-section-hint">
                {multiResult.skippedJourneys.length} more journey{multiResult.skippedJourneys.length === 1 ? '' : 's'} found
                but not generated (over the per-upload limit): {multiResult.skippedJourneys.join(', ')}
              </p>
            ) : null}
            <div className="desktop-modal-actions">
              <button type="button" className="confirm" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.doc,.md,.markdown,.txt,.html,.htm,.json,.yaml,.yml"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void handleFile(file);
              }}
            />
            {busy ? (
              <section
                className="document-generate-progress"
                aria-busy="true"
              >
                <div className="document-generate-progress-heading">
                  <span className="document-generate-loader" aria-hidden="true">
                    <LoaderCircle size={22} />
                  </span>
                  <div>
                    <span className="document-generate-kicker">
                      {phase === 'reading' ? 'Preparing your document' : 'Building your draft'}
                    </span>
                    <h3>
                      {phase === 'reading'
                        ? 'Reading the file'
                        : splitIntoFlows
                          ? 'Generating your flows'
                          : 'Generating your flow'}
                    </h3>
                  </div>
                </div>

                <p className="document-generate-activity" role="status" aria-live="polite" aria-atomic="true">
                  {phase === 'reading'
                    ? 'Loading the document securely and preparing it for analysis…'
                    : (splitIntoFlows ? MULTI_FLOW_ACTIVITY : SINGLE_FLOW_ACTIVITY)[activityIndex]}
                </p>

                <div
                  className="document-generate-progress-track"
                  role="progressbar"
                  aria-label={phase === 'reading' ? 'Reading document' : 'Generating flow draft'}
                >
                  <span />
                </div>

                {fileName ? (
                  <div className="document-generate-file">
                    <FileText size={15} aria-hidden="true" />
                    <span title={fileName}>{fileName}</span>
                    <small>{phase === 'reading' ? 'Reading' : 'Ready'}</small>
                  </div>
                ) : null}

                <ol className="document-generate-steps" aria-label="Generation progress">
                  <li data-state="complete">
                    <CheckCircle2 size={15} aria-hidden="true" />
                    <span>Document selected</span>
                  </li>
                  <li
                    data-state={phase === 'reading' ? 'active' : 'complete'}
                    aria-current={phase === 'reading' ? 'step' : undefined}
                  >
                    {phase === 'reading'
                      ? <span className="document-generate-step-dot" aria-hidden="true" />
                      : <CheckCircle2 size={15} aria-hidden="true" />}
                    <span>Prepare document</span>
                  </li>
                  <li
                    data-state={phase === 'generating' ? 'active' : 'pending'}
                    aria-current={phase === 'generating' ? 'step' : undefined}
                  >
                    <span className="document-generate-step-dot" aria-hidden="true" />
                    <span>{splitIntoFlows ? 'Draft flows' : 'Draft flow'}</span>
                  </li>
                  <li data-state="pending">
                    <span className="document-generate-step-dot" aria-hidden="true" />
                    <span>Open for review</span>
                  </li>
                </ol>

                <p className="document-generate-wait-note">
                  <span>Keep this window open. Your draft will open when it&apos;s ready.</span>
                  {elapsedSeconds >= 5 ? <span>{elapsedSeconds}s elapsed</span> : null}
                </p>
              </section>
            ) : (
              <>
                <button type="button" className="document-generate-drop" onClick={() => inputRef.current?.click()}>
                  <UploadCloud size={20} />
                  <span>Choose a document</span>
                  <small>PDF, DOCX, Markdown, text, HTML or OpenAPI · up to 15 MB</small>
                </button>
                {fileName && !error ? <p className="flow-section-hint">{fileName}</p> : null}
                {error ? (
                  <p role="alert" className="flow-status-line" data-tone="danger">{error}</p>
                ) : null}
                <label className="document-generate-option">
                  <input type="checkbox" checked={splitIntoFlows} onChange={(event) => setSplitIntoFlows(event.target.checked)} />
                  <span>
                    Split into multiple linked flows - for a document that describes more than one journey. Costs more provider calls.
                  </span>
                </label>
                <label className="document-generate-option mb-6">
                  <input type="checkbox" checked={skipConsistencyCheck} onChange={(event) => setSkipConsistencyCheck(event.target.checked)} />
                  <span>
                    Skip the ordering double-check - faster and cheaper, at the risk of a step sequenced the way the document didn&apos;t describe.
                  </span>
                </label>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
