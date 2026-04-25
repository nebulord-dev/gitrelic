import { useEffect, useMemo, useRef, useState } from 'react';

import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';

import { categoryColor } from '../../utils/colors';

import type { GitrelicReport } from '@gitrelic/core';
import type { HierarchyRectangularNode } from 'd3-hierarchy';

export type TreemapColorBy = 'churn' | 'age' | 'test-proximity';

interface LegendEntry {
  label: string;
  color: string;
}

interface ColorMode {
  fill: (filePath: string, report: GitrelicReport) => string;
  legend: LegendEntry[];
}

const AGE_COLORS = {
  fresh: '#1f4e7a',
  aging: '#3a6b8c',
  stale: '#7a4a1f',
  ancient: '#a06222',
} as const;

const TEST_COLORS = {
  tested: '#2f5a2f',
  untested: '#7a1f1f',
  unknown: '#3a3a3a',
} as const;

export const colorByMode: Record<TreemapColorBy, ColorMode> = {
  churn: {
    fill: (file, report) => {
      const h = report.hotspots.files.find((f) => f.file === file);
      return categoryColor(h?.category ?? 'low', 0.35);
    },
    legend: [
      { label: 'critical', color: categoryColor('critical', 0.35) },
      { label: 'warning', color: categoryColor('warning', 0.35) },
      { label: 'moderate', color: categoryColor('moderate', 0.35) },
      { label: 'low', color: categoryColor('low', 0.35) },
    ],
  },
  age: {
    fill: (file, report) => {
      const a = report.ageMap.files.find((f) => f.file === file);
      return AGE_COLORS[a?.status ?? 'aging'];
    },
    legend: [
      { label: 'fresh', color: AGE_COLORS.fresh },
      { label: 'aging', color: AGE_COLORS.aging },
      { label: 'stale', color: AGE_COLORS.stale },
      { label: 'ancient', color: AGE_COLORS.ancient },
    ],
  },
  'test-proximity': {
    fill: (file, report) => {
      const t = report.testCoverage.files.find((f) => f.file === file);
      if (t === undefined) return TEST_COLORS.unknown;
      return t.hasTestSibling ? TEST_COLORS.tested : TEST_COLORS.untested;
    },
    legend: [
      { label: 'tested', color: TEST_COLORS.tested },
      { label: 'untested', color: TEST_COLORS.untested },
      { label: 'unknown', color: TEST_COLORS.unknown },
    ],
  },
};

interface ChurnTreemapProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
  colorBy?: TreemapColorBy;
}

interface TreeNode {
  name: string;
  fullPath?: string;
  value?: number;
  hotspotScore?: number;
  category?: string;
  children?: TreeNode[];
}

function buildTree(report: GitrelicReport): TreeNode {
  const root: TreeNode = { name: 'root', children: [] };
  const dirMap = new Map<string, TreeNode>();

  // Only include files that appear in hotspot or LOC data
  const fileSet = new Map<string, { loc: number; score: number; category: string }>();
  for (const f of report.loc.files) {
    const hotspot = report.hotspots.files.find((h) => h.file === f.file);
    fileSet.set(f.file, {
      loc: f.lines,
      score: hotspot?.hotspotScore ?? 0,
      category: hotspot?.category ?? 'low',
    });
  }

  for (const [filePath, data] of fileSet) {
    const parts = filePath.split('/');
    const fName = parts.pop()!;

    // Ensure parent directories exist
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const key = parts.slice(0, i + 1).join('/');
      if (!dirMap.has(key)) {
        const node: TreeNode = { name: part, children: [] };
        dirMap.set(key, node);
        current.children!.push(node);
      }
      current = dirMap.get(key)!;
    }

    current.children!.push({
      name: fName,
      fullPath: filePath,
      value: Math.max(data.loc, 1),
      hotspotScore: data.score,
      category: data.category,
    });
  }

  return root;
}

export function ChurnTreemap({
  report,
  selectedFile,
  onSelectFile,
  colorBy = 'churn',
}: ChurnTreemapProps) {
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

  const leaves = useMemo(() => {
    const tree = buildTree(report);
    const root = hierarchy(tree)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = treemap<TreeNode>()
      .size([dims.width, dims.height])
      .padding(2)
      .tile(treemapSquarify);

    return layout(root).leaves() as HierarchyRectangularNode<TreeNode>[];
  }, [report, dims.width, dims.height]);

  const mode = colorByMode[colorBy];

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        {leaves.map((leaf) => {
          const d = leaf.data;
          if (!d.fullPath) return null;
          const w = leaf.x1 - leaf.x0;
          const h = leaf.y1 - leaf.y0;
          if (w < 2 || h < 2) return null;

          const isSelected = selectedFile === d.fullPath;
          const showLabel = w > 40 && h > 16;
          const fillColor = mode.fill(d.fullPath, report);

          return (
            <g
              key={d.fullPath}
              onClick={() => onSelectFile(d.fullPath!)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={leaf.x0}
                y={leaf.y0}
                width={w}
                height={h}
                fill={fillColor}
                stroke={isSelected ? 'var(--accent-primary)' : fillColor}
                strokeWidth={isSelected ? 2 : 1}
                rx={2}
              />
              {showLabel && (
                <text
                  x={leaf.x0 + 4}
                  y={leaf.y0 + 12}
                  fontSize={9}
                  fill="rgba(255,255,255,0.7)"
                  style={{ pointerEvents: 'none' }}
                >
                  {d.name}
                </text>
              )}
              {showLabel && colorBy === 'churn' && h > 28 && (
                <text
                  x={leaf.x0 + 4}
                  y={leaf.y0 + 23}
                  fontSize={8}
                  fill="rgba(255,255,255,0.4)"
                  style={{ pointerEvents: 'none' }}
                >
                  {d.hotspotScore}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
