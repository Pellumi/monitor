"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Clipboard,
  Download,
  FileCode2,
  FileImage,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { Button } from "@/components/ui/button";

const API = "/api-gateway";

type DiagramKind = "FLOW" | "SEQUENCE" | "USE_CASE" | "ACTIVITY" | "STATE_MACHINE";
type ExportFormat = "svg" | "png" | "pdf" | "mmd" | "md";

type DiagramProjection = {
  kind: DiagramKind;
  renderer: "MERMAID";
  source: string;
};

const diagramOptions: Array<{
  kind: DiagramKind;
  label: string;
  description: string;
}> = [
  { kind: "FLOW", label: "Flowchart", description: "States, branches, and outcomes" },
  { kind: "SEQUENCE", label: "Sequence", description: "Actor and system interactions" },
  { kind: "USE_CASE", label: "Use case", description: "Actors linked to flow actions" },
  { kind: "ACTIVITY", label: "Activity", description: "Step-by-step operational path" },
  { kind: "STATE_MACHINE", label: "State machine", description: "Lifecycle and transitions" },
];

const formatOptions: Array<{
  format: ExportFormat;
  label: string;
  description: string;
  icon: typeof FileImage;
}> = [
  { format: "png", label: "PNG", description: "Shareable image", icon: FileImage },
  { format: "svg", label: "SVG", description: "Scalable vector", icon: FileCode2 },
  { format: "pdf", label: "PDF", description: "Document-ready", icon: FileText },
  { format: "mmd", label: "Mermaid", description: "Editable source", icon: FileCode2 },
  { format: "md", label: "Markdown", description: "Docs with metadata", icon: FileText },
];

function safeExportName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tellann-flow"
  );
}

function downloadBlob(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

function markdownExport(
  flowName: string,
  version: number,
  kind: DiagramKind,
  source: string,
) {
  const label = diagramOptions.find((option) => option.kind === kind)?.label ?? kind;
  return [
    `# ${flowName}`,
    "",
    `- Version: ${version}`,
    `- Diagram: ${label}`,
    "",
    "```mermaid",
    source,
    "```",
    "",
  ].join("\n");
}

function MermaidPreview({
  source,
  onRendered,
}: {
  source: string;
  onRendered: (svg: string | null) => void;
}) {
  const renderId = useId().replace(/:/g, "_");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg("");
    setError(null);
    onRendered(null);

    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "dark",
          flowchart: { htmlLabels: false, curve: "basis" },
        });
        const result = await mermaid.render(`flow_export_${renderId}`, source);
        if (cancelled) return;
        setSvg(result.svg);
        onRendered(result.svg);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Diagram preview could not be rendered.");
        onRendered(null);
      });

    return () => {
      cancelled = true;
    };
  }, [onRendered, renderId, source]);

  if (error) {
    return (
      <div role="alert" className="max-w-lg rounded-md border border-red-900/50 bg-red-950/20 p-4 text-xs text-red-300">
        {error}
      </div>
    );
  }
  if (!svg) {
    return (
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Rendering preview…
      </div>
    );
  }
  return (
    <div
      className="mermaid-export-preview flex min-h-64 min-w-full items-center justify-center [&_svg]:h-auto [&_svg]:max-h-[430px] [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function FlowExportDialog({
  appId,
  flowId,
  flowName,
  version,
  onClose,
}: {
  appId: string;
  flowId: string;
  flowName: string;
  version: number;
  onClose: () => void;
}) {
  const [diagramKind, setDiagramKind] = useState<DiagramKind>("FLOW");
  const [format, setFormat] = useState<ExportFormat>("png");
  const [renderedSvg, setRenderedSvg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery<{ diagrams: DiagramProjection[] }>({
    queryKey: ["flow-export-diagrams", appId, flowId],
    queryFn: async () => {
      const response = await authenticatedFetch(`${API}/v1/applications/${appId}/flows/${flowId}/diagrams`);
      if (!response.ok) throw new Error("Flow diagrams could not be loaded.");
      return response.json();
    },
  });

  const availableOptions = useMemo(
    () => diagramOptions.filter((option) => data?.diagrams.some((diagram) => diagram.kind === option.kind && diagram.source.trim())),
    [data],
  );
  const activeDiagramKind = availableOptions.some((option) => option.kind === diagramKind)
    ? diagramKind
    : availableOptions[0]?.kind;
  const selected = useMemo(
    () => data?.diagrams.find((diagram) => diagram.kind === activeDiagramKind && diagram.source.trim()),
    [activeDiagramKind, data],
  );
  const baseName = `${safeExportName(flowName)}-${(activeDiagramKind ?? "flow").toLowerCase().replaceAll("_", "-")}`;

  useEffect(() => {
    if (activeDiagramKind && activeDiagramKind !== diagramKind) setDiagramKind(activeDiagramKind);
  }, [activeDiagramKind, diagramKind]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !exporting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exporting, onClose]);

  const exportDiagram = async () => {
    if (!selected) return;
    setExporting(true);
    setExportError(null);
    try {
      if (format === "mmd") {
        downloadBlob(`${baseName}.mmd`, selected.source, "text/plain;charset=utf-8");
      } else if (format === "md") {
        downloadBlob(
          `${baseName}.md`,
          markdownExport(flowName, version, selected.kind, selected.source),
          "text/markdown;charset=utf-8",
        );
      } else if (format === "svg") {
        if (!renderedSvg) throw new Error("The preview is still rendering.");
        downloadBlob(`${baseName}.svg`, renderedSvg, "image/svg+xml;charset=utf-8");
      } else {
        const captureTarget = previewRef.current;
        if (!captureTarget || !renderedSvg) throw new Error("The preview is still rendering.");
        const { toPng } = await import("html-to-image");
        const png = await toPng(captureTarget, {
          backgroundColor: "#090909",
          pixelRatio: 2,
          cacheBust: true,
        });
        if (format === "png") {
          const response = await fetch(png);
          downloadBlob(`${baseName}.png`, await response.blob(), "image/png");
        } else {
          const { jsPDF } = await import("jspdf");
          const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
          const width = pdf.internal.pageSize.getWidth();
          const height = pdf.internal.pageSize.getHeight();
          const margin = 36;
          const header = 54;
          const image = pdf.getImageProperties(png);
          const scale = Math.min(
            (width - margin * 2) / image.width,
            (height - margin * 2 - header) / image.height,
          );
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(16);
          pdf.text(`${flowName} — ${diagramOptions.find((item) => item.kind === selected.kind)?.label}`, margin, margin);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(90);
          pdf.text(`Tellann Flow · Version ${version}`, margin, margin + 16);
          pdf.addImage(png, "PNG", margin, margin + header, image.width * scale, image.height * scale);
          pdf.save(`${baseName}.pdf`);
        }
      }
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const copySource = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.source);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !exporting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="flow-export-title"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[#2b2b2b] bg-[#0d0d0d] shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#242424] px-5 py-4">
          <div>
            <h2 id="flow-export-title" className="text-base font-semibold text-white">Export flow</h2>
            <p className="mt-1 text-xs text-neutral-500">Choose a diagram perspective and download a presentation-ready or editable file.</p>
          </div>
          <button
            type="button"
            aria-label="Close export dialog"
            onClick={onClose}
            disabled={exporting}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-white/5 hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-b border-[#242424] p-4 lg:border-r lg:border-b-0">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Diagram type</p>
            <div className="space-y-1.5">
              {availableOptions.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => {
                    setRenderedSvg(null);
                    setDiagramKind(option.kind);
                  }}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    activeDiagramKind === option.kind
                      ? "border-white/40 bg-white/8"
                      : "border-transparent hover:border-[#2a2a2a] hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="block text-xs font-semibold text-white">{option.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-neutral-500">{option.description}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="flex min-h-0 flex-col">
            <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{flowName}</p>
                  <p className="text-[10px] text-neutral-500">Version {version}{activeDiagramKind ? ` · ${diagramOptions.find((item) => item.kind === activeDiagramKind)?.label}` : ""}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => void copySource()} disabled={!selected}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy source"}
                </Button>
              </div>
              <div
                ref={previewRef}
                className="flex min-h-72 flex-1 items-center justify-center overflow-auto rounded-lg border border-[#252525] bg-[#090909] p-6"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading diagram…</div>
                ) : error ? (
                  <div role="alert" className="text-xs text-red-300">{error instanceof Error ? error.message : "Flow diagrams could not be loaded."}</div>
                ) : selected ? (
                  <MermaidPreview source={selected.source} onRendered={setRenderedSvg} />
                ) : (
                  <div className="text-xs text-neutral-500">No exportable diagrams are available for this flow.</div>
                )}
              </div>
            </div>

            <footer className="shrink-0 border-t border-[#242424] bg-[#0a0a0a] p-4 sm:px-5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">File format</p>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {formatOptions.map((option) => (
                    <button
                      key={option.format}
                      type="button"
                      aria-pressed={format === option.format}
                      onClick={() => setFormat(option.format)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                        format === option.format
                          ? "border-white/50 bg-white/10 text-white"
                          : "border-[#292929] text-neutral-400 hover:border-[#444] hover:text-white"
                      }`}
                    >
                      <option.icon className="h-4 w-4" />
                      <span><span className="block text-[11px] font-semibold">{option.label}</span><span className="hidden text-[9px] text-neutral-500 sm:block">{option.description}</span></span>
                    </button>
                  ))}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  loading={exporting}
                  disabled={!selected || exporting || (["svg", "png", "pdf"].includes(format) && !renderedSvg)}
                  onClick={() => void exportDiagram()}
                  className="shrink-0"
                >
                  {!exporting && <Download className="h-3.5 w-3.5" />}
                  Export {format.toUpperCase()}
                </Button>
              </div>
              {exportError && <p role="alert" className="mt-2 text-xs text-red-300">{exportError}</p>}
            </footer>
          </div>
        </div>
      </section>
    </div>
  );
}
