import { useEffect, useMemo, useRef, useState } from 'react';

import { hierarchy, pack } from 'd3-hierarchy';

import { authorColor } from '../../utils/colors';

import type { GitrelicReport } from '@gitrelic/core';
import type { HierarchyCircularNode } from 'd3-hierarchy';

interface OwnershipBubbleProps {
  report: GitrelicReport;
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

const UNKNOWN_AUTHOR = 'unknown';
const UNKNOWN_BUBBLE_COLOR = 'rgb(110, 110, 115)';
const LEGEND_WIDTH = 320;
// Empirical character-width factor for the SVG monospace fallback at small
// sizes. Slightly conservative so labels don't graze the bubble edge.
const CHAR_WIDTH_FACTOR = 0.58;

function bubbleColor(author: string): string {
  return author === UNKNOWN_AUTHOR ? UNKNOWN_BUBBLE_COLOR : authorColor(author);
}

// Trim a label to fit inside a bubble of the given radius at the given font
// size. Adds an ellipsis when trimmed.
export function fitLabel(text: string, radius: number, fontSize: number): string {
  const maxChars = Math.max(4, Math.floor((radius * 1.7) / (fontSize * CHAR_WIDTH_FACTOR)));
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

// Same as fitLabel but preserves the trailing percent suffix; only the author
// portion is trimmed when the combined label is too long. Falls back to just
// the percent when the bubble is too small to fit even one author character
// plus the suffix.
export function fitSubLabel(
  author: string,
  percent: number,
  radius: number,
  fontSize: number,
): string {
  const suffix = ` ${percent}%`;
  const maxChars = Math.max(4, Math.floor((radius * 1.7) / (fontSize * CHAR_WIDTH_FACTOR)));
  if (author.length + suffix.length <= maxChars) return `${author}${suffix}`;
  const authorBudget = maxChars - suffix.length - 1;
  if (authorBudget < 2) return `${percent}%`;
  return `${author.slice(0, authorBudget)}…${suffix}`;
}

export function buildDirectoryBubbles(report: GitrelicReport): DirBubble[] {
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

    const author = busFactorMap.get(f.file);
    if (author) {
      stats.authors.set(author, (stats.authors.get(author) ?? 0) + 1);
    }
  }

  // Convert to bubbles
  const bubbles: DirBubble[] = [];
  for (const [dirPath, stats] of dirStats) {
    // Find dominant author (owns most files in this dir)
    let dominantAuthor: string = UNKNOWN_AUTHOR;
    let maxCount = 0;
    for (const [author, count] of stats.authors) {
      if (count > maxCount) {
        maxCount = count;
        dominantAuthor = author;
      }
    }
    const dominantPercent =
      dominantAuthor === UNKNOWN_AUTHOR ? 0 : Math.round((maxCount / stats.fileCount) * 100);

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
  const chartRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; dir: DirBubble } | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(chartRef.current);
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
    const root = hierarchy<DirBubble>({ children: dirs } as any)
      .sum((d) => d.totalLoc ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = pack<DirBubble>().size([dims.width, dims.height]).padding(8);
    return layout(root).leaves() as HierarchyCircularNode<DirBubble>[];
  }, [report, dims.width, dims.height]);

  // Authors actually appearing as a dominant owner of at least one bubble.
  // Sorted by total file count desc so the most-impactful authors lead the
  // legend — same impact-weighted spirit as the bus-bar tiebreaker.
  // Defends against d3.hierarchy returning a synthetic root when dirs is empty.
  const legendAuthors = useMemo(() => {
    const fileCountByAuthor = new Map<string, number>();
    for (const leaf of packData) {
      const a = leaf.data?.dominantAuthor;
      if (!a || a === UNKNOWN_AUTHOR) continue;
      fileCountByAuthor.set(a, (fileCountByAuthor.get(a) ?? 0) + (leaf.data.fileCount ?? 0));
    }
    return [...fileCountByAuthor.entries()].sort((a, b) => b[1] - a[1]).map(([author]) => author);
  }, [packData]);

  const hasUnknown = useMemo(
    () =>
      packData.some(
        (leaf) => leaf.data?.dominantAuthor === UNKNOWN_AUTHOR && (leaf.data?.fileCount ?? 0) > 0,
      ),
    [packData],
  );

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0 }}>
        <div
          style={{
            flexShrink: 0,
            width: LEGEND_WIDTH,
            borderRight: '1px solid var(--border-primary)',
            padding: '12px 12px',
            overflowY: 'auto',
            fontSize: 10,
            color: 'var(--text-tertiary)',
          }}
        >
          <div
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 8,
              color: 'var(--text-tertiary)',
            }}
          >
            Authors
          </div>
          {legendAuthors.map((author) => (
            <div
              key={author}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 5,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 10,
                  height: 10,
                  background: bubbleColor(author),
                  borderRadius: 5,
                  opacity: 0.7,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={author}
              >
                {author}
              </span>
            </div>
          ))}
          {hasUnknown && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 8,
                fontStyle: 'italic',
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 10,
                  height: 10,
                  background: UNKNOWN_BUBBLE_COLOR,
                  borderRadius: 5,
                  opacity: 0.7,
                }}
              />
              <span>no commit data</span>
            </div>
          )}
        </div>
        <div ref={chartRef} style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <svg width={dims.width} height={dims.height} style={{ display: 'block' }}>
            {packData.map((leaf) => {
              const d = leaf.data;
              // d3.hierarchy returns a synthetic root with no DirBubble fields
              // when dirs is empty — skip it.
              if (!leaf.r || !d || !d.dirPath) return null;

              const author = d.dominantAuthor ?? UNKNOWN_AUTHOR;
              const firstFile = dirFirstFileMap.get(d.dirPath) ?? d.dirPath;
              const isSelected = selectedFile !== null && firstFile === selectedFile;
              const isUnknown = author === UNKNOWN_AUTHOR;
              const color = bubbleColor(author);
              const labelFontSize = Math.min(leaf.r / 4, 12);
              const subFontSize = Math.min(leaf.r / 5, 10);
              const fittedName = fitLabel(d.name, leaf.r, labelFontSize);
              const fittedSub = isUnknown
                ? fitLabel('no commit data', leaf.r, subFontSize)
                : fitSubLabel(author, d.dominantPercent, leaf.r, subFontSize);

              return (
                <g
                  key={d.dirPath}
                  onClick={() => onSelectFile(firstFile)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        dir: d,
                      });
                    }
                  }}
                  onMouseMove={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setTooltip((prev) =>
                      prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : prev,
                    );
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <circle
                    cx={leaf.x}
                    cy={leaf.y}
                    r={leaf.r}
                    fill={color}
                    fillOpacity={isUnknown ? 0.18 : 0.3}
                    stroke={isSelected ? 'var(--accent-primary)' : color}
                    strokeOpacity={isSelected ? 1 : isUnknown ? 0.35 : 0.5}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  {leaf.r > 16 && (
                    <text
                      x={leaf.x}
                      y={leaf.y - (leaf.r > 30 ? subFontSize : 0)}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={labelFontSize}
                      fill={isUnknown ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.9)'}
                      style={{ pointerEvents: 'none' }}
                    >
                      {fittedName}
                    </text>
                  )}
                  {leaf.r > 30 && (
                    <text
                      x={leaf.x}
                      y={leaf.y + labelFontSize + 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={subFontSize}
                      fill={isUnknown ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.6)'}
                      style={{ pointerEvents: 'none' }}
                    >
                      {fittedSub}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Sticky caption strip */}
      <div
        style={{
          flexShrink: 0,
          padding: '10px 16px',
          borderTop: '1px solid var(--border-primary)',
          background: 'var(--surface-primary)',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          One bubble per directory (2 levels deep) · size = total LOC · color = dominant author ·
          click to drill in
        </div>
      </div>

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
            maxWidth: 320,
            wordBreak: 'break-all',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.dir.dirPath}/</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {tooltip.dir.totalLoc.toLocaleString()} LOC · {tooltip.dir.fileCount} files
          </div>
          <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
            {tooltip.dir.dominantAuthor === UNKNOWN_AUTHOR
              ? 'No commit data for this directory'
              : `Owner: ${tooltip.dir.dominantAuthor} (${tooltip.dir.dominantPercent}%)`}
          </div>
        </div>
      )}
    </div>
  );
}
