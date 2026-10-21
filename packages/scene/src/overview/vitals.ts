// The Overview dashboard's vitals strip: the repo's size and make-up in six
// figures, each a number over what it counts. Descriptive, never graded.

import type { GitrelicReport } from '@gitrelic/core';

export interface Vital {
  key: string;
  /** The figure, set large. */
  lead: string;
  /** What it counts. */
  label: string;
  /** Its context: "active of 77", "of commits". */
  sub: string;
}

// English on purpose, as the repo reading's (readings.ts): the words around
// the numbers are English.
const en = new Intl.NumberFormat('en');
const compact = new Intl.NumberFormat('en', { notation: 'compact' });
const pct = (x: number) => `${Math.round(x)}%`;

/** Files, lines, commits, people, AI share and the main language. */
export function repoVitals(report: GitrelicReport): Vital[] {
  const lines = report.loc.totalLines;
  const language = report.loc.languages[0];
  const people = report.contributors;
  return [
    {
      key: 'files',
      lead: en.format(report.meta.totalFiles),
      label: 'Files',
      sub: 'tracked',
    },
    {
      key: 'lines',
      // Missing data reads as an em dash, never as zero.
      lead: lines > 0 ? compact.format(lines) : '—',
      label: 'Lines',
      sub: 'of code',
    },
    {
      key: 'commits',
      lead: en.format(report.meta.totalCommits),
      label: 'Commits',
      sub: 'in the window',
    },
    {
      key: 'contributors',
      lead: en.format(people.activeContributors.length),
      label: 'Contributors',
      sub: `active of ${en.format(people.contributors.length)}`,
    },
    {
      key: 'ai',
      lead: pct(report.coAuthors.aiAdoptionPercent),
      label: 'AI-assisted',
      sub: 'of commits',
    },
    {
      key: 'language',
      lead: language ? pct(language.percentage) : '—',
      label: 'Language',
      sub: language?.language ?? 'none counted',
    },
  ];
}
