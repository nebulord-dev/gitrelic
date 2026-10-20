import { buildEntityIndex } from '@gitrelic/scene';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet, flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import Card from './Card.svelte';
import ChurnCard from './ChurnCard.svelte';
import FindingCard from './FindingCard.svelte';
import HotspotsCard from './HotspotsCard.svelte';
import WhatToDoCard from './WhatToDoCard.svelte';
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

describe('WhatToDoCard', () => {
  const advice = [
    {
      id: 'read-log',
      action: 'Read its commit log before the code.',
      why: 'Repeated fix and revert messages usually mean its contract is wrong.',
      evidence: '3 commits say fix or revert.',
      section: 'activity',
    },
    {
      id: 'change-together',
      action: 'Change it with index.ts open.',
      evidence: 'index.ts moved with it in 3 commits.',
      section: 'changes-with',
    },
  ] as const;

  it('lists each action with its evidence, linking only to sections that render', async () => {
    // The inspector's scroll box, holding the section the link jumps to.
    const box = document.createElement('div');
    box.style.overflowY = 'auto';
    box.scrollTo = vi.fn() as typeof box.scrollTo;
    const target = document.createElement('section');
    target.id = 'insp-activity';
    box.append(target);
    document.body.append(box);
    render(WhatToDoCard, { advice, sections: new Set(['insp-activity']) });

    expect(
      screen.getByText('Read its commit log before the code.'),
    ).toBeTruthy();
    expect(screen.getByText(/contract is wrong/)).toBeTruthy();
    expect(screen.getByText(/index\.ts moved with it/)).toBeTruthy();
    // No Changes with section on screen, so no link to it.
    expect(screen.queryByRole('button', { name: /Changes with/ })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: /Activity/ }));
    expect(box.scrollTo).toHaveBeenCalled();
    box.remove();
  });
});

describe('ChurnCard', () => {
  const report = reportJson as unknown as GitrelicReport;

  it('leads with the package churning hardest per file', async () => {
    const onselect = vi.fn();
    render(ChurnCard, { report, index, onselect });
    expect(screen.getByText('4.2')).toBeTruthy();
    expect(screen.getByText(/changes per file in/).textContent).toMatch(
      /src\/, across 6 files/,
    );
    // The lead, the finding's chip and the busiest list all select src/.
    const src = screen.getAllByRole('button', { name: /^src\// });
    expect(src.length).toBeGreaterThanOrEqual(3);
    await fireEvent.click(src[0]);
    expect(onselect).toHaveBeenCalledWith('dir:src');
  });

  it('lists the busiest packages and opens the table', async () => {
    const ontable = vi.fn();
    render(ChurnCard, { report, index, ontable });
    const list = screen.getByRole('heading', {
      name: 'Busiest packages',
    }).parentElement!;
    expect(list.querySelectorAll('li button')).toHaveLength(3);
    await fireEvent.click(
      screen.getByRole('button', { name: 'All 9 files in the table (T) ▸' }),
    );
    expect(ontable).toHaveBeenCalled();
  });
});

describe('Card', () => {
  const children = createRawSnippet(() => ({ render: () => '<p>body</p>' }));

  it('casts a shadow once cards scroll under a sticky one, not before', async () => {
    const box = document.createElement('div');
    box.style.overflowY = 'auto';
    document.body.append(box);
    render(Card, {
      target: box,
      props: { eyebrow: 'File', sticky: true, children },
    });
    const card = box.querySelector('section')!;
    expect(card.hasAttribute('data-sticky')).toBe(true);
    expect(card.hasAttribute('data-stuck')).toBe(false);

    box.scrollTop = 120;
    await fireEvent.scroll(box);
    flushSync();
    expect(card.hasAttribute('data-stuck')).toBe(true);

    box.scrollTop = 0;
    await fireEvent.scroll(box);
    flushSync();
    expect(card.hasAttribute('data-stuck')).toBe(false);
    box.remove();
  });

  it('is a plain card by default', () => {
    render(Card, { eyebrow: 'People', children });
    const card = screen.getByText('body').closest('section')!;
    expect(card.classList).toContain('card');
    expect(card.hasAttribute('data-sticky')).toBe(false);
  });
});
