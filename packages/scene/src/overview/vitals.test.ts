import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { repoVitals } from './vitals';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;

describe('repoVitals', () => {
  it('reads six figures off the report', () => {
    const v = Object.fromEntries(repoVitals(report).map((x) => [x.key, x]));
    expect(Object.keys(v)).toEqual([
      'files',
      'lines',
      'commits',
      'contributors',
      'ai',
      'language',
    ]);
    expect(v.files.lead).toBe(
      new Intl.NumberFormat('en').format(report.meta.totalFiles),
    );
    expect(v.commits.lead).toBe(String(report.meta.totalCommits));
    expect(v.contributors).toMatchObject({
      lead: String(report.contributors.activeContributors.length),
      sub: `active of ${report.contributors.contributors.length}`,
    });
  });

  it('formats large numbers compactly, in English', () => {
    const big = {
      ...report,
      meta: { ...report.meta, totalFiles: 7009, totalCommits: 12345 },
      loc: {
        ...report.loc,
        totalLines: 999_400,
        languages: [
          {
            ...report.loc.languages[0],
            language: 'JavaScript',
            percentage: 65.6,
          },
        ],
      },
      coAuthors: { ...report.coAuthors, aiAdoptionPercent: 3.2 },
    } as GitrelicReport;
    const v = Object.fromEntries(repoVitals(big).map((x) => [x.key, x]));
    expect(v.files.lead).toBe('7,009');
    expect(v.commits.lead).toBe('12,345');
    expect(v.lines.lead).toBe('999K');
    expect(v.ai.lead).toBe('3%');
    expect(v.language).toMatchObject({ lead: '66%', sub: 'JavaScript' });
  });

  it('reads missing lines and languages as a dash, never zero', () => {
    const empty = {
      ...report,
      loc: { ...report.loc, totalLines: 0, languages: [] },
    } as GitrelicReport;
    const v = Object.fromEntries(repoVitals(empty).map((x) => [x.key, x]));
    expect(v.lines.lead).toBe('—');
    expect(v.language).toMatchObject({ lead: '—', sub: 'none counted' });
  });
});
