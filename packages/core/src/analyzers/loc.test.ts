import { describe, it, expect } from 'vitest';

import { analyzeLoc } from './loc.js';

/** Line counts keyed by path, as the runner derives them from git blobs. */
const counts = (entries: Record<string, number | null>) =>
  new Map(Object.entries(entries));

describe('analyzeLoc', () => {
  it('counts lines for each file', () => {
    const result = analyzeLoc(
      ['src/a.ts', 'src/b.ts'],
      counts({ 'src/a.ts': 3, 'src/b.ts': 1 }),
    );

    expect(result.files).toEqual([
      { file: 'src/a.ts', lines: 3, language: 'TypeScript' },
      { file: 'src/b.ts', lines: 1, language: 'TypeScript' },
    ]);
    expect(result.totalLines).toBe(4);
    expect(result.totalFiles).toBe(2);
  });

  it('detects language from file extension', () => {
    const result = analyzeLoc(
      ['app.py', 'main.go', 'style.css'],
      counts({ 'app.py': 1, 'main.go': 1, 'style.css': 1 }),
    );

    expect(result.files[0].language).toBe('Python');
    expect(result.files[1].language).toBe('Go');
    expect(result.files[2].language).toBe('CSS');
  });

  it('aggregates language breakdown with percentages', () => {
    const result = analyzeLoc(
      ['a.ts', 'b.tsx', 'c.css'],
      counts({ 'a.ts': 3, 'b.tsx': 7, 'c.css': 1 }),
    );

    const ts = result.languages.find((l) => l.language === 'TypeScript')!;
    expect(ts.files).toBe(2);
    expect(ts.lines).toBe(10);
    expect(ts.percentage).toBeCloseTo(90.9, 0);

    const css = result.languages.find((l) => l.language === 'CSS')!;
    expect(css.files).toBe(1);
    expect(css.lines).toBe(1);
  });

  it('treats binary/unreadable (null) and missing counts as 0 lines', () => {
    const result = analyzeLoc(
      ['good.ts', 'bin.ts', 'gone.ts'],
      counts({ 'good.ts': 1, 'bin.ts': null }),
    );

    expect(result.files.map((f) => f.lines)).toEqual([1, 0, 0]);
    expect(result.totalLines).toBe(1);
  });

  it('handles empty files as 0 lines', () => {
    const result = analyzeLoc(['empty.ts'], counts({ 'empty.ts': 0 }));

    expect(result.files[0].lines).toBe(0);
  });

  it('sorts languages by lines descending', () => {
    const result = analyzeLoc(
      ['small.css', 'big.ts'],
      counts({ 'small.css': 1, 'big.ts': 3 }),
    );

    expect(result.languages[0].language).toBe('TypeScript');
    expect(result.languages[1].language).toBe('CSS');
  });

  it('produces a summary string', () => {
    const result = analyzeLoc(['file.ts'], counts({ 'file.ts': 2 }));

    expect(result.summary).toContain('2');
    expect(result.summary).toContain('1');
  });

  it('labels unknown extensions as "Other"', () => {
    const result = analyzeLoc(['data.xyz'], counts({ 'data.xyz': 1 }));

    expect(result.files[0].language).toBe('Other');
  });
});
