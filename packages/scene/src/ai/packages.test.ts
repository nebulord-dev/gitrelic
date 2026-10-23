import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { SWEEPING_COMMIT_FILES } from '../timing/punchCard';
import { aiPackagesFrom, aiPackagesOf } from './packages';
import type { CommitLike } from '../commits/commitLike';
import type { CoAuthorReport, GitrelicReport } from '@gitrelic/core';

const base = reportJson as unknown as GitrelicReport;

function withCoAuthors(over: Partial<CoAuthorReport>): GitrelicReport {
  return { ...base, coAuthors: { ...base.coAuthors, ...over } };
}

const c = (author: string, files: string[], ai: 0 | 1 | 2 = 0): CommitLike => ({
  timeMs: 0,
  author,
  files,
  ai,
});

describe('aiPackagesOf', () => {
  it('names core’s packages for the stage, most commits first, the root as repo', () => {
    const out = aiPackagesOf(
      withCoAuthors({
        packages: [
          { package: '', commits: 4, aiAssisted: 1, aiAuthored: 0 },
          { package: 'packages/ui', commits: 9, aiAssisted: 3, aiAuthored: 2 },
        ],
        humanAuthoredCommits: 10,
        aiAuthoredCommits: 2,
        aiAssistedCommits: 4,
      }),
    );
    expect(out.rows.map((r) => [r.id, r.name])).toEqual([
      ['dir:packages/ui', 'ui'],
      ['repo', '(root)'],
    ]);
    expect(out.rows[0]).toMatchObject({ commits: 9, assisted: 3, authored: 2 });
    // (4 assisted + 2 authored) of (10 human + 2 authored)
    expect(out).toMatchObject({ commits: 12, ai: 6 });
  });
});

describe('aiPackagesFrom', () => {
  const tracked = (files: string[]): GitrelicReport => ({
    ...base,
    loc: {
      ...base.loc,
      files: files.map((file) => ({ ...base.loc.files[0], file })),
    },
  });

  it('counts the matching commits by core’s rules', () => {
    const report = tracked([
      'src/a.ts',
      'docs/x.md',
      ...Array.from({ length: 21 }, (_, i) => `src/f${i}.ts`),
    ]);
    const commits = [
      c('ann@x', ['src/a.ts', 'docs/x.md'], 1),
      c('ann@x', ['src/a.ts', 'gone/old.ts']),
      c(
        'ann@x',
        Array.from(
          { length: SWEEPING_COMMIT_FILES + 1 },
          (_, i) => `src/f${i}.ts`,
        ),
        1,
      ),
      c('bob@x', ['src/a.ts'], 1),
      c('49699333+dependabot[bot]@users.noreply.github.com', ['src/a.ts']),
    ];
    const out = aiPackagesFrom(report, commits, (k) => k.author !== 'bob@x');
    // The sweeping commit counts toward the share but no package; the bot's
    // counts nowhere; the deleted file's package isn't drawn.
    expect(out).toMatchObject({ commits: 3, ai: 2 });
    expect(out.rows.map((r) => [r.package, r.commits, r.assisted])).toEqual([
      ['src', 2, 1],
      ['docs', 1, 1],
    ]);
  });

  it('splits an agent’s own commits from AI-assisted ones', () => {
    const out = aiPackagesFrom(
      tracked(['src/a.ts']),
      [c('agent@x', ['src/a.ts'], 2), c('ann@x', ['src/a.ts'], 1)],
      () => true,
    );
    expect(out.rows[0]).toMatchObject({ assisted: 1, authored: 1 });
  });
});
