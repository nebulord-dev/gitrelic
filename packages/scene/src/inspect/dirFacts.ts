// The inspector's directory card: size and activity under one path prefix.

import type { FileFact } from './fileFacts';
import type { GitrelicReport } from '@gitrelic/core';

const fmt = (n: number) => n.toLocaleString();

/** A directory's size and activity, for its inspector card. */
export function dirFacts(dir: string, report: GitrelicReport): FileFact[] {
  const prefix = `${dir}/`;
  const inDir = <T extends { file: string }>(list: readonly T[]) =>
    list.filter((x) => x.file.startsWith(prefix));
  const loc = inDir(report.loc.files);
  const churn = inDir(report.churn.files);
  const lines = loc.reduce((sum, f) => sum + f.lines, 0);
  const commits = churn.reduce((sum, f) => sum + f.commitCount, 0);
  const critical = inDir(report.hotspots.files).filter(
    (h) => h.category === 'critical',
  ).length;
  const rows: FileFact[] = [
    { label: 'Files', value: fmt(loc.length) },
    { label: 'Lines of code', value: fmt(lines) },
    { label: 'File changes', value: fmt(commits) },
  ];
  if (critical > 0)
    rows.push({
      label: 'Critical hotspots',
      value: fmt(critical),
      tier: 'critical',
    });
  return rows;
}
