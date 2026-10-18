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
