import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force';

import { categoryColor } from '../../utils/colors';

import type { GitloreReport, CoupledPair } from '@gitlore/core';

interface CouplingForceGraphProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface GraphNode {
  id: string;
  hotspotScore: number;
  category: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  strength: number;
}

function buildGraph(
  pairs: CoupledPair[],
  report: GitloreReport,
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

  useEffect(() => {
    if (nodes.length === 0) return;

    const simNodes = nodes.map((n) => ({
      ...n,
      x: dims.width / 2 + (Math.random() - 0.5) * dims.width * 0.5,
      y: dims.height / 2 + (Math.random() - 0.5) * dims.height * 0.5,
    }));
    const simLinks = links.map((l) => ({ ...l }));

    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink(simLinks)
          .id((d: any) => d.id)
          .distance(100)
          .strength((d: any) => d.strength * 0.5),
      )
      .force('charge', forceManyBody().strength(-200))
      .force('center', forceCenter(dims.width / 2, dims.height / 2))
      .force('collide', forceCollide().radius(20))
      .velocityDecay(0.3);

    sim.on('tick', () => {
      const positions = new Map<string, { x: number; y: number }>();
      for (const n of simNodes) {
        positions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
      }
      setNodePositions(new Map(positions));
    });

    return () => {
      sim.stop();
    };
  }, [nodes, links, dims.width, dims.height]);

  const rScale = useMemo(() => {
    const maxScore = Math.max(...nodes.map((n) => n.hotspotScore), 1);
    return (score: number) => 5 + (score / maxScore) * 15;
  }, [nodes]);

  const getPos = useCallback(
    (id: string) => nodePositions.get(id) ?? { x: dims.width / 2, y: dims.height / 2 },
    [nodePositions, dims],
  );

  const fileName = (path: string) => path.split('/').pop() ?? path;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        {links.map((l, i) => {
          const s = getPos(l.source);
          const t = getPos(l.target);
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
            <g key={n.id} onClick={() => onSelectFile(n.id)} style={{ cursor: 'pointer' }}>
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
                  style={{ pointerEvents: 'none' }}
                >
                  {fileName(n.id)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
