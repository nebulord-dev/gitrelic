import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear, scaleTime } from 'd3-scale';
import { area, stack, stackOrderNone, stackOffsetNone } from 'd3-shape';

import { authorColor } from '../../utils/colors';

import type { GitrelicReport, RawCommit } from '@gitrelic/core';

interface TimelineProps {
  report: GitrelicReport;
  selectedContributor: string | null;
  onSelectContributor: (email: string) => void;
}

export interface WeekBin {
  weekStart: Date;
  counts: Record<string, number>;
}

const PADDING = { top: 20, right: 20, bottom: 30, left: 40 };
const MAX_AUTHORS = 8;

/**
 * Bin commits into weekly buckets grouped by author.
 * Returns week bins and author list sorted by total commits descending.
 */
export function binCommitsByWeek(commits: RawCommit[]): {
  weeks: WeekBin[];
  authors: string[];
} {
  if (commits.length === 0) return { weeks: [], authors: [] };

  // Count commits per author for sorting
  const authorTotals = new Map<string, number>();
  for (const c of commits) {
    authorTotals.set(c.authorEmail, (authorTotals.get(c.authorEmail) ?? 0) + 1);
  }
  const authors = [...authorTotals.entries()].sort((a, b) => b[1] - a[1]).map(([email]) => email);

  // Find date range
  const dates = commits.map((c) => new Date(c.date).getTime());
  const minDate = new Date(dates.reduce((m, d) => (d < m ? d : m), dates[0]));
  const maxDate = new Date(dates.reduce((m, d) => (d > m ? d : m), dates[0]));

  // Align to Monday
  const startMonday = new Date(minDate);
  startMonday.setUTCDate(startMonday.getUTCDate() - ((startMonday.getUTCDay() + 6) % 7));
  startMonday.setUTCHours(0, 0, 0, 0);

  // Build empty bins
  const bins: WeekBin[] = [];
  const cursor = new Date(startMonday);
  while (cursor <= maxDate) {
    const counts: Record<string, number> = {};
    for (const a of authors) counts[a] = 0;
    bins.push({ weekStart: new Date(cursor), counts });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  // Fill bins
  for (const c of commits) {
    const d = new Date(c.date);
    const weekIdx = Math.floor((d.getTime() - startMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weekIdx >= 0 && weekIdx < bins.length) {
      bins[weekIdx].counts[c.authorEmail] = (bins[weekIdx].counts[c.authorEmail] ?? 0) + 1;
    }
  }

  return { weeks: bins, authors };
}

export function Timeline({ report, selectedContributor, onSelectContributor }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { weeks, authors } = useMemo(
    () => binCommitsByWeek(report.commits ?? []),
    [report.commits],
  );

  const displayAuthors = authors.slice(0, MAX_AUTHORS);
  const hasOthers = authors.length > MAX_AUTHORS;
  const stackKeys = useMemo(
    () => (hasOthers ? [...displayAuthors, '__others__'] : displayAuthors),
    [displayAuthors, hasOthers],
  );

  const stackData = useMemo(() => {
    return weeks.map((w) => {
      const row: Record<string, number | Date> = { weekStart: w.weekStart };
      for (const a of displayAuthors) {
        row[a] = w.counts[a] ?? 0;
      }
      if (hasOthers) {
        let othersTotal = 0;
        for (const a of authors.slice(MAX_AUTHORS)) {
          othersTotal += w.counts[a] ?? 0;
        }
        row.__others__ = othersTotal;
      }
      return row;
    });
  }, [weeks, displayAuthors, hasOthers, authors]);

  const plotW = dims.width - PADDING.left - PADDING.right;
  const plotH = dims.height - PADDING.top - PADDING.bottom;

  const xScale = useMemo(() => {
    if (weeks.length === 0) return null;
    return scaleTime()
      .domain([weeks[0].weekStart, weeks[weeks.length - 1].weekStart])
      .range([0, plotW]);
  }, [weeks, plotW]);

  const paths = useMemo(() => {
    if (weeks.length === 0 || !xScale) return [];

    const stacker = stack<Record<string, number | Date>>()
      .keys(stackKeys)
      .order(stackOrderNone)
      .offset(stackOffsetNone);

    const series = stacker(stackData as Record<string, number>[]);

    const maxY = series.reduce((max, s) => s.reduce((m, d) => (d[1] > m ? d[1] : m), max), 1);
    const yScale = scaleLinear().domain([0, maxY]).range([plotH, 0]);

    const areaGen = area<[number, number]>()
      .x((_d, i) => xScale(weeks[i].weekStart))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]));

    return series.map((s) => ({
      key: s.key,
      d: areaGen(s as unknown as [number, number][]) ?? '',
    }));
  }, [weeks, xScale, stackKeys, stackData, plotH]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* X axis line */}
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--border-primary)" />

          {/* Time axis labels */}
          {xScale &&
            xScale.ticks(6).map((date) => {
              const x = xScale(date);
              return (
                <g key={date.toISOString()} transform={`translate(${x},${plotH})`}>
                  <line y2={4} stroke="var(--border-primary)" />
                  <text y={16} textAnchor="middle" fontSize={8} fill="var(--text-tertiary)">
                    {date.toLocaleDateString('en', { month: 'short', year: '2-digit' })}
                  </text>
                </g>
              );
            })}

          {/* Author color legend */}
          {displayAuthors.map((email, i) => (
            <g key={email} transform={`translate(${plotW - 100}, ${i * 14 + 4})`}>
              <rect width={8} height={8} rx={2} fill={authorColor(email)} fillOpacity={0.5} />
              <text x={12} y={7} fontSize={8} fill="var(--text-secondary)">
                {email.split('@')[0]}
              </text>
            </g>
          ))}

          {/* Stacked areas */}
          {paths.map(({ key, d }) => {
            const isSelected = selectedContributor === key;
            const isOthers = key === '__others__';
            const color = isOthers ? 'var(--text-tertiary)' : authorColor(key);
            const dimmed = selectedContributor != null && !isSelected && !isOthers;

            return (
              <path
                key={key}
                d={d}
                fill={color}
                fillOpacity={dimmed ? 0.08 : 0.35}
                stroke={color}
                strokeOpacity={dimmed ? 0.1 : 0.6}
                strokeWidth={isSelected ? 1.5 : 0.5}
                onClick={() => {
                  if (!isOthers) onSelectContributor(key);
                }}
                className={isOthers ? 'cursor-default' : 'cursor-pointer'}
              />
            );
          })}

          {/* Hover vertical line */}
          {hoverWeek != null && xScale && (
            <line
              x1={xScale(weeks[hoverWeek].weekStart)}
              y1={0}
              x2={xScale(weeks[hoverWeek].weekStart)}
              y2={plotH}
              stroke="var(--text-tertiary)"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
          )}

          {/* Mouse tracking overlay — must be last so it's on top */}
          <rect
            x={0}
            y={0}
            width={plotW}
            height={plotH}
            fill="transparent"
            onMouseMove={(e) => {
              if (!xScale) return;
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const mouseX = e.clientX - rect.left - PADDING.left;
              const date = xScale.invert(mouseX);
              const idx = weeks.findIndex((w, i) => {
                const next = weeks[i + 1];
                return !next || date < next.weekStart;
              });
              setHoverWeek(idx >= 0 ? idx : null);
            }}
            onMouseLeave={() => setHoverWeek(null)}
          />
        </g>
      </svg>

      {/* Hover tooltip */}
      {hoverWeek != null && xScale && (
        <div
          className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20"
          style={{ left: PADDING.left + xScale(weeks[hoverWeek].weekStart) + 12, top: PADDING.top }}
        >
          <div className="font-semibold mb-1">
            {weeks[hoverWeek].weekStart.toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
          {stackKeys
            .filter(
              (k) => (weeks[hoverWeek].counts[k] ?? 0) > 0 || (k === '__others__' && hasOthers),
            )
            .map((key) => {
              const count =
                key === '__others__'
                  ? authors
                      .slice(MAX_AUTHORS)
                      .reduce((sum, a) => sum + (weeks[hoverWeek].counts[a] ?? 0), 0)
                  : (weeks[hoverWeek].counts[key] ?? 0);
              if (count === 0) return null;
              return (
                <div key={key} className="flex items-center gap-1 mb-px">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: key === '__others__' ? 'var(--text-tertiary)' : authorColor(key),
                    }}
                  />
                  <span className="text-text-secondary">
                    {key === '__others__' ? 'Others' : key.split('@')[0]}: {count}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
