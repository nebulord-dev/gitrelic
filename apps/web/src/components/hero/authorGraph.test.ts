import { describe, expect, it } from 'vitest';

import { buildAuthorGraph } from './authorGraph';
import type {
  CoAuthorPair,
  CoAuthorStats,
  Contributor,
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

function makeContributor(overrides: Partial<Contributor> = {}): Contributor {
  return {
    email: 'alice@example.com',
    name: 'Alice',
    commitCount: 10,
    firstCommit: '2024-01-01',
    lastCommit: '2024-12-01',
    filesOwned: 0,
    linesChanged: 0,
    activeDays: 0,
    focusAreas: [],
    isActive: true,
    isGhost: false,
    ...overrides,
  };
}

function makeReport(
  pairs: CoAuthorPair[],
  authorStats: CoAuthorStats[] = [],
  contributors: Contributor[] = [],
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
    contributors: {
      contributors,
      activeContributors: [],
      ghostContributors: [],
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
        coAuthoredCommits: 2,
      }),
      makePair({
        authorA: 'Alice <a@e.com>',
        authorB: 'Cara <c@e.com>',
        coAuthoredCommits: 2,
      }),
      makePair({
        authorA: 'Alice <a@e.com>',
        authorB: 'Dan <d@e.com>',
        coAuthoredCommits: 2,
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

  describe('single-commit edge filter', () => {
    it('drops links where coAuthoredCommits === 1 by default', () => {
      const pairs = [
        makePair({
          authorA: 'Alice <a@e.com>',
          authorB: 'Bob <b@e.com>',
          coAuthoredCommits: 5,
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
      const { links } = buildAuthorGraph(makeReport(pairs));
      expect(links).toHaveLength(1);
      expect(links[0].coAuthoredCommits).toBe(5);
    });

    it('reports the count of filtered single-commit edges', () => {
      const pairs = [
        makePair({
          authorA: 'Alice <a@e.com>',
          authorB: 'Bob <b@e.com>',
          coAuthoredCommits: 5,
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
      const { filteredSingleCommitEdges } = buildAuthorGraph(makeReport(pairs));
      expect(filteredSingleCommitEdges).toBe(2);
    });

    it('reports zero filtered edges when no single-commit pairs exist', () => {
      const pairs = [
        makePair({
          authorA: 'Alice <a@e.com>',
          authorB: 'Bob <b@e.com>',
          coAuthoredCommits: 5,
        }),
      ];
      const { filteredSingleCommitEdges } = buildAuthorGraph(makeReport(pairs));
      expect(filteredSingleCommitEdges).toBe(0);
    });

    it('drops nodes whose only links were single-commit pairs', () => {
      const pairs = [
        makePair({
          authorA: 'Alice <a@e.com>',
          authorB: 'Bob <b@e.com>',
          coAuthoredCommits: 5,
        }),
        // Cara only appears on a single-commit edge — should be filtered out.
        makePair({
          authorA: 'Alice <a@e.com>',
          authorB: 'Cara <c@e.com>',
          coAuthoredCommits: 1,
        }),
      ];
      const { nodes } = buildAuthorGraph(makeReport(pairs));
      expect(nodes.map((n) => n.id).sort()).toEqual([
        'Alice <a@e.com>',
        'Bob <b@e.com>',
      ]);
    });
  });

  describe('classification stamping', () => {
    it('stamps human classification on plain-email authors', () => {
      const pairs = [
        makePair({
          authorA: 'Alice <alice@example.com>',
          authorB: 'Bob <bob@example.com>',
          coAuthoredCommits: 5,
        }),
      ];
      const { nodes } = buildAuthorGraph(makeReport(pairs));
      for (const n of nodes) {
        expect(n.classification).toBe('human');
      }
    });

    it('stamps ai classification on Claude / Copilot / known AI emails', () => {
      const pairs = [
        makePair({
          authorA: 'Alice <alice@example.com>',
          authorB: 'Claude <noreply@anthropic.com>',
          coAuthoredCommits: 5,
        }),
        makePair({
          authorA: 'Alice <alice@example.com>',
          authorB: 'Copilot <copilot[bot]@users.noreply.github.com>',
          coAuthoredCommits: 4,
        }),
      ];
      const { nodes } = buildAuthorGraph(makeReport(pairs));
      const claude = nodes.find((n) => n.id.includes('anthropic'))!;
      const copilot = nodes.find((n) => n.id.includes('copilot'))!;
      const alice = nodes.find((n) => n.id.includes('alice'))!;
      expect(claude.classification).toBe('ai');
      expect(copilot.classification).toBe('ai');
      expect(alice.classification).toBe('human');
    });
  });

  describe('display name resolution', () => {
    it('uses aiProductName for known AI emails', () => {
      const pairs = [
        makePair({
          authorA: 'Alice <alice@example.com>',
          authorB: 'noreply <noreply@anthropic.com>',
          coAuthoredCommits: 5,
        }),
      ];
      const { nodes } = buildAuthorGraph(makeReport(pairs));
      const claude = nodes.find((n) => n.classification === 'ai')!;
      expect(claude.displayName).toBe('Claude');
    });

    it('uses contributors map name (case-insensitive on email) for human authors', () => {
      const pairs = [
        makePair({
          authorA: 'Alice Cooper <ALICE@example.com>',
          authorB: 'Bob <bob@example.com>',
          coAuthoredCommits: 5,
        }),
      ];
      const contributors = [
        makeContributor({ email: 'alice@example.com', name: 'Alice Cooper' }),
        makeContributor({ email: 'bob@example.com', name: 'Robert Smith' }),
      ];
      const { nodes } = buildAuthorGraph(makeReport(pairs, [], contributors));
      const alice = nodes.find((n) => n.id.startsWith('Alice'))!;
      const bob = nodes.find((n) => n.id.startsWith('Bob'))!;
      expect(alice.displayName).toBe('Alice Cooper');
      expect(bob.displayName).toBe('Robert Smith');
    });

    it('falls back to the email-derived label when the contributor entry has no name', () => {
      const pairs = [
        makePair({
          authorA: 'Alice <alice@example.com>',
          authorB: 'Bob <bob@example.com>',
          coAuthoredCommits: 5,
        }),
      ];
      const contributors = [
        makeContributor({ email: 'alice@example.com', name: '' }),
      ];
      const { nodes } = buildAuthorGraph(makeReport(pairs, [], contributors));
      const alice = nodes.find((n) => n.id.startsWith('Alice'))!;
      expect(alice.displayName).toBe('Alice');
    });

    it('falls back to the email-derived label when no contributors map is provided', () => {
      const pairs = [
        makePair({
          authorA: 'Alice <alice@example.com>',
          authorB: 'Bob <bob@example.com>',
          coAuthoredCommits: 5,
        }),
      ];
      const { nodes } = buildAuthorGraph(makeReport(pairs));
      const alice = nodes.find((n) => n.id.startsWith('Alice'))!;
      expect(alice.displayName).toBe('Alice');
    });
  });
});
