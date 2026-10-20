// The sample repo with fix rate rating three files: helpers.ts, config.ts and
// auth.ts each earn the 20 `fixes` points, so three files are cursed and all
// three share churn, ownership and fix commits. The fixture itself rates no
// file for fix rate, so tests that need a multi-file cursed set or a `fixes`
// segment build their input here.

import reportJson from './fixtures/report.small.json';
import type { CursedFile, GitrelicReport } from '@gitrelic/core';

const base = reportJson as unknown as GitrelicReport;

export const FIXES_LABEL =
  '4 of 10 changes needed a fix within 30 days, more than chance explains';

const all = [...base.cursedFiles.files, ...(base.cursedFiles.nearMisses ?? [])];

function withFixes(path: string): CursedFile {
  const f = all.find((c) => c.file === path);
  if (!f) throw new Error(`no ${path} in the fixture's cursed files`);
  return {
    ...f,
    curseScore: f.curseScore + 20,
    reasons: [...f.reasons, FIXES_LABEL],
    breakdown: [
      ...f.breakdown,
      { kind: 'fixes', label: FIXES_LABEL, points: 20 },
    ],
  };
}

/** helpers.ts 85, config.ts and auth.ts 65 (cursed); index.ts and api.ts 45. */
export function fixesReport(): GitrelicReport {
  const fixed = ['src/helpers.ts', 'src/config.ts', 'src/auth.ts'];
  return {
    ...base,
    cursedFiles: {
      ...base.cursedFiles,
      files: fixed.map(withFixes),
      nearMisses: all.filter(
        (c) => !fixed.includes(c.file) && c.curseScore < 50,
      ),
    },
  };
}
