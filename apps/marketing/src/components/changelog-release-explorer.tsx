"use client";

import { useMemo, useState } from "react";

type ReleaseType = "FEATURE" | "IMPROVEMENT" | "FIX" | "SECURITY" | "BREAKING_CHANGE";
type Platform = "WEB" | "DESKTOP" | "SDK" | "API";

const typeLabels: Record<ReleaseType, string> = {
  FEATURE: "Feature",
  IMPROVEMENT: "Improvement",
  FIX: "Fix",
  SECURITY: "Security",
  BREAKING_CHANGE: "Breaking change",
};

const platformLabels: Record<Platform, string> = {
  WEB: "Web app",
  DESKTOP: "Desktop",
  SDK: "SDK",
  API: "API",
};

type Entry = {
  slug: string;
  date: string;
  type: ReleaseType;
  platform: Platform;
  title: string;
  copy: string;
};

const entries: Entry[] = [
  {
    slug: "workflow-reconciliation-view",
    date: "Sample date",
    type: "FEATURE",
    platform: "WEB",
    title: "Improved workflow reconciliation view",
    copy: "A clearer presentation of expected and observed states for technical teams reviewing QA evidence.",
  },
  {
    slug: "desktop-demonstration-setup",
    date: "Sample date",
    type: "IMPROVEMENT",
    platform: "DESKTOP",
    title: "Simplified desktop demonstration setup",
    copy: "More direct guidance for developers preparing an application for a managed-browser demonstration.",
  },
  {
    slug: "session-evidence-labels",
    date: "Sample date",
    type: "FIX",
    platform: "WEB",
    title: "More consistent session evidence labels",
    copy: "An example of how a small fix can describe its impact without exposing internal implementation details.",
  },
];

const typeFilters: ("ALL" | ReleaseType)[] = ["ALL", "FEATURE", "IMPROVEMENT", "FIX", "SECURITY", "BREAKING_CHANGE"];
const platformFilters: ("ALL" | Platform)[] = ["ALL", "WEB", "DESKTOP", "SDK", "API"];

export function ChangelogReleaseExplorer() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"ALL" | ReleaseType>("ALL");
  const [platform, setPlatform] = useState<"ALL" | Platform>("ALL");

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (type !== "ALL" && entry.type !== type) return false;
      if (platform !== "ALL" && entry.platform !== platform) return false;
      if (!term) return true;
      return entry.title.toLowerCase().includes(term) || entry.copy.toLowerCase().includes(term);
    });
  }, [query, type, platform]);

  return (
    <div>
      <p className="changelog-explorer-notice">
        <strong>Tellann is building its public release history.</strong> The
        entries below illustrate the format every release note will follow —
        they are not a record of shipped features.
      </p>

      <div className="changelog-search">
        <label className="changelog-visually-hidden" htmlFor="changelog-search-input">
          Search updates
        </label>
        <input
          id="changelog-search-input"
          type="search"
          placeholder="Search updates…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <button
            type="button"
            className="changelog-search-clear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            ×
          </button>
        ) : null}
      </div>

      <div className="changelog-filter-group">
        <span className="changelog-filter-label">Release type</span>
        <div className="changelog-filter-row" role="tablist" aria-label="Filter by release type">
          {typeFilters.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={type === key}
              className={type === key ? "is-active" : ""}
              onClick={() => setType(key)}
            >
              {key === "ALL" ? "All" : typeLabels[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="changelog-filter-group">
        <span className="changelog-filter-label">Product surface</span>
        <div className="changelog-filter-row" role="tablist" aria-label="Filter by product surface">
          {platformFilters.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={platform === key}
              className={platform === key ? "is-active" : ""}
              onClick={() => setPlatform(key)}
            >
              {key === "ALL" ? "All platforms" : platformLabels[key]}
            </button>
          ))}
        </div>
      </div>

      <p className="changelog-results-count" aria-live="polite">
        Showing: {type === "ALL" ? "All" : typeLabels[type]} ·{" "}
        {platform === "ALL" ? "All platforms" : platformLabels[platform]}
      </p>

      <div className="changelog-timeline" id="timeline" aria-live="polite">
        {results.length === 0 ? (
          <p className="changelog-empty">
            No updates match these filters yet. Try another combination.
          </p>
        ) : (
          results.map((entry) => (
            <article key={entry.slug} className="changelog-entry">
              <div className="changelog-entry-meta">
                <span className="changelog-entry-date">{entry.date}</span>
                <span className="changelog-tag">{typeLabels[entry.type]}</span>
                <span className="changelog-tag">{platformLabels[entry.platform]}</span>
                <span className="changelog-illustrative-tag">Illustrative note only</span>
              </div>
              <h3>{entry.title}</h3>
              <p>{entry.copy}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
