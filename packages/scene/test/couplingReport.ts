// The sample repo with a Coupling it is too small to have: packages that
// change together (one link through the root, one through .github), a family
// across two packages, and blast radius rated for a few files.

import reportJson from './fixtures/report.small.json';
import type {
  CoupledPair,
  FileBlastRadius,
  GitrelicReport,
} from '@gitrelic/core';

const base = reportJson as unknown as GitrelicReport;

const pair = (
  fileA: string,
  fileB: string,
  coCommits: number,
  totalCommitsA: number,
  totalCommitsB: number,
): CoupledPair => ({
  fileA,
  fileB,
  coCommits,
  totalCommitsA,
  totalCommitsB,
  couplingStrength: Math.round(
    (100 * coCommits) / Math.min(totalCommitsA, totalCommitsB),
  ),
});

const footprint = (counts: Record<number, number>) =>
  Array.from({ length: 20 }, (_, k) => counts[k] ?? 0);

const blast = (
  file: string,
  totalCommits: number,
  median?: number,
  counts: Record<number, number> = {},
): FileBlastRadius => ({
  file,
  blastScore: 0,
  avgCoChangedFiles: median ?? 1,
  maxCoChangedFiles: 0,
  totalCommits,
  ...(median !== undefined
    ? { medianCoChanged: median, footprint: footprint(counts) }
    : {}),
});

/** server ↔ client is the strongest link; flags/a and flags/b are a family across two packages. */
export function couplingReport(): GitrelicReport {
  const serverClient = pair(
    'packages/client/src/api.ts',
    'packages/server/src/api.ts',
    12,
    20,
    16,
  );
  const flags = pair(
    'packages/flags/a.ts',
    'packages/shared/flags.ts',
    9,
    10,
    9,
  );
  const hub = pair(
    'packages/server/src/api.ts',
    'packages/server/src/db.ts',
    5,
    16,
    6,
  );
  const pairs = [serverClient, flags, hub];
  return {
    ...base,
    workspace: {
      sources: ['pnpm'],
      roots: [
        'packages/client',
        'packages/flags',
        'packages/server',
        'packages/shared',
      ],
    },
    coupling: {
      ...base.coupling,
      pairs,
      topPairs: pairs,
      fileProfiles: [
        {
          file: 'packages/server/src/api.ts',
          partners: [serverClient, hub],
          topPartner: 'packages/client/src/api.ts',
          couplingScore: 79,
        },
      ],
      packageCommits: [
        { package: 'packages/server', commits: 30 },
        { package: '', commits: 25 },
        { package: 'packages/client', commits: 24 },
        { package: '.github', commits: 12 },
        { package: 'packages/flags', commits: 10 },
        { package: 'packages/shared', commits: 9 },
      ],
      packages: [
        // Release commits: the root and a package, the strongest of all.
        {
          packageA: '',
          packageB: 'packages/server',
          commits: 20,
          share: 0.8,
          filePairs: [],
        },
        {
          packageA: 'packages/client',
          packageB: 'packages/server',
          commits: 14,
          share: 14 / 24,
          filePairs: [serverClient],
        },
        {
          packageA: 'packages/flags',
          packageB: 'packages/shared',
          commits: 9,
          share: 1,
          filePairs: [flags],
        },
        {
          packageA: '.github',
          packageB: 'packages/client',
          commits: 6,
          share: 0.5,
          filePairs: [],
        },
      ],
      families: [
        {
          files: ['packages/flags/a.ts', 'packages/shared/flags.ts'],
          packages: ['packages/flags', 'packages/shared'],
          pairs: [flags],
        },
      ],
    },
    blastRadius: {
      ...base.blastRadius,
      files: [
        blast('packages/shared/flags.ts', 9, 12, { 12: 6, 3: 3 }),
        blast('packages/server/src/api.ts', 16, 3, { 1: 4, 3: 8, 15: 4 }),
        blast('packages/client/src/api.ts', 20, 2, { 2: 20 }),
        blast('packages/server/src/db.ts', 6),
      ],
      minCommits: 8,
      rated: 3,
    },
  };
}
