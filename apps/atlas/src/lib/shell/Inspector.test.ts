import { buildEntityIndex, ids, lensReadings } from '@gitrelic/scene';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import Inspector from './Inspector.svelte';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const index = buildEntityIndex(report);
const base = { report, index, view: 'overview' as const };

describe('Inspector', () => {
  it('describes the view when nothing is selected', () => {
    render(Inspector, base);
    expect(screen.getByText('sample-repo')).toBeTruthy();
    expect(
      screen.getByText(/lenses open in the classic dashboard/),
    ).toBeTruthy();
    expect(
      screen.getByText(/to find a view, file, person or analyzer/),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Clear selection/ }),
    ).toBeNull();
  });

  it('explains the open lens, with its docs', () => {
    render(Inspector, { ...base, view: 'ownership-risk', lens: 'bus-factor' });
    // The explain card's title, and the lens card's eyebrow.
    expect(screen.getAllByText('Ownership').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Docs/ })).toBeTruthy();
  });

  it('clears the selection on Escape, unless the key was already handled', async () => {
    const onselect = vi.fn();
    render(Inspector, { ...base, selection: ids.file('src/api.ts'), onselect });
    const handled = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    });
    handled.preventDefault();
    window.dispatchEvent(handled);
    expect(onselect).not.toHaveBeenCalled();
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onselect).toHaveBeenCalledWith(null);
  });

  it('closes the narrow-screen drawer from its backdrop', async () => {
    const onselect = vi.fn();
    const { container } = render(Inspector, {
      ...base,
      selection: ids.file('src/api.ts'),
      onselect,
    });
    const backdrop = container.querySelector('[role="presentation"]');
    expect(backdrop).toBeTruthy();
    await fireEvent.click(backdrop!);
    expect(onselect).toHaveBeenCalledWith(null);
  });

  it('shows a file: name, folder, every lens that flags it, and its people', async () => {
    const onselect = vi.fn();
    render(Inspector, { ...base, selection: ids.file('src/api.ts'), onselect });
    expect(screen.getByText('api.ts')).toBeTruthy();
    expect(screen.getByText('src/')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Flagged by' })).toBeTruthy();
    // A row whose lens has no Atlas view opens classic; Age and Ownership
    // have one now.
    const lang = screen.getByRole('link', { name: /^Language/ });
    expect(lang.getAttribute('href')).toBe('/classic/#preset=languages');
    expect(screen.getByRole('button', { name: /^Bus Factor/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Last changed/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'People' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: /Alice/ }));
    expect(onselect).toHaveBeenCalledWith('person:alice@example.com');
  });

  it("shows the selection's activity once history arrives", async () => {
    const { rerender } = render(Inspector, {
      ...base,
      selection: ids.file('src/api.ts'),
    });
    expect(screen.getByText('Loading history…')).toBeTruthy();
    await rerender({
      activity: {
        start: Date.UTC(2026, 2, 2),
        totals: [3, 0, 2, 4],
        hits: [1, 0, 1, 2],
      },
    });
    expect(screen.getByText('3 of 4 commits in the recent half')).toBeTruthy();
  });

  it('lists authors the index lacks as text, not buttons', () => {
    const withBot = {
      ...report,
      busFactors: {
        ...report.busFactors,
        files: report.busFactors.files.map((f) =>
          f.file === 'src/api.ts'
            ? { ...f, authors: [...f.authors, 'ci-bot@example.com'] }
            : f,
        ),
      },
    } as GitrelicReport;
    render(Inspector, {
      ...base,
      report: withBot,
      index: buildEntityIndex(withBot),
      selection: ids.file('src/api.ts'),
    });
    expect(screen.getByText('ci-bot')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /ci-bot/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Alice/ })).toBeTruthy();
  });

  it('shows a person, with focus areas that select what they name', async () => {
    const onselect = vi.fn();
    render(Inspector, {
      ...base,
      selection: ids.person('alice@example.com'),
      onselect,
    });
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    await fireEvent.click(
      screen.getByRole('button', { name: 'src/helpers.ts' }),
    );
    expect(onselect).toHaveBeenCalledWith('file:src/helpers.ts');
  });

  it('shows a directory', () => {
    render(Inspector, { ...base, selection: ids.dir('src') });
    expect(screen.getByText('src/')).toBeTruthy();
    expect(screen.getByText('Lines of code')).toBeTruthy();
  });

  it('explains an analyzer and links to classic and its docs', () => {
    render(Inspector, { ...base, selection: ids.analyzer('renames') });
    expect(screen.getByText('Renames')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: /Open in classic/ })
        .getAttribute('href'),
    ).toBe('/classic/#preset=renames');
    const docs = screen.getByRole('link', { name: /Docs/ });
    expect(docs.getAttribute('href')).toBe(
      'https://nebulord-dev.github.io/gitrelic/analyzers/renames',
    );
    expect(docs.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('clears the selection', async () => {
    const onselect = vi.fn();
    render(Inspector, { ...base, selection: ids.dir('src'), onselect });
    await fireEvent.click(
      screen.getByRole('button', { name: /Clear selection/ }),
    );
    expect(onselect).toHaveBeenCalledWith(null);
  });

  it('collapses to the strip and back, by button or the I key', async () => {
    // The strip only exists docked, from 1200px.
    const wide = vi
      .spyOn(window, 'matchMedia')
      .mockReturnValue({ matches: true } as MediaQueryList);
    render(Inspector, { ...base, selection: ids.file('src/api.ts') });
    await fireEvent.click(
      screen.getByRole('button', { name: 'Collapse the inspector (I)' }),
    );
    expect(
      screen.getByRole('complementary', { name: 'Inspector, collapsed' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Show the selected file' }),
    ).toBeTruthy();
    // A selected file gets shortcuts into its sections.
    expect(
      screen.getByRole('button', { name: 'Open the inspector at People' }),
    ).toBeTruthy();
    await fireEvent.keyDown(document.body, { key: 'i' });
    expect(
      screen.queryByRole('complementary', { name: 'Inspector, collapsed' }),
    ).toBeNull();
    wide.mockRestore();
  });

  it('ignores I below 1200px, where the inspector is a drawer', async () => {
    const narrow = vi
      .spyOn(window, 'matchMedia')
      .mockReturnValue({ matches: false } as MediaQueryList);
    let collapsed = false;
    render(Inspector, {
      ...base,
      get collapsed() {
        return collapsed;
      },
      set collapsed(v: boolean) {
        collapsed = v;
      },
    });
    await fireEvent.keyDown(document.body, { key: 'i' });
    expect(collapsed).toBe(false);
    narrow.mockRestore();
  });

  it('contains its absolute children, so they never stretch the page', () => {
    // sr-only text is position: absolute; without a positioned inspector it
    // lands against the page, past the window, and the page scrolls.
    render(Inspector, { ...base, selection: ids.file('src/api.ts') });
    expect(
      screen.getByRole('complementary', { name: 'Inspector' }).classList,
    ).toContain('relative');
  });

  it('keeps the File card, with its section tabs, stuck at the top', () => {
    render(Inspector, { ...base, selection: ids.file('src/api.ts') });
    const card = screen.getByText('api.ts').closest('section')!;
    expect(card.hasAttribute('data-sticky')).toBe(true);
    expect(card.classList).toContain('sticky');
    expect(
      within(card).getByRole('navigation', { name: 'Sections' }),
    ).toBeTruthy();
    // Only the one card sticks.
    expect(document.querySelectorAll('[data-sticky]')).toHaveLength(1);
  });

  it('jumps to a section without touching the URL (the selection lives there)', async () => {
    history.replaceState(null, '', '/#s=file%3Asrc%2Fapi.ts');
    render(Inspector, { ...base, selection: ids.file('src/api.ts') });
    const sections = screen.getByRole('navigation', { name: 'Sections' });
    const people = within(sections).getByRole('button', { name: 'People' });
    await fireEvent.click(people);
    expect(location.hash).toBe('#s=file%3Asrc%2Fapi.ts');
    history.replaceState(null, '', '/');
  });

  it('offers only the sections a file has', () => {
    render(Inspector, { ...base, selection: ids.file('README.md') });
    const sections = screen.getByRole('navigation', { name: 'Sections' });
    const labels = within(sections)
      .getAllByRole('button')
      .map((b) => b.textContent?.trim());
    expect(labels).toContain('Activity');
    for (const label of labels) {
      expect(screen.getByRole('heading', { name: label })).toBeTruthy();
    }
  });

  it('says when history failed rather than loading forever', () => {
    render(Inspector, {
      ...base,
      selection: ids.file('src/api.ts'),
      historyFailed: true,
    });
    expect(screen.getByText('Commit history unavailable.')).toBeTruthy();
  });

  it('ignores I while a modal is open', async () => {
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.append(modal);
    const wide = vi
      .spyOn(window, 'matchMedia')
      .mockReturnValue({ matches: true } as MediaQueryList);
    render(Inspector, base);
    await fireEvent.keyDown(document.body, { key: 'i' });
    expect(
      screen.queryByRole('complementary', { name: 'Inspector, collapsed' }),
    ).toBeNull();
    modal.remove();
    wide.mockRestore();
  });

  it('describes the Repo map lens, and its loud signals fan their lens', async () => {
    // The fixture is a 10-file repo; force one loud lens so the list exists.
    const loud = {
      ...report,
      ownership: {
        ...report.ownership,
        packages: report.ownership.packages.map((p) => ({
          ...p,
          topQuiet: true,
        })),
      },
    } as GitrelicReport;
    const onselect = vi.fn();
    render(Inspector, { ...base, report: loud, lens: 'overview', onselect });
    expect(screen.getByText(/lenses read well outside normal/)).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Loudest signals' }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Click a lens to see what it points at\./),
    ).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: /Ownership/ }));
    expect(onselect).toHaveBeenCalledWith('analyzer:bus-factor');
  });

  it('previews a selected lens: its reading, what it points at, and how to open it', async () => {
    const onselect = vi.fn();
    const onopen = vi.fn();
    render(Inspector, {
      ...base,
      selection: ids.analyzer('hotspots'),
      onselect,
      onopen,
    });
    expect(screen.getByRole('heading', { name: 'On the map' })).toBeTruthy();
    // Hotspots has an Atlas view: the button opens it in place.
    await fireEvent.click(
      screen.getByRole('button', { name: 'Open Hotspots' }),
    );
    expect(onopen).toHaveBeenCalledWith('hotspots');
    const points = screen.getByRole('heading', { name: 'What it points at' });
    expect(points).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: /api\.ts/ }));
    expect(onselect).toHaveBeenCalledWith('file:src/api.ts');
  });

  it('explains the Hotspots lens with its own card when nothing is selected', () => {
    render(Inspector, {
      ...base,
      view: 'code-health' as const,
      lens: 'hotspots',
    });
    expect(screen.getByRole('heading', { name: 'About' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Docs ↗' }).getAttribute('href'),
    ).toMatch(/analyzers\/hotspots$/);
    expect(screen.getByRole('heading', { name: 'Hotspots' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Top five' })).toBeTruthy();
  });

  it('explains the Churn lens with its own card when nothing is selected', () => {
    render(Inspector, {
      ...base,
      view: 'code-health' as const,
      lens: 'churn',
    });
    expect(
      screen.getByRole('link', { name: 'Docs ↗' }).getAttribute('href'),
    ).toMatch(/analyzers\/churn$/);
    expect(
      screen.getByRole('heading', { name: 'Busiest packages' }),
    ).toBeTruthy();
  });

  it('explains the Risk lens with its own card when nothing is selected', () => {
    render(Inspector, {
      ...base,
      view: 'code-health' as const,
      lens: 'cursed-files',
    });
    expect(
      screen.getByRole('link', { name: 'Docs ↗' }).getAttribute('href'),
    ).toMatch(/analyzers\/cursed-files$/);
    expect(screen.getByRole('heading', { name: 'Risk' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Highest scores' }),
    ).toBeTruthy();
  });

  it('links a selected lens without an Atlas view to classic', () => {
    render(Inspector, { ...base, selection: ids.analyzer('renames') });
    expect(
      screen
        .getByRole('link', { name: /Open Renames in classic/ })
        .getAttribute('href'),
    ).toBe('/classic/#preset=renames');
  });

  it('describes a selected view: its headline, its lenses loudest first, and a way in', async () => {
    const onselect = vi.fn();
    const onopen = vi.fn();
    render(Inspector, {
      ...base,
      lens: 'overview',
      selection: ids.view('code-health'),
      onselect,
      onopen,
    });
    expect(screen.getByRole('heading', { name: 'Code Health' })).toBeTruthy();
    expect(screen.getByText(/under strain/)).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Lenses, loudest first' }),
    ).toBeTruthy();
    const readings = lensReadings(report).filter(
      (r) => r.group === 'code-health',
    );
    const headline = readings.reduce((a, b) => (b.grade > a.grade ? b : a));
    const card = screen
      .getByRole('heading', { name: 'Lenses, loudest first' })
      .closest('section') as HTMLElement;
    // The headline sits in the first card, outside the lens list.
    const shownValue = screen
      .getAllByText(headline.value)
      .find((el) => !card.contains(el));
    expect(shownValue).toBeTruthy();
    const shown = within(card)
      .getAllByRole('button')
      .map((b) => b.textContent ?? '');
    const expected = [...readings].sort((a, b) => b.grade - a.grade);
    expect(shown).toHaveLength(expected.length);
    expected.forEach((r, i) => expect(shown[i]).toContain(r.label));
    await fireEvent.click(within(card).getAllByRole('button')[0]);
    expect(onselect).toHaveBeenCalledWith(`analyzer:${expected[0].preset}`);
    await fireEvent.click(
      screen.getByRole('button', { name: 'Open Code Health' }),
    );
    expect(onopen).toHaveBeenCalledWith('hotspots');
  });

  it('clears the view selection when its Open button opens a lens', async () => {
    const onselect = vi.fn();
    const onopen = vi.fn();
    render(Inspector, {
      ...base,
      lens: 'overview',
      selection: ids.view('code-health'),
      onselect,
      onopen,
    });
    await fireEvent.click(
      screen.getByRole('button', { name: 'Open Code Health' }),
    );
    expect(onopen).toHaveBeenCalledWith('hotspots');
    expect(onselect).toHaveBeenLastCalledWith(null);
  });

  it("clears a lens preview's selection when its Open button opens the lens", async () => {
    const onselect = vi.fn();
    const onopen = vi.fn();
    render(Inspector, {
      ...base,
      selection: ids.analyzer('hotspots'),
      onselect,
      onopen,
    });
    await fireEvent.click(
      screen.getByRole('button', { name: 'Open Hotspots' }),
    );
    expect(onopen).toHaveBeenCalledWith('hotspots');
    expect(onselect).toHaveBeenLastCalledWith(null);
  });
});
