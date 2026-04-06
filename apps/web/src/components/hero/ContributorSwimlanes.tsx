import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear, scaleTime } from 'd3-scale';

import { authorColor } from '../../utils/colors';

import type { GitloreReport } from '@gitlore/core';

interface ContributorSwimlanesProps {
  report: GitloreReport;
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

export function prepareSwimlaneData(report: GitloreReport): SwimLane[] {
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
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
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
        ? new Date(Math.max(...authorCommits.map((c) => c.date.getTime())))
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
    return { min: new Date(Math.min(...dates)), max: new Date(Math.max(...dates)) };
  }, [report.commits]);

  const trackWidth = width - LABEL_WIDTH;
  const xScale = scaleTime().domain([timeRange.min, timeRange.max]).range([0, trackWidth]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'auto', position: 'relative' }}
    >
      {/* Time axis */}
      <div style={{ display: 'flex', height: 20, marginBottom: 4, flexShrink: 0 }}>
        <div style={{ width: LABEL_WIDTH, flexShrink: 0 }} />
        <svg style={{ flex: 1 }} height={20}>
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
        const maxWeekly = Math.max(...lane.weeklyIntensity, 1);
        const intensityScale = scaleLinear().domain([0, maxWeekly]).range([0.03, 0.8]);

        return (
          <div
            key={lane.email}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              height: LANE_HEIGHT,
              marginBottom: 4,
            }}
          >
            {/* Name label */}
            <div
              onClick={() => onSelectContributor(lane.email)}
              style={{
                width: LABEL_WIDTH,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                paddingRight: 12,
                cursor: 'pointer',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-primary)',
                    fontWeight: isSelected ? 700 : 600,
                  }}
                >
                  {lane.name}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                  {lane.isGhost && (
                    <span style={{ color: 'rgba(248,81,73,0.8)', marginRight: 4 }}>ghost</span>
                  )}
                  {lane.commitCount} commits
                </div>
              </div>
            </div>

            {/* Swimlane track */}
            <div
              style={{
                flex: 1,
                position: 'relative',
                borderRadius: 4,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {/* Layer 1: Activity bars */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  padding: `4px 2px ${HEATSTRIP_H + 2}px 2px`,
                  display: 'flex',
                  gap: 1,
                  alignItems: 'stretch',
                }}
              >
                {lane.weeklyIntensity.map((count, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      background: count > 0 ? color : 'transparent',
                      opacity: count > 0 ? 0.15 + intensityScale(count) * 0.15 : 0,
                      borderRadius: 1,
                    }}
                  />
                ))}
              </div>

              {/* Layer 2: Commit dots */}
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  bottom: HEATSTRIP_H,
                  pointerEvents: 'none',
                }}
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
                      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (c.files.length > 0) onSelectFile(c.files[0]);
                      }}
                      onMouseEnter={(e) => {
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (rect) {
                          setTooltip({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                            commit: c,
                            author: lane.name,
                          });
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </svg>

              {/* Layer 3: Heatstrip */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: HEATSTRIP_H,
                  display: 'flex',
                  gap: 1,
                  padding: '0 2px',
                }}
              >
                {lane.weeklyIntensity.map((count, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      background: color,
                      opacity: intensityScale(count),
                      borderRadius: 1,
                    }}
                  />
                ))}
              </div>

              {/* Ghost cutoff line */}
              {lane.isGhost && lane.lastActiveDate && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: xScale(lane.lastActiveDate),
                      borderLeft: '1px dashed rgba(248,81,73,0.3)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      left: xScale(lane.lastActiveDate) + 4,
                      fontSize: 8,
                      color: 'rgba(248,81,73,0.5)',
                    }}
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
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {tooltip.commit.files[0] ?? 'no files'}
            {tooltip.commit.isHotspot && (
              <span style={{ color: 'rgba(248,81,73,0.9)', marginLeft: 4 }}>hotspot</span>
            )}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
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
