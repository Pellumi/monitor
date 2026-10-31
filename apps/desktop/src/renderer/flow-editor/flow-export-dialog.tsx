import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Check, Clipboard, Download, FileCode2, FileImage, FileText, LoaderCircle, X } from 'lucide-react';
import type { FlowDiagram } from '@tellann/desktop-contracts';
import type { FlowDetail } from './use-flow-editor';

type DiagramKind = FlowDiagram['kind'];
type ExportFormat = 'png' | 'svg' | 'pdf' | 'mmd' | 'md';

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
    '',
  ].join('\n');
}

async function svgToPng(svg: string) {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const viewBox = parsed.getAttribute('viewBox')?.split(/\s+/).map(Number);
  const sourceWidth = viewBox?.[2] || Number.parseFloat(parsed.getAttribute('width') || '') || 1200;
  const sourceHeight = viewBox?.[3] || Number.parseFloat(parsed.getAttribute('height') || '') || 800;
  const scale = Math.min(2, 2400 / Math.max(sourceWidth, 1));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image export is not available on this device.');
    context.fillStyle = '#0b0d0e';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL('image/png'), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function FlowExportDialog({
  applicationId,
  flow,
  onClose,
}: {
  applicationId: string;
  flow: FlowDetail;
  onClose(): void;
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
  const [saved, setSaved] = useState<string | null>(null);
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
    setSaved(null);
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
    if (!selected) return;
    await window.tellann?.system.copyText(selected.source);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [selected]);

  const save = useCallback(async () => {
    if (!selected || !window.tellann?.intent.saveFlowExport) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const label = DIAGRAMS.find((item) => item.kind === selected.kind)?.label ?? selected.kind;
      const base = `${safeName(flow.name)}-${selected.kind.toLowerCase().replaceAll('_', '-')}`;
      let contentBase64: string;
      if (format === 'mmd') contentBase64 = textToBase64(selected.source);
      else if (format === 'md') contentBase64 = textToBase64(markdown(flow, label, selected.source));
      else if (format === 'svg') contentBase64 = textToBase64(svg);
      else {
        const png = await svgToPng(svg);
        if (format === 'png') contentBase64 = png.dataUrl.split(',')[1] || '';
        else {
          const { jsPDF } = await import('jspdf');
          const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const margin = 36;
          const header = 54;
          const scale = Math.min((pageWidth - margin * 2) / png.width, (pageHeight - margin * 2 - header) / png.height);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(16);
          pdf.text(`${flow.name} — ${label}`, margin, margin);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(110);
          pdf.text(`Tellann Flow · Version ${flow.version ?? 1}`, margin, margin + 16);
          pdf.addImage(png.dataUrl, 'PNG', margin, margin + header, png.width * scale, png.height * scale);
          contentBase64 = bytesToBase64(new Uint8Array(pdf.output('arraybuffer')));
        }
      }
      const result = await window.tellann.intent.saveFlowExport(`${base}.${format}`, contentBase64);
      if (!result.cancelled) setSaved(result.filename ?? `${base}.${format}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The diagram could not be exported.');
    } finally {
      setSaving(false);
    }
  }, [flow, format, selected, svg]);

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
              <button className="button" type="button" disabled={!selected} onClick={() => void copySource()}>
                {copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? 'Copied' : 'Copy source'}
              </button>
            </div>
            <div className="flow-export-preview">
              {loading || rendering ? <span className="flow-export-loading"><LoaderCircle size={18} /> Rendering preview…</span> : null}
              {!loading && !rendering && svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : null}
              {!loading && !rendering && !selected && !error ? <span>No exportable diagrams are available for this flow.</span> : null}
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
          <button className="button primary" type="button" disabled={!selected || saving || (imageFormat && !svg)} onClick={() => void save()}>
            {saving ? <LoaderCircle className="is-spinning" size={14} /> : <Download size={14} />}
            {saving ? 'Saving…' : `Export ${format.toUpperCase()}`}
          </button>
          {error ? <p className="flow-export-message" data-tone="danger" role="alert">{error}</p> : null}
          {saved ? <p className="flow-export-message" data-tone="success" role="status">Saved {saved}</p> : null}
        </footer>
      </section>
    </div>
  );
}
