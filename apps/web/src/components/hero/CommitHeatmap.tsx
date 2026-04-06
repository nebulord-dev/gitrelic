import { useEffect, useMemo, useRef, useState } from 'react';

import { authorColor } from '../../utils/colors';

import type { RawCommit } from '@gitlore/core';

interface CommitHeatmapProps {
  commits: RawCommit[];
}

const ROW_HEIGHT = 24;
const CELL_GAP = 2;
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
  const authors = [...authorTotals.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e);
  const authorIdx = new Map(authors.map((a, i) => [a, i]));

  const dates = commits.map((c) => new Date(c.date).getTime());
  const minDate = new Date(dates.reduce((m, d) => (d < m ? d : m), dates[0]));
  const maxDate = new Date(dates.reduce((m, d) => (d > m ? d : m), dates[0]));
  const startMonday = new Date(minDate);
  startMonday.setUTCDate(startMonday.getUTCDate() - ((startMonday.getUTCDay() + 6) % 7));
  startMonday.setUTCHours(0, 0, 0, 0);

  const totalWeeks = Math.ceil((maxDate.getTime() - startMonday.getTime()) / (7 * 86_400_000)) + 1;
  const weeks: Date[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    weeks.push(new Date(startMonday.getTime() + i * 7 * 86_400_000));
  }

  const grid = Array.from({ length: authors.length }, () => new Array(totalWeeks).fill(0));

  for (const c of commits) {
    const ai = authorIdx.get(c.authorEmail);
    if (ai == null) continue;
    const wi = Math.floor((new Date(c.date).getTime() - startMonday.getTime()) / (7 * 86_400_000));
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

  const { grid, authors, weeks } = useMemo(() => binCommitsForHeatmap(commits), [commits]);
  const maxCount = grid.reduce((max, row) => row.reduce((m, v) => (v > m ? v : m), max), 1);
  const cellW = Math.max((width - LABEL_WIDTH) / (weeks.length || 1), 2);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'auto', position: 'relative' }}
    >
      {authors.map((email, ai) => {
        const color = authorColor(email);
        const name = email.split('@')[0];
        return (
          <div key={email} style={{ display: 'flex', height: ROW_HEIGHT, marginBottom: CELL_GAP }}>
            <div
              style={{
                width: LABEL_WIDTH,
                flexShrink: 0,
                fontSize: 10,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                paddingRight: 8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </div>
            <div style={{ display: 'flex', flex: 1, gap: 1 }}>
              {grid[ai].map((count, wi) => (
                <div
                  key={wi}
                  style={{
                    width: cellW,
                    height: '100%',
                    background: color,
                    opacity: count === 0 ? 0.04 : 0.15 + (count / maxCount) * 0.7,
                    borderRadius: 2,
                    cursor: count > 0 ? 'pointer' : 'default',
                  }}
                  onMouseEnter={
                    count > 0
                      ? (e) => {
                          const rect = containerRef.current?.getBoundingClientRect();
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
          style={{
            position: 'absolute',
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 4,
            padding: '6px 10px',
            fontSize: 10,
            color: 'var(--text-primary)',
            pointerEvents: 'none',
            zIndex: 20,
            maxWidth: 300,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.email}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {tooltip.count} commits · week of {tooltip.week.toISOString().slice(0, 10)}
          </div>
        </div>
      )}
    </div>
  );
}
