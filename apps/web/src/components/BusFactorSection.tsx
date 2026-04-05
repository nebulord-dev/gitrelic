import type { GitloreReport } from '@gitlore/core';
import { fmt } from './theme';

interface BusFactorSectionProps {
  report: GitloreReport;
}

function mostAtRiskDirectory(files: { file: string }[]): string | null {
  if (files.length === 0) return null;
  const counts = new Map<string, number>();
  for (const f of files) {
    const lastSlash = f.file.lastIndexOf('/');
    const dir = lastSlash === -1 ? '.' : f.file.slice(0, lastSlash);
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  let topDir = '';
  let topCount = 0;
  for (const [dir, count] of counts) {
    if (count > topCount) {
      topDir = dir;
      topCount = count;
    }
  }
  return topDir || null;
}

export function BusFactorSection({ report }: BusFactorSectionProps) {
  const criticalFiles = report.busFactors.criticalFiles;
  const topFiles = criticalFiles.slice(0, 8);
  const atRiskDir = mostAtRiskDirectory(criticalFiles);

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
        Bus Factor Risk — Single-Owner Files
      </div>

      {/* Header line */}
      <div
        style={{
          fontSize: 13,
          color: 'var(--fg)',
          marginBottom: 12,
        }}
      >
        {fmt(criticalFiles.length)} files owned by a single author
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
              {f.dominantAuthorPercent}%
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      {atRiskDir !== null && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--fg3)',
            marginTop: 12,
            borderTop: '0.5px solid var(--border)',
            paddingTop: 8,
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)' }}>{atRiskDir}</span> is most at risk
        </div>
      )}
    </div>
  );
}
