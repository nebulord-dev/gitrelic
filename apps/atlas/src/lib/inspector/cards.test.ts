import { buildEntityIndex, type FixPoint } from '@gitrelic/scene';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet, flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import ActivityCard from './ActivityCard.svelte';
import Card from './Card.svelte';
import ChurnCard from './ChurnCard.svelte';
import FindingCard from './FindingCard.svelte';
import HotspotsCard from './HotspotsCard.svelte';
import RiskCard from './RiskCard.svelte';
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
      id: 'review-changes',
      action: 'Review its changes closely.',
      why: 'Changes to it need a follow-up fix more often than the rest of the repo’s do.',
      evidence: '3 of 8 changes needed a fix within 30 days; 1.2% repo-wide.',
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

    expect(screen.getByText('Review its changes closely.')).toBeTruthy();
    expect(screen.getByText(/more often than the rest/)).toBeTruthy();
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

describe('RiskCard', () => {
  const report = reportJson as unknown as GitrelicReport;

  it('leads with the cursed count, near misses and the findings', async () => {
    const onselect = vi.fn();
    render(RiskCard, { report, index, onselect });
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText(/cursed files at 50\+/).textContent).toMatch(
      /2 near misses/,
    );
    expect(
      screen.getByText(/All 3 cursed files score on churn, ownership/),
    ).toBeTruthy();
    // The near-miss finding's chip selects the file.
    await fireEvent.click(
      screen.getAllByRole('button', { name: 'index.ts' })[0],
    );
    expect(onselect).toHaveBeenCalledWith('file:src/index.ts');
  });

  it('lists the highest scores with their split, and opens the table', async () => {
    const ontable = vi.fn();
    render(RiskCard, { report, index, ontable });
    const list = screen.getByRole('heading', {
      name: 'Highest scores',
    }).parentElement!;
    const rows = list.querySelectorAll('li button');
    expect(rows).toHaveLength(5);
    expect(rows[0].textContent).toMatch(/helpers\.ts\s*85/);
    // One segment per reason: churn, ownership, fix commits.
    expect(rows[0].querySelectorAll('span.block')).toHaveLength(3);
    expect(rows[0].getAttribute('title')).toBe(
      'Churn 35 · Ownership 30 · Fix commits 20',
    );
    await fireEvent.click(
      screen.getByRole('button', { name: 'All 5 files in the table (T) ▸' }),
    );
    expect(ontable).toHaveBeenCalled();
  });

  it('says so when no file scores 40 or more', () => {
    const empty = {
      ...report,
      cursedFiles: { ...report.cursedFiles, files: [], nearMisses: [] },
    };
    render(RiskCard, { report: empty, index });
    expect(screen.getByText(/No file scores 40 or more/)).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'Highest scores' }),
    ).toBeNull();
  });
});

describe('ActivityCard', () => {
  const point: FixPoint = {
    file: 'src/a.ts',
    changes: 8,
    fixedAfter: 3,
    rate: 3 / 8,
    allowed: 1,
    aboveChance: true,
    tier: 3,
    fixes: [
      {
        hash: 'b'.repeat(40),
        message: 'Revert "cache the parse"',
        date: '2026-03-02T10:00:00Z',
        revert: true,
        causes: ['a'.repeat(40)],
      },
      {
        hash: 'c'.repeat(40),
        message: 'fix: null check <img src=x>',
        date: '2026-02-01T10:00:00Z',
        revert: false,
        causes: ['a'.repeat(40)],
      },
    ],
  };

  it("lists a rated file's fixes, newest first, as text", () => {
    render(ActivityCard, { activity: null, fixes: point, windowDays: 30 });
    expect(
      screen.getByText(
        /3 of 8 changes needed a fix within 30\s+days, more than chance explains\./,
      ),
    ).toBeTruthy();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toMatch(/2026-03-02.*Revert · Revert "cache the parse"/);
    // Commit messages are data: rendered as text, never markup.
    expect(items[1]).toContain('fix: null check <img src=x>');
    expect(document.querySelector('img')).toBeNull();
  });

  it('says nothing about fixes for a file fix rate doesn’t rate', () => {
    render(ActivityCard, { activity: null });
    expect(screen.queryByText(/needed a fix/)).toBeNull();
  });
});
