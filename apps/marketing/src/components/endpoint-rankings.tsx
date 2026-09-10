"use client";

import { useState } from "react";

type Ranking = {
  key: string;
  label: string;
  unit: string;
  rows: [string, string, string, string][];
  note?: string;
};

const rankings: Ranking[] = [
  {
    key: "slowest",
    label: "Slowest",
    unit: "Average response",
    rows: [
      ["POST", "/payment", "891 ms", "Checkout"],
      ["POST", "/checkout", "418 ms", "Checkout"],
      ["GET", "/search", "371 ms", "Search"],
      ["POST", "/auth/login", "260 ms", "Authentication"],
      ["GET", "/products", "184 ms", "Checkout · Search"],
    ],
  },
  {
    key: "observed",
    label: "Most observed",
    unit: "Observed requests",
    rows: [
      ["GET", "/products", "48", "Checkout · Search"],
      ["POST", "/auth/login", "38", "Authentication"],
      ["GET", "/profile", "34", "Authentication"],
      ["GET", "/search", "31", "Search"],
      ["POST", "/cart", "28", "Checkout"],
    ],
  },
  {
    key: "errors",
    label: "Highest error",
    unit: "Observed error rate",
    rows: [["POST", "/payment", "13.3%", "Checkout"]],
    note: "No other endpoint produced an error response in the selected demonstrations.",
  },
];

export function EndpointRankings() {
  const [active, setActive] = useState(rankings[0].key);
  const ranking = rankings.find((item) => item.key === active) ?? rankings[0];

  return (
    <div className="endpoint-rankings">
      <div className="endpoint-ranking-tabs" aria-label="Endpoint rankings">
        {rankings.map((item) => (
          <button
            key={item.key}
            type="button"
            className={active === item.key ? "is-active" : ""}
            aria-pressed={active === item.key}
            onClick={() => setActive(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="endpoint-ranking-rows"
        role="table"
        aria-label={`${ranking.label} endpoints by ${ranking.unit.toLowerCase()}`}
      >
        <div role="row" className="is-head">
          <span role="columnheader">#</span>
          <span role="columnheader">Endpoint</span>
          <span role="columnheader">{ranking.unit}</span>
          <span role="columnheader">Workflow</span>
        </div>
        {ranking.rows.map(([method, route, value, workflow], index) => (
          <div role="row" key={route + method}>
            <span role="cell">{index + 1}</span>
            <span role="cell">
              <i className="endpoint-method">{method}</i>
              {route}
            </span>
            <span role="cell">{value}</span>
            <span role="cell">{workflow}</span>
          </div>
        ))}
      </div>
      {ranking.note ? <p className="endpoint-ranking-note">{ranking.note}</p> : null}
      <small className="endpoint-sample-note">Sample application data</small>
    </div>
  );
}
