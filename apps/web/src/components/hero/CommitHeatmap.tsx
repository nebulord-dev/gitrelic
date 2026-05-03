import { useEffect, useMemo, useRef, useState } from 'react';

import { authorColor } from '../../utils/colors';

import type { RawCommit } from '@gitrelic/core';

interface CommitHeatmapProps {
  commits: RawCommit[];
}

const LABEL_WIDTH = 120;
const MAX_AUTHORS = 15;

export interface HeatmapData {
  grid: number[][];
  authors: string[];
  weeks: Date[];
}

export function binCommitsForHeatmap(commits: RawCommit[]): HeatmapData {
  if (commits.length === 0) return { grid: [], authors: [], weeks: [] };

  const authorTotals = new Map<string, number>();
  for (const c of commits) {
    authorTotals.set(c.authorEmail, (authorTotals.get(c.authorEmail) ?? 0) + 1);
  }
  const authors = [...authorTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([e]) => e);
  const authorIdx = new Map(authors.map((a, i) => [a, i]));

  const dates = commits.map((c) => new Date(c.date).getTime());
  const minDate = new Date(dates.reduce((m, d) => (d < m ? d : m), dates[0]));
  const maxDate = new Date(dates.reduce((m, d) => (d > m ? d : m), dates[0]));
  const startMonday = new Date(minDate);
  startMonday.setUTCDate(
    startMonday.getUTCDate() - ((startMonday.getUTCDay() + 6) % 7),
  );
  startMonday.setUTCHours(0, 0, 0, 0);

  const totalWeeks =
    Math.ceil((maxDate.getTime() - startMonday.getTime()) / (7 * 86_400_000)) +
    1;
  const weeks: Date[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    weeks.push(new Date(startMonday.getTime() + i * 7 * 86_400_000));
  }

  const grid = Array.from({ length: authors.length }, () =>
    new Array(totalWeeks).fill(0),
  );

  for (const c of commits) {
    const ai = authorIdx.get(c.authorEmail);
    if (ai == null) continue;
    const wi = Math.floor(
      (new Date(c.date).getTime() - startMonday.getTime()) / (7 * 86_400_000),
    );
    if (wi >= 0 && wi < totalWeeks) grid[ai][wi]++;
  }

  return {
    grid: grid.slice(0, MAX_AUTHORS),
    authors: authors.slice(0, MAX_AUTHORS),
    weeks,
  };
}

export function CommitHeatmap({ commits }: CommitHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    email: string;
    count: number;
    week: Date;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { grid, authors, weeks } = useMemo(
    () => binCommitsForHeatmap(commits),
    [commits],
  );
  const maxCount = grid.reduce(
    (max, row) => row.reduce((m, v) => (v > m ? v : m), max),
    1,
  );
  const cellW = Math.max((width - LABEL_WIDTH) / (weeks.length || 1), 2);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-auto">
      {authors.map((email, ai) => {
        const color = authorColor(email);
        const name = email.split('@')[0];
        return (
          <div key={email} className="flex h-6 mb-0.5">
            <div className="shrink-0 w-[120px] text-[10px] text-text-secondary flex items-center pr-2 overflow-hidden text-ellipsis whitespace-nowrap">
              {name}
            </div>
            <div className="flex flex-1 gap-px">
              {grid[ai].map((count, wi) => (
                <div
                  key={wi}
                  className={`h-full rounded-xs ${count > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                  style={{
                    width: cellW,
                    background: color,
                    opacity:
                      count === 0 ? 0.04 : 0.15 + (count / maxCount) * 0.7,
                  }}
                  onMouseEnter={
                    count > 0
                      ? (e) => {
                          const rect =
                            containerRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          setTooltip({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                            email,
                            count,
                            week: weeks[wi],
                          });
                        }
                      : undefined
                  }
                  onMouseLeave={count > 0 ? () => setTooltip(null) : undefined}
                />
              ))}
            </div>
          </div>
        );
      })}
      {tooltip && (
        <div
          className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20 max-w-[300px]"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <div className="font-semibold mb-0.5">{tooltip.email}</div>
          <div className="text-text-secondary">
            {tooltip.count} commits · week of{' '}
            {tooltip.week.toISOString().slice(0, 10)}
          </div>
        </div>
      )}
    </div>
  );
}
