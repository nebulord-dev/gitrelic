import { describe, expect, it } from 'vitest';

import { parseHash, serializeHash } from './hash';

describe('parseHash', () => {
  it('reads view, layout and selection', () => {
    expect(
      parseHash('#v=contributors&l=swimlanes&s=person%3Aann%40corp.com'),
    ).toEqual({
      view: 'contributors',
      layout: 'swimlanes',
      selection: 'person:ann@corp.com',
    });
  });

  it('accepts a hash without the leading #', () => {
    expect(parseHash('v=coupling')).toEqual({ view: 'coupling' });
  });

  it.each(['', '#', '#v=', '#x=1&t=glow'])(
    'ignores empty and unknown keys: %j',
    (hash) => {
      expect(parseHash(hash)).toEqual({});
    },
  );
});

describe('serializeHash', () => {
  it('omits empty fields and returns no hash for an empty location', () => {
    expect(serializeHash({})).toBe('');
    expect(serializeHash({ view: 'overview', layout: '' })).toBe('#v=overview');
  });

  it.each([
    {
      view: 'contributors',
      layout: 'swimlanes',
      selection: 'person:ann@corp.com',
    },
    // URLSearchParams decodes a raw + as a space; serializing must escape it.
    { selection: 'person:ann+atlas@corp.com' },
    { selection: 'file:src/a b&c=d#e.ts' },
  ])('round-trips %j', (location) => {
    expect(parseHash(serializeHash(location))).toEqual(location);
  });
});
