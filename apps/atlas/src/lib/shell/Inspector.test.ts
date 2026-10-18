import { buildEntityIndex, ids } from '@gitrelic/scene';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import Inspector from './Inspector.svelte';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const index = buildEntityIndex(report);

describe('Inspector', () => {
  it('shows the repository and a search hint when nothing is selected', () => {
    render(Inspector, { report, index });
    expect(screen.getByText('sample-repo')).toBeTruthy();
    expect(screen.getByText(/to find a file, person or analyzer/)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Clear selection/ }),
    ).toBeNull();
  });

  it('clears the selection on Escape, unless the key was already handled', async () => {
    const onselect = vi.fn();
    render(Inspector, {
      report,
      index,
      selection: ids.file('src/api.ts'),
      onselect,
    });
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
      report,
      index,
      selection: ids.file('src/api.ts'),
      onselect,
    });
    const backdrop = container.querySelector('[role="presentation"]');
    expect(backdrop).toBeTruthy();
    await fireEvent.click(backdrop!);
    expect(onselect).toHaveBeenCalledWith(null);
  });

  it('shows a file’s facts and contributors, and selects a contributor', async () => {
    const onselect = vi.fn();
    render(Inspector, {
      report,
      index,
      selection: ids.file('src/api.ts'),
      onselect,
    });
    expect(screen.getByText('src/api.ts')).toBeTruthy();
    expect(screen.getByText('Top contributors')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: /Alice/ }));
    expect(onselect).toHaveBeenCalledWith('person:alice@example.com');
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
      report,
      index,
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
    render(Inspector, { report, index, selection: ids.dir('src') });
    expect(screen.getByText('src/')).toBeTruthy();
    expect(screen.getByText('Lines of code')).toBeTruthy();
  });

  it('explains an analyzer and links to classic and its docs', () => {
    render(Inspector, {
      report,
      index,
      selection: ids.analyzer('ghost-files'),
    });
    expect(screen.getByText('Ghost Files')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: /Open in classic/ })
        .getAttribute('href'),
    ).toBe('/classic/#preset=ghost-files');
    const docs = screen.getByRole('link', { name: /Docs/ });
    expect(docs.getAttribute('href')).toBe(
      'https://nebulord-dev.github.io/gitrelic/analyzers/ghost-files',
    );
    expect(docs.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('clears the selection', async () => {
    const onselect = vi.fn();
    render(Inspector, { report, index, selection: ids.dir('src'), onselect });
    await fireEvent.click(
      screen.getByRole('button', { name: /Clear selection/ }),
    );
    expect(onselect).toHaveBeenCalledWith(null);
  });
});
