/**
 * End-to-end check that author identities are merged before analysis.
 *
 * Runs the real `git log` path (so `.mailmap` handling via %aE/%aN is
 * exercised, not mocked) against a fixture where each person commits under
 * split identities, then asserts every email-keyed analyzer agrees on one
 * canonical identity per person.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { runGitrelic } from './runner.js';
import type { GitrelicReport } from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BUILD_SCRIPT = path.resolve(
  __dirname,
  '../tests/fixtures/build-identity-repo.sh',
);

const EXPECTED_AUTHORS = [
  '49699333+dependabot[bot]@users.noreply.github.com',
  'alex@a.com',
  'alex@b.com',
  'dana@corp.com',
  'josh@corp.com',
  'sam@work.com',
];

let repoPath = '';
let merged: GitrelicReport;
let unmerged: GitrelicReport;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-02-01T12:00:00Z'));

  repoPath = mkdtempSync(path.join(tmpdir(), 'gitrelic-identity-'));
  execFileSync('bash', [BUILD_SCRIPT, repoPath], { stdio: 'pipe' });

  merged = await runGitrelic({ repoPath });
  unmerged = await runGitrelic({ repoPath, mergeIdentities: false });
}, 30_000);

afterAll(() => {
  vi.useRealTimers();
  if (repoPath) rmSync(repoPath, { recursive: true, force: true });
});

describe('identity merging (integration)', () => {
  it('applies .mailmap even when merging is disabled', () => {
    const emails = new Set(unmerged.commits.map((c) => c.authorEmail));
    expect(emails.has('old@corp.com')).toBe(false);
    expect(emails.has('dana@corp.com')).toBe(true);
  });

  it('counts each person once in meta and contributors', () => {
    expect(merged.meta.totalAuthors).toBe(EXPECTED_AUTHORS.length);
    expect(merged.contributors.contributors.map((c) => c.email).sort()).toEqual(
      EXPECTED_AUTHORS,
    );
    // Without merging, Josh and Sam are each split in two.
    expect(unmerged.meta.totalAuthors).toBe(EXPECTED_AUTHORS.length + 2);
  });

  it('uses canonical names', () => {
    const josh = merged.contributors.contributors.find(
      (c) => c.email === 'josh@corp.com',
    );
    expect(josh?.name).toBe('Josh Story');
    expect(josh?.commitCount).toBe(5);
  });

  it('keeps the two different Alexes apart', () => {
    const alexes = merged.contributors.contributors.filter(
      (c) => c.name === 'Alex',
    );
    expect(alexes).toHaveLength(2);
  });

  it('attributes file ownership to the canonical identity', () => {
    const api = merged.busFactors.files.find((f) => f.file === 'src/api.ts');
    expect(api?.authors).toEqual(['josh@corp.com']);
    expect(api?.dominantAuthorPercent).toBe(100);
  });

  it('folds split commits into one stress profile', () => {
    // 3 + 2 commits: neither identity alone clears commit-timing's
    // 5-commit floor, so Josh only appears once merged.
    const find = (r: GitrelicReport) =>
      r.commitTiming.authorStress.filter(
        (a) => a.name === 'Josh Story' || a.name === 'joshstory',
      );
    expect(find(unmerged)).toEqual([]);
    const [josh] = find(merged);
    expect(josh.email).toBe('josh@corp.com');
    expect(josh.totalCommits).toBe(5);
    expect(josh.lateNightCommits).toBe(1);
  });

  it('remaps co-author trailers', () => {
    const paired = merged.commits.find((c) =>
      c.message.startsWith('feat: paired'),
    );
    expect(paired?.coAuthors).toEqual([
      { name: 'Josh Story', email: 'josh@corp.com' },
    ]);
  });

  it('applies .mailmap to co-author trailers', () => {
    const review = merged.commits.find((c) =>
      c.message.startsWith('fix: review follow-ups'),
    );
    expect(review?.coAuthors).toEqual([
      { name: 'Dana Park', email: 'dana@corp.com' },
    ]);
  });

  it('reports merged identities with their aliases', () => {
    expect(merged.identities.map((i) => i.canonicalEmail)).toEqual([
      'josh@corp.com',
      'sam@work.com',
    ]);
    expect(merged.identities[0].aliases).toEqual([
      { email: 'josh@corp.com', name: 'Josh Story', commits: 3 },
      {
        email: '12345+joshstory@users.noreply.github.com',
        name: 'joshstory',
        commits: 2,
      },
    ]);
    expect(unmerged.identities).toEqual([]);
  });
});
