import { useEffect, useMemo, useRef, useState } from 'react';

import { authorColor } from '../../utils/colors';

import type { GitrelicReport } from '@gitrelic/core';

export interface LanguageSegment {
  language: string;
  loc: number;
}

export interface LanguageRow {
  directory: string;
  totalLoc: number;
  segments: LanguageSegment[];
}

export interface LanguagesData {
  rows: LanguageRow[];
  maxRowLoc: number;
}

export function directoryFor(file: string, depth = 2): string {
  const parts = file.split('/');
  if (parts.length <= 1) return '(root)';
  const dirSegments = parts.slice(0, parts.length - 1);
  return dirSegments.slice(0, depth).join('/');
}

export function prepareLanguagesData(report: GitrelicReport, topN = 30): LanguagesData {
  const dirToLangs = new Map<string, Map<string, number>>();
  for (const f of report.loc.files) {
    const dir = directoryFor(f.file);
    if (!dirToLangs.has(dir)) dirToLangs.set(dir, new Map());
    const langMap = dirToLangs.get(dir)!;
    langMap.set(f.language, (langMap.get(f.language) ?? 0) + f.lines);
  }

  const rows: LanguageRow[] = [];
  for (const [directory, langMap] of dirToLangs) {
    const segments: LanguageSegment[] = [];
    let totalLoc = 0;
    for (const [language, loc] of langMap) {
      segments.push({ language, loc });
      totalLoc += loc;
    }
    segments.sort((a, b) => b.loc - a.loc);
    rows.push({ directory, totalLoc, segments });
  }

  rows.sort((a, b) => b.totalLoc - a.totalLoc);
  const top = rows.slice(0, topN);

  let maxRowLoc = 0;
  for (const r of top) {
    if (r.totalLoc > maxRowLoc) maxRowLoc = r.totalLoc;
  }

  return { rows: top, maxRowLoc };
}

const KNOWN_LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  TSX: '#61dafb',
  JSX: '#61dafb',
  Python: '#3776ab',
  Markdown: '#888888',
  JSON: '#999999',
  YAML: '#cb171e',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Shell: '#89e051',
  Go: '#00add8',
  Rust: '#dea584',
  Ruby: '#cc342d',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  PHP: '#4f5d95',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Other: '#444444',
};

function languageColor(language: string): string {
  return KNOWN_LANGUAGE_COLORS[language] ?? authorColor(language);
}

interface LanguagesStackedBarProps {
  report: GitrelicReport;
}

export function LanguagesStackedBar({ report }: LanguagesStackedBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    directory: string;
    segment: LanguageSegment;
    rowTotal: number;
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

  const { rows, maxRowLoc } = useMemo(() => prepareLanguagesData(report), [report]);

  // Top-N languages across all rows for the legend (computed unconditionally
  // before the early return so the hook order stays stable across renders).
  const legendLanguages = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) {
      for (const s of r.segments) {
        totals.set(s.language, (totals.get(s.language) ?? 0) + s.loc);
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([language]) => language);
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center text-text-tertiary text-xs"
      >
        No language data detected.
      </div>
    );
  }

  const labelWidth = 280;
  const rightPad = 80;
  const topPad = 16;
  const bottomPad = 16;
  const available = Math.max(120, dims.width - labelWidth - rightPad);
  const rowHeight = Math.max(20, (dims.height - topPad - bottomPad) / Math.max(rows.length, 1));
  const barHeight = Math.max(10, rowHeight - 6);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg width={dims.width} height={dims.height}>
        {rows.map((row, i) => {
          const y = topPad + i * rowHeight;
          const rowFraction = maxRowLoc > 0 ? row.totalLoc / maxRowLoc : 0;
          const rowWidth = Math.max(2, rowFraction * available);

          let xCursor = labelWidth;
          return (
            <g key={row.directory}>
              <text
                x={labelWidth - 8}
                y={y + barHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fontFamily="var(--font-mono)"
                fill="var(--text-secondary)"
              >
                {row.directory}
              </text>
              {row.segments.map((seg) => {
                const segFraction = row.totalLoc > 0 ? seg.loc / row.totalLoc : 0;
                const segWidth = Math.max(0, segFraction * rowWidth);
                const x = xCursor;
                xCursor += segWidth;
                return (
                  <rect
                    key={`${row.directory}-${seg.language}`}
                    x={x}
                    y={y}
                    width={segWidth}
                    height={barHeight}
                    fill={languageColor(seg.language)}
                    fillOpacity={0.8}
                    className="cursor-pointer"
                    onMouseEnter={(evt) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      setTooltip({
                        x: evt.clientX - rect.left,
                        y: evt.clientY - rect.top,
                        directory: row.directory,
                        segment: seg,
                        rowTotal: row.totalLoc,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
              <text
                x={labelWidth + rowWidth + 6}
                y={y + barHeight / 2}
                dominantBaseline="middle"
                fontSize={10}
                fontFamily="var(--font-mono)"
                fill="var(--text-secondary)"
                className="pointer-events-none"
              >
                {row.totalLoc.toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Language legend overlaid in the bottom-right */}
      <div className="absolute right-2 bottom-2 flex flex-wrap gap-x-2.5 gap-y-1 max-w-80 text-[9px] text-text-tertiary bg-surface-elevated border border-border-primary rounded px-2 py-1.5">
        {legendLanguages.map((lang) => (
          <span key={lang} className="inline-flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-xs"
              style={{ background: languageColor(lang) }}
            />
            {lang}
          </span>
        ))}
      </div>
      {tooltip && (
        <div
          className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20 max-w-80 break-all"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <div className="font-semibold mb-0.5">{tooltip.directory}</div>
          <div style={{ color: languageColor(tooltip.segment.language) }}>
            {tooltip.segment.language} · {tooltip.segment.loc.toLocaleString()} LOC ·{' '}
            {tooltip.rowTotal > 0
              ? `${Math.round((tooltip.segment.loc / tooltip.rowTotal) * 100)}%`
              : '0%'}
          </div>
        </div>
      )}
    </div>
  );
}
