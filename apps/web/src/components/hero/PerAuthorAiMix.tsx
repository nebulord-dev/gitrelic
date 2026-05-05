import { useMemo } from 'react';

import { HeroCaption } from '../shared/HeroCaption';
import type { PerAuthorMixEntry } from '@gitrelic/core';

interface PerAuthorAiMixProps {
  rows: PerAuthorMixEntry[];
}

export function PerAuthorAiMix({ rows }: PerAuthorAiMixProps) {
  const maxTotal = useMemo(
    () => Math.max(1, ...rows.map((r) => r.totalCommits)),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="max-w-md text-text-secondary">
          No human authors to show in this analysis window.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {rows.map((r) => {
          const aiPct = (r.aiCommits / maxTotal) * 100;
          const soloPct = (r.soloCommits / maxTotal) * 100;
          return (
            <div key={r.author} className="flex h-8 items-center">
              <div className="w-[28%] truncate pr-3 text-right text-sm text-text-primary">
                {r.displayName}
              </div>
              <div className="relative h-3 flex-1 bg-surface-tertiary/30">
                <div
                  className="absolute left-0 top-0 h-full bg-accent-coupling"
                  style={{ width: `${aiPct}%` }}
                />
                <div
                  className="absolute top-0 h-full bg-surface-tertiary"
                  style={{ left: `${aiPct}%`, width: `${soloPct}%` }}
                />
              </div>
              <div className="w-[8%] pl-3 text-right font-mono text-sm text-text-secondary">
                {r.personalRatio}%
              </div>
            </div>
          );
        })}
      </div>
      <HeroCaption primary="Horizontal bars · one row per human · segment width = commit count · split by AI-assisted vs solo" />
    </div>
  );
}
