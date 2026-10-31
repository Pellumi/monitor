import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Braces, Check, Clipboard, Download, FileCode2, FileImage, FileText, LoaderCircle, X } from 'lucide-react';
import type { FlowDiagram } from '@tellann/desktop-contracts';
import type { FlowDetail } from './use-flow-editor';

type DiagramKind = FlowDiagram['kind'];
type ExportFormat = 'png' | 'svg' | 'pdf' | 'mmd' | 'md' | 'spec';

const DIAGRAMS: Array<{ kind: DiagramKind; label: string; description: string }> = [
  { kind: 'FLOW', label: 'Flowchart', description: 'States, branches, and outcomes' },
  { kind: 'SEQUENCE', label: 'Sequence', description: 'Actor and system interactions' },
  { kind: 'USE_CASE', label: 'Use case', description: 'Actors linked to flow actions' },
  { kind: 'ACTIVITY', label: 'Activity', description: 'Step-by-step operational path' },
  { kind: 'STATE_MACHINE', label: 'State machine', description: 'Lifecycle and transitions' },
];

const FORMATS: Array<{ format: ExportFormat; label: string; description: string; icon: typeof FileImage }> = [
  { format: 'png', label: 'PNG', description: 'Shareable image', icon: FileImage },
  { format: 'svg', label: 'SVG', description: 'Scalable vector', icon: FileCode2 },
  { format: 'pdf', label: 'PDF', description: 'Document-ready', icon: FileText },
  { format: 'mmd', label: 'Mermaid', description: 'Editable source', icon: FileCode2 },
  { format: 'md', label: 'Markdown', description: 'Docs with metadata', icon: FileText },
  { format: 'spec', label: 'Flow spec', description: 'Full declaration as JSON', icon: Braces },
];

function safeName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tellann-flow';
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

const textToBase64 = (value: string) => bytesToBase64(new TextEncoder().encode(value));

// ─────────────────────────────────────────────────────────────
// The flow spec: recognizer, control, inputs, effects, mode, requires, subFlow, and
// evidenceIds all live on `flow.states`/`flow.transitions` already — typed on
// `DeclaredStateSchema`/`DeclaredTransitionSchema`/`DeclaredFlowDetailSchema` in
// desktop-contracts. Previously only the Mermaid diagram (boxes and arrows) was
// exported; neither format carried any of this, so an export could not be read back by
// the Automated Run engine or used as a QA-ready spec. Read defensively since an older
// flow, or one never enriched with declarations, simply has none of these fields set.
// ─────────────────────────────────────────────────────────────

type SpecState = FlowDetail['states'][number];
type SpecTransition = FlowDetail['transitions'][number];

function specStateName(state: SpecState): string {
  return state.stateName;
}
function specTransitionEndpoints(transition: SpecTransition): { from: string; to: string } {
  return { from: transition.fromState?.stateName ?? '?', to: transition.toState?.stateName ?? '?' };
}

/** The flow's full declaration — not just the diagram — as a plain object ready to serialise. */
function flowSpecObject(flow: FlowDetail) {
  const states = flow.states ?? [];
  const transitions = flow.transitions ?? [];
  const referencedFlowIds = [...new Set(states.map((state) => state.subFlowId).filter((id): id is string => Boolean(id)))];
  return {
    name: flow.name,
    version: flow.version ?? 1,
    purpose: flow.purpose ?? null,
    scopeStatement: flow.scopeStatement ?? null,
    workflowType: flow.workflowType ?? null,
    requires: flow.requires ?? null,
    states: states.map((state) => ({
      name: specStateName(state), category: state.category, role: state.role, terminalKind: state.terminalKind ?? null,
      description: state.description ?? null, actor: state.actor ?? null,
      recognizer: state.recognizer ?? null,
      ...(state.subFlowId ? { subFlowId: state.subFlowId } : {}),
      ...(state.evidenceIds?.length ? { evidenceIds: state.evidenceIds } : {}),
    })),
    transitions: transitions.map((transition) => ({
      ...specTransitionEndpoints(transition),
      action: transition.action ?? null, condition: transition.condition ?? null, mode: transition.mode ?? 'AUTO',
      control: transition.control ?? null,
      inputs: transition.expectedInput ?? null,
      effects: transition.expectedOutput ?? null,
      ...(transition.evidenceIds?.length ? { evidenceIds: transition.evidenceIds } : {}),
    })),
    // Other flows a state here stands for in full (see the flow language's `subFlow`).
    // Their own spec is not inlined — export each referenced flow separately and the ids
    // below tie them together — but listing them here means nothing is silently missing.
    referencedFlowIds,
  };
}

function specMarkdownSection(flow: FlowDetail): string {
  const spec = flowSpecObject(flow);
  const hasAnyDetail = spec.states.some((s) => s.recognizer) || spec.transitions.some((t) => t.control || t.inputs || t.effects || t.mode !== 'AUTO') || spec.requires || spec.referencedFlowIds.length;
  if (!hasAnyDetail) return '';
  const lines: string[] = ['', '## Flow specification', ''];
  if (spec.requires) lines.push(`**Requires:** ${JSON.stringify(spec.requires)}`, '');
  lines.push('### States', '', '| State | Category | Role | Recognizer |', '| --- | --- | --- | --- |');
  for (const state of spec.states) {
    const recognizer = state.recognizer
      ? [...(state.recognizer.routes ?? []), ...(state.recognizer.headings ?? []).map((h) => `"${h}"`)].join(', ') || '—'
      : '—';
    lines.push(`| ${state.name} | ${state.category ?? ''} | ${state.role ?? ''}${state.terminalKind ? ` (${state.terminalKind})` : ''} | ${recognizer} |`);
  }
  lines.push('', '### Transitions', '', '| From | To | Action | Condition | Control | Mode | Inputs | Effects |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const transition of spec.transitions) {
    const control = transition.control?.label ? `${transition.control.role ? `${transition.control.role}: ` : ''}"${transition.control.label}"` : '—';
    const inputs = transition.inputs?.length ? transition.inputs.map((input: any) => `${input.name} (${input.role})`).join(', ') : '—';
    const effects = transition.effects?.length ? transition.effects.map((effect: any) => `${effect.method} ${effect.route}`).join(', ') : '—';
    lines.push(`| ${transition.from} | ${transition.to} | ${transition.action ?? '—'} | ${transition.condition ?? '—'} | ${control} | ${transition.mode} | ${inputs} | ${effects} |`);
  }
  if (spec.referencedFlowIds.length) {
    lines.push('', `### Referenced flows`, '', ...spec.referencedFlowIds.map((id) => `- ${id} (export separately — see its own flow for the full definition)`));
  }
  return lines.join('\n');
}

function markdown(flow: FlowDetail, label: string, source: string) {
  return [
    `# ${flow.name}`,
    '',
    `- Version: ${flow.version ?? 1}`,
    `- Diagram: ${label}`,
    '',
    '```mermaid',
    source,
    '```',
    specMarkdownSection(flow),
  ].join('\n');
}

export function FlowExportDialog({
  applicationId,
  flow,
  onClose,
  onSaved,
}: {
  applicationId: string;
  flow: FlowDetail;
  onClose(): void;
  onSaved(filename: string): void;
}) {
  const renderId = useId().replace(/:/g, '_');
  const [kind, setKind] = useState<DiagramKind>('FLOW');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [diagrams, setDiagrams] = useState<FlowDiagram[]>([]);
  const [svg, setSvg] = useState('');
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Published exports use their immutable version. Drafts use the live graph
    // so what is downloaded always matches the canvas behind this dialog.
    const versionId = flow.lifecycleStatus === 'PUBLISHED'
      ? flow.publishedVersionId ?? flow.versions?.[0]?.id
      : undefined;
    void window.tellann?.intent.getFlowDiagrams(applicationId, flow.id, versionId)
      .then((payload) => {
        if (cancelled) return;
        setDiagrams(Array.isArray(payload.diagrams) ? payload.diagrams as FlowDiagram[] : []);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Flow diagrams could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [applicationId, flow]);

  const availableDiagrams = useMemo(
    () => DIAGRAMS.filter((option) => diagrams.some((diagram) => diagram.kind === option.kind && diagram.source.trim())),
    [diagrams],
  );
  const activeKind = availableDiagrams.some((option) => option.kind === kind)
    ? kind
    : availableDiagrams[0]?.kind;
  const selected = useMemo(
    () => diagrams.find((diagram) => diagram.kind === activeKind && diagram.source.trim()),
    [activeKind, diagrams],
  );

  useEffect(() => {
    if (activeKind && activeKind !== kind) setKind(activeKind);
  }, [activeKind, kind]);

  useEffect(() => {
    let cancelled = false;
    setSvg('');
    if (!selected) return;
    setRendering(true);
    setError(null);
    void import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark', flowchart: { htmlLabels: false, curve: 'basis' } });
      return mermaid.render(`desktop_flow_export_${renderId}`, selected.source);
    })
      .then((result) => {
        if (!cancelled) setSvg(result.svg);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Diagram preview could not be rendered.');
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => { cancelled = true; };
  }, [renderId, selected]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  const copySource = useCallback(async () => {
    const text = format === 'spec' ? JSON.stringify(flowSpecObject(flow), null, 2) : selected?.source;
    if (!text) return;
    await window.tellann?.system.copyText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [flow, format, selected]);

  const save = useCallback(async () => {
    if (!window.tellann?.intent.saveFlowExport) return;
    // The spec export is the flow's full declaration, not a rendered diagram — it needs
    // no selected diagram kind and no Mermaid render to have completed.
    if (format !== 'spec' && !selected) return;
    setSaving(true);
    setError(null);
    try {
      if (format === 'spec') {
        const base = `${safeName(flow.name)}-spec`;
        const contentBase64 = textToBase64(JSON.stringify(flowSpecObject(flow), null, 2));
        const result = await window.tellann.intent.saveFlowExport(`${base}.json`, contentBase64, undefined);
        if (!result.cancelled) onSaved(result.filename ?? `${base}.json`);
        return;
      }
      if (!selected) return;
      const label = DIAGRAMS.find((item) => item.kind === selected.kind)?.label ?? selected.kind;
      const base = `${safeName(flow.name)}-${selected.kind.toLowerCase().replaceAll('_', '-')}`;
      let contentBase64: string;
      if (format === 'mmd') contentBase64 = textToBase64(selected.source);
      else if (format === 'md') contentBase64 = textToBase64(markdown(flow, label, selected.source));
      else if (format === 'svg') contentBase64 = textToBase64(svg);
      else contentBase64 = textToBase64(svg);
      const result = await window.tellann.intent.saveFlowExport(
        `${base}.${format}`,
        contentBase64,
        format === 'png' || format === 'pdf'
          ? { render: format, title: `${flow.name} — ${label}`, subtitle: `Tellann Flow · Version ${flow.version ?? 1}` }
          : undefined,
      );
      if (!result.cancelled) onSaved(result.filename ?? `${base}.${format}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The flow could not be exported.');
    } finally {
      setSaving(false);
    }
  }, [flow, format, onSaved, selected, svg]);

  const imageFormat = format === 'png' || format === 'svg' || format === 'pdf';

  return (
    <div className="flow-export-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section className="flow-export-dialog" role="dialog" aria-modal="true" aria-labelledby="flow-export-title">
        <header className="flow-export-header">
          <div>
            <h2 id="flow-export-title">Export flow</h2>
            <p>Choose a diagram perspective and download a presentation-ready or editable file.</p>
          </div>
          <button className="flow-icon-button" type="button" aria-label="Close export dialog" disabled={saving} onClick={onClose}>
            <X size={15} />
          </button>
        </header>

        <div className="flow-export-content">
          <aside className="flow-export-types" aria-label="Diagram type">
            <span className="flow-export-eyebrow">Diagram type</span>
            {availableDiagrams.map((item) => (
              <button key={item.kind} type="button" data-selected={activeKind === item.kind || undefined} onClick={() => setKind(item.kind)}>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </button>
            ))}
          </aside>

          <div className="flow-export-main">
            <div className="flow-export-preview-heading">
              <div><strong>{flow.name}</strong><small>Version {flow.version ?? 1}{activeKind ? ` · ${DIAGRAMS.find((item) => item.kind === activeKind)?.label}` : ''}</small></div>
              <button className="button" type="button" disabled={format === 'spec' ? false : !selected} onClick={() => void copySource()}>
                {copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? 'Copied' : 'Copy source'}
              </button>
            </div>
            <div className="flow-export-preview">
              {format === 'spec'
                ? <pre className="flow-export-spec-preview">{JSON.stringify(flowSpecObject(flow), null, 2)}</pre>
                : <>
                    {loading || rendering ? <span className="flow-export-loading"><LoaderCircle size={18} /> Rendering preview…</span> : null}
                    {!loading && !rendering && svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : null}
                    {!loading && !rendering && !selected && !error ? <span>No exportable diagrams are available for this flow.</span> : null}
                  </>}
            </div>
          </div>
        </div>

        <footer className="flow-export-footer">
          <div>
            <span className="flow-export-eyebrow">File format</span>
            <div className="flow-export-formats">
              {FORMATS.map((item) => (
                <button key={item.format} type="button" aria-pressed={format === item.format} onClick={() => setFormat(item.format)}>
                  <item.icon size={15} /><span><strong>{item.label}</strong><small>{item.description}</small></span>
                </button>
              ))}
            </div>
          </div>
          <button className="button primary" type="button" disabled={saving || (format === 'spec' ? false : !selected || (imageFormat && !svg))} onClick={() => void save()}>
            {saving ? <LoaderCircle className="is-spinning" size={14} /> : <Download size={14} />}
            {saving ? 'Saving…' : `Export ${format.toUpperCase()}`}
          </button>
          {error ? <p className="flow-export-message" data-tone="danger" role="alert">{error}</p> : null}
        </footer>
      </section>
    </div>
  );
}
