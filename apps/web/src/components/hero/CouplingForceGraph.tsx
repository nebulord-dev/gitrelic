import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';

import { categoryColor } from '../../utils/colors';

import type { GitrelicReport, CoupledPair } from '@gitrelic/core';
import type {
  Simulation as D3Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from 'd3-force';

interface CouplingForceGraphProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface GraphNode extends SimulationNodeDatum {
  id: string;
  hotspotScore: number;
  category: string;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  strength: number;
}

function buildGraph(
  pairs: CoupledPair[],
  report: GitrelicReport,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodeSet = new Set<string>();
  const links: GraphLink[] = [];

  for (const p of pairs) {
    nodeSet.add(p.fileA);
    nodeSet.add(p.fileB);
    links.push({ source: p.fileA, target: p.fileB, strength: p.couplingStrength });
  }

  const hotspotMap = new Map<string, { score: number; category: string }>();
  for (const h of report.hotspots.files) {
    hotspotMap.set(h.file, { score: h.hotspotScore, category: h.category });
  }

  const nodes: GraphNode[] = [...nodeSet].map((id) => {
    const h = hotspotMap.get(id);
    return { id, hotspotScore: h?.score ?? 0, category: h?.category ?? 'low' };
  });

  return { nodes, links };
}

export function CouplingForceGraph({
  report,
  selectedFile,
  onSelectFile,
}: CouplingForceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const simRef = useRef<D3Simulation<GraphNode, GraphLink> | null>(null);
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

  const { nodes, links } = useMemo(() => buildGraph(report.coupling.topPairs, report), [report]);

  // Create simulation when data changes — uses dims from ref, not dependency
  useEffect(() => {
    if (nodes.length === 0) return;

    const { width, height } = dimsRef.current;
    const simNodes: GraphNode[] = nodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height / 2 + (Math.random() - 0.5) * height * 0.5,
    }));
    const simLinks: GraphLink[] = links.map((l) => ({ ...l }));

    const padding = 30;
    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(simLinks)
          .id((d) => d.id)
          .distance(100)
          .strength((d) => d.strength * 0.5),
      )
      .force('charge', forceManyBody().strength(-200))
      .force('x', forceX(width / 2).strength(0.1))
      .force('y', forceY(height / 2).strength(0.1))
      .force('collide', forceCollide().radius(20))
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
  }, [nodes, links]);

  // On resize, nudge center forces — don't restart from scratch
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
    const maxScore = Math.max(...nodes.map((n) => n.hotspotScore), 1);
    return (score: number) => 5 + (score / maxScore) * 15;
  }, [nodes]);

  const getPos = useCallback(
    (id: string) => nodePositions.get(id) ?? { x: dims.width / 2, y: dims.height / 2 },
    [nodePositions, dims],
  );

  const fileName = (path: string) => path.split('/').pop() ?? path;

  const partnerCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of links) {
      const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      counts.set(src, (counts.get(src) ?? 0) + 1);
      counts.set(tgt, (counts.get(tgt) ?? 0) + 1);
    }
    return counts;
  }, [links]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg width={dims.width} height={dims.height}>
        {links.map((l, i) => {
          const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
          const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
          const s = getPos(srcId);
          const t = getPos(tgtId);
          return (
            <line
              key={i}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke="rgba(88,166,255,0.3)"
              strokeWidth={1 + l.strength * 3}
            />
          );
        })}

        {nodes.map((n) => {
          const pos = getPos(n.id);
          const r = rScale(n.hotspotScore);
          const isSelected = selectedFile === n.id;
          const showLabel = r > 8;

          return (
            <g
              key={n.id}
              onClick={() => onSelectFile(n.id)}
              className="cursor-pointer"
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
                fill={categoryColor(n.category, 0.4)}
                stroke={isSelected ? 'var(--accent-primary)' : categoryColor(n.category, 0.6)}
                strokeWidth={isSelected ? 2 : 1}
              />
              {showLabel && (
                <text
                  x={pos.x}
                  y={pos.y + r + 10}
                  textAnchor="middle"
                  fontSize={8}
                  fill="rgba(255,255,255,0.6)"
                  className="pointer-events-none"
                >
                  {fileName(n.id)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div
          className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20 max-w-[300px]"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <div className="font-semibold mb-0.5">{tooltip.node.id}</div>
          <div className="text-text-secondary">
            Score: {tooltip.node.hotspotScore} · {tooltip.node.category} ·{' '}
            {partnerCount.get(tooltip.node.id) ?? 0} partners
          </div>
        </div>
      )}
    </div>
  );
}
