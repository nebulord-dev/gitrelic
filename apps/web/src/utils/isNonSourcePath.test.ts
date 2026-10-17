import { describe, expect, it } from 'vitest';

import { isNonSourcePath } from './isNonSourcePath';

describe('isNonSourcePath', () => {
  const fresh = {
    fileClasses: {
      'src/__generated__/schema.ts': 'generated',
      'src/__tests__/a.test.ts': 'test',
    } as const,
  };

  it('uses core classification when the report has it', () => {
    expect(isNonSourcePath(fresh, 'src/__generated__/schema.ts')).toBe(true);
    expect(isNonSourcePath(fresh, 'src/__tests__/a.test.ts')).toBe(true);
    expect(isNonSourcePath(fresh, 'src/app.ts')).toBe(false);
  });

  it('trusts core over the heuristic', () => {
    // The heuristic would call this a test path, but the report's map — the
    // authority for that analysis — doesn't list it, so it's source.
    expect(isNonSourcePath(fresh, 'tests/helper.ts')).toBe(false);
  });

  it('falls back to the path heuristic for pre-0.50 reports', () => {
    expect(isNonSourcePath({ fileClasses: {} }, 'src/a.test.ts')).toBe(true);
    expect(isNonSourcePath({ fileClasses: {} }, 'src/a.ts')).toBe(false);
  });
});
