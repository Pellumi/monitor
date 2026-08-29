"use client";

import { useState } from "react";

const layers = ["Event Stream", "PostgreSQL", "ClickHouse", "Object Storage"];

export function ArchitectureAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div className="hiw-architecture-accordion" data-open={open}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="technical-architecture-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <span>View technical architecture</span>
        <i aria-hidden="true">
          <span />
          <span />
        </i>
      </button>
      <div
        className="hiw-architecture-panel"
        id="technical-architecture-panel"
        aria-hidden={!open}
      >
        <div>
          <p>
            The underlying pipeline separates event transport, application data,
            behavioral analytics, and durable media storage.
          </p>
          <ul>
            {layers.map((layer, index) => (
              <li key={layer}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {layer}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
