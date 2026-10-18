import { describe, expect, it } from 'vitest';

import { normalizeReport } from '../report/normalizeReport';
import { coupledWith } from './coupledWith';

const pair = (
  fileA: string,
  fileB: string,
  coCommits: number,
  couplingStrength: number,
) => ({ fileA, fileB, coCommits, couplingStrength }) as never;

describe('coupledWith', () => {
  it('lists partners from either side of a pair, most shared commits first', () => {
    const r = normalizeReport({});
    r.coupling.pairs = [
      pair('a.ts', 'b.ts', 3, 100),
      pair('c.ts', 'a.ts', 14, 70.4),
      pair('a.ts', 'd.ts', 3, 60),
      pair('x.ts', 'y.ts', 50, 100),
    ];
    expect(coupledWith('a.ts', r)).toEqual([
      { file: 'c.ts', coCommits: 14, strength: 70 },
      { file: 'b.ts', coCommits: 3, strength: 100 },
      { file: 'd.ts', coCommits: 3, strength: 60 },
    ]);
    expect(coupledWith('a.ts', r, 1)).toHaveLength(1);
    expect(coupledWith('zzz.ts', r)).toEqual([]);
  });
});
