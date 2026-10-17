import { normalizeReport } from '@gitrelic/scene';

import type { CommitIndex, GitrelicReport } from '@gitrelic/core';

type Fetch = (url: string) => Promise<Response>;

// Resolve fetch at call time so tests can stub the global.
const globalFetch: Fetch = (url) => fetch(url);

async function fetchJson<T>(
  fetchImpl: Fetch,
  url: string,
  label: string,
): Promise<T> {
  const res = await fetchImpl(url);
  if (res.status === 404) {
    throw new Error(`No ${label} found. Run gitrelic --web to generate one.`);
  }
  if (!res.ok) {
    throw new Error(`Couldn't load the ${label} (HTTP ${res.status}).`);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`The ${label} is malformed. Re-run gitrelic --web.`);
  }
}

async function fetchCommitIndex(fetchImpl: Fetch): Promise<CommitIndex> {
  const index = await fetchJson<CommitIndex>(
    fetchImpl,
    '/gitrelic-commits.json',
    'commit history',
  );
  // Checked at the boundary so no view decodes a layout it doesn't know.
  if (index.version !== 1) {
    throw new Error(
      `Unsupported commit history version ${index.version}. Re-run gitrelic --web.`,
    );
  }
  return index;
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
    'report',
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
    (pending ??= fetchCommitIndex(fetchImpl).catch((err: unknown) => {
      pending = undefined;
      throw err;
    }));
}

export const loadCommits = createCommitsLoader();
