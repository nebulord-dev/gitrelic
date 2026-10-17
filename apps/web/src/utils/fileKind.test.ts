import { describe, expect, it } from 'vitest';

import { makeFileKind } from './fileKind';

describe('makeFileKind', () => {
  const kind = makeFileKind({
    fileClasses: {
      'src/__tests__/a.test.ts': 'test',
      'src/__snapshots__/a.snap': 'fixture',
      'vendor/github.com/x/y.go': 'generated',
    },
  });

  it('groups tests and fixtures together', () => {
    expect(kind('src/__tests__/a.test.ts')).toBe('test');
    expect(kind('src/__snapshots__/a.snap')).toBe('test');
  });

  it('keeps generated/vendored code out of both views', () => {
    expect(kind('vendor/github.com/x/y.go')).toBe('generated');
  });

  it('treats files absent from the map as source', () => {
    expect(kind('src/app.ts')).toBe('source');
    // The heuristic would call this a test path, but the report's map — the
    // authority for that analysis — doesn't list it.
    expect(kind('tests/helper.ts')).toBe('source');
  });

  it('falls back to the path heuristic for reports without fileClasses', () => {
    const legacy = makeFileKind({ fileClasses: {} });
    expect(legacy('src/a.test.ts')).toBe('test');
    expect(legacy('src/a.ts')).toBe('source');
  });
});
