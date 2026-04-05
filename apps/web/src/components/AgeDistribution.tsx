import { useMemo } from 'react';
import type { GitloreReport } from '@gitlore/core';
import { fmt } from './theme';

interface AgeDistributionProps {
  report: GitloreReport;
}

interface CellProps {
  label: string;
  value: number;
  color: string;
}

function Cell({ label, value, color }: CellProps) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        padding: '14px 16px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 500,
          color,
        }}
      >
        {fmt(value)}
      </div>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          color: 'var(--fg3)',
          letterSpacing: '0.08em',
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function AgeDistribution({ report }: AgeDistributionProps) {
  const { fresh, aging, stale, ancient, untouchedCount, oldestDays } = useMemo(() => {
    const files = report.ageMap.files;
    const ancientFiles = report.ageMap.ancientFiles;

    const fresh = files.filter((f) => f.status === 'fresh').length;
    const aging = files.filter((f) => f.status === 'aging').length;
    const stale = files.filter((f) => f.status === 'stale').length;
    const ancient = files.filter((f) => f.status === 'ancient').length;

    const untouchedCount = ancientFiles.length;
    const oldestDays =
      ancientFiles.length > 0
        ? Math.max(...ancientFiles.map((f) => f.ageInDays))
        : 239;

    return { fresh, aging, stale, ancient, untouchedCount, oldestDays };
  }, [report]);

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          color: 'var(--fg3)',
          letterSpacing: '0.08em',
          marginBottom: 10,
        }}
      >
        Codebase Age — {fmt(untouchedCount)} files untouched {oldestDays}+ days
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <Cell label="Fresh" value={fresh} color="var(--teal)" />
        <Cell label="Aging" value={aging} color="var(--amber)" />
        <Cell label="Stale" value={stale} color="var(--red)" />
        <Cell label="Ancient" value={ancient} color="var(--fg3)" />
      </div>
    </div>
  );
}
