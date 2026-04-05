import type { GitloreReport } from '@gitlore/core';
import { fmt } from './theme';

interface ShameSectionProps {
  report: GitloreReport;
}

export function ShameSection({ report }: ShameSectionProps) {
  const { shameLeaderboard, totalShameCommits } = report.forensics;
  const topFiles = shameLeaderboard.slice(0, 6);

  return (
    <div>
      {/* Section label */}
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          color: 'var(--fg3)',
          letterSpacing: '0.08em',
          marginBottom: 10,
        }}
      >
        Shame — Files with Repeated Fix Commits
      </div>

      {/* File list */}
      <div>
        {topFiles.map((f, i) => (
          <div
            key={f.file}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 0',
              borderTop: i === 0 ? 'none' : '0.5px solid var(--border)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--fg)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                marginRight: 12,
              }}
            >
              {f.file}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--red)',
                flexShrink: 0,
              }}
            >
              {f.shameScore}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--fg3)',
          marginTop: 12,
          borderTop: '0.5px solid var(--border)',
          paddingTop: 8,
        }}
      >
        {fmt(totalShameCommits)} shame commits total
      </div>
    </div>
  );
}
