import { describe, expect, it } from 'vitest';

import { buildDirectoryBubbles } from './OwnershipBubble';

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

describe('buildDirectoryBubbles', () => {
  it('aggregates files by directory with dominant author', () => {
    const report = makeReport();
    const dirs = buildDirectoryBubbles(report);
    expect(dirs.length).toBeGreaterThan(0);

    const srcDir = dirs.find((d) => d.dirPath === 'src');
    expect(srcDir).toBeDefined();
    expect(srcDir!.totalLoc).toBe(200); // 150 + 50
    expect(srcDir!.fileCount).toBe(2);
  });

  it('identifies dominant author per directory', () => {
    const report = makeReport();
    const dirs = buildDirectoryBubbles(report);
    // Both files in src/ have different authors, but alice owns app.ts (bigger file count = 1 each, so either could be dominant)
    const srcDir = dirs.find((d) => d.dirPath === 'src');
    expect(srcDir?.dominantAuthor).toBeDefined();
    expect(srcDir?.dominantPercent).toBeGreaterThan(0);
  });

  it('uses totalLoc as bubble sizing value', () => {
    const report = makeReport();
    const dirs = buildDirectoryBubbles(report);
    const srcDir = dirs.find((d) => d.dirPath === 'src');
    expect(srcDir?.totalLoc).toBe(200);
  });

  it('handles files at root level (no directory)', () => {
    const report = makeReport({
      loc: {
        totalFiles: 1,
        totalLines: 100,
        files: [{ file: 'README.md', lines: 100, language: 'Markdown' }],
        languages: [],
        summary: '',
      },
    });
    const dirs = buildDirectoryBubbles(report);
    const rootDir = dirs.find((d) => d.dirPath === '.');
    expect(rootDir).toBeDefined();
    expect(rootDir!.totalLoc).toBe(100);
  });

  it('uses 2-level deep key for nested paths', () => {
    const report = makeReport({
      loc: {
        totalFiles: 2,
        totalLines: 300,
        files: [
          { file: 'apps/web/App.tsx', lines: 200, language: 'TypeScript' },
          { file: 'apps/cli/index.ts', lines: 100, language: 'TypeScript' },
        ],
        languages: [],
        summary: '',
      },
      busFactors: {
        files: [
          {
            file: 'apps/web/App.tsx',
            uniqueAuthors: 1,
            authors: ['alice@dev.com'],
            dominantAuthor: 'alice@dev.com',
            dominantAuthorPercent: 100,
            risk: 'critical' as const,
          },
          {
            file: 'apps/cli/index.ts',
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
    });
    const dirs = buildDirectoryBubbles(report);
    // 3-part paths → use 2-level key
    expect(dirs.find((d) => d.dirPath === 'apps/web')).toBeDefined();
    expect(dirs.find((d) => d.dirPath === 'apps/cli')).toBeDefined();
  });
});
