import { useEffect, useMemo, useRef, useState } from 'react';
import { hierarchy, partition } from 'd3-hierarchy';
import { arc } from 'd3-shape';

import { authorColor } from '../../utils/colors';
import { HeroCaption } from '../shared/HeroCaption';
import type { GitrelicReport } from '@gitrelic/core';
import type { HierarchyRectangularNode } from 'd3-hierarchy';

export type SunburstMode = 'all' | 'ghost' | 'single-author';

const SILOS_THRESHOLD = 80;

interface OwnershipSunburstProps {
  report: GitrelicReport;
  selectedFile: string | null;
  selectedContributor: string | null;
  onSelectFile: (file: string) => void;
  onSelectContributor: (email: string) => void;
  mode?: SunburstMode;
  caption?: string;
}

function displayName(email: string, nameByEmail: Map<string, string>): string {
  const candidate = nameByEmail.get(email);
  return candidate && candidate.length > 0 ? candidate : email;
}

interface SunburstNode {
  name: string;
  email?: string;
  file?: string;
  risk?: string;
  value?: number;
  children?: SunburstNode[];
}

function filterSetForMode(
  report: GitrelicReport,
  mode: SunburstMode,
): Set<string> | null {
  if (mode === 'ghost')
    return new Set(report.ghostFiles.files.map((f) => f.file));
  if (mode === 'single-author') {
    return new Set(
      report.busFactors.files
        .filter((f) => f.dominantAuthorPercent > SILOS_THRESHOLD)
        .map((f) => f.file),
    );
  }
  return null;
}

export function prepareSunburstData(
  report: GitrelicReport,
  mode: SunburstMode,
  nameByEmail?: Map<string, string>,
): SunburstNode {
  const locMap = new Map<string, number>();
  for (const f of report.loc.files) {
    locMap.set(f.file, f.lines);
  }

  // Optional caller-supplied map lets the component pass in its memoized
  // copy so we don't rebuild on every render. Defaults to an internal build
  // for direct callers (e.g. tests) that don't pre-compute it.
  const namesMap =
    nameByEmail ??
    new Map(report.contributors.contributors.map((c) => [c.email, c.name]));

  const filterSet = filterSetForMode(report, mode);

  const authorMap = new Map<
    string,
    { files: Array<{ file: string; risk: string; loc: number }> }
  >();

  for (const f of report.busFactors.files) {
    if (filterSet && !filterSet.has(f.file)) continue;
    const author = f.dominantAuthor;
    if (!authorMap.has(author)) {
      authorMap.set(author, { files: [] });
    }
    authorMap.get(author)!.files.push({
      file: f.file,
      risk: f.risk,
      loc: locMap.get(f.file) ?? 1,
    });
  }

  const authorNodes: SunburstNode[] = [];
  for (const [email, data] of authorMap) {
    authorNodes.push({
      name: displayName(email, namesMap),
      email,
      children: data.files.map((f) => ({
        name: f.file.split('/').pop() ?? f.file,
        file: f.file,
        risk: f.risk,
        value: Math.max(f.loc, 1),
      })),
    });
  }

  return { name: 'root', children: authorNodes };
}

export function countSunburstFiles(
  report: GitrelicReport,
  mode: SunburstMode,
): number {
  const filterSet = filterSetForMode(report, mode);
  if (!filterSet) return report.busFactors.files.length;
  let count = 0;
  for (const f of report.busFactors.files) {
    if (filterSet.has(f.file)) count += 1;
  }
  return count;
}

function modeHeading(mode: SunburstMode): string {
  if (mode === 'ghost') return 'Ghost Ownership';
  if (mode === 'single-author') return 'Knowledge Silos';
  return 'Ownership';
}

function riskColor(risk: string, opacity: number): string {
  switch (risk) {
    case 'critical':
      return `rgba(248, 81, 73, ${opacity})`;
    case 'high':
      return `rgba(210, 153, 34, ${opacity})`;
    case 'medium':
      return `rgba(88, 166, 255, ${opacity})`;
    default:
      return `rgba(63, 185, 80, ${opacity})`;
  }
}

type TooltipState =
  | {
      kind: 'author';
      x: number;
      y: number;
      name: string;
      email: string;
      fileCount: number;
    }
  | { kind: 'file'; x: number; y: number; file: string; risk: string };

export function OwnershipSunburst({
  report,
  selectedFile,
  selectedContributor,
  onSelectFile,
  onSelectContributor,
  mode = 'all',
  caption,
}: OwnershipSunburstProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 600, height: 400 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const radius = Math.min(dims.width, dims.height) / 2;

  const nameByEmail = useMemo(
    () =>
      new Map(report.contributors.contributors.map((c) => [c.email, c.name])),
    [report.contributors.contributors],
  );

  const treeData = useMemo(
    () => prepareSunburstData(report, mode, nameByEmail),
    [report, mode, nameByEmail],
  );
  const totalFiles = useMemo(
    () => countSunburstFiles(report, mode),
    [report, mode],
  );

  // Build layout
  const { nodes, authorNames } = useMemo(() => {
    const root = hierarchy<SunburstNode>(treeData)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = partition<SunburstNode>().size([2 * Math.PI, radius]);
    layout(root);

    const allNodes = (root as HierarchyRectangularNode<SunburstNode>)
      .descendants()
      .slice(1);

    const names: string[] = [];
    for (const node of allNodes) {
      if (node.depth === 1 && node.data.email) {
        names.push(node.data.email);
      }
    }

    return { nodes: allNodes, authorNames: names };
  }, [treeData, radius]);

  // Arc generator — partition produces x0/x1 as angles, y0/y1 as radii
  const arcGen = useMemo(
    () =>
      arc<HierarchyRectangularNode<SunburstNode>>()
        .startAngle((d) => d.x0)
        .endAngle((d) => d.x1)
        .innerRadius((d) => d.y0)
        .outerRadius((d) => d.y1)
        .padAngle(0.005),
    [],
  );

  const cx = dims.width / 2;
  const cy = dims.height / 2;

  return (
    <div className="w-full h-full flex flex-col">
      <div ref={containerRef} className="flex-1 w-full relative">
        <svg width={dims.width} height={dims.height}>
          <g transform={`translate(${cx}, ${cy})`}>
            {nodes.map((node, i) => {
              const d = node.data;
              const isAuthor = node.depth === 1;
              const isFile = node.depth === 2;

              const fill = isAuthor
                ? authorColor(d.email ?? d.name)
                : riskColor(d.risk ?? 'low', 0.75);

              const isSelectedAuthor =
                isAuthor && d.email === selectedContributor;
              const isSelectedFile = isFile && d.file === selectedFile;
              const isSelected = isSelectedAuthor || isSelectedFile;

              const pathD = arcGen(node) ?? undefined;

              return (
                <path
                  key={i}
                  d={pathD}
                  fill={fill}
                  fillOpacity={isAuthor ? 0.85 : 0.75}
                  stroke={
                    isSelected
                      ? 'var(--accent-primary)'
                      : 'var(--surface-primary)'
                  }
                  strokeWidth={isSelected ? 2 : 0.5}
                  className="cursor-pointer"
                  onClick={() => {
                    if (isAuthor && d.email) {
                      onSelectContributor(d.email);
                    } else if (isFile && d.file) {
                      onSelectFile(d.file);
                    }
                  }}
                  onMouseEnter={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    if (isAuthor && d.email) {
                      setTooltip({
                        kind: 'author',
                        x,
                        y,
                        name: d.name,
                        email: d.email,
                        fileCount: node.children?.length ?? 0,
                      });
                    } else if (isFile && d.file) {
                      setTooltip({
                        kind: 'file',
                        x,
                        y,
                        file: d.file,
                        risk: d.risk ?? 'low',
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </g>

          {/* Center label */}
          <text
            x={cx}
            y={cy - 8}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={600}
            fill="var(--text-primary)"
            className="pointer-events-none"
          >
            {modeHeading(mode)}
          </text>
          <text
            x={cx}
            y={cy + 8}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fill="var(--text-secondary)"
            className="pointer-events-none"
          >
            {totalFiles} files
          </text>

          {/* Risk legend */}
          {(['critical', 'high', 'medium', 'low'] as const).map((risk, i) => (
            <g
              key={risk}
              transform={`translate(10, ${dims.height - 80 + i * 17})`}
            >
              <rect
                width={10}
                height={10}
                rx={2}
                fill={riskColor(risk, 0.75)}
              />
              <text x={16} y={9} fontSize={9} fill="var(--text-secondary)">
                {risk.charAt(0).toUpperCase() + risk.slice(1)} risk
              </text>
            </g>
          ))}

          {/* Author legend */}
          {authorNames.slice(0, 6).map((email, i) => (
            <g
              key={email}
              transform={`translate(${dims.width - 110}, ${dims.height - Math.min(authorNames.length, 6) * 16 + i * 16})`}
            >
              <circle
                cx={5}
                cy={4}
                r={5}
                fill={authorColor(email)}
                fillOpacity={0.85}
              />
              <text x={14} y={8} fontSize={9} fill="var(--text-secondary)">
                {displayName(email, nameByEmail)}
              </text>
            </g>
          ))}
        </svg>

        {tooltip && (
          <div
            className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20 max-w-80 break-all"
            style={{ left: tooltip.x + 14, top: tooltip.y - 8 }}
          >
            {tooltip.kind === 'author' ? (
              <>
                <div className="font-semibold mb-0.5">{tooltip.name}</div>
                <div className="text-text-secondary">{tooltip.email}</div>
                <div className="text-text-secondary mt-0.5">
                  {tooltip.fileCount} file{tooltip.fileCount !== 1 ? 's' : ''}{' '}
                  owned
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold mb-0.5 break-all">
                  {tooltip.file}
                </div>
                <div
                  className="mt-0.5 capitalize"
                  style={{ color: riskColor(tooltip.risk, 1) }}
                >
                  {tooltip.risk} risk
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {caption != null && <HeroCaption primary={caption} />}
    </div>
  );
}
