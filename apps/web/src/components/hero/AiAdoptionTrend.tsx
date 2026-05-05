import { useMemo } from 'react';

import { HeroCaption } from '../shared/HeroCaption';
import type { CoAuthorMonthEntry } from '@gitrelic/core';

const PADDING = { top: 24, right: 24, bottom: 48, left: 48 };
const BAR_GAP_RATIO = 0.2;

interface AiAdoptionTrendProps {
  byMonth: CoAuthorMonthEntry[];
}

export function AiAdoptionTrend({ byMonth }: AiAdoptionTrendProps) {
  const maxTotal = useMemo(
    () => Math.max(1, ...byMonth.map((m) => m.total)),
    [byMonth],
  );

  if (byMonth.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="max-w-md text-text-secondary">
          No co-authored commits in this analysis window.
        </p>
        <p className="mt-2 max-w-md text-sm text-text-tertiary">
          The AI Adoption hero shows monthly stacked bars (AI-assisted vs
          pure-human) when this codebase emits Co-Authored-By trailers.
        </p>
      </div>
    );
  }

  const innerWidth = 800 - PADDING.left - PADDING.right;
  const innerHeight = 400 - PADDING.top - PADDING.bottom;

  return (
    <div className="flex h-full w-full flex-col">
      <svg
        className="h-full w-full"
        viewBox="0 0 800 400"
        preserveAspectRatio="xMidYMid meet"
      >
        {byMonth.map((m, i) => {
          const slotWidth = innerWidth / byMonth.length;
          const barWidth = slotWidth * (1 - BAR_GAP_RATIO);
          const x = PADDING.left + i * slotWidth + (slotWidth - barWidth) / 2;
          const aiHeight = (m.aiAssisted / maxTotal) * innerHeight;
          const humanHeight = (m.pureHuman / maxTotal) * innerHeight;
          const totalHeight = aiHeight + humanHeight;
          const baselineY = PADDING.top + innerHeight;

          return (
            <g key={m.month}>
              <rect
                data-testid="ai-trend-bar-human"
                x={x}
                y={baselineY - humanHeight}
                width={barWidth}
                height={humanHeight}
                className="fill-surface-tertiary"
              />
              <rect
                data-testid="ai-trend-bar-ai"
                x={x}
                y={baselineY - totalHeight}
                width={barWidth}
                height={aiHeight}
                className="fill-accent-coupling"
              />
              <text
                x={x + barWidth / 2}
                y={baselineY + 16}
                textAnchor="middle"
                className="fill-text-tertiary text-[10px]"
              >
                {m.month.slice(2)}
              </text>
            </g>
          );
        })}
        <text
          x={PADDING.left - 8}
          y={PADDING.top + 4}
          textAnchor="end"
          className="fill-text-tertiary text-[10px]"
        >
          {maxTotal}
        </text>
        <text
          x={PADDING.left - 8}
          y={PADDING.top + innerHeight / 2 + 4}
          textAnchor="end"
          className="fill-text-tertiary text-[10px]"
        >
          {Math.round(maxTotal / 2)}
        </text>
        <text
          x={PADDING.left - 8}
          y={400 - PADDING.bottom + 4}
          textAnchor="end"
          className="fill-text-tertiary text-[10px]"
        >
          0
        </text>
      </svg>
      <HeroCaption primary="Monthly stacked bars · top layer = AI-assisted commits · bottom = pure-human · linear scale" />
    </div>
  );
}
