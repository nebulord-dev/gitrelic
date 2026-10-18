// Which analyzers single out a file — the inspector's "jump to" list. Only
// the ones that flag it as notable, not every analyzer that merely lists it.

import type { GitrelicReport } from '@gitrelic/core';

export function fileMentions(file: string, report: GitrelicReport): string[] {
  const out: string[] = [];
  const has = <T extends { file: string }>(
    list: readonly T[],
    keep: (x: T) => boolean = () => true,
  ) => list.some((x) => x.file === file && keep(x));

  if (
    has(
      report.hotspots.files,
      (h) => h.category === 'critical' || h.category === 'warning',
    )
  ) {
    out.push('hotspots');
  }
  if (has(report.cursedFiles.files)) out.push('cursed-files');
  if (has(report.deadCode.candidates)) out.push('dead-code');
  if (has(report.busFactors.criticalFiles)) out.push('bus-factor');
  if (
    report.coupling.topPairs.some((p) => p.fileA === file || p.fileB === file)
  ) {
    out.push('coupling');
  }
  if (has(report.ghostFiles.files)) out.push('ghost-files');
  return out;
}
