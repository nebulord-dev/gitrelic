import { describe, it, expect } from 'vitest';

import { parseGitLog, isIgnored } from './git.js';

describe('parseGitLog', () => {
  it('parses a single commit with numstat', () => {
    const raw = [
      'COMMIT|abc123|alice@example.com|Alice|2025-01-15T10:00:00Z',
      'MSG|fix: handle edge case',
      '10\t2\tsrc/index.ts',
      '5\t0\tsrc/utils.ts',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits).toHaveLength(1);
    expect(commits[0].hash).toBe('abc123');
    expect(commits[0].authorEmail).toBe('alice@example.com');
    expect(commits[0].authorName).toBe('Alice');
    expect(commits[0].message).toBe('fix: handle edge case');
    expect(commits[0].files).toEqual(['src/index.ts', 'src/utils.ts']);
    expect(commits[0].insertions).toBe(15);
    expect(commits[0].deletions).toBe(2);
  });

  it('parses multiple commits', () => {
    const raw = [
      'COMMIT|aaa|alice@example.com|Alice|2025-01-15T10:00:00Z',
      'MSG|feat: new thing',
      '1\t0\tfile-a.ts',
      '',
      'COMMIT|bbb|bob@example.com|Bob|2025-01-16T10:00:00Z',
      'MSG|revert: undo bad change',
      '2\t1\tfile-b.ts',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits).toHaveLength(2);
    expect(commits[0].message).toBe('feat: new thing');
    expect(commits[1].message).toBe('revert: undo bad change');
  });

  it('returns empty array for empty input', () => {
    expect(parseGitLog('')).toEqual([]);
  });

  it('skips rename noise with curly braces', () => {
    const raw = [
      'COMMIT|abc|a@b.com|A|2025-01-15T10:00:00Z',
      'MSG|chore: rename files',
      '5\t3\tsrc/{old => new}/file.ts',
      '1\t0\tsrc/clean.ts',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits[0].files).toEqual(['src/clean.ts']);
    expect(commits[0].message).toBe('chore: rename files');
  });

  it('handles pipe characters in commit messages', () => {
    const raw = [
      'COMMIT|abc|a@b.com|A|2025-01-15T10:00:00Z',
      'MSG|fix: handle a|b edge case',
      '1\t0\tsrc/a.ts',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits[0].message).toBe('fix: handle a|b edge case');
  });
});

describe('isIgnored', () => {
  it('ignores lock files by exact name', () => {
    expect(isIgnored('package-lock.json')).toBe(true);
    expect(isIgnored('pnpm-lock.yaml')).toBe(true);
    expect(isIgnored('yarn.lock')).toBe(true);
    expect(isIgnored('bun.lockb')).toBe(true);
  });

  it('ignores lock files in subdirectories', () => {
    expect(isIgnored('packages/app/package-lock.json')).toBe(true);
  });

  it('ignores asset files by extension', () => {
    expect(isIgnored('public/favicon.ico')).toBe(true);
    expect(isIgnored('src/logo.png')).toBe(true);
    expect(isIgnored('assets/icon.svg')).toBe(true);
    expect(isIgnored('fonts/inter.woff2')).toBe(true);
  });

  it('ignores generated files by extension', () => {
    expect(isIgnored('dist/bundle.min.js')).toBe(true);
    expect(isIgnored('styles/app.min.css')).toBe(true);
    expect(isIgnored('dist/index.js.map')).toBe(true);
  });

  it('ignores framework generated files', () => {
    expect(isIgnored('next-env.d.ts')).toBe(true);
    expect(isIgnored('vite-env.d.ts')).toBe(true);
  });

  it('ignores directory prefixes', () => {
    expect(isIgnored('.next/cache/webpack.js')).toBe(true);
    expect(isIgnored('dist/index.js')).toBe(true);
    expect(isIgnored('coverage/lcov.info')).toBe(true);
  });

  it('passes through normal source files', () => {
    expect(isIgnored('src/index.ts')).toBe(false);
    expect(isIgnored('src/components/App.tsx')).toBe(false);
    expect(isIgnored('package.json')).toBe(false);
    expect(isIgnored('README.md')).toBe(false);
    expect(isIgnored('tsconfig.json')).toBe(false);
  });
});
