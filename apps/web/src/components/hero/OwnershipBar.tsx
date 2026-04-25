import { useEffect, useMemo, useRef, useState } from 'react';

import type { BusFactorRisk, GitrelicReport } from '@gitrelic/core';

export interface OwnershipBarRow {
  file: string;
  name: string;
  dominantAuthor: string;
  dominantAuthorName: string;
  dominantAuthorPercent: number;
  risk: BusFactorRisk;
}

export function prepareOwnershipBarData(report: GitrelicReport, topN = 30): OwnershipBarRow[] {
  return [...report.busFactors.criticalFiles]
    .sort((a, b) => b.dominantAuthorPercent - a.dominantAuthorPercent)
    .slice(0, topN)
    .map((f) => {
      const basename = f.file.split('/').pop();
      const localPart = f.dominantAuthor.split('@')[0];
      return {
        file: f.file,
        name: basename && basename.length > 0 ? basename : f.file,
        dominantAuthor: f.dominantAuthor,
        dominantAuthorName: localPart && localPart.length > 0 ? localPart : f.dominantAuthor,
        dominantAuthorPercent: f.dominantAuthorPercent,
        risk: f.risk,
      };
    });
}

function riskColor(risk: BusFactorRisk): string {
  switch (risk) {
    case 'critical':
      return 'var(--severity-critical)';
    case 'high':
      return 'var(--severity-warning)';
    case 'medium':
      return 'var(--severity-moderate)';
    case 'low':
      return 'var(--severity-healthy)';
  }
}

interface OwnershipBarProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export function OwnershipBar({ report, selectedFile, onSelectFile }: OwnershipBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; row: OwnershipBarRow } | null>(
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

  const rows = useMemo(() => prepareOwnershipBarData(report), [report]);

  if (rows.length === 0) {
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
        No critical-ownership files detected.
      </div>
    );
  }

  const labelWidth = 220;
  const rightPad = 160;
  const topPad = 16;
  const bottomPad = 16;
  const available = Math.max(120, dims.width - labelWidth - rightPad);
  const rowHeight = Math.max(20, (dims.height - topPad - bottomPad) / Math.max(rows.length, 1));
  const barHeight = Math.max(10, rowHeight - 6);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        {rows.map((row, i) => {
          const y = topPad + i * rowHeight;
          const barWidth = Math.max(2, (row.dominantAuthorPercent / 100) * available);
          const isSelected = selectedFile === row.file;
          const color = riskColor(row.risk);

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
              <rect
                x={labelWidth}
                y={y}
                width={available}
                height={barHeight}
                rx={2}
                fill="var(--surface-secondary)"
                fillOpacity={0.4}
              />
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
              <text
                x={labelWidth + available + 6}
                y={y + barHeight / 2}
                dominantBaseline="middle"
                fontSize={10}
                fontFamily="var(--font-mono)"
                fill={color}
                fontWeight={600}
                style={{ pointerEvents: 'none' }}
              >
                {row.dominantAuthorName} {row.dominantAuthorPercent}%
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
          <div style={{ color: 'var(--text-secondary)' }}>
            {tooltip.row.dominantAuthor} owns {tooltip.row.dominantAuthorPercent}%
          </div>
          <div
            style={{
              color: riskColor(tooltip.row.risk),
              marginTop: 2,
              textTransform: 'capitalize',
            }}
          >
            {tooltip.row.risk} risk
          </div>
        </div>
      )}
    </div>
  );
}
