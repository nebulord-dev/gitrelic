import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear, scaleTime } from 'd3-scale';

import { authorColor } from '../../utils/colors';

import type { GitrelicReport } from '@gitrelic/core';

interface ContributorSwimlanesProps {
  report: GitrelicReport;
  selectedFile: string | null;
  selectedContributor: string | null;
  onSelectFile: (file: string) => void;
  onSelectContributor: (email: string) => void;
}

export interface SwimCommit {
  date: Date;
  files: string[];
  isHotspot: boolean;
}

export interface SwimLane {
  email: string;
  name: string;
  commitCount: number;
  commits: SwimCommit[];
  weeklyIntensity: number[];
  isGhost: boolean;
  lastActiveDate: Date | null;
}

const LANE_HEIGHT = 56;
const HEATSTRIP_H = 8;
const LABEL_WIDTH = 130;

export function prepareSwimlaneData(report: GitrelicReport): SwimLane[] {
  const commits = report.commits ?? [];
  const hotspotFiles = new Set(
    report.hotspots.files
      .filter((h) => h.category === 'critical' || h.category === 'warning')
      .map((h) => h.file),
  );
  const ghostAuthors = new Set(report.ghostFiles.files.map((g) => g.dominantAuthor));

  // Group commits by author
  const byAuthor = new Map<string, SwimCommit[]>();
  for (const c of commits) {
    const isHotspot = c.files.some((f) => hotspotFiles.has(f));
    const entry: SwimCommit = { date: new Date(c.date), files: c.files, isHotspot };
    const arr = byAuthor.get(c.authorEmail) ?? [];
    arr.push(entry);
    byAuthor.set(c.authorEmail, arr);
  }

  // Date range for weekly binning
  if (commits.length === 0) return [];
  const allDates = commits.map((c) => new Date(c.date).getTime());
  const minDate = new Date(allDates.reduce((m, d) => (d < m ? d : m), allDates[0]));
  const maxDate = new Date(allDates.reduce((m, d) => (d > m ? d : m), allDates[0]));
  const startMonday = new Date(minDate);
  startMonday.setUTCDate(startMonday.getUTCDate() - ((startMonday.getUTCDay() + 6) % 7));
  startMonday.setUTCHours(0, 0, 0, 0);
  const totalWeeks = Math.ceil((maxDate.getTime() - startMonday.getTime()) / (7 * 86_400_000)) + 1;

  // Build lanes from contributor report (sorted by commit count)
  const sorted = [...report.contributors.contributors].sort(
    (a, b) => b.commitCount - a.commitCount,
  );

  return sorted.map((contrib) => {
    const authorCommits = byAuthor.get(contrib.email) ?? [];
    const weekly = new Array(totalWeeks).fill(0);
    for (const c of authorCommits) {
      const idx = Math.floor((c.date.getTime() - startMonday.getTime()) / (7 * 86_400_000));
      if (idx >= 0 && idx < totalWeeks) weekly[idx]++;
    }

    const isGhost = ghostAuthors.has(contrib.email) || !contrib.isActive;
    const lastActiveDate =
      authorCommits.length > 0
        ? new Date(
            authorCommits.reduce((m, c) => {
              const t = c.date.getTime();
              return t > m ? t : m;
            }, 0),
          )
        : null;

    return {
      email: contrib.email,
      name: contrib.name,
      commitCount: contrib.commitCount,
      commits: authorCommits.sort((a, b) => a.date.getTime() - b.date.getTime()),
      weeklyIntensity: weekly,
      isGhost,
      lastActiveDate,
    };
  });
}

export function ContributorSwimlanes({
  report,
  selectedContributor,
  onSelectFile,
  onSelectContributor,
}: ContributorSwimlanesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    commit: SwimCommit;
    author: string;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const lanes = useMemo(() => prepareSwimlaneData(report), [report]);

  const timeRange = useMemo(() => {
    const commits = report.commits ?? [];
    if (commits.length === 0) return { min: new Date(), max: new Date() };
    const dates = commits.map((c) => new Date(c.date).getTime());
    return {
      min: new Date(dates.reduce((m, d) => (d < m ? d : m), dates[0])),
      max: new Date(dates.reduce((m, d) => (d > m ? d : m), dates[0])),
    };
  }, [report.commits]);

  const trackWidth = width - LABEL_WIDTH;
  const xScale = scaleTime().domain([timeRange.min, timeRange.max]).range([0, trackWidth]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-auto relative">
      {/* Time axis */}
      <div className="flex h-5 mb-1 shrink-0">
        <div className="w-[130px] shrink-0" />
        <svg className="flex-1" height={20}>
          {xScale.ticks(8).map((date) => (
            <text
              key={date.toISOString()}
              x={xScale(date)}
              y={14}
              textAnchor="middle"
              fontSize={8}
              fill="var(--text-tertiary)"
            >
              {date.toLocaleDateString('en', { month: 'short', year: '2-digit' })}
            </text>
          ))}
        </svg>
      </div>
      {lanes.map((lane) => {
        const isSelected = selectedContributor === lane.email;
        const color = authorColor(lane.email);
        const maxWeekly = lane.weeklyIntensity.reduce((m, v) => (v > m ? v : m), 1);
        const intensityScale = scaleLinear().domain([0, maxWeekly]).range([0.03, 0.8]);

        return (
          <div key={lane.email} className="flex items-stretch h-14 mb-1">
            {/* Name label */}
            <div
              onClick={() => onSelectContributor(lane.email)}
              className="w-[130px] shrink-0 flex items-center pr-3 cursor-pointer"
            >
              <div>
                <div
                  className={`text-[11px] text-text-primary ${isSelected ? 'font-bold' : 'font-semibold'}`}
                >
                  {lane.name}
                </div>
                <div className="text-[9px] text-text-tertiary">
                  {lane.isGhost && (
                    <span className="mr-1" style={{ color: 'rgba(248,81,73,0.8)' }}>
                      ghost
                    </span>
                  )}
                  {lane.commitCount} commits
                </div>
              </div>
            </div>

            {/* Swimlane track */}
            <div
              className="flex-1 relative rounded overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {/* Layer 1: Activity bars */}
              <div className="absolute inset-0 flex items-stretch gap-px pt-1 px-0.5 pb-2.5">
                {lane.weeklyIntensity.map((count, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-[1px]"
                    style={{
                      background: count > 0 ? color : 'transparent',
                      opacity: count > 0 ? 0.15 + intensityScale(count) * 0.15 : 0,
                    }}
                  />
                ))}
              </div>

              {/* Layer 2: Commit dots */}
              <svg
                className="absolute inset-0 bottom-2 pointer-events-none"
                width={trackWidth}
                height={LANE_HEIGHT - HEATSTRIP_H}
              >
                {lane.commits.map((c, i) => {
                  const cx = xScale(c.date);
                  const cy = (LANE_HEIGHT - HEATSTRIP_H) / 2;
                  return (
                    <circle
                      key={i}
                      cx={cx}
                      cy={cy}
                      r={c.isHotspot ? 3 : 2.5}
                      fill={c.isHotspot ? 'rgba(248,81,73,0.9)' : color}
                      fillOpacity={c.isHotspot ? 0.9 : 0.7}
                      className="pointer-events-auto cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (c.files.length > 0) onSelectFile(c.files[0]);
                      }}
                      onMouseEnter={(e) => {
                        setTooltip({
                          x: e.clientX,
                          y: e.clientY,
                          commit: c,
                          author: lane.name,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </svg>

              {/* Layer 3: Heatstrip */}
              <div className="absolute bottom-0 left-0 right-0 h-2 flex gap-px px-0.5">
                {lane.weeklyIntensity.map((count, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-[1px]"
                    style={{
                      background: color,
                      opacity: intensityScale(count),
                    }}
                  />
                ))}
              </div>

              {/* Ghost cutoff line */}
              {lane.isGhost && lane.lastActiveDate && (
                <>
                  <div
                    className="absolute top-0 bottom-0 border-l border-dashed"
                    style={{
                      left: xScale(lane.lastActiveDate),
                      borderLeftColor: 'rgba(248,81,73,0.3)',
                    }}
                  />
                  <div
                    className="absolute top-1 text-[8px]"
                    style={{ left: xScale(lane.lastActiveDate) + 4, color: 'rgba(248,81,73,0.5)' }}
                  >
                    inactive
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
      {tooltip && (
        <div
          className="fixed bg-tooltip-bg border border-border-primary rounded pointer-events-none z-[1000] max-w-[300px] text-[10px] text-tooltip-text px-2.5 py-1.5"
          style={{
            left: Math.min(tooltip.x + 12, window.innerWidth - 320),
            top: tooltip.y - 8,
          }}
        >
          <div className="font-semibold mb-0.5">
            {tooltip.commit.files[0] ?? 'no files'}
            {tooltip.commit.isHotspot && (
              <span className="ml-1" style={{ color: 'rgba(248,81,73,0.9)' }}>
                hotspot
              </span>
            )}
          </div>
          <div className="text-text-secondary">
            {tooltip.author} ·{' '}
            {tooltip.commit.date.toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            · {tooltip.commit.files.length} files
          </div>
        </div>
      )}
    </div>
  );
}
