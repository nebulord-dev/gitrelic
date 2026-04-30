import { useEffect, useMemo, useRef, useState } from 'react';

import { HeroCaption } from '../shared/HeroCaption';

import type { GitrelicReport } from '@gitrelic/core';

export interface RewriteRow {
  file: string;
  name: string;
  rewriteScore: number;
  totalInsertions: number;
  totalDeletions: number;
  ratio: number;
}

export interface RewriteData {
  rows: RewriteRow[];
  maxAbs: number;
}

export function prepareRewriteData(report: GitrelicReport, topN = 30): RewriteData {
  const rows: RewriteRow[] = [...report.rewriteRatio.files]
    .sort((a, b) => b.rewriteScore - a.rewriteScore)
    .slice(0, topN)
    .map((f) => {
      const basename = f.file.split('/').pop();
      return {
        file: f.file,
        name: basename && basename.length > 0 ? basename : f.file,
        rewriteScore: f.rewriteScore,
        totalInsertions: f.totalInsertions,
        totalDeletions: f.totalDeletions,
        ratio: f.ratio,
      };
    });

  let maxAbs = 0;
  for (const r of rows) {
    if (r.totalInsertions > maxAbs) maxAbs = r.totalInsertions;
    if (r.totalDeletions > maxAbs) maxAbs = r.totalDeletions;
  }

  return { rows, maxAbs };
}

interface RewriteDivergingBarProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const CAPTION_PRIMARY =
  'Top 30 by rewrite score · bar length = lines added/removed · score on right';
const CAPTION_SUBTITLE =
  "Which files keep getting rewritten? Balanced ins/del = code that doesn't stick.";

export function RewriteDivergingBar({
  report,
  selectedFile,
  onSelectFile,
}: RewriteDivergingBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; row: RewriteRow } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { rows, maxAbs } = useMemo(() => prepareRewriteData(report), [report]);

  if (rows.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 12,
          }}
        >
          No rewrite activity detected.
        </div>
        <HeroCaption primary={CAPTION_PRIMARY} subtitle={CAPTION_SUBTITLE} />
      </div>
    );
  }

  const labelWidth = 220;
  const rightPad = 60;
  const topPad = 28;
  const bottomPad = 16;
  const available = Math.max(120, dims.width - labelWidth - rightPad);
  const halfBar = available / 2;
  const centerX = labelWidth + halfBar;
  const rowHeight = Math.max(20, (dims.height - topPad - bottomPad) / Math.max(rows.length, 1));
  const barHeight = Math.max(10, rowHeight - 6);
  const insertionColor = 'var(--severity-healthy)';
  const deletionColor = 'var(--severity-critical)';

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flex: 1, position: 'relative' }}>
        <svg width={dims.width} height={dims.height}>
          {/* Header axis labels */}
          <text
            x={labelWidth + halfBar / 2}
            y={topPad - 12}
            textAnchor="middle"
            fontSize={9}
            fill={deletionColor}
            fontWeight={600}
          >
            deletions
          </text>
          <text
            x={labelWidth + halfBar + halfBar / 2}
            y={topPad - 12}
            textAnchor="middle"
            fontSize={9}
            fill={insertionColor}
            fontWeight={600}
          >
            insertions
          </text>
          {/* Center axis */}
          <line
            x1={centerX}
            y1={topPad - 6}
            x2={centerX}
            y2={topPad + rows.length * rowHeight}
            stroke="var(--border-primary)"
            strokeWidth={1}
          />

          {rows.map((row, i) => {
            const y = topPad + i * rowHeight;
            const insWidth = maxAbs > 0 ? (row.totalInsertions / maxAbs) * halfBar : 0;
            const delWidth = maxAbs > 0 ? (row.totalDeletions / maxAbs) * halfBar : 0;
            const isSelected = selectedFile === row.file;

            return (
              <g
                key={row.file}
                onClick={() => onSelectFile(row.file)}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(evt) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({ x: evt.clientX - rect.left, y: evt.clientY - rect.top, row });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <text
                  x={labelWidth - 8}
                  y={y + barHeight / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill={isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)'}
                >
                  {row.name}
                </text>
                {/* Deletion bar — extends left of center */}
                <rect
                  x={centerX - delWidth}
                  y={y}
                  width={delWidth}
                  height={barHeight}
                  rx={2}
                  fill={deletionColor}
                  fillOpacity={isSelected ? 0.9 : 0.7}
                  stroke={isSelected ? 'var(--accent-primary)' : 'transparent'}
                  strokeWidth={isSelected ? 1 : 0}
                />
                {/* Insertion bar — extends right of center */}
                <rect
                  x={centerX}
                  y={y}
                  width={insWidth}
                  height={barHeight}
                  rx={2}
                  fill={insertionColor}
                  fillOpacity={isSelected ? 0.9 : 0.7}
                  stroke={isSelected ? 'var(--accent-primary)' : 'transparent'}
                  strokeWidth={isSelected ? 1 : 0}
                />
                {/* Right-side rewrite score */}
                <text
                  x={labelWidth + available + 6}
                  y={y + barHeight / 2}
                  dominantBaseline="middle"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill="var(--text-secondary)"
                  fontWeight={600}
                  style={{ pointerEvents: 'none' }}
                >
                  {row.rewriteScore}
                </text>
              </g>
            );
          })}
        </svg>
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
              maxWidth: 320,
              wordBreak: 'break-all',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.row.file}</div>
            <div style={{ color: insertionColor }}>+{tooltip.row.totalInsertions} insertions</div>
            <div style={{ color: deletionColor }}>−{tooltip.row.totalDeletions} deletions</div>
            <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
              Rewrite score {tooltip.row.rewriteScore} · ratio {tooltip.row.ratio.toFixed(2)}
            </div>
          </div>
        )}
      </div>
      <HeroCaption primary={CAPTION_PRIMARY} subtitle={CAPTION_SUBTITLE} />
    </div>
  );
}
