// Ownership's data (docs/atlas-views.md › Ownership): the packages on the
// organic map, who tops each, and the six people who get a color, all from
// core's ownership report.
//
// Like Coupling's ring, the map leaves out the repository root and top-level
// dot-folders: release commits and CI config make whoever cuts releases the
// "owner" of both. The report keeps them; only the map skips them.

import { ids, type EntityId } from '../ids';
import { reportNow } from '../report/now';
import type {
  GitrelicReport,
  PackageOwnership,
  TruckFactor,
} from '@gitrelic/core';

/**
 * Most packages on the map, the busiest by commits. Past this the cells are
 * too small to label and the treemap grows slow (about 0.5 s at 300); the
 * rest stay in the findings and the table.
 */
export const MAP_PACKAGES = 60;
/** People with their own color (`--owner-0..5`); everyone else is grey. */
export const OWNER_SLOTS = 6;
/** No commit in this many days before the analyzed commit (core's `QUIET_DAYS`). */
const QUIET_DAYS = 90;
const DAY = 86_400_000;

/** Whether a package is drawn: not the root, not a dot-folder. */
export const onMap = (dir: string) => dir !== '' && !dir.startsWith('.');

export interface MapPerson {
  email: string;
  name: string;
  /** No commit in the 90 days before the analyzed commit. */
  quiet: boolean;
  /** `--owner-<slot>`, or null for grey. */
  slot: number | null;
}

export interface MapPackage extends PackageOwnership {
  dir: string;
  id: EntityId;
}

export interface OwnershipMap {
  /** Every rated package but the root and dot-folders, most commits first. */
  packages: MapPackage[];
  /** The ones on the map: the first `MAP_PACKAGES` of `packages`. */
  drawn: MapPackage[];
  /** Packages past `MAP_PACKAGES`, in the table but not on the map. */
  hidden: number;
  /** Everyone with a share in a drawn package, by email. */
  people: ReadonlyMap<string, MapPerson>;
  truckFactor: TruckFactor;
  /** Rated packages left off: the root and dot-folders. */
  leftOut: number;
  /** Packages under core's commit floor. */
  belowFloor: number;
  /** One person tops every drawn package. */
  solo: boolean;
  /**
   * The report has no ownership section: made before the Ownership lens
   * (backfilled empty), so rerunning gitrelic fills it.
   */
  noData: boolean;
}

function ownershipMap(report: GitrelicReport): OwnershipMap {
  const own = report.ownership;
  const packages = own.packages
    .filter((p) => onMap(p.package))
    .map((p) => ({ ...p, dir: p.package, id: ids.dir(p.package) }));

  const drawn = packages.slice(0, MAP_PACKAGES);

  // Color goes to whoever tops the most drawn packages, then has the most
  // commits in them, so a person keeps one color across both forms.
  const tops = new Map<string, { packages: number; commits: number }>();
  for (const p of drawn) {
    const t = tops.get(p.shares[0].email) ?? { packages: 0, commits: 0 };
    t.packages++;
    t.commits += p.shares[0].commits;
    tops.set(p.shares[0].email, t);
  }
  const slotted = [...tops]
    .sort(
      ([ea, a], [eb, b]) =>
        b.packages - a.packages ||
        b.commits - a.commits ||
        ea.localeCompare(eb),
    )
    .slice(0, OWNER_SLOTS)
    .map(([email]) => email);

  const byEmail = new Map(
    report.contributors.contributors.map((c) => [c.email, c]),
  );
  const now = reportNow(report);
  const people = new Map<string, MapPerson>();
  for (const p of packages)
    for (const s of p.shares) {
      if (people.has(s.email)) continue;
      const c = byEmail.get(s.email);
      const last = c ? Date.parse(c.lastCommit) : NaN;
      people.set(s.email, {
        email: s.email,
        name: c?.name || s.email.split('@')[0],
        quiet: Number.isFinite(last) && now - last > QUIET_DAYS * DAY,
        slot: slotted.includes(s.email) ? slotted.indexOf(s.email) : null,
      });
    }

  return {
    packages,
    drawn,
    hidden: packages.length - drawn.length,
    people,
    truckFactor: own.truckFactor,
    leftOut: own.packages.length - packages.length,
    belowFloor: own.belowFloor,
    solo:
      packages.length > 0 &&
      new Set(packages.map((p) => p.shares[0].email)).size === 1,
    noData:
      own.packages.length === 0 &&
      own.belowFloor === 0 &&
      own.truckFactor.files === 0,
  };
}

const cache = new WeakMap<GitrelicReport, OwnershipMap>();
/** `ownershipMap`, once per report. */
export function ownershipMapOf(report: GitrelicReport): OwnershipMap {
  let m = cache.get(report);
  if (!m) cache.set(report, (m = ownershipMap(report)));
  return m;
}

/**
 * The packages nobody else would know if `email` left: they're its only
 * knower (10%+ of the commits and 3+ of them). "What if X left".
 */
export function strandedBy(map: OwnershipMap, email: string): MapPackage[] {
  return map.packages.filter(
    (p) => p.knowers.length === 1 && p.knowers[0] === email,
  );
}

/** A person's surname, for a cell's second line ("Savona 88%"). */
export function surname(name: string): string {
  const parts = name
    .replace(/"[^"]*"/g, '')
    .trim()
    .split(/\s+/);
  return parts[parts.length - 1] || name;
}
