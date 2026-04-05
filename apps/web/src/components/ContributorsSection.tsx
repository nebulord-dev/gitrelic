import { useMemo } from 'react';
import type { GitloreReport } from '@gitlore/core';

interface Props {
  report: GitloreReport;
}

const avatarColors = ['var(--red)', 'var(--amber)', 'var(--teal)', 'var(--blue)', 'var(--purple)'];

function getAvatarColor(name: string): string {
  return avatarColors[name.charCodeAt(0) % avatarColors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

export default function ContributorsSection({ report }: Props) {
  const topContributors = useMemo(
    () =>
      [...report.contributors.contributors]
        .sort((a, b) => b.commitCount - a.commitCount)
        .slice(0, 8),
    [report.contributors.contributors],
  );

  const hotspotOwnershipMap = useMemo(() => {
    const map = new Map<string, number>();
    const total = report.hotspots.topHotspots.length;
    if (total === 0) return map;

    for (const contributor of topContributors) {
      const owned = report.hotspots.topHotspots.filter((hotspot) => {
        const busFactor = report.busFactors.files.find((f) => f.file === hotspot.file);
        return busFactor?.dominantAuthor === contributor.email;
      }).length;
      if (owned > 0) {
        map.set(contributor.email, Math.round((owned / total) * 100));
      }
    }
    return map;
  }, [topContributors, report.hotspots.topHotspots, report.busFactors.files]);

  const ghostThreshold = 180;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Section label */}
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          color: 'var(--fg3)',
          letterSpacing: '0.08em',
        }}
      >
        Contributors — Ownership Concentration
      </div>

      {/* Contributor rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {topContributors.map((c) => {
          const avatarColor = getAvatarColor(c.name);
          const initials = getInitials(c.name);
          const hotspotPct = hotspotOwnershipMap.get(c.email);

          return (
            <div
              key={c.email}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: avatarColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 10,
                  color: '#fff',
                  fontWeight: 600,
                }}
              >
                {initials}
              </div>

              {/* Name */}
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--fg)',
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.name}
              </span>

              {/* Right-side stats */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 2,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--fg3)',
                  }}
                >
                  {c.commitCount} · {c.filesOwned} files
                </span>
                {hotspotPct !== undefined && hotspotPct > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--red)',
                    }}
                  >
                    {hotspotPct}% hotspot ownership
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--fg3)',
          fontFamily: 'var(--font-mono)',
          marginTop: 4,
        }}
      >
        {report.contributors.activeContributors.length} active ·{' '}
        {report.contributors.ghostContributors.length} ghosts ({ghostThreshold}+ days)
      </div>
    </div>
  );
}
