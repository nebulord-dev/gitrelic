import { describe, expect, it } from 'vitest';

import { COLOR_ROLES } from '../model';
import { readPalette } from './palette';

describe('readPalette', () => {
  it('reads every colour role', () => {
    const palette = readPalette(() => 'rgba(255, 0, 0, 0.5)');
    expect(Object.keys(palette).sort()).toEqual([...COLOR_ROLES].sort());
    expect(palette['--link']).toEqual({ r: 1, g: 0, b: 0, a: 0.5 });
  });

  it('names every role it cannot read', () => {
    expect(() =>
      readPalette((role) =>
        role === '--accent' ? 'var(--x)' : role === '--link' ? '' : '#fff',
      ),
    ).toThrow(/--accent: "var\(--x\)", --link: ""/);
  });
});
