import { useEffect, useMemo, useRef, useState } from 'react';

import type { GitrelicReport } from '@gitrelic/core';

export type ShameSeverity = 'critical' | 'warning' | 'low';

export interface ShameBarEntry {
  file: string;
  name: string;
  score: number;
  shameCommitCount: number;
  topKeyword: string | null;
  severity: ShameSeverity;
}

function classifySeverity(score: number): ShameSeverity {
  if (score >= 70) return 'critical';
  if (score >= 40) return 'warning';
  return 'low';
}

export function prepareShameData(report: GitrelicReport): ShameBarEntry[] {
  return report.forensics.shameLeaderboard.map((f) => {
    const basename = f.file.split('/').pop();
    return {
      file: f.file,
      name: basename && basename.length > 0 ? basename : f.file,
      score: f.shameScore,
      shameCommitCount: f.shameCommitCount,
      topKeyword: f.dominantKeywords[0] ?? null,
      severity: classifySeverity(f.shameScore),
    };
  });
}

function severityColor(severity: ShameSeverity): string {
  switch (severity) {
    case 'critical':
      return 'var(--severity-critical)';
    case 'warning':
      return 'var(--severity-warning)';
    default:
      return 'var(--severity-healthy)';
  }
}

interface ShameLeaderboardProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export function ShameLeaderboard({ report, selectedFile, onSelectFile }: ShameLeaderboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; entry: ShameBarEntry } | null>(
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

  const entries = useMemo(() => prepareShameData(report), [report]);

  if (entries.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 12,
        }}
      >
        No shame signals detected.
      </div>
    );
  }

  const labelWidth = 180;
  const rightPad = 70;
  const topPad = 16;
  const bottomPad = 16;
  const available = Math.max(120, dims.width - labelWidth - rightPad);
  const rowHeight = Math.max(20, (dims.height - topPad - bottomPad) / Math.max(entries.length, 1));
  const barHeight = Math.max(10, rowHeight - 6);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        {entries.map((e, i) => {
          const y = topPad + i * rowHeight;
          const barWidth = Math.max(2, (e.score / 100) * available);
          const isSelected = selectedFile === e.file;
          const color = severityColor(e.severity);

          return (
            <g
              key={e.file}
              onClick={() => onSelectFile(e.file)}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(evt) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                setTooltip({
                  x: evt.clientX - rect.left,
                  y: evt.clientY - rect.top,
                  entry: e,
                });
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
                {e.name}
              </text>
              <rect
                x={labelWidth}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={2}
                fill={color}
                fillOpacity={isSelected ? 0.9 : 0.7}
                stroke={isSelected ? 'var(--accent-primary)' : 'transparent'}
                strokeWidth={isSelected ? 1 : 0}
              />
              {e.topKeyword && barWidth > 60 && (
                <text
                  x={labelWidth + 6}
                  y={y + barHeight / 2}
                  dominantBaseline="middle"
                  fontSize={9}
                  fill="rgba(255,255,255,0.8)"
                  style={{ pointerEvents: 'none' }}
                >
                  {e.topKeyword}
                </text>
              )}
              <text
                x={labelWidth + barWidth + 6}
                y={y + barHeight / 2}
                dominantBaseline="middle"
                fontSize={10}
                fontFamily="var(--font-mono)"
                fill={color}
                fontWeight={600}
                style={{ pointerEvents: 'none' }}
              >
                {e.score}
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
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.entry.file}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Shame {tooltip.entry.score} · {tooltip.entry.shameCommitCount} shame commit
            {tooltip.entry.shameCommitCount !== 1 ? 's' : ''}
          </div>
          {tooltip.entry.topKeyword && (
            <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
              Top keyword: {tooltip.entry.topKeyword}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
