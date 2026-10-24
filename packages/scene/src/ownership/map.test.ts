import { describe, expect, it } from 'vitest';

import { ownershipReport } from '../../test/ownershipReport';
import { normalizeReport } from '../report/normalizeReport';
import { ownershipMapOf, surname } from './map';

describe('ownershipMapOf', () => {
  const m = ownershipMapOf(ownershipReport());

  it('maps the rated packages, without the root or dot-folders', () => {
    expect(m.packages.map((p) => p.dir)).toEqual([
      'packages/server',
      'packages/client',
      'packages/shared',
    ]);
    expect(m.packages[0].id).toBe('dir:packages/server');
    expect(m.leftOut).toBe(2);
    expect(m.belowFloor).toBe(3);
  });

  it('gives colors to whoever tops the most packages, then by commits', () => {
    // ann tops server (44), bob tops client, cy tops shared (5, tied, wins by email).
    const slot = (e: string) => m.people.get(`${e}@example.com`)?.slot;
    expect(slot('ann')).toBe(0);
    expect(slot('bob')).toBe(1);
    expect(slot('cy')).toBe(2);
    expect(slot('dee')).toBeNull();
  });

  it('names people and marks the quiet ones from the analyzed commit', () => {
    expect(m.people.get('bob@example.com')).toMatchObject({
      name: 'Bob Ray',
      quiet: true,
    });
    expect(m.people.get('ann@example.com')?.quiet).toBe(false);
  });

  it('carries the truck factor and says when one person tops everything', () => {
    expect(m.truckFactor.value).toBe(2);
    expect(m.solo).toBe(false);
  });

  it('says when the report predates the lens', () => {
    const old = ownershipMapOf(normalizeReport({}));
    expect(old.noData).toBe(true);
    expect(old.packages).toEqual([]);
    expect(m.noData).toBe(false);
  });

  it('is memoized per report', () => {
    const r = ownershipReport();
    expect(ownershipMapOf(r)).toBe(ownershipMapOf(r));
  });
});

describe('surname', () => {
  it('takes the last name, skipping a quoted nickname', () => {
    expect(surname('Joseph Savona')).toBe('Savona');
    expect(surname('Sebastian "Sebbie" Silbermann')).toBe('Silbermann');
    expect(surname('lauren')).toBe('lauren');
  });
});
