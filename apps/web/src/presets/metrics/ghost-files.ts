import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function ghostFilesMetrics(report: GitrelicReport): Metric[] {
  const ghosts = report.ghostFiles.files;
  const total = ghosts.length;

  let trueGhosts = 0;
  let fading = 0;
  let ghostLoc = 0;
  let maxInactive = 0;

  for (const f of ghosts) {
    if (f.authorInactiveDays > 365) {
      trueGhosts += 1;
    } else if (f.authorInactiveDays >= 180) {
      fading += 1;
    }
    ghostLoc += f.loc;
    if (f.authorInactiveDays > maxInactive) {
      maxInactive = f.authorInactiveDays;
    }
  }

  return [
    {
      label: 'Ghost Files',
      value: String(total),
      color: total > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'True Ghosts (>365d)',
      value: String(trueGhosts),
      color: trueGhosts > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Fading (180–365d)',
      value: String(fading),
      color: fading > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Ghost LOC',
      value: fmt(ghostLoc),
      color: ghostLoc > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Max Inactive Days',
      value: total > 0 ? String(maxInactive) : '—',
      color:
        total === 0
          ? 'var(--severity-healthy)'
          : maxInactive > 365
            ? 'var(--severity-critical)'
            : 'var(--severity-warning)',
    },
  ];
}
