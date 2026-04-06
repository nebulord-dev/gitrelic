import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear, scaleTime } from 'd3-scale';
import { area, stack, stackOrderNone, stackOffsetNone } from 'd3-shape';

import { authorColor } from '../../utils/colors';

import type { GitloreReport, RawCommit } from '@gitlore/core';

interface TimelineProps {
  report: GitloreReport;
  selectedFile: string | null;
  selectedContributor: string | null;
  onSelectFile: (file: string) => void;
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
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

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
  const stackKeys = hasOthers ? [...displayAuthors, '__others__'] : displayAuthors;

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

  const paths = useMemo(() => {
    if (weeks.length === 0) return [];

    const xScale = scaleTime()
      .domain([weeks[0].weekStart, weeks[weeks.length - 1].weekStart])
      .range([0, plotW]);

    const stacker = stack<Record<string, number | Date>>()
      .keys(stackKeys)
      .order(stackOrderNone)
      .offset(stackOffsetNone);

    const series = stacker(stackData as Record<string, number>[]);

    const maxY = Math.max(...series.flatMap((s) => s.map((d) => d[1])), 1);
    const yScale = scaleLinear().domain([0, maxY]).range([plotH, 0]);

    const areaGen = area<[number, number]>()
      .x((_d, i) => xScale(weeks[i].weekStart))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]));

    return series.map((s) => ({
      key: s.key,
      d: areaGen(s as unknown as [number, number][]) ?? '',
    }));
  }, [weeks, stackKeys, stackData, plotW, plotH]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* X axis line */}
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--border-primary)" />

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
                style={{ cursor: isOthers ? 'default' : 'pointer' }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
