import { describe, expect, it } from 'vitest';

import { nextSort, ROW_LIMIT, visibleRows } from './tableRows';
import type { LensTable } from '@gitrelic/scene';

const row = (file: string, score: number, tier: 0 | 1 | 2 | 3) => ({
  id: `file:${file}`,
  tier,
  search: file.toLowerCase(),
  cells: { file, score },
});

const table: LensTable = {
  columns: [
    { id: 'file', label: 'File' },
    { id: 'score', label: 'Score', numeric: true },
  ],
  rows: [
    row('src/Api.ts', 90, 3),
    row('src/util.ts', 40, 1),
    row('docs/guide.md', 10, 0),
  ],
  tierNames: ['Low', 'Moderate', 'Warning', 'Critical'],
  sort: { column: 'score', descending: true },
};

const all = { filter: '', tiers: new Set<number>(), sort: table.sort };
const ids = (r: { rows: { id: string }[] }) => r.rows.map((x) => x.id);

describe('visibleRows', () => {
  it('sorts by the chosen column, either way', () => {
    expect(ids(visibleRows(table, all))).toEqual([
      'file:src/Api.ts',
      'file:src/util.ts',
      'file:docs/guide.md',
    ]);
    expect(
      ids(
        visibleRows(table, {
          ...all,
          sort: { column: 'file', descending: false },
        }),
      ),
    ).toEqual(['file:docs/guide.md', 'file:src/Api.ts', 'file:src/util.ts']);
  });

  it('filters by text, ignoring case, and by tier', () => {
    expect(ids(visibleRows(table, { ...all, filter: ' API ' }))).toEqual([
      'file:src/Api.ts',
    ]);
    const warm = visibleRows(table, { ...all, tiers: new Set([1, 3]) });
    expect(ids(warm)).toEqual(['file:src/Api.ts', 'file:src/util.ts']);
    expect(warm.matched).toBe(2);
  });

  it('draws at most ROW_LIMIT rows but counts every match', () => {
    const big: LensTable = {
      ...table,
      rows: Array.from({ length: ROW_LIMIT + 20 }, (_, i) =>
        row(`f${i}.ts`, i, 0),
      ),
    };
    const out = visibleRows(big, all);
    expect(out.rows).toHaveLength(ROW_LIMIT);
    expect(out.matched).toBe(ROW_LIMIT + 20);
  });
});

describe('nextSort', () => {
  it('flips the column already sorted, and starts numbers largest first', () => {
    expect(
      nextSort({ column: 'score', descending: true }, 'score', true),
    ).toEqual({
      column: 'score',
      descending: false,
    });
    expect(
      nextSort({ column: 'score', descending: true }, 'file', false),
    ).toEqual({
      column: 'file',
      descending: false,
    });
    expect(
      nextSort({ column: 'file', descending: false }, 'lines', true),
    ).toEqual({
      column: 'lines',
      descending: true,
    });
  });
});
