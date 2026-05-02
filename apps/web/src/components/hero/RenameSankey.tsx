import { useEffect, useMemo, useRef, useState } from 'react';

import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

import type { GitrelicReport } from '@gitrelic/core';

export interface RenameSankeyNode {
  name: string;
  displayName: string;
  currentPath: string;
  isTerminus: boolean;
}

function suffixDepthToDistinguish(target: string, peer: string): number {
  const tSeg = target.split('/');
  const pSeg = peer.split('/');
  const minLen = Math.min(tSeg.length, pSeg.length);
  for (let i = 0; i < minLen; i++) {
    if (tSeg[tSeg.length - 1 - i] !== pSeg[pSeg.length - 1 - i]) {
      return i + 1;
    }
  }
  return minLen + 1;
}

export function computeDisplayName(target: string, chainPaths: string[]): string {
  const tSeg = target.split('/');
  if (tSeg.length === 0) return target;
  let depth = 1;
  for (const peer of chainPaths) {
    if (peer === target) continue;
    const d = suffixDepthToDistinguish(target, peer);
    if (d > depth) depth = d;
  }
  return tSeg.slice(-depth).join('/');
}

export interface RenameSankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface SankeyPrepOptions {
  topN?: number;
}

export function prepareSankeyData(
  report: GitrelicReport,
  options: SankeyPrepOptions = {},
): { nodes: RenameSankeyNode[]; links: RenameSankeyLink[] } {
  const topN = options.topN ?? 20;
  const sorted = [...report.renameTracking.chains]
    .sort((a, b) => b.renameCount - a.renameCount)
    .slice(0, topN);

  const nodes: RenameSankeyNode[] = [];
  const links: RenameSankeyLink[] = [];
  const nodeIndex = new Map<string, number>();

  function addNode(
    name: string,
    displayName: string,
    currentPath: string,
    isTerminus: boolean,
  ): number {
    const existing = nodeIndex.get(name);
    if (existing != null) {
      if (isTerminus && !nodes[existing].isTerminus) {
        nodes[existing] = { ...nodes[existing], isTerminus: true, currentPath };
      }
      return existing;
    }
    const index = nodes.length;
    nodes.push({ name, displayName, currentPath, isTerminus });
    nodeIndex.set(name, index);
    return index;
  }

  for (const chain of sorted) {
    if (chain.previousNames.length === 0) continue;
    const path = [...chain.previousNames, chain.currentPath];
    const indices = path.map((name) =>
      addNode(name, computeDisplayName(name, path), chain.currentPath, name === chain.currentPath),
    );
    for (let i = 0; i < indices.length - 1; i++) {
      links.push({ source: indices[i], target: indices[i + 1], value: 1 });
    }
  }

  return { nodes, links };
}

interface RenameSankeyProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export function RenameSankey({ report, selectedFile, onSelectFile }: RenameSankeyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    node: RenameSankeyNode;
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

  const { nodes: rawNodes, links: rawLinks } = useMemo(() => prepareSankeyData(report), [report]);

  const sankeyGraph = useMemo(() => {
    if (rawNodes.length === 0 || rawLinks.length === 0) return null;
    const margin = { top: 12, right: 120, bottom: 12, left: 120 };
    const innerWidth = Math.max(200, dims.width - margin.left - margin.right);
    const innerHeight = Math.max(160, dims.height - margin.top - margin.bottom);

    const generator = sankey<RenameSankeyNode, RenameSankeyLink>()
      .nodeWidth(12)
      .nodePadding(10)
      .extent([
        [margin.left, margin.top],
        [margin.left + innerWidth, margin.top + innerHeight],
      ]);

    return generator({
      nodes: rawNodes.map((n) => ({ ...n })),
      links: rawLinks.map((l) => ({ ...l })),
    });
  }, [rawNodes, rawLinks, dims]);

  if (!sankeyGraph) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center text-text-tertiary text-xs"
      >
        No rename history detected.
      </div>
    );
  }

  const linkPath = sankeyLinkHorizontal<RenameSankeyNode, RenameSankeyLink>();

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg width={dims.width} height={dims.height}>
        <g fill="none" strokeOpacity={0.3}>
          {sankeyGraph.links.map((l, i) => (
            <path
              key={i}
              d={linkPath(l) ?? ''}
              stroke="rgba(88,166,255,0.5)"
              strokeWidth={Math.max(1, l.width ?? 1)}
            />
          ))}
        </g>
        {sankeyGraph.nodes.map((n, i) => {
          const isSelected = selectedFile === n.currentPath;
          const x0 = n.x0 ?? 0;
          const x1 = n.x1 ?? 0;
          const y0 = n.y0 ?? 0;
          const y1 = n.y1 ?? 0;
          const height = Math.max(1, y1 - y0);
          const width = Math.max(1, x1 - x0);
          const midY = (y0 + y1) / 2;
          const color = n.isTerminus ? 'var(--accent-primary)' : 'var(--text-tertiary)';

          return (
            <g
              key={i}
              className="cursor-pointer"
              onClick={() => onSelectFile(n.currentPath)}
              onMouseEnter={(evt) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                setTooltip({
                  x: evt.clientX - rect.left,
                  y: evt.clientY - rect.top,
                  node: n,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <rect
                x={x0}
                y={y0}
                width={width}
                height={height}
                fill={color}
                fillOpacity={isSelected ? 1 : 0.85}
                stroke={isSelected ? 'var(--accent-primary)' : 'transparent'}
                strokeWidth={isSelected ? 1 : 0}
              />
              <text
                x={n.isTerminus ? x0 - 6 : x1 + 6}
                y={midY}
                textAnchor={n.isTerminus ? 'end' : 'start'}
                dominantBaseline="middle"
                fontSize={9}
                fontFamily="var(--font-mono)"
                fill="var(--text-secondary)"
                className="pointer-events-none"
              >
                {n.displayName}
              </text>
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div
          className="absolute bg-surface-elevated border border-border-primary rounded px-2.5 py-[6px] text-[10px] text-text-primary pointer-events-none z-20 max-w-[320px] break-all"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <div className="font-semibold mb-0.5">{tooltip.node.name}</div>
          {!tooltip.node.isTerminus && (
            <div className="text-text-secondary">Now: {tooltip.node.currentPath}</div>
          )}
          <div className="text-text-tertiary mt-0.5">
            {tooltip.node.isTerminus ? 'Current name' : 'Previous name'}
          </div>
        </div>
      )}
    </div>
  );
}
