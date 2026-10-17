import { normalizeReport } from '@gitrelic/scene';

import type { CommitIndex, GitrelicReport } from '@gitrelic/core';

type Fetch = (url: string) => Promise<Response>;

// Resolve fetch at call time so tests can stub the global.
const globalFetch: Fetch = (url) => fetch(url);

async function fetchJson<T>(fetchImpl: Fetch, url: string): Promise<T> {
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error('No report found. Run gitrelic --web to generate one.');
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error('Report file is malformed. Re-run gitrelic --web.');
  }
}

/**
 * The report without its commits. Older saved reports lack newer fields, so
 * it is normalized before any view sees it.
 */
export async function loadReport(
  fetchImpl: Fetch = globalFetch,
): Promise<GitrelicReport> {
  const raw = await fetchJson<Partial<GitrelicReport>>(
    fetchImpl,
    '/gitrelic-report.lite.json',
  );
  return normalizeReport(raw);
}

/**
 * Returns a loader for the columnar commit index. Only views that need
 * individual commits call it, and it fetches once; a failed fetch is retried
 * on the next call.
 */
export function createCommitsLoader(
  fetchImpl: Fetch = globalFetch,
): () => Promise<CommitIndex> {
  let pending: Promise<CommitIndex> | undefined;
  return () =>
    (pending ??= fetchJson<CommitIndex>(
      fetchImpl,
      '/gitrelic-commits.json',
    ).catch((err: unknown) => {
      pending = undefined;
      throw err;
    }));
}

export const loadCommits = createCommitsLoader();
