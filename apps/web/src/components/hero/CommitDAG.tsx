import { useEffect, useMemo, useRef, useState } from 'react';

import { authorColor } from '../../utils/colors';

import type { RawCommit } from '@gitlore/core';

interface CommitDAGProps {
  commits: RawCommit[];
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const MAX_COMMITS = 200;
const NODE_RADIUS = 5;
const ROW_HEIGHT = 20;
const PADDING_LEFT = 40;

export function CommitDAG({ commits, selectedFile, onSelectFile }: CommitDAGProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const displayed = useMemo(() => {
    const sorted = [...commits].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.slice(0, MAX_COMMITS);
  }, [commits]);

  const totalHeight = displayed.length * ROW_HEIGHT + 40;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <svg width={width} height={totalHeight}>
        <line
          x1={PADDING_LEFT}
          y1={10}
          x2={PADDING_LEFT}
          y2={totalHeight - 10}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />

        {displayed.map((commit, i) => {
          const y = 20 + i * ROW_HEIGHT;
          const color = authorColor(commit.authorEmail);
          const topFile = commit.files[0] ?? null;
          const isSelected = topFile != null && selectedFile === topFile;

          return (
            <g
              key={commit.hash}
              onClick={() => {
                if (topFile) onSelectFile(topFile);
              }}
              style={{ cursor: topFile ? 'pointer' : 'default' }}
            >
              {i < displayed.length - 1 && (
                <line
                  x1={PADDING_LEFT}
                  y1={y + NODE_RADIUS}
                  x2={PADDING_LEFT}
                  y2={y + ROW_HEIGHT - NODE_RADIUS}
                  stroke={color}
                  strokeOpacity={0.2}
                  strokeWidth={1}
                />
              )}

              <circle
                cx={PADDING_LEFT}
                cy={y}
                r={NODE_RADIUS}
                fill={color}
                fillOpacity={0.7}
                stroke={isSelected ? 'var(--accent-primary)' : color}
                strokeWidth={isSelected ? 2 : 1}
              />

              <text
                x={PADDING_LEFT + 16}
                y={y + 1}
                dominantBaseline="central"
                fontSize={10}
                fill="var(--text-secondary)"
              >
                {commit.message.length > 60 ? `${commit.message.slice(0, 57)}...` : commit.message}
              </text>

              <text
                x={width - 10}
                y={y + 1}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={9}
                fill="var(--text-tertiary)"
              >
                {commit.date.slice(0, 10)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
