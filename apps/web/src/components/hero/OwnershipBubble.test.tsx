import { describe, expect, it } from 'vitest';

import { buildOwnershipTree } from './OwnershipBubble';

import type { GitloreReport } from '@gitlore/core';

function makeReport(overrides: Partial<GitloreReport> = {}): GitloreReport {
  return {
    loc: {
      totalFiles: 2,
      totalLines: 200,
      files: [
        { file: 'src/app.ts', lines: 150, language: 'TypeScript' },
        { file: 'src/utils.ts', lines: 50, language: 'TypeScript' },
      ],
      languages: [],
      summary: '',
    },
    busFactors: {
      files: [
        {
          file: 'src/app.ts',
          uniqueAuthors: 2,
          authors: ['alice@dev.com', 'bob@dev.com'],
          dominantAuthor: 'alice@dev.com',
          dominantAuthorPercent: 70,
          risk: 'high' as const,
        },
        {
          file: 'src/utils.ts',
          uniqueAuthors: 1,
          authors: ['bob@dev.com'],
          dominantAuthor: 'bob@dev.com',
          dominantAuthorPercent: 100,
          risk: 'critical' as const,
        },
      ],
      criticalFiles: [],
      overallBusFactor: 1,
      summary: '',
    },
    ...overrides,
  } as GitloreReport;
}

describe('buildOwnershipTree', () => {
  it('creates hierarchy nodes with dominantAuthor', () => {
    const report = makeReport();
    const tree = buildOwnershipTree(report);
    expect(tree.name).toBe('root');
    expect(tree.children).toBeDefined();

    const leaves: { name: string; dominantAuthor?: string }[] = [];
    const walk = (n: typeof tree) => {
      if (!n.children?.length) leaves.push(n);
      else n.children.forEach(walk);
    };
    walk(tree);

    const app = leaves.find((l) => l.name === 'app.ts');
    expect(app?.dominantAuthor).toBe('alice@dev.com');
    const utils = leaves.find((l) => l.name === 'utils.ts');
    expect(utils?.dominantAuthor).toBe('bob@dev.com');
  });

  it('uses LOC as value for bubble sizing', () => {
    const report = makeReport();
    const tree = buildOwnershipTree(report);
    const leaves: { name: string; value?: number }[] = [];
    const walk = (n: typeof tree) => {
      if (!n.children?.length) leaves.push(n);
      else n.children.forEach(walk);
    };
    walk(tree);

    const app = leaves.find((l) => l.name === 'app.ts');
    expect(app?.value).toBe(150);
  });
});
