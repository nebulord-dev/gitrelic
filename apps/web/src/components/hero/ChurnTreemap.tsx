// apps/web/src/components/hero/ChurnTreemap.tsx
import type { GitloreReport } from "@gitlore/core";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";

interface ChurnTreemapProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface TreeNode {
  name: string;
  fullPath?: string;
  value?: number;
  hotspotScore?: number;
  category?: string;
  children?: TreeNode[];
}

function buildTree(report: GitloreReport): TreeNode {
  const root: TreeNode = { name: "root", children: [] };
  const dirMap = new Map<string, TreeNode>();

  // Only include files that appear in hotspot or LOC data
  const fileSet = new Map<string, { loc: number; score: number; category: string }>();
  for (const f of report.loc.files) {
    const hotspot = report.hotspots.files.find((h) => h.file === f.file);
    fileSet.set(f.file, {
      loc: f.lines,
      score: hotspot?.hotspotScore ?? 0,
      category: hotspot?.category ?? "low",
    });
  }

  for (const [filePath, data] of fileSet) {
    const parts = filePath.split("/");
    const fName = parts.pop()!;

    // Ensure parent directories exist
    let current = root;
    for (const part of parts) {
      const key = parts.slice(0, parts.indexOf(part) + 1).join("/");
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

function categoryColor(category: string, opacity: number): string {
  switch (category) {
    case "critical":
      return `rgba(248, 81, 73, ${opacity})`;
    case "warning":
      return `rgba(210, 153, 34, ${opacity})`;
    case "moderate":
      return `rgba(88, 166, 255, ${opacity})`;
    default:
      return `rgba(63, 185, 80, ${opacity})`;
  }
}

export function ChurnTreemap({ report, selectedFile, onSelectFile }: ChurnTreemapProps) {
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

    layout(root);
    return root.leaves();
  }, [report, dims.width, dims.height]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg width={dims.width} height={dims.height}>
        {leaves.map((leaf) => {
          const d = leaf.data;
          if (!d.fullPath) return null;
          const w = (leaf.x1 ?? 0) - (leaf.x0 ?? 0);
          const h = (leaf.y1 ?? 0) - (leaf.y0 ?? 0);
          if (w < 2 || h < 2) return null;

          const isSelected = selectedFile === d.fullPath;
          const showLabel = w > 40 && h > 16;

          return (
            <g
              key={d.fullPath}
              onClick={() => onSelectFile(d.fullPath!)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={leaf.x0}
                y={leaf.y0}
                width={w}
                height={h}
                fill={categoryColor(d.category ?? "low", 0.35)}
                stroke={
                  isSelected
                    ? "var(--accent-primary)"
                    : categoryColor(d.category ?? "low", 0.3)
                }
                strokeWidth={isSelected ? 2 : 1}
                rx={2}
              />
              {showLabel && (
                <text
                  x={(leaf.x0 ?? 0) + 4}
                  y={(leaf.y0 ?? 0) + 12}
                  fontSize={9}
                  fill="rgba(255,255,255,0.7)"
                  style={{ pointerEvents: "none" }}
                >
                  {d.name}
                </text>
              )}
              {showLabel && h > 28 && (
                <text
                  x={(leaf.x0 ?? 0) + 4}
                  y={(leaf.y0 ?? 0) + 23}
                  fontSize={8}
                  fill="rgba(255,255,255,0.4)"
                  style={{ pointerEvents: "none" }}
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
