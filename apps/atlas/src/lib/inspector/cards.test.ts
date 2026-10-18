import { buildEntityIndex } from '@gitrelic/scene';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import DetailTable from './DetailTable.svelte';
import FindingCard from './FindingCard.svelte';
import type { GitrelicReport } from '@gitrelic/core';

const index = buildEntityIndex(reportJson as unknown as GitrelicReport);

describe('FindingCard', () => {
  it('renders text and turns known entities into chips that select them', async () => {
    const onselect = vi.fn();
    render(FindingCard, {
      index,
      onselect,
      finding: {
        id: 'f',
        tone: 'warning',
        segments: [
          { ref: 'person:alice@example.com', text: 'Alice' },
          ' owns ',
          { ref: 'file:src/api.ts', text: 'api.ts' },
          ' alone; ',
          { ref: 'file:<b>made-up</b>', text: '<b>made-up</b>' },
        ],
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'api.ts' }));
    expect(onselect).toHaveBeenCalledWith('file:src/api.ts');
    // An unknown ref is plain text (and text, never markup).
    expect(screen.queryByRole('button', { name: /made-up/ })).toBeNull();
    expect(screen.getByText('<b>made-up</b>')).toBeTruthy();
  });
});

describe('DetailTable', () => {
  const rows = [
    { name: 'b.ts', commits: 3 },
    { name: 'a.ts', commits: 10 },
    { name: 'c.ts', commits: 1 },
  ];
  const columns = [
    { key: 'name' as const, label: 'File' },
    { key: 'commits' as const, label: 'Commits', numeric: true },
  ];
  const names = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelector('td')?.textContent);

  it('starts collapsed with a count, in the given order', () => {
    const { container } = render(DetailTable, {
      title: 'Files',
      columns,
      rows,
      rowKey: 'name',
    });
    expect(container.querySelector('details')?.open).toBe(false);
    expect(screen.getByText('Files (3)')).toBeTruthy();
    expect(names()).toEqual(['b.ts', 'a.ts', 'c.ts']);
  });

  it('sorts numbers high-first, text A–Z, and flips on a second click', async () => {
    render(DetailTable, { title: 'Files', columns, rows, rowKey: 'name' });
    await fireEvent.click(screen.getByRole('button', { name: 'Commits' }));
    expect(names()).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(
      screen
        .getByRole('columnheader', { name: /Commits/ })
        .getAttribute('aria-sort'),
    ).toBe('descending');
    await fireEvent.click(screen.getByRole('button', { name: /Commits/ }));
    expect(names()).toEqual(['c.ts', 'b.ts', 'a.ts']);
    await fireEvent.click(screen.getByRole('button', { name: 'File' }));
    expect(names()).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });
});
