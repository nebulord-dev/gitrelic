import { describe, expect, it } from 'vitest';

import { presetFromHash } from './presetFromHash';

describe('presetFromHash', () => {
  it('reads a known preset id', () => {
    expect(presetFromHash('#preset=coupling')).toBe('coupling');
    expect(presetFromHash('#preset=dead-code')).toBe('dead-code');
  });

  it('reads it among other hash params', () => {
    expect(presetFromHash('#x=1&preset=risk')).toBe('risk');
  });

  it('ignores a missing hash or param', () => {
    expect(presetFromHash('')).toBeNull();
    expect(presetFromHash('#')).toBeNull();
    expect(presetFromHash('#v=coupling')).toBeNull();
  });

  it('ignores ids that are not presets, including inherited keys', () => {
    expect(presetFromHash('#preset=bogus')).toBeNull();
    expect(presetFromHash('#preset=toString')).toBeNull();
    expect(presetFromHash('#preset=__proto__')).toBeNull();
  });
});
