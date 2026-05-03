import * as fs from 'node:fs/promises';

import { describe, it, expect, vi } from 'vitest';

import { analyzeLoc } from './loc.js';

vi.mock('node:fs/promises');

const mockReadFile = vi.mocked(fs.readFile);

describe('analyzeLoc', () => {
  it('counts lines for each file', async () => {
    mockReadFile.mockResolvedValueOnce('line1\nline2\nline3\n');
    mockReadFile.mockResolvedValueOnce('single\n');

    const result = await analyzeLoc(['src/a.ts', 'src/b.ts'], '/repo');

    expect(result.files).toEqual([
      { file: 'src/a.ts', lines: 3, language: 'TypeScript' },
      { file: 'src/b.ts', lines: 1, language: 'TypeScript' },
    ]);
    expect(result.totalLines).toBe(4);
    expect(result.totalFiles).toBe(2);
  });

  it('detects language from file extension', async () => {
    mockReadFile.mockResolvedValueOnce('x\n');
    mockReadFile.mockResolvedValueOnce('x\n');
    mockReadFile.mockResolvedValueOnce('x\n');

    const result = await analyzeLoc(
      ['app.py', 'main.go', 'style.css'],
      '/repo',
    );

    expect(result.files[0].language).toBe('Python');
    expect(result.files[1].language).toBe('Go');
    expect(result.files[2].language).toBe('CSS');
  });

  it('aggregates language breakdown with percentages', async () => {
    mockReadFile.mockResolvedValueOnce('a\nb\nc\n'); // 3 lines TS
    mockReadFile.mockResolvedValueOnce('a\nb\nc\nd\ne\nf\ng\n'); // 7 lines TS
    mockReadFile.mockResolvedValueOnce('a\n'); // 1 line CSS

    const result = await analyzeLoc(['a.ts', 'b.tsx', 'c.css'], '/repo');

    const ts = result.languages.find((l) => l.language === 'TypeScript')!;
    expect(ts.files).toBe(2);
    expect(ts.lines).toBe(10);
    expect(ts.percentage).toBeCloseTo(90.9, 0);

    const css = result.languages.find((l) => l.language === 'CSS')!;
    expect(css.files).toBe(1);
    expect(css.lines).toBe(1);
  });

  it('handles unreadable files gracefully with lines: 0', async () => {
    mockReadFile.mockResolvedValueOnce('ok\n');
    mockReadFile.mockRejectedValueOnce(new Error('EACCES'));

    const result = await analyzeLoc(['good.ts', 'bad.ts'], '/repo');

    expect(result.files[0].lines).toBe(1);
    expect(result.files[1].lines).toBe(0);
    expect(result.totalLines).toBe(1);
  });

  it('handles empty files as 0 lines', async () => {
    mockReadFile.mockResolvedValueOnce('');

    const result = await analyzeLoc(['empty.ts'], '/repo');

    expect(result.files[0].lines).toBe(0);
  });

  it('sorts languages by lines descending', async () => {
    mockReadFile.mockResolvedValueOnce('a\n');
    mockReadFile.mockResolvedValueOnce('a\nb\nc\n');

    const result = await analyzeLoc(['small.css', 'big.ts'], '/repo');

    expect(result.languages[0].language).toBe('TypeScript');
    expect(result.languages[1].language).toBe('CSS');
  });

  it('produces a summary string', async () => {
    mockReadFile.mockResolvedValueOnce('a\nb\n');

    const result = await analyzeLoc(['file.ts'], '/repo');

    expect(result.summary).toContain('2');
    expect(result.summary).toContain('1');
  });

  it('counts files without trailing newline correctly', async () => {
    mockReadFile.mockResolvedValueOnce('no-newline');

    const result = await analyzeLoc(['file.ts'], '/repo');

    expect(result.files[0].lines).toBe(1);
  });

  it('labels unknown extensions as "Other"', async () => {
    mockReadFile.mockResolvedValueOnce('x\n');

    const result = await analyzeLoc(['data.xyz'], '/repo');

    expect(result.files[0].language).toBe('Other');
  });
});
