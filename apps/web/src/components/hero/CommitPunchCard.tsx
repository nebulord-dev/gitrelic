import { useEffect, useMemo, useRef, useState } from 'react';

import { HeroCaption } from '../shared/HeroCaption';
import type { GitrelicReport } from '@gitrelic/core';

interface CommitPunchCardProps {
  report: GitrelicReport;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Mirrors core's isLateNight() — kept literal here because web only `import type` from @gitrelic/core.
const LATE_NIGHT_HOURS = new Set([23, 0, 1, 2, 3, 4]);
const WEEKEND_DAYS = new Set([0, 6]); // Sun, Sat

const PADDING = { top: 12, right: 16, bottom: 32, left: 48 };
const HOUR_TICK_STEP = 3; // label every 3 hours

function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

export function CommitPunchCard({ report }: CommitPunchCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [hover, setHover] = useState<{ day: number; hour: number } | null>(
    null,
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const matrix = report.commitTiming.repoHourDayMatrix;

  const total = useMemo(() => {
    let sum = 0;
    for (const row of matrix) for (const c of row) sum += c;
    return sum;
  }, [matrix]);

  const maxCount = useMemo(() => {
    let m = 0;
    for (const row of matrix) for (const c of row) if (c > m) m = c;
    return m;
  }, [matrix]);

  if (total === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-sm text-text-tertiary">
          No commits in the analyzed window.
        </div>
        <HeroCaption
          primary="When this team works."
          subtitle="Cells are commit counts (log-scaled). Shaded rows mark weekends; shaded columns mark late-night hours."
        />
      </div>
    );
  }

  // Log scale opacity: opacity(count) = log(count + 1) / log(max + 1)
  // Count 0 → 0; count = max → 1.
  const logMax = Math.log(maxCount + 1);
  const opacityFor = (count: number): number =>
    count === 0 ? 0 : Math.log(count + 1) / logMax;

  const innerWidth = Math.max(dims.width - PADDING.left - PADDING.right, 24);
  const innerHeight = Math.max(
    dims.height - PADDING.top - PADDING.bottom - 80,
    100,
  );
  const cellWidth = innerWidth / 24;
  const cellHeight = innerHeight / 7;

  const hoverData = hover ? matrix[hover.day][hover.hour] : null;
  const hoverPercent =
    hover && hoverData !== null && total > 0
      ? Math.round((hoverData / total) * 1000) / 10
      : 0;

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <div className="flex-1 relative">
        <svg
          width={dims.width}
          height={dims.height - 80}
          role="img"
          aria-label={`Commit punch card heatmap: 7 days × 24 hours. ${total} ${total === 1 ? 'commit' : 'commits'} total. Stress zones (weekend rows + late-night columns 11pm–4am) shaded.`}
        >
          {/* Stress-zone shading: weekend rows (Sun=0, Sat=6) */}
          {Array.from(WEEKEND_DAYS).map((day) => (
            <rect
              key={`wknd-${day}`}
              className="punch-card-stress-zone"
              x={PADDING.left}
              y={PADDING.top + day * cellHeight}
              width={innerWidth}
              height={cellHeight}
              fill="var(--severity-warning)"
              fillOpacity={0.08}
            />
          ))}
          {/* Stress-zone shading: late-night cols (23, 0, 1, 2, 3, 4) */}
          {Array.from(LATE_NIGHT_HOURS).map((hour) => (
            <rect
              key={`late-${hour}`}
              className="punch-card-stress-zone"
              x={PADDING.left + hour * cellWidth}
              y={PADDING.top}
              width={cellWidth}
              height={innerHeight}
              fill="var(--severity-warning)"
              fillOpacity={0.08}
            />
          ))}
          {/* Cells */}
          {matrix.map((row, day) =>
            row.map((count, hour) => (
              <rect
                key={`${day}-${hour}`}
                className="punch-card-cell cursor-default"
                data-day={day}
                data-hour={hour}
                x={PADDING.left + hour * cellWidth + 1}
                y={PADDING.top + day * cellHeight + 1}
                width={Math.max(cellWidth - 2, 1)}
                height={Math.max(cellHeight - 2, 1)}
                rx={2}
                fill="var(--accent-primary)"
                fillOpacity={opacityFor(count)}
                stroke={
                  hover?.day === day && hover.hour === hour
                    ? 'var(--text-primary)'
                    : 'none'
                }
                strokeWidth={1}
                onMouseEnter={() => setHover({ day, hour })}
                onMouseLeave={() => setHover(null)}
              />
            )),
          )}
          {/* Day labels (left) */}
          {DAY_LABELS.map((label, day) => (
            <text
              key={`day-${day}`}
              x={PADDING.left - 8}
              y={PADDING.top + day * cellHeight + cellHeight / 2 + 4}
              textAnchor="end"
              className="text-[10px] fill-text-tertiary"
            >
              {label}
            </text>
          ))}
          {/* Hour labels (bottom, every 3 hours) */}
          {Array.from({ length: 24 }, (_, h) => h)
            .filter((h) => h % HOUR_TICK_STEP === 0)
            .map((hour) => (
              <text
                key={`hour-${hour}`}
                x={PADDING.left + hour * cellWidth + cellWidth / 2}
                y={PADDING.top + innerHeight + 16}
                textAnchor="middle"
                className="text-[10px] fill-text-tertiary"
              >
                {formatHour(hour)}
              </text>
            ))}
        </svg>
        {hover && hoverData !== null && (
          <div
            className="absolute pointer-events-none bg-tooltip-bg text-tooltip-text text-[11px] px-2 py-1 rounded shadow-lg"
            style={{
              left:
                hover.hour >= 20
                  ? PADDING.left + hover.hour * cellWidth - 4
                  : PADDING.left + hover.hour * cellWidth + cellWidth + 4,
              top: PADDING.top + hover.day * cellHeight,
              transform: hover.hour >= 20 ? 'translateX(-100%)' : undefined,
            }}
          >
            <div className="font-mono">
              {DAY_LABELS[hover.day]} {formatHour(hover.hour)}
            </div>
            <div className="text-text-tertiary">
              <span className="font-mono text-text-primary font-semibold">
                {hoverData}
              </span>{' '}
              commits ({hoverPercent}%)
            </div>
          </div>
        )}
      </div>
      <HeroCaption
        primary="When this team works."
        subtitle="Cells are commit counts (log-scaled). Shaded rows mark weekends; shaded columns mark late-night hours."
      />
    </div>
  );
}
