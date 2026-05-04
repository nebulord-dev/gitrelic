import { fmt } from '../../components/theme';
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function ghostFilesMetrics(report: GitrelicReport): Metric[] {
  const gf = report.ghostFiles;
  const totalLines = report.loc.totalLines;
  const ghostLocPercent = totalLines > 0 ? (gf.ghostLoc / totalLines) * 100 : 0;

  return [
    {
      label: 'Ghost Files',
      value: String(gf.totalGhostFiles),
      color:
        gf.totalGhostFiles === 0
          ? 'var(--severity-healthy)'
          : gf.totalGhostFiles < 10
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
    {
      label: 'Ghost Owners',
      value: String(gf.ghostOwners),
      color:
        gf.ghostOwners === 0
          ? 'var(--severity-healthy)'
          : gf.ghostOwners < 3
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
    {
      label: 'True Ghosts (≥365d)',
      value: String(gf.tierMix.trueGhost),
      color:
        gf.tierMix.trueGhost === 0
          ? 'var(--severity-healthy)'
          : 'var(--severity-critical)',
    },
    {
      label: 'Fading (180–364d)',
      value: String(gf.tierMix.fading),
      color:
        gf.tierMix.fading === 0
          ? 'var(--severity-healthy)'
          : gf.tierMix.fading < 10
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
    {
      label: 'Ghost LOC',
      value: fmt(gf.ghostLoc),
      color:
        ghostLocPercent < 2
          ? 'var(--severity-healthy)'
          : ghostLocPercent < 10
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
  ];
}
