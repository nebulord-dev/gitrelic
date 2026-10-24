import { describe, expect, it } from 'vitest';

import { couplingReport } from '../../test/couplingReport';
import reportJson from '../../test/fixtures/report.small.json';
import { blastSummaryOf, boundariesOf, rippleOf } from './boundaries';
import type { GitrelicReport } from '@gitrelic/core';

describe('boundariesOf', () => {
  const b = boundariesOf(couplingReport());

  it('rings the packages, without the root or dot-folders', () => {
    expect(b.packages.map((p) => p.dir)).toEqual([
      'packages/server',
      'packages/client',
      'packages/flags',
      'packages/shared',
    ]);
    expect(b.packages[0]).toMatchObject({
      id: 'dir:packages/server',
      commits: 30,
      links: 1,
    });
  });

  it('links them by commits, leaving the root’s and .github’s links out', () => {
    expect(b.links.map((l) => [l.a, l.b, l.commits])).toEqual([
      ['packages/client', 'packages/server', 14],
      ['packages/flags', 'packages/shared', 9],
    ]);
    expect(b.leftOut).toBe(2);
  });

  it('is memoised per report', () => {
    const r = couplingReport();
    expect(boundariesOf(r)).toBe(boundariesOf(r));
  });
});

describe('rippleOf', () => {
  it('lists a file’s partners, most shared first, marking other packages', () => {
    const ripple = rippleOf(couplingReport(), 'packages/server/src/api.ts')!;
    expect(ripple).toMatchObject({ package: 'packages/server', commits: 16 });
    expect(ripple.partners).toEqual([
      {
        file: 'packages/client/src/api.ts',
        package: 'packages/client',
        shared: 12,
        share: 12 / 16,
        other: true,
      },
      {
        file: 'packages/server/src/db.ts',
        package: 'packages/server',
        shared: 5,
        share: 5 / 16,
        other: false,
      },
    ]);
    expect(ripple.blast).toMatchObject({ median: 3, commits: 16 });
  });

  it('gives a file with no partners an empty ripple', () => {
    const ripple = rippleOf(couplingReport(), 'packages/client/src/api.ts')!;
    expect(ripple.partners).toEqual([]);
    expect(ripple.blast?.median).toBe(2);
  });
});

describe('blastSummaryOf', () => {
  it('counts rated files by median, the wide ones, and the unrated', () => {
    const s = blastSummaryOf(couplingReport());
    expect(s).toMatchObject({ rated: 3, wide: 1, unrated: 1, minCommits: 8 });
    expect(s.bins[12]).toBe(1);
    expect(s.widest.map((f) => f.file)[0]).toBe('packages/shared/flags.ts');
  });

  it('reads a report with nothing rated', () => {
    const s = blastSummaryOf(reportJson as unknown as GitrelicReport);
    expect(s.rated).toBe(0);
    expect(s.widest).toEqual([]);
  });
});
