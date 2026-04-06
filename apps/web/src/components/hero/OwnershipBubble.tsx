import { useEffect, useMemo, useRef, useState } from 'react';

import { hierarchy, pack } from 'd3-hierarchy';

import { authorColor } from '../../utils/colors';

import type { GitloreReport } from '@gitlore/core';

interface OwnershipBubbleProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface BubbleNode {
  name: string;
  fullPath?: string;
  value?: number;
  dominantAuthor?: string;
  children?: BubbleNode[];
}

export function buildOwnershipTree(report: GitloreReport): BubbleNode {
  const root: BubbleNode = { name: 'root', children: [] };
  const dirMap = new Map<string, BubbleNode>();

  const busFactorMap = new Map<string, string>();
  for (const f of report.busFactors.files) {
    busFactorMap.set(f.file, f.dominantAuthor);
  }

  for (const f of report.loc.files) {
    const parts = f.file.split('/');
    const fName = parts.pop()!;

    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const key = parts.slice(0, i + 1).join('/');
      if (!dirMap.has(key)) {
        const node: BubbleNode = { name: parts[i], children: [] };
        dirMap.set(key, node);
        current.children!.push(node);
      }
      current = dirMap.get(key)!;
    }

    current.children!.push({
      name: fName,
      fullPath: f.file,
      value: Math.max(f.lines, 1),
      dominantAuthor: busFactorMap.get(f.file) ?? 'unknown',
    });
  }

  return root;
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

  const bubbles = useMemo(() => {
    const tree = buildOwnershipTree(report);
    const root = hierarchy(tree)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = pack<BubbleNode>().size([dims.width, dims.height]).padding(3);
    layout(root);
    return root.leaves();
  }, [report, dims.width, dims.height]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        {bubbles.map((leaf) => {
          const d = leaf.data;
          if (!d.fullPath || !leaf.r) return null;
          if (leaf.r < 2) return null;

          const isSelected = selectedFile === d.fullPath;
          const color = authorColor(d.dominantAuthor ?? 'unknown');
          const showLabel = leaf.r > 20;

          return (
            <g
              key={d.fullPath}
              onClick={() => onSelectFile(d.fullPath!)}
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
              {showLabel && (
                <text
                  x={leaf.x}
                  y={leaf.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.min(leaf.r / 3, 11)}
                  fill="rgba(255,255,255,0.8)"
                  style={{ pointerEvents: 'none' }}
                >
                  {d.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
