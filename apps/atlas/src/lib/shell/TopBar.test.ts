import { normalizeReport } from '@gitrelic/scene';
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import TopBar from './TopBar.svelte';

describe('TopBar', () => {
  it('drops the date range when the report has no dates', () => {
    render(TopBar, {
      report: normalizeReport({ repoName: 'demo' }),
      theme: 'flat',
    });
    expect(screen.getByText('0 commits · 0 authors')).toBeTruthy();
  });

  it('drops an unparseable date range', () => {
    const report = normalizeReport({ repoName: 'demo' });
    report.meta = { ...report.meta, firstCommit: 'nope', lastCommit: 'nah' };
    render(TopBar, { report, theme: 'flat' });
    expect(document.body.textContent).not.toContain('Invalid Date');
    expect(screen.getByText('0 commits · 0 authors')).toBeTruthy();
  });
});
