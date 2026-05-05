import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force';

import { authorColor } from '../../utils/colors';
import { HeroCaption } from '../shared/HeroCaption';
import {
  type AuthorGraphLink,
  type AuthorGraphNode,
  buildAuthorGraph,
} from './authorGraph';
import type { GitrelicReport } from '@gitrelic/core';
import type {
  Simulation as D3Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from 'd3-force';

interface AuthorForceGraphProps {
  report: GitrelicReport;
  selectedContributor: string | null;
  onSelectContributor: (author: string) => void;
}

type SimNode = AuthorGraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & {
  coAuthoredCommits: number;
  sharedFiles: number;
};

type NodeTooltip = {
  kind: 'node';
  x: number;
  y: number;
  node: AuthorGraphNode;
};
type EdgeTooltip = {
  kind: 'edge';
  x: number;
  y: number;
  link: AuthorGraphLink;
};
type Tooltip = NodeTooltip | EdgeTooltip;

function nodeFill(node: AuthorGraphNode): string {
  if (node.classification === 'ai') return 'var(--accent-coupling)';
  return authorColor(node.id);
}

function classificationLabel(c: AuthorGraphNode['classification']): string {
  return c === 'ai' ? 'AI' : 'Human';
}

export function AuthorForceGraph({
  report,
  selectedContributor,
  onSelectContributor,
}: AuthorForceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({
    width: 800,
    height: 400,
  });
  const [nodePositions, setNodePositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const simRef = useRef<D3Simulation<SimNode, SimLink> | null>(null);
  const dimsRef = useRef(dims);
  dimsRef.current = dims;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { nodes, links, filteredSingleCommitEdges } = useMemo(
    () => buildAuthorGraph(report),
    [report],
  );

  const nodesById = useMemo(() => {
    const map = new Map<string, AuthorGraphNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const maxLinkCommits = useMemo(() => {
    let max = 0;
    for (const l of links) {
      if (l.coAuthoredCommits > max) max = l.coAuthoredCommits;
    }
    return max;
  }, [links]);

  useEffect(() => {
    if (nodes.length === 0) return;

    const { width, height } = dimsRef.current;
    const simNodes: SimNode[] = nodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height / 2 + (Math.random() - 0.5) * height * 0.5,
    }));
    const simLinks: SimLink[] = links.map((l) => ({
      ...l,
    }));

    const padding = 30;
    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(120)
          .strength((d) =>
            maxLinkCommits > 0
              ? Math.min(0.8, (d.coAuthoredCommits / maxLinkCommits) * 0.8)
              : 0.2,
          ),
      )
      .force('charge', forceManyBody().strength(-240))
      .force('x', forceX(width / 2).strength(0.1))
      .force('y', forceY(height / 2).strength(0.1))
      .force('collide', forceCollide().radius(24))
      .velocityDecay(0.3);

    sim.on('tick', () => {
      const { width: w, height: h } = dimsRef.current;
      const positions = new Map<string, { x: number; y: number }>();
      for (const n of simNodes) {
        n.x = Math.max(padding, Math.min(w - padding, n.x ?? 0));
        n.y = Math.max(padding, Math.min(h - padding, n.y ?? 0));
        positions.set(n.id, { x: n.x, y: n.y });
      }
      setNodePositions(new Map(positions));
    });

    simRef.current = sim;
    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [nodes, links, maxLinkCommits]);

  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim
      .force('x', forceX(dims.width / 2).strength(0.1))
      .force('y', forceY(dims.height / 2).strength(0.1))
      .alpha(0.3)
      .restart();
  }, [dims.width, dims.height]);

  const rScale = useMemo(() => {
    let max = 0;
    for (const n of nodes) {
      if (n.coAuthoredCommits > max) max = n.coAuthoredCommits;
    }
    if (max === 0) return () => 6;
    return (commits: number) => 6 + (commits / max) * 16;
  }, [nodes]);

  const getPos = useCallback(
    (id: string) =>
      nodePositions.get(id) ?? {
        x: dims.width / 2,
        y: dims.height / 2,
      },
    [nodePositions, dims],
  );

  const captionPrimary =
    filteredSingleCommitEdges > 0
      ? `Force-directed network · circles = co-authors (size = commit volume) · edges = shared commits · single-commit pairs hidden (${filteredSingleCommitEdges} filtered)`
      : 'Force-directed network · circles = co-authors (size = commit volume) · edges = shared commits';

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={containerRef} className="relative w-full flex-1">
        <svg width={dims.width} height={dims.height}>
          {links.map((l, i) => {
            const s = getPos(l.source);
            const t = getPos(l.target);
            const weight =
              maxLinkCommits > 0 ? l.coAuthoredCommits / maxLinkCommits : 0;
            return (
              <line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke="rgba(88,166,255,0.3)"
                strokeWidth={1 + weight * 3}
                strokeLinecap="round"
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({
                    kind: 'edge',
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    link: l,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                className="cursor-default"
                style={{
                  // pointerEvents: 'stroke' so hover hit-tests the line itself,
                  // not the implicit fill bbox of the enclosing path.
                  pointerEvents: 'stroke',
                }}
              />
            );
          })}

          {nodes.map((n) => {
            const pos = getPos(n.id);
            const r = rScale(n.coAuthoredCommits);
            const isSelected = selectedContributor === n.id;
            const showLabel = r > 10;
            const color = nodeFill(n);

            return (
              <g
                key={n.id}
                onClick={() => onSelectContributor(n.id)}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({
                    kind: 'node',
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    node: n,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r}
                  fill={color}
                  fillOpacity={0.6}
                  stroke={isSelected ? 'var(--accent-primary)' : color}
                  strokeWidth={isSelected ? 2 : 1}
                />
                {showLabel && (
                  <text
                    x={pos.x}
                    y={pos.y + r + 10}
                    textAnchor="middle"
                    fontSize={9}
                    fill="rgba(255,255,255,0.7)"
                    className="pointer-events-none"
                  >
                    {n.displayName}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {tooltip?.kind === 'node' && (
          <div
            className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20 max-w-[300px]"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 8,
            }}
          >
            <div className="font-semibold mb-0.5">
              {tooltip.node.displayName}
            </div>
            <div className="text-text-secondary">
              {classificationLabel(tooltip.node.classification)} ·{' '}
              {tooltip.node.coAuthoredCommits} co-authored commit
              {tooltip.node.coAuthoredCommits === 1 ? '' : 's'} ·{' '}
              {tooltip.node.partnerCount} partner
              {tooltip.node.partnerCount === 1 ? '' : 's'}
            </div>
          </div>
        )}
        {tooltip?.kind === 'edge' &&
          (() => {
            const a = nodesById.get(tooltip.link.source);
            const b = nodesById.get(tooltip.link.target);
            const labelA = a?.displayName ?? tooltip.link.source;
            const labelB = b?.displayName ?? tooltip.link.target;
            return (
              <div
                className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20 max-w-[300px]"
                style={{
                  left: tooltip.x + 12,
                  top: tooltip.y - 8,
                }}
              >
                <div className="font-semibold mb-0.5">
                  {labelA} ↔ {labelB}
                </div>
                <div className="text-text-secondary">
                  {tooltip.link.coAuthoredCommits} co-commit
                  {tooltip.link.coAuthoredCommits === 1 ? '' : 's'} ·{' '}
                  {tooltip.link.sharedFiles} shared file
                  {tooltip.link.sharedFiles === 1 ? '' : 's'}
                </div>
              </div>
            );
          })()}
      </div>
      <HeroCaption primary={captionPrimary} />
    </div>
  );
}
