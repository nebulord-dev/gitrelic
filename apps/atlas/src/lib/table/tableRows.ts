// The table drawer's rows: filtered by text and tier, then sorted. Pure, so
// the drawer component only renders what this returns.

import type { LensTable, TableRow } from '@gitrelic/scene';

export interface TableView {
  /** Matched against each row's `search` text, case-insensitively. */
  filter: string;
  /** Tiers shown; an empty set shows every tier. */
  tiers: ReadonlySet<number>;
  sort: { column: string; descending: boolean };
}

/** Rows drawn at once; a filter narrows a longer list. */
export const ROW_LIMIT = 300;

export function visibleRows(
  table: LensTable,
  view: TableView,
): { rows: TableRow[]; matched: number } {
  const needle = view.filter.trim().toLowerCase();
  const matching = table.rows.filter(
    (r) =>
      (view.tiers.size === 0 || view.tiers.has(r.tier)) &&
      (!needle || r.search.includes(needle)),
  );
  const { column, descending } = view.sort;
  const sorted = [...matching].sort((a, b) => {
    const x = a.cells[column];
    const y = b.cells[column];
    const order =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x ?? '').localeCompare(String(y ?? ''));
    // Ties keep the table's own order (hottest first), whichever way.
    return descending ? -order : order;
  });
  return { rows: sorted.slice(0, ROW_LIMIT), matched: matching.length };
}

/** The next sort after clicking `column`'s header. */
export function nextSort(
  current: TableView['sort'],
  column: string,
  numeric: boolean,
): TableView['sort'] {
  return current.column === column
    ? { column, descending: !current.descending }
    : { column, descending: numeric };
}
