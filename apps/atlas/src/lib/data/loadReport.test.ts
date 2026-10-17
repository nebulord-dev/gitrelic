import { describe, expect, it, vi } from 'vitest';

import { createCommitsLoader, loadReport } from './loadReport';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 });

describe('loadReport', () => {
  it('fetches the lite report and backfills missing sections', async () => {
    const fetchImpl = vi.fn(async () => json({ repoName: 'demo' }));
    const report = await loadReport(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('/gitrelic-report.lite.json');
    expect(report.repoName).toBe('demo');
    expect(report.identities).toEqual([]);
    expect(report.commits).toEqual([]);
  });

  it('explains a missing report', async () => {
    await expect(
      loadReport(async () => new Response('', { status: 404 })),
    ).rejects.toThrow('No report found');
  });

  it('reports a server error as such, not as a missing report', async () => {
    await expect(
      loadReport(async () => new Response('', { status: 500 })),
    ).rejects.toThrow("Couldn't load the report (HTTP 500).");
  });

  it('explains a malformed report', async () => {
    await expect(
      loadReport(async () => new Response('{nope', { status: 200 })),
    ).rejects.toThrow('malformed');
  });
});

describe('createCommitsLoader', () => {
  it('fetches the commit index once', async () => {
    const fetchImpl = vi.fn(async () => json({ version: 1 }));
    const load = createCommitsLoader(fetchImpl);
    await Promise.all([load(), load()]);
    await load();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('/gitrelic-commits.json');
  });

  it('names the commit history, not the report, when it fails', async () => {
    const load = createCommitsLoader(
      async () => new Response('', { status: 404 }),
    );
    await expect(load()).rejects.toThrow('No commit history found');
  });

  it('rejects an index version it cannot decode', async () => {
    const load = createCommitsLoader(async () => json({ version: 2 }));
    await expect(load()).rejects.toThrow(
      'Unsupported commit history version 2',
    );
  });

  it('retries after a failure', async () => {
    const fetchImpl = vi
      .fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(json({ version: 1 }));
    const load = createCommitsLoader(fetchImpl);
    await expect(load()).rejects.toThrow();
    await expect(load()).resolves.toEqual({ version: 1 });
  });
});
