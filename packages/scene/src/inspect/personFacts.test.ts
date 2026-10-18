import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import {
  dirFacts,
  fileContributors,
  personFacts,
  reportNow,
} from './personFacts';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;

describe('personFacts', () => {
  it('summarises a contributor', () => {
    const p = personFacts('alice@example.com', report);
    expect(p).toMatchObject({ name: 'Alice', status: 'active', aliases: [] });
    expect(p?.focusAreas[0]).toBe('src/helpers.ts');
    const rows = Object.fromEntries(
      (p?.rows ?? []).map((r) => [r.label, r.value]),
    );
    expect(rows.Commits).toBe('13');
    expect(rows['Off-hours commits']).toBe('0% late · 38% weekend');
  });

  it('dates older reports without meta.lastCommit from the newest commit', () => {
    const old = {
      ...report,
      meta: { ...report.meta, lastCommit: '' },
    } as GitrelicReport;
    const newest = Math.max(
      ...report.contributors.contributors.map((c) => Date.parse(c.lastCommit)),
    );
    expect(reportNow(old)).toBe(newest);
    const values = (personFacts('alice@example.com', old)?.rows ?? []).map(
      (r) => r.value,
    );
    expect(values.join(' ')).not.toMatch(/NaN/);
  });

  it('shows ages as unknown when nothing in the report has a date', () => {
    const bare = {
      ...report,
      meta: { ...report.meta, lastCommit: '' },
      contributors: {
        ...report.contributors,
        contributors: report.contributors.contributors.map((c) => ({
          ...c,
          lastCommit: '',
        })),
      },
    } as GitrelicReport;
    const rows = Object.fromEntries(
      (personFacts('alice@example.com', bare)?.rows ?? []).map((r) => [
        r.label,
        r.value,
      ]),
    );
    expect(rows['First commit']).toBe('—');
    expect(rows['Last commit']).toBe('—');
  });

  it('omits the off-hours row for people without a stress profile', () => {
    const p = personFacts('bob@example.com', report);
    expect(p?.rows.map((r) => r.label)).not.toContain('Off-hours commits');
  });

  it('flags a ghost’s last commit and lists merged aliases', () => {
    const ghost = {
      ...report,
      contributors: {
        ...report.contributors,
        contributors: report.contributors.contributors.map((c) =>
          c.email === 'bob@example.com'
            ? { ...c, isActive: false, isGhost: true }
            : c,
        ),
      },
      identities: [
        {
          canonicalEmail: 'bob@example.com',
          name: 'Bob',
          aliases: [
            { email: 'bob@example.com', name: 'Bob', commits: 3 },
            { email: 'Bob@Example.com', name: 'Bob', commits: 1 },
          ],
        },
      ],
    } as GitrelicReport;
    const p = personFacts('bob@example.com', ghost);
    expect(p?.status).toBe('ghost');
    expect(p?.aliases).toEqual(['Bob@Example.com']);
    expect(p?.rows.find((r) => r.label === 'Last commit')?.tier).toBe(
      'critical',
    );
  });

  it('returns null for someone not in the report', () => {
    expect(personFacts('nobody@example.com', report)).toBeNull();
  });
});

describe('fileContributors', () => {
  it('lists authors with the dominant share', () => {
    expect(fileContributors('src/api.ts', report)).toEqual([
      { email: 'alice@example.com', name: 'Alice', percent: 100 },
    ]);
    expect(fileContributors('nope.ts', report)).toEqual([]);
  });
});

describe('dirFacts', () => {
  it('sums a directory without counting lookalike siblings', () => {
    const rows = Object.fromEntries(
      dirFacts('src', report).map((r) => [r.label, r.value]),
    );
    expect(rows.Files).toBe('7');
    const lookalike = dirFacts('sr', report);
    expect(lookalike.find((r) => r.label === 'Files')?.value).toBe('0');
  });
});
