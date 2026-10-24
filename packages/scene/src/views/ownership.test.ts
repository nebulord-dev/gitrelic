import { describe, expect, it } from 'vitest';

import {
  manyPackagesReport,
  ownershipReport,
} from '../../test/ownershipReport';
import { normalizeReport } from '../report/normalizeReport';
import { ownershipFindings, ownershipTable, ownershipView } from './ownership';
import type { Finding } from '../model';
import type { GitrelicReport } from '@gitrelic/core';

const text = (f: Finding) =>
  f.segments.map((s) => (typeof s === 'string' ? s : s.text)).join('');
const findings = (report: GitrelicReport) =>
  ownershipFindings({ report, commits: null });

describe('ownershipView', () => {
  it('is the Ownership lens, drawn as the map', () => {
    expect(ownershipView.id).toBe('bus-factor');
    expect(ownershipView.layouts.map((l) => l.id)).toEqual(['map']);
    expect(ownershipView.layouts[0].needsCommits).toBe(false);
  });
});

describe('ownershipFindings', () => {
  const list = findings(ownershipReport());
  const byId = new Map(list.map((f) => [f.id, f]));

  it('warns about a quiet top contributor, with chips for the package and person', () => {
    const quiet = byId.get('quiet')!;
    expect(quiet.tone).toBe('warning');
    expect(text(quiet)).toBe(
      "client's top contributor, Bob Ray (47%), has made no commit in 90 days: find out who takes it over.",
    );
    expect(quiet.segments).toContainEqual({
      ref: 'person:bob@example.com',
      text: 'Bob Ray',
    });
  });

  it('names the packages resting on one person and counts the shared ones', () => {
    expect(text(byId.get('one-person')!)).toBe(
      'server rests on one person (75% or more of the commits).',
    );
    expect(text(byId.get('shared')!)).toBe(
      '1 package of 3 is shared: nobody made 30% of the commits.',
    );
  });

  it('says what it left off', () => {
    expect(text(byId.get('left-out')!)).toBe(
      '3 packages with under 10 commits and the root and dot-folders (2) left off the map.',
    );
  });

  it('says when the map shows only the busiest packages, and the table lists all', () => {
    const report = manyPackagesReport(70);
    const hidden = findings(report).find((f) => f.id === 'hidden')!;
    expect(text(hidden)).toBe(
      'The map shows the busiest 60 of 73 packages; the other 13 are in the table.',
    );
    expect(ownershipTable({ report, commits: null }).rows).toHaveLength(73);
    expect(byId.has('hidden')).toBe(false);
  });

  it('says plainly when one person owns everything', () => {
    const base = ownershipReport();
    const solo: GitrelicReport = {
      ...base,
      ownership: {
        ...base.ownership,
        packages: base.ownership.packages.map((p) => ({
          ...p,
          shares: [{ email: 'ann@example.com', commits: p.commits }],
          topShare: 100,
          owner: 'ann@example.com',
          onePerson: true,
          topQuiet: false,
        })),
      },
    };
    const ids = findings(solo).map((f) => f.id);
    expect(ids).toContain('solo');
    // Every package resting on one person is the same news, so it isn't repeated.
    expect(ids).not.toContain('one-person');
  });

  it('asks for a rerun on a report from before the lens', () => {
    expect(findings(normalizeReport({})).map((f) => f.id)).toEqual(['no-data']);
  });
});

describe('ownershipTable', () => {
  it('lists every mapped package with its tier', () => {
    const table = ownershipTable({ report: ownershipReport(), commits: null });
    expect(table.rows.map((r) => [r.id, r.tier, r.cells.flags])).toEqual([
      ['dir:packages/server', 2, 'one person'],
      ['dir:packages/client', 3, 'top quiet'],
      ['dir:packages/shared', 0, 'shared'],
    ]);
    expect(table.rows[0].cells).toMatchObject({
      top: 'Ann Lee',
      share: 88,
      knowers: 2,
      truck: 1,
    });
  });
});
