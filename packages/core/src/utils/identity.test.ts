import { describe, expect, it } from 'vitest';

import { mergeIdentities } from './identity.js';
import type { RawCommit } from './git.js';

let seq = 0;
function commit(
  authorEmail: string,
  authorName: string,
  extra: Partial<RawCommit> = {},
): RawCommit {
  seq += 1;
  return {
    hash: `h${seq}`,
    authorEmail,
    authorName,
    date: '2026-01-01T00:00:00Z',
    message: 'm',
    coAuthors: [],
    files: [],
    fileStats: [],
    insertions: 0,
    deletions: 0,
    ...extra,
  };
}

function authors(commits: RawCommit[]): string[] {
  return commits.map((c) => `${c.authorName} <${c.authorEmail}>`);
}

describe('mergeIdentities', () => {
  it('leaves distinct people untouched and reports no identities', () => {
    const input = [
      commit('alice@example.com', 'Alice Adams'),
      commit('bob@example.com', 'Bob Brown'),
    ];
    const { commits, identities } = mergeIdentities(input);
    expect(authors(commits)).toEqual(authors(input));
    expect(identities).toEqual([]);
  });

  it('merges emails that differ only by case', () => {
    const { commits, identities } = mergeIdentities([
      commit('Alice@Example.com', 'Alice'),
      commit('alice@example.com', 'Alice'),
      commit('alice@example.com', 'Alice'),
    ]);
    expect(new Set(commits.map((c) => c.authorEmail))).toEqual(
      new Set(['alice@example.com']),
    );
    expect(identities).toHaveLength(1);
    expect(identities[0].canonicalEmail).toBe('alice@example.com');
  });

  it('merges a GitHub noreply address into the matching work email by login', () => {
    const { commits } = mergeIdentities([
      commit('jstory@corp.com', 'Josh Story'),
      commit('jstory@corp.com', 'Josh Story'),
      commit('12345+jstory@users.noreply.github.com', 'jstory'),
    ]);
    expect(new Set(authors(commits))).toEqual(
      new Set(['Josh Story <jstory@corp.com>']),
    );
  });

  it('merges a noreply login that equals the de-spaced name', () => {
    const { commits } = mergeIdentities([
      commit('josh@personal.dev', 'Josh Story'),
      commit('99+joshstory@users.noreply.github.com', 'Josh S'),
    ]);
    expect(new Set(commits.map((c) => c.authorEmail))).toEqual(
      new Set(['josh@personal.dev']),
    );
  });

  it('merges two emails sharing a normalized multi-word name', () => {
    const { commits, identities } = mergeIdentities([
      commit('sebastian@old.eu', 'Sebastian  Markbåge'),
      commit('seb@new.com', 'sebastian markbåge'),
      commit('seb@new.com', 'Sebastian Markbåge'),
    ]);
    expect(new Set(commits.map((c) => c.authorEmail))).toEqual(
      new Set(['seb@new.com']),
    );
    expect(identities[0].aliases.map((a) => a.email).sort()).toEqual([
      'seb@new.com',
      'sebastian@old.eu',
    ]);
  });

  it('matches a co-author email nobody authored with to an author by full name', () => {
    const { commits } = mergeIdentities([
      commit('jackpope@meta.com', 'Jack Pope', {
        coAuthors: [{ name: 'Jack Pope', email: 'jackpope1@gmail.com' }],
      }),
      commit('bob@example.com', 'Bob Brown', {
        coAuthors: [
          { name: 'jack pope', email: 'jackpope1@gmail.com' },
          { name: 'Alex', email: 'alex@else.com' },
        ],
      }),
    ]);
    expect(commits[0].coAuthors).toEqual([
      { name: 'Jack Pope', email: 'jackpope@meta.com' },
    ]);
    // A single-word name is too common to trust, as for authors.
    expect(commits[1].coAuthors).toEqual([
      { name: 'Jack Pope', email: 'jackpope@meta.com' },
      { name: 'Alex', email: 'alex@else.com' },
    ]);
  });

  it('never matches an AI co-author to a person by name', () => {
    const { commits } = mergeIdentities([
      commit('claude@corp.com', 'Claude Opus'),
      commit('bob@example.com', 'Bob Brown', {
        coAuthors: [{ name: 'Claude Opus', email: 'noreply@anthropic.com' }],
      }),
    ]);
    expect(commits[1].coAuthors[0].email).toBe('noreply@anthropic.com');
  });

  it('does not merge on a single-word name', () => {
    const { commits, identities } = mergeIdentities([
      commit('alex@a.com', 'Alex'),
      commit('alex@b.com', 'Alex'),
    ]);
    expect(new Set(commits.map((c) => c.authorEmail)).size).toBe(2);
    expect(identities).toEqual([]);
  });

  it('does not merge on denylisted placeholder names', () => {
    const { commits } = mergeIdentities([
      commit('a@one.com', 'Your Name'),
      commit('b@two.com', 'your name'),
    ]);
    expect(new Set(commits.map((c) => c.authorEmail)).size).toBe(2);
  });

  it('never merges bots or AI identities by name or login', () => {
    const { commits } = mergeIdentities([
      commit(
        '49699333+dependabot[bot]@users.noreply.github.com',
        'dependabot[bot]',
      ),
      commit('dependabot[bot]@example.com', 'dependabot[bot]'),
      commit('noreply@anthropic.com', 'Claude Code'),
      commit('claude@corp.com', 'Claude Code'),
    ]);
    expect(new Set(commits.map((c) => c.authorEmail)).size).toBe(4);
  });

  it('prefers the most-used non-noreply email as canonical', () => {
    const { commits } = mergeIdentities([
      commit('1+ann@users.noreply.github.com', 'Ann Lee'),
      commit('1+ann@users.noreply.github.com', 'Ann Lee'),
      commit('1+ann@users.noreply.github.com', 'Ann Lee'),
      commit('ann@corp.com', 'Ann Lee'),
    ]);
    expect(new Set(commits.map((c) => c.authorEmail))).toEqual(
      new Set(['ann@corp.com']),
    );
  });

  it('uses the most frequent name as canonical', () => {
    const { commits } = mergeIdentities([
      commit('ann@corp.com', 'Ann Lee'),
      commit('ann@corp.com', 'Ann Lee'),
      commit('ANN@corp.com', 'ann'),
    ]);
    expect(new Set(commits.map((c) => c.authorName))).toEqual(
      new Set(['Ann Lee']),
    );
  });

  it('rewrites co-author emails through the same map', () => {
    const { commits } = mergeIdentities([
      commit('ann@corp.com', 'Ann Lee'),
      commit('1+ann@users.noreply.github.com', 'Ann Lee'),
      commit('bob@corp.com', 'Bob Brown', {
        coAuthors: [
          { name: 'Ann Lee', email: '1+ann@users.noreply.github.com' },
          { name: 'Zed Unknown', email: 'zed@elsewhere.org' },
        ],
      }),
    ]);
    expect(commits[2].coAuthors).toEqual([
      { name: 'Ann Lee', email: 'ann@corp.com' },
      { name: 'Zed Unknown', email: 'zed@elsewhere.org' },
    ]);
  });

  it('counts commits per alias', () => {
    const { identities } = mergeIdentities([
      commit('ann@corp.com', 'Ann Lee'),
      commit('ann@corp.com', 'Ann Lee'),
      commit('ann@home.net', 'Ann Lee'),
    ]);
    expect(identities[0]).toEqual({
      canonicalEmail: 'ann@corp.com',
      name: 'Ann Lee',
      aliases: [
        { email: 'ann@corp.com', name: 'Ann Lee', commits: 2 },
        { email: 'ann@home.net', name: 'Ann Lee', commits: 1 },
      ],
    });
  });

  it('is idempotent', () => {
    const first = mergeIdentities([
      commit('ann@corp.com', 'Ann Lee'),
      commit('1+ann@users.noreply.github.com', 'ann'),
      commit('ann@home.net', 'Ann Lee'),
    ]);
    const second = mergeIdentities(first.commits);
    expect(authors(second.commits)).toEqual(authors(first.commits));
    expect(second.identities).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = [
      commit('ann@corp.com', 'Ann Lee'),
      commit('ann@home.net', 'Ann Lee'),
    ];
    mergeIdentities(input);
    expect(input[1].authorEmail).toBe('ann@home.net');
  });

  it('does not merge a noreply login that matches more than one person', () => {
    // Both Alexes index under handle "alex"; unioning the login with every
    // match would merge two different people the single-word guard keeps apart.
    const { commits } = mergeIdentities([
      commit('alex@a.com', 'Alex'),
      commit('alex@b.com', 'Alex'),
      commit('999+alex@users.noreply.github.com', 'alex'),
    ]);
    expect(new Set(commits.map((c) => c.authorEmail)).size).toBe(3);
  });

  it('still merges an ambiguous-looking handle when all matches are one person', () => {
    // Two emails already merged by name (rule 3) both index "annlee" — that's
    // one cluster, so the login is unambiguous.
    const { commits } = mergeIdentities([
      commit('ann@corp.com', 'Ann Lee'),
      commit('ann@home.net', 'Ann Lee'),
      commit('5+annlee@users.noreply.github.com', 'annlee'),
    ]);
    expect(new Set(commits.map((c) => c.authorEmail)).size).toBe(1);
  });

  it('merges two noreply spellings of the same login', () => {
    const { commits } = mergeIdentities([
      commit('octo@users.noreply.github.com', 'octo'),
      commit('42+octo@users.noreply.github.com', 'octo'),
    ]);
    expect(new Set(commits.map((c) => c.authorEmail)).size).toBe(1);
  });

  it('ignores very short handles', () => {
    const { commits } = mergeIdentities([
      commit('me@one.com', 'Pat Doe'),
      commit('1+me@users.noreply.github.com', 'me'),
    ]);
    expect(new Set(commits.map((c) => c.authorEmail)).size).toBe(2);
  });

  it('is transitive across rules', () => {
    // case → name → login chains into one person
    const { commits } = mergeIdentities([
      commit('Ann@Corp.com', 'Ann Lee'),
      commit('ann@corp.com', 'Ann Lee'),
      commit('ann.lee@home.net', 'Ann Lee'),
      commit('7+ann.lee@users.noreply.github.com', 'al'),
    ]);
    expect(new Set(commits.map((c) => c.authorEmail)).size).toBe(1);
  });
});
