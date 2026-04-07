import { useEffect, useMemo, useRef, useState } from 'react';

import type { GitloreReport } from '@gitlore/core';

interface CouplingHeatmapProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const ROW_LABEL_WIDTH = 140;
const COL_HEADER_HEIGHT = 160;
const MIN_CELL = 24;

function getDirectory(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 1) return '.';
  return parts.length > 2 ? parts.slice(0, 2).join('/') : parts[0];
}

function dirLabel(d: string): string {
  const parts = d.split('/');
  return parts[parts.length - 1];
}

export function CouplingHeatmap({ report, selectedFile, onSelectFile }: CouplingHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    dirA: string;
    dirB: string;
    value: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { dirs, matrix, maxValue, dirFilesMap } = useMemo(() => {
    const dirFilesMap = new Map<string, Set<string>>();
    const pairMap = new Map<string, number>();

    for (const p of report.coupling.topPairs) {
      const dA = getDirectory(p.fileA);
      const dB = getDirectory(p.fileB);

      if (!dirFilesMap.has(dA)) dirFilesMap.set(dA, new Set());
      if (!dirFilesMap.has(dB)) dirFilesMap.set(dB, new Set());
      dirFilesMap.get(dA)!.add(p.fileA);
      dirFilesMap.get(dB)!.add(p.fileB);

      if (dA !== dB) {
        const key = [dA, dB].sort().join('|||');
        pairMap.set(key, (pairMap.get(key) ?? 0) + p.coCommits);
      }
    }

    // Sort directories by total coupling volume (most coupled first)
    const dirTotals = new Map<string, number>();
    for (const [key, count] of pairMap) {
      const [a, b] = key.split('|||');
      dirTotals.set(a, (dirTotals.get(a) ?? 0) + count);
      dirTotals.set(b, (dirTotals.get(b) ?? 0) + count);
    }
    const dirs = [...dirTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20) // Cap at 20 directories to keep the grid readable
      .map(([d]) => d);

    const dirIdx = new Map(dirs.map((d, i) => [d, i]));
    const n = dirs.length;
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    let maxValue = 0;
    for (const [key, count] of pairMap) {
      const [a, b] = key.split('|||');
      const iA = dirIdx.get(a);
      const iB = dirIdx.get(b);
      if (iA != null && iB != null) {
        matrix[iA][iB] = count;
        matrix[iB][iA] = count;
        if (count > maxValue) maxValue = count;
      }
    }

    return { dirs, matrix, maxValue, dirFilesMap };
  }, [report.coupling.topPairs]);

  const gridSize = Math.min(dims.width - ROW_LABEL_WIDTH, dims.height - COL_HEADER_HEIGHT);
  const cellSize = Math.max(dirs.length > 0 ? gridSize / dirs.length : MIN_CELL, MIN_CELL);
  const totalSize = cellSize * dirs.length;

  const selectedDir = selectedFile ? getDirectory(selectedFile) : null;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'auto',
        marginTop: '-35px',
      }}
    >
      <svg
        width={ROW_LABEL_WIDTH + totalSize + 10}
        height={COL_HEADER_HEIGHT + totalSize + 10}
        style={{ display: 'block' }}
      >
        {/* Column headers (rotated) */}
        {dirs.map((d, i) => (
          <text
            key={`col-${d}`}
            x={0}
            y={0}
            transform={`translate(${ROW_LABEL_WIDTH + i * cellSize + cellSize / 2}, 150) rotate(-45)`}
            textAnchor="start"
            fontSize={9}
            fill={selectedDir === d ? 'var(--text-primary)' : 'var(--text-secondary)'}
            fontWeight={selectedDir === d ? 700 : 400}
          >
            {dirLabel(d)}
          </text>
        ))}

        {/* Row headers + cells */}
        {dirs.map((rowDir, ri) => (
          <g key={`row-${rowDir}`} transform={`translate(0, ${COL_HEADER_HEIGHT + ri * cellSize})`}>
            {/* Row label */}
            <text
              x={ROW_LABEL_WIDTH - 8}
              y={cellSize / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={9}
              fill={selectedDir === rowDir ? 'var(--text-primary)' : 'var(--text-secondary)'}
              fontWeight={selectedDir === rowDir ? 700 : 400}
            >
              {dirLabel(rowDir)}
            </text>

            {/* Cells */}
            {dirs.map((colDir, ci) => {
              const value = matrix[ri][ci];
              if (ri === ci) {
                // Diagonal — skip (self-coupling)
                return (
                  <rect
                    key={colDir}
                    x={ROW_LABEL_WIDTH + ci * cellSize}
                    y={0}
                    width={cellSize - 1}
                    height={cellSize - 1}
                    fill="var(--surface-tertiary)"
                    rx={2}
                  />
                );
              }

              const intensity = maxValue > 0 ? value / maxValue : 0;
              const isHighlighted = selectedDir === rowDir || selectedDir === colDir;

              return (
                <rect
                  key={colDir}
                  x={ROW_LABEL_WIDTH + ci * cellSize}
                  y={0}
                  width={cellSize - 1}
                  height={cellSize - 1}
                  fill={
                    value === 0
                      ? 'var(--surface-secondary)'
                      : `rgba(88, 166, 255, ${0.1 + intensity * 0.8})`
                  }
                  stroke={isHighlighted ? 'var(--accent-primary)' : 'none'}
                  strokeWidth={isHighlighted ? 1.5 : 0}
                  rx={2}
                  style={{ cursor: value > 0 ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (value > 0) {
                      const files = dirFilesMap.get(rowDir);
                      if (files) onSelectFile([...files][0]);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (value === 0) return;
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        dirA: rowDir,
                        dirB: colDir,
                        value,
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </g>
        ))}
      </svg>

      {/* Tooltip */}
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
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {tooltip.dirA} ↔ {tooltip.dirB}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>{tooltip.value} co-commits</div>
        </div>
      )}
    </div>
  );
}
