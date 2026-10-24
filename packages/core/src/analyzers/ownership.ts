import { classifyAuthor } from '../utils/authorClassification.js';
import type {
  OwnershipReport,
  PackageOwnership,
  PackageShare,
  TruckFactor,
} from '../types.js';
import type { RawCommit } from '../utils/git.js';
import type { PackageOf } from './commit-timing.js';

/** Human commits before a package is rated: fewer, and one person wrote it by default. */
export const MIN_PACKAGE_COMMITS = 10;
/** The top contributor owns a package from this share; below it, it's shared. */
export const OWNER_SHARE = 0.3;
/** One person did most of the work. */
export const ONE_PERSON_SHARE = 0.75;
/** Someone knows a package with this share of its commits and this many of them. */
export const KNOWER_SHARE = 0.1;
export const KNOWER_COMMITS = 3;
/** No commit in this many days before the analyzed commit. */
export const QUIET_DAYS = 90;
/** A file counts toward the truck factor from this many human commits. */
export const TRUCK_MIN_FILE_COMMITS = 2;

const DAY = 86_400_000;

/**
 * Degree of authorship (Avelino et al., "A novel approach for estimating
 * truck factors", ICPC 2016): first authorship, deliveries, and everyone
 * else's changes. Only the window's history is read, so "first author" is
 * whoever changed the file first in the window.
 */
function degreeOfAuthorship(
  first: boolean,
  deliveries: number,
  others: number,
) {
  return (
    3.293 +
    1.098 * (first ? 1 : 0) +
    0.164 * deliveries -
    0.321 * Math.log(1 + others)
  );
}

/** Each file's authors: degree of authorship at 75%+ of the file's highest, and above the constant. */
function fileAuthors(history: string[]): string[] {
  const counts = new Map<string, number>();
  for (const e of history) counts.set(e, (counts.get(e) ?? 0) + 1);
  const doa = [...counts].map(
    ([e, n]) =>
      [e, degreeOfAuthorship(history[0] === e, n, history.length - n)] as const,
  );
  const max = Math.max(...doa.map(([, d]) => d));
  return doa.filter(([, d]) => d / max >= 0.75 && d >= 3.293).map(([e]) => e);
}

/**
 * The fewest people who'd have to leave before more than half the files have
 * no author left: remove whoever authors the most remaining files, until then.
 */
function truckFactor(authorsByFile: string[][]): TruckFactor {
  const files = authorsByFile.length;
  const left = authorsByFile.map((a) => new Set(a));
  const people: string[] = [];
  const orphaned = () => left.filter((s) => s.size === 0).length;
  while (files > 0 && orphaned() <= files / 2) {
    const tally = new Map<string, number>();
    for (const s of left)
      for (const e of s) tally.set(e, (tally.get(e) ?? 0) + 1);
    if (tally.size === 0) break;
    // Ties go to the email, so the result doesn't depend on commit order.
    const [next] = [...tally].sort(
      (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
    )[0];
    people.push(next);
    for (const s of left) s.delete(next);
  }
  return { value: people.length, people, files };
}

/**
 * Who owns what, per package, and the truck factor for the repo and each
 * package. Bots never count.
 *
 * A package's shares count every path a commit touched in it (`counts`),
 * deleted and renamed files included: that work happened there. The truck
 * factor reads only `ownershipFiles` (tracked, fixtures and generated files
 * held back by the runner), since it asks who knows the code that exists.
 */
export function analyzeOwnership(
  commits: RawCommit[],
  ownershipFiles: string[],
  pkgOf: PackageOf,
  asOf: number,
  counts: (path: string) => boolean = () => true,
): OwnershipReport {
  const tracked = new Set(ownershipFiles);
  const human = commits
    .filter((c) => classifyAuthor(c.authorEmail) !== 'bot')
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  const lastSeen = new Map<string, number>();
  const byPackage = new Map<string, Map<string, number>>();
  const history = new Map<string, string[]>(); // file -> authors, oldest first
  for (const c of human) {
    lastSeen.set(c.authorEmail, Date.parse(c.date));
    const packages = new Set<string>();
    for (const f of c.files) {
      if (counts(f)) packages.add(pkgOf(f));
      if (!tracked.has(f)) continue;
      const h = history.get(f) ?? [];
      h.push(c.authorEmail);
      history.set(f, h);
    }
    for (const p of packages) {
      const m = byPackage.get(p) ?? new Map<string, number>();
      m.set(c.authorEmail, (m.get(c.authorEmail) ?? 0) + 1);
      byPackage.set(p, m);
    }
  }
  const quiet = (e: string) => asOf - (lastSeen.get(e) ?? 0) > QUIET_DAYS * DAY;

  const rated = [...history].filter(
    ([, h]) => h.length >= TRUCK_MIN_FILE_COMMITS,
  );
  const authors = new Map(rated.map(([f, h]) => [f, fileAuthors(h)]));

  const packages: PackageOwnership[] = [];
  let belowFloor = 0;
  for (const [pkg, counts] of byPackage) {
    const commitCount = [...counts.values()].reduce((a, b) => a + b, 0);
    if (commitCount < MIN_PACKAGE_COMMITS) {
      belowFloor++;
      continue;
    }
    const shares: PackageShare[] = [...counts]
      .map(([email, n]) => ({ email, commits: n }))
      .sort((a, b) => b.commits - a.commits || (a.email < b.email ? -1 : 1));
    const top = shares[0];
    const share = top.commits / commitCount;
    packages.push({
      package: pkg,
      commits: commitCount,
      shares,
      topShare: Math.round(share * 100),
      owner: share >= OWNER_SHARE ? top.email : null,
      onePerson: share >= ONE_PERSON_SHARE,
      topQuiet: quiet(top.email),
      knowers: shares
        .filter(
          (s) =>
            s.commits / commitCount >= KNOWER_SHARE &&
            s.commits >= KNOWER_COMMITS,
        )
        .map((s) => s.email),
      truckFactor: truckFactor(
        [...authors].filter(([f]) => pkgOf(f) === pkg).map(([, a]) => a),
      ),
    });
  }
  packages.sort(
    (a, b) => b.commits - a.commits || (a.package < b.package ? -1 : 1),
  );

  const repo = truckFactor([...authors.values()]);
  const quietCount = packages.filter((p) => p.topQuiet).length;
  const summary =
    packages.length === 0
      ? 'No package has enough commits to rate ownership'
      : quietCount === 0
        ? `Truck factor ${repo.value}; every package's top contributor is still active`
        : `Truck factor ${repo.value}; ${quietCount} of ${packages.length} packages' top contributors went quiet`;

  return { packages, belowFloor, truckFactor: repo, summary };
}
