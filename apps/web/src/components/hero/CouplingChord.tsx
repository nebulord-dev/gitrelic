import { useEffect, useMemo, useRef, useState } from 'react';

import { chord, ribbon } from 'd3-chord';
import { scaleOrdinal } from 'd3-scale';
import { arc } from 'd3-shape';

import { authorColor } from '../../utils/colors';

import type { GitloreReport } from '@gitlore/core';

interface CouplingChordProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

function getDirectory(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 1) return '.';
  // Aggregate at 2 levels deep to avoid dozens of thin arcs on large repos
  return parts.length > 2 ? parts.slice(0, 2).join('/') : parts[0];
}

export function CouplingChord({ report, selectedFile, onSelectFile }: CouplingChordProps) {
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

  const { matrix, dirs, dirFiles } = useMemo(() => {
    const dirSet = new Set<string>();
    const dirFilesMap = new Map<string, Set<string>>();
    for (const p of report.coupling.topPairs) {
      const dA = getDirectory(p.fileA);
      const dB = getDirectory(p.fileB);
      dirSet.add(dA);
      dirSet.add(dB);

      if (!dirFilesMap.has(dA)) dirFilesMap.set(dA, new Set());
      if (!dirFilesMap.has(dB)) dirFilesMap.set(dB, new Set());
      dirFilesMap.get(dA)!.add(p.fileA);
      dirFilesMap.get(dB)!.add(p.fileB);
    }

    const dirs = [...dirSet].sort();
    const dirIdx = new Map(dirs.map((d, i) => [d, i]));
    const n = dirs.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

    for (const p of report.coupling.topPairs) {
      const iA = dirIdx.get(getDirectory(p.fileA))!;
      const iB = dirIdx.get(getDirectory(p.fileB))!;
      if (iA !== iB) {
        matrix[iA][iB] += p.coCommits;
        matrix[iB][iA] += p.coCommits;
      }
    }

    // Apply square root scaling to compress the range —
    // without this, dominant pairs (hundreds of co-commits)
    // produce chords so wide they fill the entire circle
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        matrix[i][j] = Math.sqrt(matrix[i][j]);
      }
    }

    return { matrix, dirs, dirFiles: dirFilesMap };
  }, [report.coupling.topPairs]);

  const radius = Math.min(dims.width, dims.height) / 2 - 40;
  const innerRadius = radius - 20;

  const chordLayout = useMemo(
    () =>
      chord()
        .padAngle(0.06)
        .sortSubgroups((a, b) => b - a)(matrix),
    [matrix],
  );

  const arcGen = arc<any>().innerRadius(innerRadius).outerRadius(radius);
  const ribbonGen = ribbon<any, any>().radius(innerRadius);

  const colorScale = scaleOrdinal<string>()
    .domain(dirs)
    .range(dirs.map((d) => authorColor(d)));

  const selectedDir = selectedFile ? getDirectory(selectedFile) : null;

  const dirLabel = (d: string) => {
    const parts = d.split('/');
    return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : d;
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${dims.width / 2},${dims.height / 2})`}>
          {chordLayout.groups.map((g, i) => {
            const isSelected = selectedDir === dirs[i];
            return (
              <g key={dirs[i]}>
                <path
                  d={arcGen(g) ?? ''}
                  fill={colorScale(dirs[i])}
                  fillOpacity={isSelected ? 0.8 : 0.5}
                  stroke={isSelected ? 'var(--accent-primary)' : 'none'}
                  strokeWidth={isSelected ? 2 : 0}
                  onClick={() => {
                    const files = dirFiles.get(dirs[i]);
                    if (files) onSelectFile([...files][0]);
                  }}
                  style={{ cursor: 'pointer' }}
                />
                {g.endAngle - g.startAngle > 0.15 && (
                  <text
                    transform={`rotate(${(((g.startAngle + g.endAngle) / 2) * 180) / Math.PI - 90}) translate(${radius + 8})`}
                    textAnchor={(g.startAngle + g.endAngle) / 2 > Math.PI ? 'end' : 'start'}
                    fontSize={9}
                    fill="var(--text-secondary)"
                  >
                    {dirLabel(dirs[i])}
                  </text>
                )}
              </g>
            );
          })}

          {chordLayout.map((c, i) => {
            const srcDir = dirs[c.source.index];
            const tgtDir = dirs[c.target.index];
            const involves = selectedDir === srcDir || selectedDir === tgtDir;
            return (
              <path
                key={i}
                d={ribbonGen(c) ?? ''}
                fill={colorScale(srcDir)}
                fillOpacity={selectedDir == null ? 0.15 : involves ? 0.3 : 0.04}
                stroke={colorScale(srcDir)}
                strokeOpacity={selectedDir == null ? 0.2 : involves ? 0.4 : 0.05}
                strokeWidth={0.5}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
