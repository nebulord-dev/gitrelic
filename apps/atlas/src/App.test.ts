import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App.svelte';

function serve(response: () => Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response()),
  );
}

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('renders the shell once the report loads', async () => {
    serve(() =>
      Response.json({
        repoName: 'demo-repo',
        meta: {
          totalCommits: 1234,
          totalFiles: 10,
          totalAuthors: 3,
          firstCommit: '2026-01-01T00:00:00Z',
          lastCommit: '2026-04-01T00:00:00Z',
          analyzedBranch: 'main',
          primaryLanguage: 'TypeScript',
        },
      }),
    );
    render(App);
    expect(screen.getByText('Excavating git history…')).toBeTruthy();
    expect((await screen.findAllByText('demo-repo')).length).toBeGreaterThan(0);
    expect(screen.getByText(/1,234 commits · 3 authors/)).toBeTruthy();
  });

  it('shows why the report failed to load', async () => {
    serve(() => new Response('', { status: 404 }));
    render(App);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No report found',
    );
  });

  it('applies and remembers the theme', async () => {
    serve(() => Response.json({ repoName: 'demo-repo' }));
    render(App);
    expect(document.documentElement.dataset.theme).toBe('flat');

    await fireEvent.click(await screen.findByRole('button', { name: 'Glow' }));
    expect(document.documentElement.dataset.theme).toBe('glow');
    expect(localStorage.getItem('gitrelic-atlas-theme')).toBe('glow');
  });
});
