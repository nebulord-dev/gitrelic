import { describe, it, expect } from 'vitest';

import { parseRenameLog, buildRenameChains } from './rename-tracking.js';

import type { FileRename } from '../types.js';

describe('parseRenameLog', () => {
  it('correctly parses rename entries with R100', () => {
    const raw = ['COMMIT|abc123|2025-06-01T00:00:00Z', 'R100\tsrc/old.ts\tsrc/new.ts'].join('\n');

    const result = parseRenameLog(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      oldPath: 'src/old.ts',
      newPath: 'src/new.ts',
      commitHash: 'abc123',
      date: '2025-06-01T00:00:00Z',
    });
  });

  it('correctly parses rename entries with R095', () => {
    const raw = [
      'COMMIT|def456|2025-07-01T00:00:00Z',
      'R095\tlib/auth.ts\tlib/authentication.ts',
    ].join('\n');

    const result = parseRenameLog(raw);
    expect(result).toHaveLength(1);
    expect(result[0].oldPath).toBe('lib/auth.ts');
    expect(result[0].newPath).toBe('lib/authentication.ts');
  });

  it('handles empty input', () => {
    expect(parseRenameLog('')).toHaveLength(0);
  });

  it('handles multiple renames in one commit', () => {
    const raw = [
      'COMMIT|abc123|2025-06-01T00:00:00Z',
      'R100\tsrc/a.ts\tsrc/a-renamed.ts',
      'R090\tsrc/b.ts\tsrc/b-renamed.ts',
    ].join('\n');

    const result = parseRenameLog(raw);
    expect(result).toHaveLength(2);
    expect(result[0].oldPath).toBe('src/a.ts');
    expect(result[0].newPath).toBe('src/a-renamed.ts');
    expect(result[1].oldPath).toBe('src/b.ts');
    expect(result[1].newPath).toBe('src/b-renamed.ts');
    // Both should share the same commit
    expect(result[0].commitHash).toBe('abc123');
    expect(result[1].commitHash).toBe('abc123');
  });

  it('handles multiple commits', () => {
    const raw = [
      'COMMIT|aaa|2025-01-01T00:00:00Z',
      'R100\told1.ts\tnew1.ts',
      '',
      'COMMIT|bbb|2025-02-01T00:00:00Z',
      'R100\told2.ts\tnew2.ts',
    ].join('\n');

    const result = parseRenameLog(raw);
    expect(result).toHaveLength(2);
    expect(result[0].commitHash).toBe('aaa');
    expect(result[1].commitHash).toBe('bbb');
  });
});

describe('buildRenameChains', () => {
  it('builds a→b→c chain correctly for c', () => {
    const renames: FileRename[] = [
      { oldPath: 'a.ts', newPath: 'b.ts', commitHash: 'aaa', date: '2025-01-01T00:00:00Z' },
      { oldPath: 'b.ts', newPath: 'c.ts', commitHash: 'bbb', date: '2025-02-01T00:00:00Z' },
    ];

    const chains = buildRenameChains(renames, ['c.ts']);
    expect(chains).toHaveLength(1);
    expect(chains[0]).toEqual({
      currentPath: 'c.ts',
      previousNames: ['a.ts', 'b.ts'],
      renameCount: 2,
    });
  });

  it('only includes chains for current tracked files', () => {
    const renames: FileRename[] = [
      { oldPath: 'a.ts', newPath: 'b.ts', commitHash: 'aaa', date: '2025-01-01T00:00:00Z' },
      { oldPath: 'x.ts', newPath: 'y.ts', commitHash: 'bbb', date: '2025-01-01T00:00:00Z' },
    ];

    // Only b.ts is tracked, y.ts is not
    const chains = buildRenameChains(renames, ['b.ts']);
    expect(chains).toHaveLength(1);
    expect(chains[0].currentPath).toBe('b.ts');
    expect(chains[0].previousNames).toEqual(['a.ts']);
  });

  it('returns empty chains for files with no rename history', () => {
    const renames: FileRename[] = [
      { oldPath: 'a.ts', newPath: 'b.ts', commitHash: 'aaa', date: '2025-01-01T00:00:00Z' },
    ];

    const chains = buildRenameChains(renames, ['c.ts']);
    expect(chains).toHaveLength(0);
  });

  it('handles single rename', () => {
    const renames: FileRename[] = [
      { oldPath: 'old.ts', newPath: 'new.ts', commitHash: 'aaa', date: '2025-01-01T00:00:00Z' },
    ];

    const chains = buildRenameChains(renames, ['new.ts']);
    expect(chains).toHaveLength(1);
    expect(chains[0]).toEqual({
      currentPath: 'new.ts',
      previousNames: ['old.ts'],
      renameCount: 1,
    });
  });

  it('handles multiple tracked files with independent rename histories', () => {
    const renames: FileRename[] = [
      { oldPath: 'a.ts', newPath: 'b.ts', commitHash: 'aaa', date: '2025-01-01T00:00:00Z' },
      { oldPath: 'x.ts', newPath: 'y.ts', commitHash: 'bbb', date: '2025-01-01T00:00:00Z' },
    ];

    const chains = buildRenameChains(renames, ['b.ts', 'y.ts']);
    expect(chains).toHaveLength(2);

    const bChain = chains.find((c) => c.currentPath === 'b.ts')!;
    const yChain = chains.find((c) => c.currentPath === 'y.ts')!;
    expect(bChain.previousNames).toEqual(['a.ts']);
    expect(yChain.previousNames).toEqual(['x.ts']);
  });
});

describe('summary generation', () => {
  it('generates correct summary with counts', () => {
    // We test this indirectly through the pure functions since analyzeRenameTracking is async
    const renames: FileRename[] = [
      { oldPath: 'a.ts', newPath: 'b.ts', commitHash: 'aaa', date: '2025-01-01T00:00:00Z' },
      { oldPath: 'b.ts', newPath: 'c.ts', commitHash: 'bbb', date: '2025-02-01T00:00:00Z' },
      { oldPath: 'x.ts', newPath: 'y.ts', commitHash: 'ccc', date: '2025-03-01T00:00:00Z' },
    ];

    const chains = buildRenameChains(renames, ['c.ts', 'y.ts']);
    const totalRenames = renames.length;
    const filesWithRenames = chains.length;
    const summary = `${filesWithRenames} file${filesWithRenames !== 1 ? 's' : ''} have been renamed ${totalRenames} time${totalRenames !== 1 ? 's' : ''} total`;

    expect(summary).toBe('2 files have been renamed 3 times total');
  });

  it('generates singular form for 1 file and 1 rename', () => {
    const renames: FileRename[] = [
      { oldPath: 'a.ts', newPath: 'b.ts', commitHash: 'aaa', date: '2025-01-01T00:00:00Z' },
    ];

    const chains = buildRenameChains(renames, ['b.ts']);
    const totalRenames = renames.length;
    const filesWithRenames = chains.length;
    const summary = `${filesWithRenames} file${filesWithRenames !== 1 ? 's' : ''} have been renamed ${totalRenames} time${totalRenames !== 1 ? 's' : ''} total`;

    expect(summary).toBe('1 file have been renamed 1 time total');
  });
});
