import { packageOf } from './commit-timing.js';
import { MAX_FIX_FILES } from './fix-rate.js';
import type {
  CouplingFamily,
  CouplingReport,
  CoupledPair,
  FileCouplingProfile,
  PackageCoupling,
  PackageCommits,
} from '../types.js';
import type { RawCommit } from '../utils/git.js';

const MIN_CO_OCCURRENCES = 3;
const MIN_COUPLING_STRENGTH = 30;
/** A package link names at most this many of the file pairs behind it. */
const PACKAGE_FILE_PAIRS = 4;
/**
 * A family pair changes together in this many commits, and in this share of
 * the *busier* file's commits: a file that rides along with a busy one
 * (100% of its own commits, a sliver of the other's) stays out.
 */
export const FAMILY_MIN_SHARED = 4;
export const FAMILY_MIN_SHARE = 0.6;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

/**
 * Which files, and which packages, change in the same commits.
 * @param commits - The analysis window's commits.
 * @param files - The files to pair: the ownership set (fixtures and
 *   generated files left out), as fix rate reads.
 */
export function analyzeCoupling(
  commits: RawCommit[],
  files: string[],
): CouplingReport {
  const fileSet = new Set(files);
  const coOccurrences = new Map<string, number>();
  const fileTotalCommits = new Map<string, number>();
  const packageTotals = new Map<string, number>();
  const packagePairs = new Map<string, number>();

  for (const commit of commits) {
    const changed = commit.files.filter((f) => fileSet.has(f));
    // A sweeping commit (a rename across the codebase, a mass reformat) would
    // pair everything with everything; fix rate draws the line at 20 files.
    if (changed.length === 0 || changed.length > MAX_FIX_FILES) continue;

    for (const file of changed) {
      fileTotalCommits.set(file, (fileTotalCommits.get(file) ?? 0) + 1);
    }
    for (let i = 0; i < changed.length; i++) {
      for (let j = i + 1; j < changed.length; j++) {
        const key = pairKey(changed[i], changed[j]);
        coOccurrences.set(key, (coOccurrences.get(key) ?? 0) + 1);
      }
    }

    const pkgs = [...new Set(changed.map(packageOf))];
    for (const p of pkgs) packageTotals.set(p, (packageTotals.get(p) ?? 0) + 1);
    for (let i = 0; i < pkgs.length; i++) {
      for (let j = i + 1; j < pkgs.length; j++) {
        const key = pairKey(pkgs[i], pkgs[j]);
        packagePairs.set(key, (packagePairs.get(key) ?? 0) + 1);
      }
    }
  }

  const pairs: CoupledPair[] = [];

  for (const [key, coCommits] of coOccurrences) {
    if (coCommits < MIN_CO_OCCURRENCES) continue;

    const [fileA, fileB] = key.split('\0');
    const totalCommitsA = fileTotalCommits.get(fileA) ?? 0;
    const totalCommitsB = fileTotalCommits.get(fileB) ?? 0;
    const minCommits = Math.min(totalCommitsA, totalCommitsB);
    const couplingStrength =
      minCommits > 0 ? Math.round((coCommits / minCommits) * 100) : 0;

    if (couplingStrength < MIN_COUPLING_STRENGTH) continue;

    pairs.push({
      fileA,
      fileB,
      coCommits,
      totalCommitsA,
      totalCommitsB,
      couplingStrength,
    });
  }

  pairs.sort((a, b) => b.couplingStrength - a.couplingStrength);
  const topPairs = pairs.slice(0, 20);

  const profileMap = new Map<string, CoupledPair[]>();
  for (const pair of pairs) {
    if (!profileMap.has(pair.fileA)) profileMap.set(pair.fileA, []);
    if (!profileMap.has(pair.fileB)) profileMap.set(pair.fileB, []);
    profileMap.get(pair.fileA)!.push(pair);
    profileMap.get(pair.fileB)!.push(pair);
  }

  const fileProfiles: FileCouplingProfile[] = [...profileMap.entries()]
    .map(([file, partners]) => {
      const sorted = [...partners].sort(
        (a, b) => b.couplingStrength - a.couplingStrength,
      );
      const topPartner = sorted[0]
        ? sorted[0].fileA === file
          ? sorted[0].fileB
          : sorted[0].fileA
        : null;
      const couplingScore =
        sorted.length > 0
          ? Math.round(
              sorted.reduce((s, p) => s + p.couplingStrength, 0) /
                sorted.length,
            )
          : 0;
      return { file, partners: sorted, topPartner, couplingScore };
    })
    .sort((a, b) => b.couplingScore - a.couplingScore);

  const packageCommits: PackageCommits[] = [...packageTotals]
    .map(([pkg, n]) => ({ package: pkg, commits: n }))
    .sort((a, b) => b.commits - a.commits || (a.package < b.package ? -1 : 1));

  const packages: PackageCoupling[] = [];
  for (const [key, n] of packagePairs) {
    if (n < MIN_CO_OCCURRENCES) continue;
    const [packageA, packageB] = key.split('\0');
    const smaller = Math.min(
      packageTotals.get(packageA) ?? 0,
      packageTotals.get(packageB) ?? 0,
    );
    const across = (p: CoupledPair) => {
      const a = packageOf(p.fileA);
      const b = packageOf(p.fileB);
      return (
        (a === packageA && b === packageB) || (a === packageB && b === packageA)
      );
    };
    packages.push({
      packageA,
      packageB,
      commits: n,
      share: smaller > 0 ? n / smaller : 0,
      filePairs: pairs
        .filter(across)
        .sort((a, b) => b.coCommits - a.coCommits)
        .slice(0, PACKAGE_FILE_PAIRS),
    });
  }
  packages.sort(
    (a, b) =>
      b.commits - a.commits ||
      (pairKey(a.packageA, a.packageB) < pairKey(b.packageA, b.packageB)
        ? -1
        : 1),
  );

  const strongest = topPairs[0];
  const summary =
    pairs.length > 0 && strongest
      ? `${pairs.length} coupled pair${pairs.length !== 1 ? 's' : ''} found, strongest: ${strongest.fileA} ↔ ${strongest.fileB} (${strongest.couplingStrength}%)`
      : 'No temporal coupling detected';

  return {
    pairs,
    fileProfiles,
    topPairs,
    packageCommits,
    packages,
    families: families(pairs),
    summary,
  };
}

/** Connected groups of pairs strong both ways, largest first. */
function families(pairs: CoupledPair[]): CouplingFamily[] {
  const strong = pairs.filter(
    (p) =>
      p.coCommits >= FAMILY_MIN_SHARED &&
      p.coCommits / Math.max(p.totalCommitsA, p.totalCommitsB) >=
        FAMILY_MIN_SHARE,
  );
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(x, root);
    return root;
  };
  for (const p of strong) {
    for (const f of [p.fileA, p.fileB]) if (!parent.has(f)) parent.set(f, f);
    const a = find(p.fileA);
    const b = find(p.fileB);
    if (a !== b) parent.set(a < b ? b : a, a < b ? a : b);
  }
  const groups = new Map<string, string[]>();
  for (const f of parent.keys()) {
    const root = find(f);
    const group = groups.get(root) ?? [];
    group.push(f);
    groups.set(root, group);
  }
  return [...groups.values()]
    .map((group): CouplingFamily => {
      const files = [...group].sort();
      const inside = new Set(files);
      return {
        files,
        packages: [...new Set(files.map(packageOf))].sort(),
        pairs: strong.filter((p) => inside.has(p.fileA) && inside.has(p.fileB)),
      };
    })
    .sort(
      (a, b) =>
        b.files.length - a.files.length || (a.files[0] < b.files[0] ? -1 : 1),
    );
}
