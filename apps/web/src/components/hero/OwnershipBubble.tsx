import { useEffect, useMemo, useRef, useState } from 'react';

import { hierarchy, pack } from 'd3-hierarchy';

import { authorColor } from '../../utils/colors';

import type { GitloreReport } from '@gitlore/core';

interface OwnershipBubbleProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export interface DirBubble {
  name: string;
  dirPath: string;
  totalLoc: number;
  dominantAuthor: string;
  dominantPercent: number;
  fileCount: number;
}

export function buildDirectoryBubbles(report: GitloreReport): DirBubble[] {
  // Build bus factor map
  const busFactorMap = new Map<string, string>();
  for (const f of report.busFactors.files) {
    busFactorMap.set(f.file, f.dominantAuthor);
  }

  // Aggregate by top-level directory (2 levels deep for src/*)
  const dirStats = new Map<
    string,
    { loc: number; authors: Map<string, number>; fileCount: number }
  >();

  for (const f of report.loc.files) {
    const parts = f.file.split('/');
    // Use up to 2 levels: "src/analyzers", "apps/web", etc.
    const dirKey =
      parts.length > 2 ? parts.slice(0, 2).join('/') : parts.length > 1 ? parts[0] : '.';

    if (!dirStats.has(dirKey)) {
      dirStats.set(dirKey, { loc: 0, authors: new Map(), fileCount: 0 });
    }
    const stats = dirStats.get(dirKey)!;
    stats.loc += f.lines;
    stats.fileCount++;

    const author = busFactorMap.get(f.file) ?? 'unknown';
    stats.authors.set(author, (stats.authors.get(author) ?? 0) + 1);
  }

  // Convert to bubbles
  const bubbles: DirBubble[] = [];
  for (const [dirPath, stats] of dirStats) {
    // Find dominant author (owns most files in this dir)
    let dominantAuthor = 'unknown';
    let maxCount = 0;
    for (const [author, count] of stats.authors) {
      if (count > maxCount) {
        maxCount = count;
        dominantAuthor = author;
      }
    }
    const dominantPercent = Math.round((maxCount / stats.fileCount) * 100);

    bubbles.push({
      name: dirPath,
      dirPath,
      totalLoc: stats.loc,
      dominantAuthor,
      dominantPercent,
      fileCount: stats.fileCount,
    });
  }

  return bubbles;
}

export function OwnershipBubble({ report, selectedFile, onSelectFile }: OwnershipBubbleProps) {
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

  // Build a map from dirPath → first file path for click navigation
  const dirFirstFileMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of report.loc.files) {
      const parts = f.file.split('/');
      const dirKey =
        parts.length > 2 ? parts.slice(0, 2).join('/') : parts.length > 1 ? parts[0] : '.';
      if (!map.has(dirKey)) {
        map.set(dirKey, f.file);
      }
    }
    return map;
  }, [report]);

  const packData = useMemo(() => {
    const dirs = buildDirectoryBubbles(report);
    const root = hierarchy({ name: 'root', children: dirs })
      .sum((d: any) => d.totalLoc ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = pack<any>().size([dims.width, dims.height]).padding(8);
    layout(root);
    return root.leaves();
  }, [report, dims.width, dims.height]);

  const uniqueAuthors = useMemo(() => {
    const seen = new Set<string>();
    for (const leaf of packData) {
      seen.add(leaf.data.dominantAuthor ?? 'unknown');
    }
    return Array.from(seen);
  }, [packData]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        {packData.map((leaf) => {
          const d = leaf.data as DirBubble;
          if (!leaf.r) return null;

          const firstFile = dirFirstFileMap.get(d.dirPath) ?? d.dirPath;
          const isSelected = selectedFile !== null && firstFile === selectedFile;
          const color = authorColor(d.dominantAuthor ?? 'unknown');
          const labelFontSize = Math.min(leaf.r / 4, 12);
          const subFontSize = Math.min(leaf.r / 5, 10);

          return (
            <g
              key={d.dirPath}
              onClick={() => onSelectFile(firstFile)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={leaf.x}
                cy={leaf.y}
                r={leaf.r}
                fill={color}
                fillOpacity={0.3}
                stroke={isSelected ? 'var(--accent-primary)' : color}
                strokeOpacity={isSelected ? 1 : 0.5}
                strokeWidth={isSelected ? 2 : 1}
              />
              {leaf.r > 16 && (
                <text
                  x={leaf.x}
                  y={leaf.y - (leaf.r > 30 ? subFontSize : 0)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={labelFontSize}
                  fill="rgba(255,255,255,0.9)"
                  style={{ pointerEvents: 'none' }}
                >
                  {d.name}
                </text>
              )}
              {leaf.r > 30 && (
                <text
                  x={leaf.x}
                  y={leaf.y + labelFontSize + 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={subFontSize}
                  fill="rgba(255,255,255,0.6)"
                  style={{ pointerEvents: 'none' }}
                >
                  {d.dominantAuthor.split('@')[0]} {d.dominantPercent}%
                </text>
              )}
            </g>
          );
        })}

        {/* Author legend */}
        {uniqueAuthors.map((author, i) => (
          <g
            key={author}
            transform={`translate(10, ${dims.height - (uniqueAuthors.length - i) * 16})`}
          >
            <circle cx={6} cy={-3} r={5} fill={authorColor(author)} fillOpacity={0.5} />
            <text x={16} y={0} fontSize={9} fill="var(--text-secondary)">
              {author.split('@')[0]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
