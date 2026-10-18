import { buildEntityIndex } from '@gitrelic/scene';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import FindingCard from './FindingCard.svelte';
import HotspotsCard from './HotspotsCard.svelte';
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

describe('HotspotsCard', () => {
  const report = reportJson as unknown as GitrelicReport;

  it('leads with the tier counts and the findings, chips selecting files', async () => {
    const onselect = vi.fn();
    render(HotspotsCard, { report, index, onselect });
    expect(
      screen.getByText(/critical, 2 warning, of 10 scored files/),
    ).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'helpers.ts' }));
    expect(onselect).toHaveBeenCalledWith('file:src/helpers.ts');
  });

  it('lists the tiers and the top five, each selecting its file', async () => {
    const onselect = vi.fn();
    render(HotspotsCard, { report, index, onselect });
    expect(screen.getByRole('heading', { name: 'By tier' })).toBeTruthy();
    const top = screen.getByRole('heading', {
      name: 'Top five',
    }).parentElement!;
    const rows = top.querySelectorAll('li button');
    expect(rows).toHaveLength(5);
    await fireEvent.click(rows[1]);
    expect(onselect).toHaveBeenCalledWith('file:src/index.ts');
  });

  it('opens the full table, when there is one to open', async () => {
    const ontable = vi.fn();
    const { unmount } = render(HotspotsCard, { report, index, ontable });
    await fireEvent.click(
      screen.getByRole('button', { name: /All 10 files in the table/ }),
    );
    expect(ontable).toHaveBeenCalled();
    unmount();
    render(HotspotsCard, { report, index });
    expect(screen.queryByRole('button', { name: /in the table/ })).toBeNull();
  });
});
