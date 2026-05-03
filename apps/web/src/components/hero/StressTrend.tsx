import { useEffect, useMemo, useRef, useState } from 'react';

import { HeroCaption } from '../shared/HeroCaption';
import type { GitrelicReport } from '@gitrelic/core';

interface StressTrendProps {
  report: GitrelicReport;
}

const PADDING = { top: 16, right: 24, bottom: 40, left: 56 };
const BAR_GAP = 4;

function formatMonth(iso: string): string {
  const [yearStr, monthStr] = iso.split('-');
  const year = yearStr.slice(2);
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthIdx = parseInt(monthStr, 10) - 1;
  return `${monthNames[monthIdx]} ${year}`;
}

export function StressTrend({ report }: StressTrendProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const months = report.commitTiming.byMonth;
  const maxTotal = useMemo(
    () => months.reduce((m, b) => (b.total > m ? b.total : m), 0),
    [months],
  );

  if (months.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-sm text-text-tertiary">
          No commits in the analyzed window.
        </div>
        <HeroCaption
          primary="Is off-hours pressure trending?"
          subtitle="Bars layered by stress severity per month — red is the worst (weekend + late-night), orange is one criterion, neutral is healthy hours."
        />
      </div>
    );
  }

  const innerWidth = Math.max(dims.width - PADDING.left - PADDING.right, 64);
  const innerHeight = Math.max(
    dims.height - PADDING.top - PADDING.bottom - 80,
    120,
  );
  const barWidth = Math.max(
    (innerWidth - BAR_GAP * (months.length - 1)) / months.length,
    2,
  );
  const yScale = (v: number) => (v / Math.max(maxTotal, 1)) * innerHeight;
  const tickStep = months.length <= 12 ? 1 : Math.ceil(months.length / 12);

  const hoverData = hoverIdx !== null ? months[hoverIdx] : null;

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <div className="flex-1 relative">
        <svg width={dims.width} height={dims.height - 80}>
          {months.map((bucket, i) => {
            const x = PADDING.left + i * (barWidth + BAR_GAP);
            const healthyH = yScale(bucket.healthy);
            const singleH = yScale(bucket.singleCriterion);
            const critH = yScale(bucket.weekendLateNight);
            const baseY = PADDING.top + innerHeight;
            return (
              <g
                key={bucket.month}
                className="stress-trend-bar cursor-default"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                {/* Bottom: weekend + late-night (worst) */}
                <rect
                  className="stress-trend-critical"
                  x={x}
                  y={baseY - critH}
                  width={barWidth}
                  height={critH}
                  fill="var(--severity-critical)"
                />
                {/* Middle: single-criterion */}
                <rect
                  className="stress-trend-warning"
                  x={x}
                  y={baseY - critH - singleH}
                  width={barWidth}
                  height={singleH}
                  fill="var(--severity-warning)"
                />
                {/* Top: healthy */}
                <rect
                  className="stress-trend-healthy"
                  x={x}
                  y={baseY - critH - singleH - healthyH}
                  width={barWidth}
                  height={healthyH}
                  fill="var(--surface-tertiary)"
                />
              </g>
            );
          })}
          {/* Month tick labels */}
          {months
            .filter((_, i) => i % tickStep === 0)
            .map((bucket) => {
              const idx = months.indexOf(bucket);
              const x =
                PADDING.left + idx * (barWidth + BAR_GAP) + barWidth / 2;
              return (
                <text
                  key={bucket.month}
                  x={x}
                  y={PADDING.top + innerHeight + 16}
                  textAnchor="middle"
                  className="text-[10px] fill-text-tertiary"
                >
                  {formatMonth(bucket.month)}
                </text>
              );
            })}
        </svg>
        {hoverData && hoverIdx !== null && (
          <div
            className="absolute pointer-events-none bg-tooltip-bg text-tooltip-text text-[11px] px-2 py-1 rounded shadow-lg"
            style={{
              left:
                PADDING.left + hoverIdx * (barWidth + BAR_GAP) + barWidth + 6,
              top: PADDING.top + 8,
            }}
          >
            <div className="font-mono">{formatMonth(hoverData.month)}</div>
            <div className="text-text-tertiary">
              <span className="font-mono text-text-primary font-semibold">
                {hoverData.total}
              </span>{' '}
              commits
            </div>
            <div className="text-text-tertiary mt-1">
              <span className="font-mono text-severity-critical">
                {hoverData.weekendLateNight}
              </span>{' '}
              weekend-late-night ·{' '}
              <span className="font-mono text-severity-warning">
                {hoverData.singleCriterion}
              </span>{' '}
              single-criterion ·{' '}
              <span className="font-mono text-text-primary">
                {hoverData.healthy}
              </span>{' '}
              healthy
            </div>
          </div>
        )}
      </div>
      <HeroCaption
        primary="Is off-hours pressure trending?"
        subtitle="Bars layered by stress severity per month — red is the worst (weekend + late-night), orange is one criterion, neutral is healthy hours."
      />
    </div>
  );
}
