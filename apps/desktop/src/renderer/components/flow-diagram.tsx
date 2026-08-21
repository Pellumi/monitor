import { useEffect, useId, useRef, useState } from "react";
import { Maximize2, Minus, Plus, X } from "lucide-react";

let mermaidPromise: Promise<typeof import("mermaid")> | null = null;
function loadMermaid() {
  if (!mermaidPromise)
    mermaidPromise = import("mermaid").then((module) => {
      module.default.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "dark",
        flowchart: {
          curve: "basis",
          htmlLabels: false,
          nodeSpacing: 42,
          rankSpacing: 64,
        },
        themeVariables: {
          background: "#080809",
          primaryColor: "#171719",
          primaryTextColor: "#f4f4f5",
          primaryBorderColor: "#52525b",
          lineColor: "#71717a",
          secondaryColor: "#111113",
          tertiaryColor: "#0d0d0f",
          edgeLabelBackground: "#0a0a0b",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        },
      });
      return module;
    });
  return mermaidPromise;
}

export function FlowDiagram({
  source,
  label = "Selected flow diagram",
}: {
  source: string;
  label?: string;
}) {
  const reactId = useId();
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    const renderId = `tellann-flow-${reactId.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}`;
    setError(null);
    void loadMermaid()
      .then((module) => module.default.render(renderId, source))
      .then(({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered);
      })
      .catch(() => {
        if (!cancelled) {
          setSvg("");
          setError(
            "The diagram could not be rendered. Reopen the diagram or refresh the flow to regenerate it.",
          );
        }
      });
    return () => {
      cancelled = true;
      document.getElementById(`d${renderId}`)?.remove();
    };
  }, [reactId, source]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isFullscreen && !dialog.open) {
      setFullscreenZoom(1);
      dialog.showModal();
    } else if (!isFullscreen && dialog.open) {
      dialog.close();
    }
  }, [isFullscreen]);

  const closeFullscreen = () => {
    setIsFullscreen(false);
    requestAnimationFrame(() => fullscreenButtonRef.current?.focus());
  };

  return (
    <div className="flow-diagram" aria-label={label}>
      <div className="flow-diagram-toolbar" aria-label="Diagram controls">
        <span>
          <i className="flow-diagram-key current" /> Current flow
        </span>
        <span>
          <i className="flow-diagram-key proposed" /> Proposed
        </span>
        <div className="flow-diagram-zoom">
          <button
            type="button"
            className="icon-button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.55, value - 0.15))}
          >
            <Minus size={14} />
          </button>
          <button
            ref={fullscreenButtonRef}
            type="button"
            className="icon-button"
            aria-label="Open diagram in full screen"
            title="Open full screen"
            onClick={() => setIsFullscreen(true)}
          >
            <Maximize2 size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => setZoom((value) => Math.min(2, value + 0.15))}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      {error ? (
        <p className="flow-diagram-error" role="alert">
          {error}
        </p>
      ) : null}
      {!error && !svg ? (
        <div className="flow-diagram-loading" role="status">
          Rendering diagram...
        </div>
      ) : null}
      {svg && !isFullscreen ? (
        <div
          className="flow-diagram-viewport"
          tabIndex={0}
          aria-label={`${label}. Scroll to explore.`}
        >
          <div
            className="flow-diagram-canvas"
            style={{ transform: `scale(${zoom})` }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      ) : null}
      <dialog
        ref={dialogRef}
        className="flow-diagram-modal"
        aria-labelledby={`${reactId}-fullscreen-title`}
        onCancel={(event) => {
          event.preventDefault();
          closeFullscreen();
        }}
        onClose={() => {
          if (isFullscreen) setIsFullscreen(false);
        }}
      >
        <div className="flow-diagram-modal-header">
          <div>
            <span className="eyebrow">Full-screen diagram</span>
            <h2 id={`${reactId}-fullscreen-title`}>{label}</h2>
          </div>
          <div className="flow-diagram-modal-controls" aria-label="Full-screen diagram controls">
            <button
              type="button"
              className="icon-button"
              aria-label="Zoom out"
              title="Zoom out"
              onClick={() =>
                setFullscreenZoom((value) => Math.max(0.55, value - 0.15))
              }
            >
              <Minus size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Reset zoom"
              title="Reset zoom"
              onClick={() => setFullscreenZoom(1)}
            >
              <Maximize2 size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Zoom in"
              title="Zoom in"
              onClick={() =>
                setFullscreenZoom((value) => Math.min(2, value + 0.15))
              }
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              className="icon-button flow-diagram-modal-close"
              aria-label="Close full-screen diagram"
              title="Close"
              onClick={closeFullscreen}
            >
              <X size={17} />
            </button>
          </div>
        </div>
        <div className="flow-diagram-modal-legend" aria-label="Diagram legend">
          <span>
            <i className="flow-diagram-key current" /> Current flow
          </span>
          <span>
            <i className="flow-diagram-key proposed" /> Proposed
          </span>
          <span className="flow-diagram-modal-hint">Scroll in either direction to explore</span>
        </div>
        {svg ? (
          <div
            className="flow-diagram-viewport flow-diagram-modal-viewport"
            tabIndex={0}
            aria-label={`${label}. Full-screen view. Scroll to explore.`}
          >
            <div
              className="flow-diagram-canvas"
              style={{ transform: `scale(${fullscreenZoom})` }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
