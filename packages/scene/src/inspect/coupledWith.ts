// The file card's "Changes with": the files a file is committed alongside
// most, by how many commits they share (then by coupling strength).

import type { GitrelicReport } from '@gitrelic/core';

export interface CoupledFile {
  file: string;
  coCommits: number;
  /** Share of the rarer file's commits that include the other, 0..100. */
  strength: number;
}

export function coupledWith(
  file: string,
  report: GitrelicReport,
  limit = 4,
): CoupledFile[] {
  return report.coupling.pairs
    .filter((p) => p.fileA === file || p.fileB === file)
    .map((p) => ({
      file: p.fileA === file ? p.fileB : p.fileA,
      coCommits: p.coCommits,
      strength: Math.round(p.couplingStrength),
    }))
    .sort((a, b) => b.coCommits - a.coCommits || b.strength - a.strength)
    .slice(0, limit);
}
