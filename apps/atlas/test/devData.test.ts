// @vitest-environment node
// Node-side check: reads files from disk, so it runs outside happy-dom.

import { describe, expect, it } from 'vitest';

import { loadDevPayload } from '../dev/devData';

describe('loadDevPayload without GITRELIC_DEV_REPO', () => {
  it('serves the sample fixture: a lite report and its commit index', async () => {
    const payload = await loadDevPayload({});
    const lite = JSON.parse(payload.lite);
    const index = JSON.parse(payload.commits);

    expect(lite.repoName).toBe('sample-repo');
    expect(lite.commits).toEqual([]);
    expect(index.version).toBe(1);
    expect(index.time).toHaveLength(lite.meta.totalCommits);
  });
});
