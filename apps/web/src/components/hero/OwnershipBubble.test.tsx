import { describe, expect, it } from 'vitest';

import {
  buildDirectoryBubbles,
  fitLabel,
  fitSubLabel,
} from './OwnershipBubble';
import type { Contributor, GitrelicReport } from '@gitrelic/core';

const EMPTY_TOP_CONTRIBUTOR: Contributor = {
  email: '',
  name: '',
  commitCount: 0,
  firstCommit: '',
  lastCommit: '',
  filesOwned: 0,
  linesChanged: 0,
  activeDays: 0,
  focusAreas: [],
  isActive: false,
  isGhost: false,
};

function makeReport(overrides: Partial<GitrelicReport> = {}): GitrelicReport {
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
    contributors: {
      contributors: [
        {
          email: 'alice@dev.com',
          name: 'Alice',
          commitCount: 10,
          firstCommit: '',
          lastCommit: '',
          filesOwned: 1,
          linesChanged: 150,
          activeDays: 5,
          focusAreas: [],
          isActive: true,
          isGhost: false,
        },
        {
          email: 'bob@dev.com',
          name: 'Bob',
          commitCount: 5,
          firstCommit: '',
          lastCommit: '',
          filesOwned: 1,
          linesChanged: 50,
          activeDays: 3,
          focusAreas: [],
          isActive: true,
          isGhost: false,
        },
      ],
      activeContributors: [],
      ghostContributors: [],
      topContributor: EMPTY_TOP_CONTRIBUTOR,
      summary: '',
    },
    ...overrides,
  } as GitrelicReport;
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

  it('resolves dominantAuthorName from contributors display name', () => {
    const report = makeReport();
    const dirs = buildDirectoryBubbles(report);
    const srcDir = dirs.find((d) => d.dirPath === 'src');
    // Both alice and bob have display names in the fixture
    expect(['Alice', 'Bob']).toContain(srcDir?.dominantAuthorName);
  });

  it('falls back to email for dominantAuthorName when contributor name is empty', () => {
    // Both alice and bob have empty names. Whoever wins the dominant-author
    // tiebreak (Map iteration order in buildDirectoryBubbles), their
    // dominantAuthorName must equal their email — no display name to fall back
    // on. Asserting on whichever author won keeps the test deterministic
    // without depending on iteration order.
    const report = makeReport({
      contributors: {
        contributors: [
          {
            email: 'alice@dev.com',
            name: '',
            commitCount: 10,
            firstCommit: '',
            lastCommit: '',
            filesOwned: 1,
            linesChanged: 150,
            activeDays: 5,
            focusAreas: [],
            isActive: true,
            isGhost: false,
          },
          {
            email: 'bob@dev.com',
            name: '',
            commitCount: 5,
            firstCommit: '',
            lastCommit: '',
            filesOwned: 1,
            linesChanged: 80,
            activeDays: 3,
            focusAreas: [],
            isActive: true,
            isGhost: false,
          },
        ],
        activeContributors: [],
        ghostContributors: [],
        topContributor: EMPTY_TOP_CONTRIBUTOR,
        summary: '',
      },
    });
    const dirs = buildDirectoryBubbles(report);
    const srcDir = dirs.find((d) => d.dirPath === 'src');
    expect(srcDir).toBeDefined();
    // Whoever the dominant author is, the empty-name fallback must produce
    // their email as the displayed name. Unconditional assertion.
    expect(srcDir!.dominantAuthorName).toBe(srcDir!.dominantAuthor);
    expect(['alice@dev.com', 'bob@dev.com']).toContain(
      srcDir!.dominantAuthorName,
    );
  });

  it('sets dominantAuthorName to UNKNOWN_AUTHOR for dirs with no commit data', () => {
    const report = makeReport({
      loc: {
        totalFiles: 1,
        totalLines: 50,
        files: [
          { file: 'scripts/bench/index.js', lines: 50, language: 'JavaScript' },
        ],
        languages: [],
        summary: '',
      },
      busFactors: {
        files: [],
        criticalFiles: [],
        overallBusFactor: 0,
        summary: '',
      },
    });
    const dirs = buildDirectoryBubbles(report);
    const benchDir = dirs.find((d) => d.dirPath === 'scripts/bench');
    expect(benchDir?.dominantAuthorName).toBe('unknown');
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

  it('flags directories with no bus-factor data as unknown / 0%', () => {
    const report = makeReport({
      loc: {
        totalFiles: 1,
        totalLines: 50,
        files: [
          { file: 'scripts/bench/index.js', lines: 50, language: 'JavaScript' },
        ],
        languages: [],
        summary: '',
      },
      busFactors: {
        files: [],
        criticalFiles: [],
        overallBusFactor: 0,
        summary: '',
      },
    });
    const dirs = buildDirectoryBubbles(report);
    const benchDir = dirs.find((d) => d.dirPath === 'scripts/bench');
    expect(benchDir).toBeDefined();
    expect(benchDir!.dominantAuthor).toBe('unknown');
    expect(benchDir!.dominantPercent).toBe(0);
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

describe('fitLabel', () => {
  it('returns the text unchanged when it fits in the budget', () => {
    expect(fitLabel('packages/core', 200, 12)).toBe('packages/core');
  });

  it('appends an ellipsis when the text exceeds the budget', () => {
    const out = fitLabel('packages/react-server-dom-webpack', 30, 10);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThan('packages/react-server-dom-webpack'.length);
  });

  it('floors the budget at 4 chars so very tiny bubbles still get something', () => {
    // radius=1, fontSize=20 → would compute zero chars; floor protects this.
    const out = fitLabel('reallylongthing', 1, 20);
    expect(out.length).toBeGreaterThan(0);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('fitSubLabel', () => {
  it('returns full author + percent when both fit', () => {
    expect(fitSubLabel('alice@example.com', 80, 200, 10)).toBe(
      'alice@example.com 80%',
    );
  });

  it('truncates only the author portion when the label is too long', () => {
    const out = fitSubLabel(
      '6425824+josephsavona@users.noreply.github.com',
      28,
      50,
      10,
    );
    expect(out.endsWith(' 28%')).toBe(true);
    expect(out.includes('…')).toBe(true);
  });

  it('falls back to just the percent when the bubble is too small for any author chars', () => {
    // Tiny radius forces maxChars to floor at 4, and " 100%" alone is 5 chars,
    // so authorBudget falls below 2 and we drop to percent-only.
    const out = fitSubLabel('alice@example.com', 100, 8, 10);
    expect(out).toBe('100%');
  });
});
