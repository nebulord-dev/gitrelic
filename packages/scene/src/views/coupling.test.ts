import { describe, expect, it } from 'vitest';

import { couplingReport } from '../../test/couplingReport';
import reportJson from '../../test/fixtures/report.small.json';
import { couplingFindings, couplingTable, couplingView } from './coupling';
import type { Finding } from '../model';
import type { GitrelicReport } from '@gitrelic/core';

const text = (f: Finding) =>
  f.segments.map((s) => (typeof s === 'string' ? s : s.text)).join('');
const find = (fs: Finding[], id: string) => fs.find((f) => f.id === id);

describe('couplingView', () => {
  it('is Boundaries alone, re-forming around a package or a file', () => {
    expect(couplingView.id).toBe('coupling');
    expect(couplingView.layouts.map((l) => l.id)).toEqual(['boundaries']);
    expect(couplingView.layouts[0].focusKinds).toEqual(['dir', 'file']);
    expect(couplingView.layouts[0].needsCommits).toBe(false);
  });
});

describe('couplingFindings', () => {
  const findings = couplingFindings({
    report: couplingReport(),
    commits: null,
  });

  it('names the strongest link between packages, and the files behind it', () => {
    const f = find(findings, 'strongest')!;
    expect(f.segments).toContainEqual({
      ref: 'dir:packages/client',
      text: 'client',
    });
    expect(text(f)).toBe(
      'client and server changed together in 14 commits (58% of client’s), most often api.ts with api.ts (12).',
    );
  });

  it('flags a family spread across packages: one change, made in several places', () => {
    const f = find(findings, 'family')!;
    expect(f.tone).toBe('warning');
    expect(text(f)).toBe(
      '2 files in 2 packages always change together (a.ts, flags.ts): one change, made in 2 places.',
    );
  });

  it('says how wide the widest changes go, and how many files are too thin to say', () => {
    expect(text(find(findings, 'blast')!)).toBe(
      '1 of 3 files usually changes with 10 or more others, the widest flags.ts (12 per change); 1 more has under 8 commits to say.',
    );
  });

  it('notes the links it leaves off the ring', () => {
    expect(text(find(findings, 'left-out')!)).toBe(
      '2 links to root-level files or dot-folders (release bumps, CI config) are left off the ring.',
    );
  });

  it('reads a repo with no coupling', () => {
    const quiet = couplingFindings({
      report: reportJson as unknown as GitrelicReport,
      commits: null,
    });
    expect(find(quiet, 'strongest')).toBeUndefined();
    expect(text(find(quiet, 'blast')!)).toMatch(/^No file has the 8 commits/);
  });
});

describe('couplingTable', () => {
  const table = couplingTable({ report: couplingReport(), commits: null });

  it('lists rated files, widest first, tiered by their median', () => {
    expect(table.rows.map((r) => [r.id, r.tier])).toEqual([
      ['file:packages/shared/flags.ts', 3],
      ['file:packages/server/src/api.ts', 1],
      ['file:packages/client/src/api.ts', 0],
    ]);
    expect(table.sort).toEqual({ column: 'median', descending: true });
    expect(table.rows[1].cells).toMatchObject({
      median: 3,
      commits: 16,
      partner: 'api.ts',
      package: 'packages/server',
    });
  });
});
