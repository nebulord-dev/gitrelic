import { useEffect, useRef, useState } from 'react';

import { HeroCaption } from '../shared/HeroCaption';
import type { CoAuthorMonthEntry } from '@gitrelic/core';

const PADDING = { top: 16, right: 24, bottom: 28, left: 32 };
const BAR_GAP = 6;

interface AiAdoptionTrendProps {
  byMonth: CoAuthorMonthEntry[];
}

export function AiAdoptionTrend({ byMonth }: AiAdoptionTrendProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 300 });
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    entry: CoAuthorMonthEntry;
    aiPercent: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (byMonth.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center text-center">
          <p className="max-w-md text-text-tertiary text-xs">
            No co-authored commits in this analysis window.
          </p>
        </div>
        <HeroCaption
          primary="Monthly stacked bars · top layer = AI-assisted commits · bottom = pure-human · linear scale"
          subtitle="The AI Adoption hero shows monthly stacked bars when this codebase emits Co-Authored-By trailers."
        />
      </div>
    );
  }

  const chartHeight = Math.max(
    160,
    dims.height - PADDING.top - PADDING.bottom - 56,
  );
  const chartWidth = Math.max(120, dims.width - PADDING.left - PADDING.right);
  const barWidth = Math.max(
    8,
    (chartWidth - BAR_GAP * (byMonth.length - 1)) / byMonth.length,
  );

  const maxTotal = Math.max(1, ...byMonth.map((m) => m.total));
  const totalAcrossMonths = byMonth.reduce((s, m) => s + m.total, 0);
  const totalAiAcrossMonths = byMonth.reduce((s, m) => s + m.aiAssisted, 0);

  const barFor = (m: CoAuthorMonthEntry, i: number) => {
    const x = PADDING.left + i * (barWidth + BAR_GAP);
    const totalH = (m.total / maxTotal) * chartHeight;
    const humanH = (m.pureHuman / maxTotal) * chartHeight;
    const aiH = (m.aiAssisted / maxTotal) * chartHeight;
    const baseY = PADDING.top + chartHeight;
    const aiPercent =
      m.total > 0 ? Math.round((m.aiAssisted / m.total) * 100) : 0;

    return (
      <g
        key={m.month}
        onMouseEnter={(evt) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setTooltip({
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top,
            entry: m,
            aiPercent,
          });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Hit-test rect spans the full column height so the user can hover
            empty space above a tiny bar and still see the tooltip. */}
        <rect
          x={x}
          y={PADDING.top}
          width={barWidth}
          height={chartHeight}
          fill="transparent"
        />
        <rect
          data-testid="ai-trend-bar-human"
          x={x}
          y={baseY - humanH}
          width={barWidth}
          height={humanH}
          className="fill-surface-tertiary"
        />
        <rect
          data-testid="ai-trend-bar-ai"
          x={x}
          y={baseY - totalH}
          width={barWidth}
          height={aiH}
          className="fill-accent-coupling"
        />
      </g>
    );
  };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <div className="flex-1 relative">
        <svg
          width={dims.width}
          height={dims.height - 56}
          role="img"
          aria-label={`AI adoption trend by month. ${byMonth.length} ${byMonth.length === 1 ? 'month' : 'months'} from ${byMonth[0].month} to ${byMonth[byMonth.length - 1].month}. ${totalAiAcrossMonths} of ${totalAcrossMonths} commits AI-assisted.`}
        >
          {byMonth.map(barFor)}
          {byMonth.length > 0 && (
            <>
              <text
                x={PADDING.left}
                y={PADDING.top + chartHeight + 16}
                fontSize={10}
                fill="var(--text-tertiary)"
                fontFamily="var(--font-mono)"
              >
                {byMonth[0].month}
              </text>
              <text
                x={
                  PADDING.left +
                  (byMonth.length - 1) * (barWidth + BAR_GAP) +
                  barWidth
                }
                y={PADDING.top + chartHeight + 16}
                fontSize={10}
                fill="var(--text-tertiary)"
                fontFamily="var(--font-mono)"
                textAnchor="end"
              >
                {byMonth[byMonth.length - 1].month}
              </text>
            </>
          )}
        </svg>
        {tooltip && (
          <div
            className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20"
            style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
          >
            <div className="font-semibold mb-0.5">{tooltip.entry.month}</div>
            <div className="text-text-secondary">
              <span className="text-accent-coupling">
                AI-assisted {tooltip.entry.aiAssisted}
              </span>
              {' · '}
              <span>pure-human {tooltip.entry.pureHuman}</span>
            </div>
            <div className="text-text-tertiary mt-0.5">
              total {tooltip.entry.total}
              {tooltip.entry.total > 0 && (
                <>
                  {' · '}
                  <span className="font-mono">{tooltip.aiPercent}%</span> AI
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <HeroCaption
        primary="Monthly stacked bars · top layer = AI-assisted commits · bottom = pure-human · linear scale"
        subtitle="When did AI use start in this codebase? Is the ratio growing month over month?"
      />
    </div>
  );
}
