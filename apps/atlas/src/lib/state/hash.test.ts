import { describe, expect, it } from 'vitest';

import { isTimeWindow, parseHash, serializeHash } from './hash';

describe('parseHash', () => {
  it('reads view, lens, form, selection and time', () => {
    expect(
      parseHash(
        '#v=code-health&l=hotspots&f=by-package&s=person%3Aann%40corp.com&t=2026-01..2026-03',
      ),
    ).toEqual({
      view: 'code-health',
      lens: 'hotspots',
      form: 'by-package',
      selection: 'person:ann@corp.com',
      time: '2026-01..2026-03',
    });
  });

  it('accepts a hash without the leading #', () => {
    expect(parseHash('v=structure')).toEqual({ view: 'structure' });
  });

  it.each(['', '#', '#v=', '#x=1&theme=glow'])(
    'ignores empty and unknown keys: %j',
    (hash) => {
      expect(parseHash(hash)).toEqual({});
    },
  );
});

describe('serializeHash', () => {
  it('omits empty fields and returns no hash for an empty location', () => {
    expect(serializeHash({})).toBe('');
    expect(serializeHash({ view: 'overview', lens: '' })).toBe('#v=overview');
  });

  it.each([
    {
      view: 'code-health',
      lens: 'hotspots',
      form: 'by-package',
      selection: 'person:ann@corp.com',
      time: '2026-03',
    },
    // URLSearchParams decodes a raw + as a space; serializing must escape it.
    { selection: 'person:ann+atlas@corp.com' },
    { selection: 'file:src/a b&c=d#e.ts' },
  ])('round-trips %j', (location) => {
    expect(parseHash(serializeHash(location))).toEqual(location);
  });
});

describe('isTimeWindow', () => {
  it.each(['2026-03', '2025-11..2026-02', '2026-03..2026-03'])(
    'accepts %s',
    (t) => expect(isTimeWindow(t)).toBe(true),
  );
  it.each(['2026-3', '2026-13', '2026-03..', '2026-04..2026-01', 'now', '<b>'])(
    'rejects %s',
    (t) => expect(isTimeWindow(t)).toBe(false),
  );
});
