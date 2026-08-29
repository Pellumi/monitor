"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type Visual = {
  id: string;
  label: string;
  source: string;
  display: string;
  copy?: string;
};

function Placeholder({ visual, className = "" }: { visual: Visual; className?: string }) {
  const [width, height] = visual.display.match(/\d+/g)?.map(Number) ?? [960, 600];
  const style = { "--visual-width": `${width}px`, aspectRatio: `${width} / ${height}` } as CSSProperties;
  return (
    <div className={`desktop-visual ${className}`} style={style} role="img" aria-label={`${visual.label}. Source ${visual.source}, displayed at ${visual.display}.`}>
      <i aria-hidden="true" />
      <span>{visual.id} · Visual placeholder</span>
      <strong>{visual.label}</strong>
      <code>Display {visual.display} px · Source {visual.source} px</code>
    </div>
  );
}

const projectSteps: Visual[] = [
  { id: "DSK-04", label: "Attach local project screenshot", source: "1440 × 900", display: "960 × 600", copy: "Choose a local folder, repository, development URL, preview URL, or browser-only mode." },
  { id: "DSK-05", label: "Permission prompt screenshot", source: "1280 × 800", display: "840 × 525", copy: "Review the exact access Tellann is requesting before workspace analysis begins." },
  { id: "DSK-06", label: "Workspace analysis screenshot", source: "1440 × 900", display: "960 × 600", copy: "Inspect detected framework, package manager, Git state, routes, endpoints, tests, and documentation." },
  { id: "DSK-07", label: "Project ready screenshot", source: "1440 × 900", display: "960 × 600", copy: "Confirm the reviewed project context before moving into a guided QA run." },
];

export function DesktopProjectSequence() {
  const [active, setActive] = useState(0);
  const current = projectSteps[active];
  return (
    <div className="desktop-shell desktop-project-sequence">
      <div className="desktop-project-tabs" role="tablist" aria-label="Connect a project workflow">
        {["Attach", "Permissions", "Analyze", "Ready"].map((label, index) => <button key={label} type="button" role="tab" aria-selected={active === index} aria-controls="desktop-project-panel" onClick={() => setActive(index)}><small>{String(index + 1).padStart(2, "0")}</small>{label}</button>)}
      </div>
      <div id="desktop-project-panel" className="desktop-project-panel" role="tabpanel">
        <p>{current.copy}</p>
        <Placeholder visual={current} />
      </div>
    </div>
  );
}

const gallery: Visual[] = [
  { id: "DSK-14", label: "Projects", source: "1440 × 900", display: "620 × 388", copy: "Your local workspace and Tellann application in one place." },
  { id: "DSK-15", label: "Intent", source: "1440 × 900", display: "620 × 388", copy: "Review expected behavior before comparing it with a run." },
  { id: "DSK-16", label: "QA Runs", source: "1440 × 900", display: "620 × 388", copy: "Demonstrate workflows while Tellann collects structured evidence." },
  { id: "DSK-17", label: "Reports", source: "1440 × 900", display: "620 × 388", copy: "Turn run evidence into a reviewable quality report." },
];

export function DesktopProductGallery() {
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (selected === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
      if (event.key === "ArrowRight") setSelected(value => value === null ? 0 : (value + 1) % gallery.length);
      if (event.key === "ArrowLeft") setSelected(value => value === null ? 0 : (value - 1 + gallery.length) % gallery.length);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  return (
    <>
      <div className="desktop-shell desktop-gallery">
        {gallery.map((visual, index) => <button key={visual.id} type="button" onClick={() => setSelected(index)} aria-label={`Open ${visual.label} preview`}><Placeholder visual={visual} /><span><strong>{visual.label}</strong>{visual.copy}</span></button>)}
      </div>
      {selected !== null ? <div className="desktop-lightbox" role="dialog" aria-modal="true" aria-label={`${gallery[selected].label} product preview`}><button className="desktop-lightbox-backdrop" type="button" aria-label="Close preview" onClick={() => setSelected(null)} /><div><header><span>{gallery[selected].label}</span><button type="button" onClick={() => setSelected(null)}>Close ×</button></header><Placeholder visual={{ ...gallery[selected], display: "1440 × 900" }} /><footer><button type="button" onClick={() => setSelected((selected - 1 + gallery.length) % gallery.length)}>← Previous</button><p>{gallery[selected].copy}</p><button type="button" onClick={() => setSelected((selected + 1) % gallery.length)}>Next →</button></footer></div></div> : null}
    </>
  );
}
