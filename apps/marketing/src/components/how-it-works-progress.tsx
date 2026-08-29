"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";

const steps = [
  ["connect", "Connect"],
  ["demonstrate", "Demonstrate"],
  ["capture", "Capture"],
  ["session", "Session"],
  ["states", "States"],
  ["workflows", "Workflows"],
  ["graph", "Graph"],
  ["coverage", "Coverage"],
  ["gaps", "Gaps"],
  ["endpoints", "Endpoints"],
  ["replay", "Replay"],
  ["reports", "Report"],
] as const;
type StepId = (typeof steps)[number][0];

export function HowItWorksProgress() {
  const [activeStep, setActiveStep] = useState<StepId>(steps[0][0]);

  useEffect(() => {
    const sections = steps
      .map(([id]) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    const activeObserver = new IntersectionObserver(
      (entries) => {
        const current = entries.find((entry) => entry.isIntersecting);
        if (current) setActiveStep(current.target.id as StepId);
      },
      { rootMargin: "-32% 0px -57% 0px", threshold: 0 },
    );
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-visible", "true");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );

    sections.forEach((section) => {
      activeObserver.observe(section);
      revealObserver.observe(section);
    });
    return () => {
      activeObserver.disconnect();
      revealObserver.disconnect();
    };
  }, []);

  const activeIndex = steps.findIndex(([id]) => id === activeStep);

  function moveToStep(event: MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    window.history.replaceState(null, "", `#${id}`);
    setActiveStep(id as StepId);
  }

  return (
    <aside
      className="hiw-progress"
      aria-label="Page progress"
      style={{ "--active-step": activeIndex } as CSSProperties}
    >
      <i className="hiw-progress-indicator" aria-hidden="true" />
      {steps.map(([id, label], index) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={activeStep === id ? "step" : undefined}
          onClick={(event) => moveToStep(event, id)}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          {label}
        </a>
      ))}
    </aside>
  );
}
