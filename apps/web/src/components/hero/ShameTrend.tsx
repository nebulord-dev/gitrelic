import { useEffect, useRef, useState } from 'react';

import { HeroCaption } from '../shared/HeroCaption';

import type { GitrelicReport, ShameByMonth } from '@gitrelic/core';

const TIER_COLORS = {
  critical: 'var(--severity-critical)',
  moderate: 'var(--severity-warning)',
  mild: '#9b8b3e', // muted yellow — distinct from --severity-healthy (green)
} as const;

interface ShameTrendProps {
  report: GitrelicReport;
}

export function ShameTrend({ report }: ShameTrendProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 300 });
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    month: ShameByMonth;
    total: number;
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

  const months = report.forensics.byMonth;

  if (months.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
          No shame commits in the analysis window.
        </div>
        <HeroCaption
          primary="One bar per month · stack = commit count by tier · color = severity"
          subtitle="Try a longer commit history or a different branch."
        />
      </div>
    );
  }

  const padding = { top: 16, right: 24, bottom: 28, left: 32 };
  const chartHeight = Math.max(160, dims.height - padding.top - padding.bottom - 56);
  const chartWidth = Math.max(120, dims.width - padding.left - padding.right);
  const barGap = 6;
  const barWidth = Math.max(8, (chartWidth - barGap * (months.length - 1)) / months.length);

  const maxTotal = Math.max(1, ...months.map((m) => m.critical + m.moderate + m.mild));
  const totalAcrossMonths = months.reduce((s, m) => s + m.critical + m.moderate + m.mild, 0);

  const barFor = (m: ShameByMonth, i: number) => {
    const x = padding.left + i * (barWidth + barGap);
    const total = m.critical + m.moderate + m.mild;
    const totalH = (total / maxTotal) * chartHeight;
    const mildH = (m.mild / maxTotal) * chartHeight;
    const moderateH = (m.moderate / maxTotal) * chartHeight;
    const criticalH = (m.critical / maxTotal) * chartHeight;
    const baseY = padding.top + chartHeight;

    return (
      <g
        key={m.month}
        onMouseEnter={(evt) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setTooltip({
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top,
            month: m,
            total,
          });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <rect
          data-tier="mild"
          x={x}
          y={baseY - mildH}
          width={barWidth}
          height={mildH}
          fill={TIER_COLORS.mild}
          opacity={0.85}
        />
        <rect
          data-tier="moderate"
          x={x}
          y={baseY - mildH - moderateH}
          width={barWidth}
          height={moderateH}
          fill={TIER_COLORS.moderate}
          opacity={0.85}
        />
        <rect
          data-tier="critical"
          x={x}
          y={baseY - totalH}
          width={barWidth}
          height={criticalH}
          fill={TIER_COLORS.critical}
          opacity={0.95}
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
          aria-label={`Shame commit trend by month. ${months.length} ${months.length === 1 ? 'month' : 'months'} from ${months[0].month} to ${months[months.length - 1].month}. ${totalAcrossMonths} total shame ${totalAcrossMonths === 1 ? 'commit' : 'commits'}.`}
        >
          {months.map(barFor)}
          {months.length > 0 && (
            <>
              <text
                x={padding.left}
                y={padding.top + chartHeight + 16}
                fontSize={10}
                fill="var(--text-tertiary)"
                fontFamily="var(--font-mono)"
              >
                {months[0].month}
              </text>
              <text
                x={padding.left + (months.length - 1) * (barWidth + barGap) + barWidth}
                y={padding.top + chartHeight + 16}
                fontSize={10}
                fill="var(--text-tertiary)"
                fontFamily="var(--font-mono)"
                textAnchor="end"
              >
                {months[months.length - 1].month}
              </text>
            </>
          )}
        </svg>
        {tooltip && (
          <div
            className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20"
            style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
          >
            <div className="font-semibold mb-0.5">{tooltip.month.month}</div>
            <div className="text-text-secondary">
              <span style={{ color: TIER_COLORS.critical }}>critical {tooltip.month.critical}</span>
              {' · '}
              <span style={{ color: TIER_COLORS.moderate }}>moderate {tooltip.month.moderate}</span>
              {' · '}
              <span style={{ color: TIER_COLORS.mild }}>mild {tooltip.month.mild}</span>
            </div>
            <div className="text-text-tertiary mt-0.5">total {tooltip.total}</div>
          </div>
        )}
      </div>
      <HeroCaption
        primary="One bar per month · stack = commit count by tier · color = severity"
        subtitle="Is shame trending up — and is the severity mix shifting toward worse tiers?"
      />
    </div>
  );
}
