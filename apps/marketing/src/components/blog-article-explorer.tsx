"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ProductPlaceholder } from "@/components/product-tour";

type Category =
  | "ENGINEERING"
  | "QA_TESTING"
  | "BEHAVIORAL_INTELLIGENCE"
  | "PRODUCT"
  | "STARTUPS"
  | "INSIDE_TELLANN";

const categoryLabels: Record<Category, string> = {
  ENGINEERING: "Engineering",
  QA_TESTING: "QA & Testing",
  BEHAVIORAL_INTELLIGENCE: "Behavioral Intelligence",
  PRODUCT: "Product",
  STARTUPS: "Startups",
  INSIDE_TELLANN: "Inside Tellann",
};

type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: Category;
  readTime: string;
  date: string;
};

const articles: Article[] = [
  {
    slug: "code-coverage-vs-workflow-coverage",
    title: "Code Coverage vs Workflow Coverage: What's the Difference?",
    excerpt: "Understanding what different forms of coverage actually prove.",
    category: "ENGINEERING",
    readTime: "7 min read",
    date: "Mar 2026",
  },
  {
    slug: "hidden-cost-of-untested-failure-paths",
    title: "The Hidden Cost of Untested Failure Paths",
    excerpt: "Why validating the happy path is rarely enough.",
    category: "QA_TESTING",
    readTime: "6 min read",
    date: "Mar 2026",
  },
  {
    slug: "from-requirements-to-observable-behavior",
    title: "From Product Requirements to Observable Behavior",
    excerpt: "Why intended product behavior deserves explicit validation.",
    category: "PRODUCT",
    readTime: "8 min read",
    date: "Feb 2026",
  },
  {
    slug: "qa-strategy-for-small-teams",
    title: "A Practical QA Strategy for Small Teams",
    excerpt: "Building useful quality checks with limited resources.",
    category: "STARTUPS",
    readTime: "6 min read",
    date: "Feb 2026",
  },
  {
    slug: "what-is-behavioral-qa",
    title: "What Is Behavioral QA, and Why Does It Matter?",
    excerpt: "An introduction to validating demonstrated behavior, not just code.",
    category: "BEHAVIORAL_INTELLIGENCE",
    readTime: "9 min read",
    date: "Feb 2026",
  },
  {
    slug: "why-tellann-is-built-around-declared-intent",
    title: "Why We Are Building Tellann Around Declared Intent",
    excerpt: "Engineering notes from the team building Tellann.",
    category: "INSIDE_TELLANN",
    readTime: "7 min read",
    date: "Jan 2026",
  },
];

const filters: ("ALL" | Category)[] = [
  "ALL",
  "ENGINEERING",
  "QA_TESTING",
  "BEHAVIORAL_INTELLIGENCE",
  "PRODUCT",
  "STARTUPS",
  "INSIDE_TELLANN",
];

export function BlogArticleExplorer() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"ALL" | Category>("ALL");

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (category !== "ALL" && article.category !== category) return false;
      if (!term) return true;
      return (
        article.title.toLowerCase().includes(term) ||
        article.excerpt.toLowerCase().includes(term) ||
        categoryLabels[article.category].toLowerCase().includes(term)
      );
    });
  }, [query, category]);

  return (
    <div className="blog-explorer">
      <div className="blog-search">
        <label className="blog-visually-hidden" htmlFor="blog-search-input">
          Search articles, topics, and ideas
        </label>
        <input
          id="blog-search-input"
          type="search"
          placeholder="Search articles, topics, and ideas…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <button
            type="button"
            className="blog-search-clear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            ×
          </button>
        ) : null}
      </div>
      <div className="blog-categories" role="tablist" aria-label="Filter articles by category">
        {filters.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={category === key}
            className={category === key ? "is-active" : ""}
            onClick={() => setCategory(key)}
          >
            {key === "ALL" ? "All" : categoryLabels[key]}
          </button>
        ))}
      </div>

      <div className="blog-latest-head" id="latest-thinking">
        <p className="blog-kicker">The latest thinking</p>
        <h2>Fresh perspectives, practical lessons.</h2>
      </div>

      <div className="blog-grid" aria-live="polite">
        {results.length === 0 ? (
          <p className="blog-empty">
            No articles match &ldquo;{query}&rdquo; in this category yet. Try another term or
            select All.
          </p>
        ) : (
          results.map((article) => (
            <Link key={article.slug} href={`/blog/${article.slug}`} className="blog-card">
              <ProductPlaceholder
                label={`${article.title} — cover image`}
                dimensions="1200 × 675"
                displayDimensions="380 × 214"
              />
              <div className="blog-card-body">
                <span className="blog-card-category">{categoryLabels[article.category]}</span>
                <h3>{article.title}</h3>
                <p>{article.excerpt}</p>
                <div className="blog-card-meta">
                  <span>{article.date}</span>
                  <span>{article.readTime}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
