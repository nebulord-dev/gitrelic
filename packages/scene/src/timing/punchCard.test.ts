import { describe, expect, it } from 'vitest';

import {
  busiestCells,
  emptyGrid,
  hourName,
  isOffHours,
  selectionHours,
  selectionHoursOf,
  SWEEPING_COMMIT_FILES,
  touchesSelection,
  workingHoursShare,
} from './punchCard';
import type { CommitLike } from '../commits/commitLike';

// Tue 3 Jun 2025 at 02:00 and 14:00 UTC; Sat 7 Jun at 12:00 UTC.
const at = (
  iso: string,
  files: string[],
  author = 'a@x',
  tz = 0,
): CommitLike => ({
  timeMs: Date.parse(iso),
  author,
  files,
  tz,
});

describe('off-hours', () => {
  it('is late night (23:00 to 04:59) or the weekend', () => {
    expect(isOffHours(2, 23)).toBe(true);
    expect(isOffHours(2, 4)).toBe(true);
    expect(isOffHours(2, 5)).toBe(false);
    expect(isOffHours(6, 12)).toBe(true);
    expect(isOffHours(0, 12)).toBe(true);
    expect(isOffHours(1, 12)).toBe(false);
  });
});

describe('selectionHours', () => {
  it('counts a selection’s commits by local day and hour, as core counts them', () => {
    const commits = [
      at('2025-06-03T02:00:00Z', ['packages/server/a.ts']),
      // 14:00Z is 06:00 in -08:00: a weekday morning, not off-hours.
      at('2025-06-03T14:00:00Z', ['packages/server/b.ts'], 'a@x', -480),
      at('2025-06-07T12:00:00Z', ['packages/server/a.ts']),
      at('2025-06-03T14:00:00Z', ['src/x.ts']),
      // Left out: a sweeping commit and a bot's.
      at(
        '2025-06-03T02:00:00Z',
        Array.from(
          { length: SWEEPING_COMMIT_FILES + 1 },
          (_, i) => `packages/server/f${i}.ts`,
        ),
      ),
      at(
        '2025-06-03T02:00:00Z',
        ['packages/server/a.ts'],
        '49699333+dependabot[bot]@users.noreply.github.com',
      ),
    ];
    const s = selectionHours(commits, touchesSelection('dir:packages/server')!);
    expect(s.commits).toBe(3);
    expect(s.offHours).toBe(2);
    expect(s.grid[2][2]).toBe(1);
    expect(s.grid[2][6]).toBe(1);
    expect(s.grid[6][12]).toBe(1);
  });

  it('matches files, directories and the root package; nothing else', () => {
    expect(touchesSelection('file:src/x.ts')!(['src/x.ts'])).toBe(true);
    expect(touchesSelection('dir:src')!(['src/deep/y.ts'])).toBe(true);
    expect(touchesSelection('dir:src')!(['srcfoo/y.ts'])).toBe(false);
    expect(touchesSelection('repo')!(['README.md'])).toBe(true);
    expect(touchesSelection('repo')!(['src/x.ts'])).toBe(false);
    expect(touchesSelection('person:a@x')).toBeNull();
  });

  it('is memoised per commit list and selection', () => {
    const commits = [at('2025-06-03T02:00:00Z', ['src/x.ts'])];
    expect(selectionHoursOf(commits, 'dir:src')).toBe(
      selectionHoursOf(commits, 'dir:src'),
    );
    expect(selectionHoursOf(commits, 'person:a@x')).toBeNull();
  });
});

describe('the grid’s readings', () => {
  it('finds the working-hours share and the busiest hours', () => {
    const g = emptyGrid();
    g[1][12] = 6; // Mon noon
    g[2][16] = 3; // Tue 4pm
    g[6][2] = 1; // Sat 2am
    expect(workingHoursShare(g)).toBeCloseTo(0.9);
    expect(busiestCells(g, 2)).toEqual([
      { day: 1, hour: 12, commits: 6 },
      { day: 2, hour: 16, commits: 3 },
    ]);
    expect([0, 11, 12, 23].map(hourName)).toEqual([
      '12am',
      '11am',
      '12pm',
      '11pm',
    ]);
  });
});
