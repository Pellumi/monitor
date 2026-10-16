"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ProductPlaceholder } from "@/components/product-tour";

type Audience = "DEVELOPERS" | "QA_ENGINEERS" | "PRODUCT_TEAMS" | "ENGINEERING_LEADERS" | "FOUNDERS";

const audienceLabels: Record<Audience, string> = {
  DEVELOPERS: "Developers",
  QA_ENGINEERS: "QA Engineers",
  PRODUCT_TEAMS: "Product Teams",
  ENGINEERING_LEADERS: "Engineering Leaders",
  FOUNDERS: "Founders",
};

type Story = {
  slug: string;
  industry: string;
  title: string;
  audiences: Audience[];
};

const stories: Story[] = [
  {
    slug: "checkout-workflow-validation-example",
    industry: "E-commerce",
    title: "Investigating a checkout flow with incomplete execution evidence",
    audiences: ["DEVELOPERS", "QA_ENGINEERS"],
  },
  {
    slug: "onboarding-journey-validation-example",
    industry: "SaaS",
    title: "Understanding missing steps in a new-user onboarding journey",
    audiences: ["PRODUCT_TEAMS", "QA_ENGINEERS"],
  },
  {
    slug: "payment-transfer-workflow-example",
    industry: "Fintech",
    title: "Examining alternative states in a payment-transfer workflow",
    audiences: ["DEVELOPERS", "ENGINEERING_LEADERS"],
  },
  {
    slug: "assessment-submission-workflow-example",
    industry: "EdTech",
    title: "Validating an assessment submission journey",
    audiences: ["PRODUCT_TEAMS", "FOUNDERS"],
  },
];

const filters: ("ALL" | Audience)[] = [
  "ALL",
  "DEVELOPERS",
  "QA_ENGINEERS",
  "ENGINEERING_LEADERS",
  "PRODUCT_TEAMS",
  "FOUNDERS",
];

export function CaseStudyExplorer() {
  const [audience, setAudience] = useState<"ALL" | Audience>("ALL");

  const results = useMemo(() => {
    if (audience === "ALL") return stories;
    return stories.filter((story) => story.audiences.includes(audience));
  }, [audience]);

  return (
    <div className="cs-explorer">
      <div className="cs-chip-row" role="tablist" aria-label="Filter case studies by audience">
        {filters.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={audience === key}
            className={audience === key ? "is-active" : ""}
            onClick={() => setAudience(key)}
          >
            {key === "ALL" ? "All stories" : audienceLabels[key]}
          </button>
        ))}
      </div>

      <div className="cs-story-grid" aria-live="polite">
        {results.length === 0 ? (
          <p className="cs-empty">No illustrative scenarios are tagged for this audience yet.</p>
        ) : (
          results.map((story) => (
            <Link key={story.slug} href={`/case-studies/${story.slug}`} className="cs-story-card">
              <ProductPlaceholder
                label={`${story.title} — illustrative scenario cover`}
                dimensions="1200 × 675"
                displayDimensions="375 × 211"
              />
              <div className="cs-story-body">
                <span className="cs-story-tag">
                  Illustrative · {story.industry}
                </span>
                <h3>{story.title}</h3>
                <p className="cs-story-audiences">{story.audiences.map((item) => audienceLabels[item]).join(" · ")}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
