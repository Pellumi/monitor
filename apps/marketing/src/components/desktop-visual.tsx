import type { CSSProperties } from "react";

export type DesktopVisualProps = {
  id: string;
  label: string;
  source: string;
  display?: string;
  className?: string;
};

export function DesktopVisual({ id, label, source, display, className = "" }: DesktopVisualProps) {
  const sourceSize = source.match(/\d+/g)?.map(Number) ?? [1600, 1000];
  const displaySize = display?.match(/\d+/g)?.map(Number);
  const width = displaySize?.[0] ?? sourceSize[0];
  const height = displaySize?.[1] ?? sourceSize[1];
  const style = { "--visual-width": `${width}px`, aspectRatio: `${width} / ${height}` } as CSSProperties;

  return (
    <div className={`desktop-visual ${className}`} style={style} role="img" aria-label={`${label}. Source ${source}${display ? `, displayed at ${display}` : ""}.`}>
      <i aria-hidden="true" />
      <span>{id} · Visual placeholder</span>
      <strong>{label}</strong>
      <code>{display ? `Display ${display} px · Source ${source} px` : `${source} px · Master-size preview`}</code>
    </div>
  );
}
