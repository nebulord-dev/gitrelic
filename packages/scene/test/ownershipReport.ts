// The sample repo with an ownership it is too small to have: a package that
// rests on one person, one whose top contributor went quiet, a shared one,
// and the root and .github rated too (the map leaves those off).

import reportJson from './fixtures/report.small.json';
import type {
  Contributor,
  GitrelicReport,
  PackageOwnership,
} from '@gitrelic/core';

const base = reportJson as unknown as GitrelicReport;
const at = (email: string) => `${email}@example.com`;

function pkg(
  dir: string,
  shares: Record<string, number>,
  extra: Partial<PackageOwnership> = {},
): PackageOwnership {
  const list = Object.entries(shares)
    .map(([e, commits]) => ({ email: at(e), commits }))
    .sort((a, b) => b.commits - a.commits);
  const total = list.reduce((a, s) => a + s.commits, 0);
  const share = list[0].commits / total;
  return {
    package: dir,
    commits: total,
    shares: list,
    topShare: Math.round(share * 100),
    owner: share >= 0.3 ? list[0].email : null,
    onePerson: share >= 0.75,
    topQuiet: false,
    knowers: list
      .filter((s) => s.commits / total >= 0.1 && s.commits >= 3)
      .map((s) => s.email),
    truckFactor: { value: 1, people: [list[0].email], files: 4 },
    ...extra,
  };
}

function person(name: string, lastCommit: string): Contributor {
  return {
    email: at(name.toLowerCase().split(' ')[0]),
    name,
    commitCount: 10,
    firstCommit: '2025-01-01T00:00:00Z',
    lastCommit,
    filesOwned: 0,
    linesChanged: 0,
    activeDays: 1,
    focusAreas: [],
    isActive: true,
    isGhost: false,
  };
}

export function ownershipReport(): GitrelicReport {
  return {
    ...base,
    meta: { ...base.meta, lastCommit: '2026-06-30T00:00:00Z' },
    contributors: {
      ...base.contributors,
      contributors: [
        person('Ann Lee', '2026-06-20T00:00:00Z'),
        person('Bob Ray', '2026-02-01T00:00:00Z'), // quiet: 149 days
        person('Cy Dee', '2026-06-01T00:00:00Z'),
        person('Dee Fox', '2026-06-01T00:00:00Z'),
        person('Eve Gil', '2026-06-01T00:00:00Z'),
      ],
    },
    ownership: {
      packages: [
        pkg('packages/server', { ann: 44, cy: 6 }),
        pkg('packages/client', { bob: 16, ann: 10, cy: 8 }, { topQuiet: true }),
        pkg('packages/shared', { cy: 5, dee: 5, eve: 5, ann: 5, bob: 4 }),
        pkg('', { eve: 20 }),
        pkg('.github', { eve: 12 }),
      ],
      belowFloor: 3,
      truckFactor: { value: 2, people: [at('ann'), at('bob')], files: 40 },
      summary: '',
    },
  };
}

/** The same report with `n` extra one-person packages, busiest first. */
export function manyPackagesReport(n: number): GitrelicReport {
  const base = ownershipReport();
  const extra = Array.from({ length: n }, (_, i) =>
    pkg(`packages/p${String(i).padStart(3, '0')}`, { ann: 40 - (i % 30) }),
  );
  return {
    ...base,
    ownership: {
      ...base.ownership,
      packages: [...base.ownership.packages, ...extra].sort(
        (a, b) => b.commits - a.commits,
      ),
    },
  };
}
