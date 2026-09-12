"use client";
import { useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
/** The border box is exactly the named display size, until the viewport requires scaling. */
export function DriftMedia({
  label,
  width,
  height,
  master,
}: {
  label: string;
  width: number;
  height: number;
  master?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(`${width} × ${height}`);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      setSize(`${Math.round(rect.width)} × ${Math.round(rect.height)}`);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="drift-media"
      style={{
        width: `min(100%, ${width}px)`,
        aspectRatio: `${width}/${height}`,
      }}
      role="img"
      aria-label={`${label} placeholder`}
    >
      <span>Media placeholder</span>
      <strong>{label}</strong>
      <small>Rendered: {size} px</small>
      <small>
        Desktop: {width} × {height} px{master ? ` · Export: ${master} px` : ""}
      </small>
    </div>
  );
}
const changes = [
  [
    "Added",
    "+",
    "New behavior appeared",
    "A promo-code path is present in the newer demonstration.",
  ],
  [
    "Removed",
    "−",
    "An earlier path is absent",
    "Inventory check was observed in v6, but not in v7. Investigate whether it was skipped or became unreachable.",
  ],
  [
    "Changed",
    "~",
    "A transition changed frequency",
    "Cart → Checkout was observed 14 times before and 6 times now.",
  ],
  [
    "Coverage",
    "↗",
    "Coverage moved forward",
    "68% → 72.2%: an increase of 4.2 percentage points in demonstrated coverage.",
  ],
];
export function DriftComparison() {
  const [filter, setFilter] = useState("All changes");
  return (
    <div className="drift-comparison">
      <div className="drift-toolbar">
        <span>CHECKOUT · v6 → v7</span>
        <small>Illustrative example</small>
      </div>
      <div className="drift-filters" aria-label="Filter example changes">
        {["All changes", ...changes.map((c) => c[0])].map((label) => (
          <button
            key={label}
            aria-pressed={filter === label}
            onClick={() => setFilter(label)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="drift-results" aria-live="polite">
        {changes
          .filter((c) => filter === "All changes" || c[0] === filter)
          .map(([type, symbol, title, copy]) => (
            <article key={type}>
              <span className="drift-symbol">{symbol}</span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </article>
          ))}
      </div>
      <DriftMedia
        label="Before / after graph comparison"
        width={1200}
        height={750}
        master="1600 × 1000"
      />
    </div>
  );
}
const roles = [
  [
    "Developer",
    "Less guessing after a change.",
    "Find newly observed paths and investigate missing behavior before digging into code.",
  ],
  [
    "QA engineer",
    "Give your next run a clear focus.",
    "Review disappeared paths, validate new behavior, and track coverage across demonstrations.",
  ],
  [
    "Engineering manager",
    "A shared picture of change.",
    "Discuss coverage movement and removed behavior with a common evidence trail.",
  ],
  [
    "Product manager",
    "Keep the intended experience in view.",
    "See which intended paths now have evidence and which still need to be demonstrated.",
  ],
];
export function DriftRoles() {
  const [active, setActive] = useState(0);
  return (
    <div className="drift-roles">
      <label htmlFor="drift-role">Your role</label>
      <Select
        value={String(active)}
        onValueChange={(value) => setActive(Number(value))}
      >
        <SelectTrigger id="drift-role">
          <SelectValue placeholder="Select role">
            {roles[active][0]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {roles.map(([role], i) => (
              <SelectItem value={String(i)} key={role}>
                {role}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div key={active} className="drift-role-copy" aria-live="polite">
        <h3>{roles[active][1]}</h3>
        <p>{roles[active][2]}</p>
      </div>
    </div>
  );
}
