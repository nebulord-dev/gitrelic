import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { WEEK_MS } from '../time/week';
import { ADOPTION_ROWS, adoptionLanes } from './adoption';
import type { CommitLike } from '../commits/commitLike';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
// A Monday, so week bins start on the commits.
const MON = Date.UTC(2026, 0, 5);
const c = (author: string, week: number, ai: 0 | 1 | 2 = 0): CommitLike => ({
  timeMs: MON + week * WEEK_MS,
  author,
  files: ['src/a.ts'],
  ai,
});

describe('adoptionLanes', () => {
  it('puts AI users first, by AI commits, then the busiest of the rest', () => {
    const lanes = adoptionLanes(report, [
      ...Array.from({ length: 9 }, (_, w) => c('busy@x', w)),
      c('some@x', 0),
      c('some@x', 3, 1),
      c('most@x', 1, 1),
      c('most@x', 2, 1),
      c('209825114+claude[bot]@users.noreply.github.com', 2, 2),
      c('49699333+dependabot[bot]@users.noreply.github.com', 2),
    ]);
    expect(lanes.rows.map((r) => r.name)).toEqual([
      'most@x',
      'some@x',
      'Claude (agent)',
      'busy@x',
    ]);
    const some = lanes.rows[1];
    expect(some).toMatchObject({ commits: 2, ai: 1, agent: null });
    expect(some.firstAi).toBe(MON + 3 * WEEK_MS);
    expect(some.bins.slice(0, 4)).toEqual([1, 0, 0, 1]);
    expect(some.aiBins.slice(0, 4)).toEqual([0, 0, 0, 1]);
    expect(lanes.rows[2]).toMatchObject({ agent: 'Claude', ai: 1 });
    expect(lanes.binStarts).toHaveLength(9);
    expect(lanes.others).toBe(0);
  });

  it('counts the people it leaves out, and how many of them used AI', () => {
    const commits = Array.from({ length: ADOPTION_ROWS + 3 }, (_, i) =>
      c(`p${i}@x`, 0),
    );
    commits.push(
      ...Array.from({ length: ADOPTION_ROWS + 1 }, (_, i) =>
        c(`ai${i}@x`, 1, 1),
      ),
    );
    const lanes = adoptionLanes(report, commits);
    expect(lanes.rows).toHaveLength(ADOPTION_ROWS);
    expect(lanes.rows.every((r) => r.ai > 0)).toBe(true);
    expect(lanes.others).toBe(ADOPTION_ROWS + 4);
    expect(lanes.othersWithAi).toBe(1);
  });

  it('uses the contributor’s name when the report has one', () => {
    const person = report.contributors.contributors[0];
    const lanes = adoptionLanes(report, [c(person.email, 0, 1)]);
    expect(lanes.rows[0].name).toBe(person.name);
    expect(lanes.rows[0].id).toBe(`person:${person.email}`);
  });
});
