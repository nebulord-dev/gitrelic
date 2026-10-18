import { describe, expect, it } from 'vitest';

import { distinctNames } from './distinctNames';

describe('distinctNames', () => {
  it('keeps unique basenames bare', () => {
    expect([...distinctNames(['src/a.ts', 'lib/b.ts']).values()]).toEqual([
      'a.ts',
      'b.ts',
    ]);
  });

  it('adds parent folders only where names collide', () => {
    const names = distinctNames([
      'packages/client/src/index.ts',
      'packages/server/src/index.ts',
      'packages/server/util.ts',
    ]);
    expect(names.get('packages/client/src/index.ts')).toBe(
      'client/src/index.ts',
    );
    expect(names.get('packages/server/src/index.ts')).toBe(
      'server/src/index.ts',
    );
    expect(names.get('packages/server/util.ts')).toBe('util.ts');
  });

  it('stops at the full path, and copes with duplicates and root files', () => {
    const names = distinctNames(['index.ts', 'src/index.ts', 'index.ts']);
    expect(names.get('index.ts')).toBe('index.ts');
    expect(names.get('src/index.ts')).toBe('src/index.ts');
  });
});
