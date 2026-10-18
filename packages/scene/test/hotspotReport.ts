// A report holding only what the Hotspots lens reads (churn and hotspots),
// for tests that need a shape the fixture doesn't have.

import type { GitrelicReport } from '@gitrelic/core';

/** Just the two sections hotspotPoints reads. */
export function hotspotReport(
  files: { file: string; commits: number; loc: number; score: number }[],
): GitrelicReport {
  const maxCount = Math.max(...files.map((f) => f.commits));
  return {
    churn: {
      files: files.map((f) => ({
        file: f.file,
        commitCount: f.commits,
        churnScore: Math.round((f.commits / maxCount) * 100),
        category: 'warm',
      })),
    },
    hotspots: {
      files: files.map((f) => ({
        file: f.file,
        hotspotScore: f.score,
        churnScore: Math.round((f.commits / maxCount) * 100),
        loc: f.loc,
        category: 'low',
      })),
    },
  } as unknown as GitrelicReport;
}
