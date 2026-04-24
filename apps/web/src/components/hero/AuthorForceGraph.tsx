import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';

import { authorColor } from '../../utils/colors';
import { type AuthorGraphNode, buildAuthorGraph } from './authorGraph';

import type { GitrelicReport } from '@gitrelic/core';
import type { Simulation as D3Simulation } from 'd3-force';

interface AuthorForceGraphProps {
  report: GitrelicReport;
  selectedContributor: string | null;
  onSelectContributor: (author: string) => void;
}

export function AuthorForceGraph({
  report,
  selectedContributor,
  onSelectContributor,
}: AuthorForceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: AuthorGraphNode } | null>(
    null,
  );
  const simRef = useRef<D3Simulation<any, any> | null>(null);
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

  const { nodes, links } = useMemo(() => buildAuthorGraph(report), [report]);

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
    const simNodes = nodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height / 2 + (Math.random() - 0.5) * height * 0.5,
    }));
    const simLinks = links.map((l) => ({ ...l }));

    const padding = 30;
    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink(simLinks)
          .id((d: any) => d.id)
          .distance(120)
          .strength((d: any) =>
            maxLinkCommits > 0 ? Math.min(0.8, (d.coAuthoredCommits / maxLinkCommits) * 0.8) : 0.2,
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
    (id: string) => nodePositions.get(id) ?? { x: dims.width / 2, y: dims.height / 2 },
    [nodePositions, dims],
  );

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        {links.map((l, i) => {
          const s = getPos(l.source);
          const t = getPos(l.target);
          const weight = maxLinkCommits > 0 ? l.coAuthoredCommits / maxLinkCommits : 0;
          return (
            <line
              key={i}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke="rgba(88,166,255,0.3)"
              strokeWidth={1 + weight * 3}
            />
          );
        })}

        {nodes.map((n) => {
          const pos = getPos(n.id);
          const r = rScale(n.coAuthoredCommits);
          const isSelected = selectedContributor === n.id;
          const showLabel = r > 10;
          const color = authorColor(n.id);

          return (
            <g
              key={n.id}
              onClick={() => onSelectContributor(n.id)}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: n });
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
                  style={{ pointerEvents: 'none' }}
                >
                  {n.label}
                </text>
              )}
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
            maxWidth: 300,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.node.label}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {tooltip.node.coAuthoredCommits} co-commit
            {tooltip.node.coAuthoredCommits !== 1 ? 's' : ''} · {tooltip.node.partnerCount} partner
            {tooltip.node.partnerCount !== 1 ? 's' : ''}
          </div>
          {tooltip.node.primaryPartner && (
            <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
              Top: {tooltip.node.primaryPartner.split(' <')[0]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
