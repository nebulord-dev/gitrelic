import { describe, expect, it } from 'vitest';

import { buildAuthorGraph } from './authorGraph';

import type {
  CoAuthorPair,
  CoAuthorStats,
  GitrelicReport,
} from '@gitrelic/core';

function makePair(overrides: Partial<CoAuthorPair> = {}): CoAuthorPair {
  return {
    authorA: 'Alice <alice@example.com>',
    authorB: 'Bob <bob@example.com>',
    coAuthoredCommits: 10,
    files: ['src/a.ts', 'src/b.ts'],
    ...overrides,
  };
}

function makeReport(
  pairs: CoAuthorPair[],
  authorStats: CoAuthorStats[] = [],
): GitrelicReport {
  return {
    coAuthors: {
      pairs,
      authorStats,
      totalCoAuthoredCommits: pairs.reduce(
        (s, p) => s + p.coAuthoredCommits,
        0,
      ),
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('buildAuthorGraph', () => {
  it('returns empty nodes and links when pairs list is empty', () => {
    const { nodes, links } = buildAuthorGraph(makeReport([]));
    expect(nodes).toEqual([]);
    expect(links).toEqual([]);
  });

  it('creates one link per pair and deduplicates shared authors across pairs', () => {
    const pairs = [
      makePair({
        authorA: 'Alice <a@e.com>',
        authorB: 'Bob <b@e.com>',
        coAuthoredCommits: 5,
      }),
      makePair({
        authorA: 'Alice <a@e.com>',
        authorB: 'Cara <c@e.com>',
        coAuthoredCommits: 3,
      }),
    ];
    const { nodes, links } = buildAuthorGraph(makeReport(pairs));
    expect(nodes).toHaveLength(3);
    expect(links).toHaveLength(2);
    expect(nodes.map((n) => n.id).sort()).toEqual([
      'Alice <a@e.com>',
      'Bob <b@e.com>',
      'Cara <c@e.com>',
    ]);
  });

  it('maps each link to authorA → authorB with coAuthoredCommits and shared file count', () => {
    const pair = makePair({
      coAuthoredCommits: 7,
      files: ['x.ts', 'y.ts', 'z.ts'],
    });
    const { links } = buildAuthorGraph(makeReport([pair]));
    expect(links[0].source).toBe(pair.authorA);
    expect(links[0].target).toBe(pair.authorB);
    expect(links[0].coAuthoredCommits).toBe(7);
    expect(links[0].sharedFiles).toBe(3);
  });

  it('derives coAuthoredCommits per node by summing links when no authorStats match', () => {
    const pairs = [
      makePair({
        authorA: 'Alice <a@e.com>',
        authorB: 'Bob <b@e.com>',
        coAuthoredCommits: 5,
      }),
      makePair({
        authorA: 'Alice <a@e.com>',
        authorB: 'Cara <c@e.com>',
        coAuthoredCommits: 3,
      }),
    ];
    const { nodes } = buildAuthorGraph(makeReport(pairs));
    const alice = nodes.find((n) => n.id === 'Alice <a@e.com>')!;
    expect(alice.coAuthoredCommits).toBe(8);
  });

  it('prefers authorStats coAuthoredCommits when an entry exists for the author', () => {
    const pairs = [
      makePair({
        authorA: 'Alice <a@e.com>',
        authorB: 'Bob <b@e.com>',
        coAuthoredCommits: 5,
      }),
    ];
    const authorStats: CoAuthorStats[] = [
      {
        author: 'Alice <a@e.com>',
        coAuthoredCommits: 42,
        primaryPartner: 'Bob <b@e.com>',
      },
    ];
    const { nodes } = buildAuthorGraph(makeReport(pairs, authorStats));
    const alice = nodes.find((n) => n.id === 'Alice <a@e.com>')!;
    expect(alice.coAuthoredCommits).toBe(42);
    expect(alice.primaryPartner).toBe('Bob <b@e.com>');
  });

  it('counts partnerCount from the number of links touching each node', () => {
    const pairs = [
      makePair({
        authorA: 'Alice <a@e.com>',
        authorB: 'Bob <b@e.com>',
        coAuthoredCommits: 1,
      }),
      makePair({
        authorA: 'Alice <a@e.com>',
        authorB: 'Cara <c@e.com>',
        coAuthoredCommits: 1,
      }),
      makePair({
        authorA: 'Alice <a@e.com>',
        authorB: 'Dan <d@e.com>',
        coAuthoredCommits: 1,
      }),
    ];
    const { nodes } = buildAuthorGraph(makeReport(pairs));
    const alice = nodes.find((n) => n.id === 'Alice <a@e.com>')!;
    const bob = nodes.find((n) => n.id === 'Bob <b@e.com>')!;
    expect(alice.partnerCount).toBe(3);
    expect(bob.partnerCount).toBe(1);
  });

  it('derives a display label from the author identifier, stripping the email suffix', () => {
    const pairs = [
      makePair({ authorA: 'Alice <a@e.com>', authorB: 'Bob <b@e.com>' }),
    ];
    const { nodes } = buildAuthorGraph(makeReport(pairs));
    const alice = nodes.find((n) => n.id === 'Alice <a@e.com>')!;
    expect(alice.label).toBe('Alice');
  });
});
