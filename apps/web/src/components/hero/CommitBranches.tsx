import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleTime } from 'd3-scale';

import { authorColor } from '../../utils/colors';

import type { RawCommit } from '@gitlore/core';

interface CommitBranchesProps {
  commits: RawCommit[];
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const LANE_HEIGHT = 28;
const LABEL_WIDTH = 120;
const DOT_RADIUS = 3;

export function CommitBranches({ commits, selectedFile, onSelectFile }: CommitBranchesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; commit: RawCommit } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { lanes, xScale } = useMemo(() => {
    if (commits.length === 0) return { lanes: [], xScale: scaleTime().range([0, 1]) };

    const byAuthor = new Map<string, RawCommit[]>();
    for (const c of commits) {
      const arr = byAuthor.get(c.authorEmail) ?? [];
      arr.push(c);
      byAuthor.set(c.authorEmail, arr);
    }

    const sorted = [...byAuthor.entries()].sort((a, b) => b[1].length - a[1].length);
    const dates = commits.map((c) => new Date(c.date).getTime());
    const xScale = scaleTime()
      .domain([new Date(Math.min(...dates)), new Date(Math.max(...dates))])
      .range([0, width - LABEL_WIDTH]);

    return {
      lanes: sorted.map(([email, authorCommits]) => ({
        email,
        name: email.split('@')[0],
        commits: authorCommits.sort((a, b) => a.date.localeCompare(b.date)),
      })),
      xScale,
    };
  }, [commits, width]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'auto', position: 'relative' }}
    >
      {/* Time axis */}
      <div style={{ display: 'flex', height: 20, marginBottom: 4 }}>
        <div style={{ width: LABEL_WIDTH, flexShrink: 0 }} />
        <svg style={{ flex: 1 }} height={20}>
          {lanes.length > 0 &&
            xScale.ticks(6).map((date) => (
              <text
                key={date.toISOString()}
                x={xScale(date)}
                y={14}
                textAnchor="middle"
                fontSize={8}
                fill="var(--text-tertiary)"
              >
                {date.toLocaleDateString('en', { month: 'short', year: '2-digit' })}
              </text>
            ))}
        </svg>
      </div>
      {lanes.map((lane) => {
        const color = authorColor(lane.email);
        return (
          <div key={lane.email} style={{ display: 'flex', height: LANE_HEIGHT, marginBottom: 2 }}>
            <div
              style={{
                width: LABEL_WIDTH,
                flexShrink: 0,
                fontSize: 10,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                paddingRight: 8,
              }}
            >
              {lane.name}
            </div>
            <svg style={{ flex: 1 }} height={LANE_HEIGHT}>
              <line
                x1={0}
                y1={LANE_HEIGHT / 2}
                x2={width - LABEL_WIDTH}
                y2={LANE_HEIGHT / 2}
                stroke={color}
                strokeOpacity={0.1}
                strokeWidth={1}
              />
              {lane.commits.map((c) => {
                const cx = xScale(new Date(c.date));
                const topFile = c.files[0] ?? null;
                const isSelected = topFile != null && selectedFile === topFile;
                return (
                  <circle
                    key={c.hash}
                    cx={cx}
                    cy={LANE_HEIGHT / 2}
                    r={DOT_RADIUS}
                    fill={color}
                    fillOpacity={0.7}
                    stroke={isSelected ? 'var(--accent-primary)' : 'none'}
                    strokeWidth={isSelected ? 2 : 0}
                    onClick={() => {
                      if (topFile) onSelectFile(topFile);
                    }}
                    style={{ cursor: topFile ? 'pointer' : 'default' }}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      if (rect) {
                        setTooltip({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                          commit: c,
                        });
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </svg>
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
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.commit.message}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {tooltip.commit.date.slice(0, 10)} · {tooltip.commit.files.length} files · +
            {tooltip.commit.insertions}/-{tooltip.commit.deletions}
          </div>
        </div>
      )}
    </div>
  );
}
