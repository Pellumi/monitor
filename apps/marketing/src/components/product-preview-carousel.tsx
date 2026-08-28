'use client';

import { useEffect, useState } from 'react';

const ROTATION_INTERVAL_MS = 5_000;

const previewStages = [
  { tab: 'Demonstrate', flow: 'Developer walkthrough', visual: 'Developer demonstration session' },
  { tab: 'Observe', flow: 'Behavior events', visual: 'Observed behavior events' },
  { tab: 'Understand', flow: 'Workflow model', visual: 'Generated workflow model' },
  { tab: 'Report', flow: 'QA intelligence', visual: 'Actionable QA intelligence report' },
] as const;

export function ProductPreviewCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStage = previewStages[activeIndex];

  useEffect(() => {
    const rotationTimer = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % previewStages.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(rotationTimer);
  }, [activeIndex]);

  const selectStage = (index: number) => setActiveIndex(index);
  const selectAdjacentStage = (index: number, direction: -1 | 1) => {
    setActiveIndex((index + direction + previewStages.length) % previewStages.length);
  };

  return (
    <div className="home-preview-carousel">
      <div className="home-preview-tabs" role="tablist" aria-label="Product preview stages">
        {previewStages.map((stage, index) => (
          <button
            key={stage.tab}
            id={`preview-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={activeIndex === index}
            aria-controls="product-preview-panel"
            tabIndex={activeIndex === index ? 0 : -1}
            className={activeIndex === index ? 'is-active' : ''}
            onClick={() => selectStage(index)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') selectAdjacentStage(index, -1);
              if (event.key === 'ArrowRight') selectAdjacentStage(index, 1);
            }}
          >
            {stage.tab}
          </button>
        ))}
      </div>

      <div
        id="product-preview-panel"
        className="home-visual-placeholder home-preview-visual"
        role="tabpanel"
        aria-labelledby={`preview-tab-${activeIndex}`}
        data-placeholder-width="1200"
        data-placeholder-height="640"
        style={{ width: 'min(100%, 1200px)', aspectRatio: '1200 / 640' }}
      >
        <span>Visual placeholder</span>
        <strong>{activeStage.visual}</strong>
        <code>1200 × 640 px</code>
      </div>

      <div className="home-preview-flow mt-4" aria-label="Product preview workflow">
        {previewStages.map((stage, index) => (
          <button
            key={stage.flow}
            type="button"
            className={activeIndex === index ? 'is-active' : ''}
            aria-label={`Show ${stage.tab} preview`}
            aria-pressed={activeIndex === index}
            onClick={() => selectStage(index)}
          >
            {stage.flow}
          </button>
        ))}
      </div>
    </div>
  );
}
