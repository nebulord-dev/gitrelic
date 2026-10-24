// Ownership & Knowledge › Ownership: who owns what, per package
// (docs/atlas-views.md › Ownership). The Organic map is the primary form, the
// Mosaic its alternate (a later PR); Knowledge Silos and Ghost Files merged
// in. The truck factor heads the lens card; the table lists every package.

import { ids } from '../ids';
import { shortPackage } from '../layouts/boundaries';
import { organicMapScene } from '../layouts/organicMap';
import {
  ownershipMapOf,
  type MapPackage,
  type OwnershipMap,
} from '../ownership/map';
import type {
  AnalyzerView,
  Finding,
  Layout,
  LensTable,
  ViewInput,
} from '../model';

const n = (v: number) => v.toLocaleString('en-US');
const plural = (k: number, one: string, many = `${one}s`) =>
  `${n(k)} ${k === 1 ? one : many}`;
const nameOf = (map: OwnershipMap, email: string) =>
  map.people.get(email)?.name ?? email;

export const organicMapLayout: Layout = {
  id: 'map',
  label: 'Map',
  caption:
    'Each cell is a package, sized by commits and colored by whoever made the most; the stronger the color, the more of it is theirs. Dashed: that person has gone quiet.',
  focusKinds: ['person'],
  needsCommits: false,
  build: organicMapScene,
};

/** Chips for packages, "a, b and c". */
function packageList(list: readonly MapPackage[]): Finding['segments'] {
  const out: Finding['segments'] = [];
  list.forEach((p, i) => {
    if (i > 0) out.push(i === list.length - 1 ? ' and ' : ', ');
    out.push({ ref: p.id, text: shortPackage(p.dir) });
  });
  return out;
}

export function ownershipFindings(input: ViewInput): Finding[] {
  const map = ownershipMapOf(input.report);
  if (map.noData)
    return [
      {
        id: 'no-data',
        tone: 'warning',
        segments: [
          'This report was made before the Ownership lens: rerun gitrelic to see who owns what.',
        ],
      },
    ];
  const findings: Finding[] = [];

  if (map.solo) {
    const [only] = map.packages;
    findings.push({
      id: 'solo',
      tone: 'neutral',
      segments: [
        {
          ref: ids.person(only.shares[0].email),
          text: nameOf(map, only.shares[0].email),
        },
        ` tops every package: one person owns everything, so the map has one color.`,
      ],
    });
  }

  const quiet = map.packages.filter((p) => p.topQuiet);
  for (const p of quiet)
    findings.push({
      id: quiet.length === 1 ? 'quiet' : `quiet:${p.dir}`,
      tone: 'warning',
      segments: [
        { ref: p.id, text: shortPackage(p.dir) },
        `'s top contributor, `,
        {
          ref: ids.person(p.shares[0].email),
          text: nameOf(map, p.shares[0].email),
        },
        ` (${p.topShare}%), has made no commit in 90 days: find out who takes it over.`,
      ],
    });

  const onePerson = map.packages.filter((p) => p.onePerson);
  if (onePerson.length > 0 && !map.solo)
    findings.push({
      id: 'one-person',
      tone: 'notable',
      segments: [
        ...packageList(onePerson.slice(0, 4)),
        onePerson.length > 4 ? ` and ${n(onePerson.length - 4)} more` : '',
        ` ${onePerson.length === 1 ? 'rests' : 'rest'} on one person (75% or more of the commits).`,
      ],
    });

  const shared = map.packages.filter((p) => !p.owner);
  if (shared.length > 0)
    findings.push({
      id: 'shared',
      tone: 'neutral',
      segments: [
        `${plural(shared.length, 'package')} of ${n(map.packages.length)} ${shared.length === 1 ? 'is' : 'are'} shared: nobody made 30% of the commits.`,
      ],
    });

  if (map.hidden > 0)
    findings.push({
      id: 'hidden',
      tone: 'neutral',
      segments: [
        `The map shows the busiest ${n(map.drawn.length)} of ${n(map.packages.length)} packages; the other ${n(map.hidden)} are in the table.`,
      ],
    });

  const left = map.belowFloor + map.leftOut;
  if (left > 0)
    findings.push({
      id: 'left-out',
      tone: 'neutral',
      segments: [
        [
          map.belowFloor > 0
            ? `${plural(map.belowFloor, 'package')} with under 10 commits`
            : '',
          map.leftOut > 0 ? `the root and dot-folders (${n(map.leftOut)})` : '',
        ]
          .filter(Boolean)
          .join(' and ') + ' left off the map.',
      ],
    });
  return findings.map((f) => ({
    ...f,
    segments: f.segments.filter((s) => s !== ''),
  }));
}

/** Every mapped package, busiest first. Tiers: shared, owned, one person, top quiet. */
export function ownershipTable(input: ViewInput): LensTable {
  const map = ownershipMapOf(input.report);
  return {
    columns: [
      { id: 'package', label: 'Package' },
      { id: 'commits', label: 'Commits', numeric: true },
      { id: 'top', label: 'Top contributor' },
      { id: 'share', label: 'Share %', numeric: true },
      { id: 'knowers', label: 'People who know it', numeric: true },
      { id: 'truck', label: 'Truck factor', numeric: true },
      { id: 'flags', label: 'Flags' },
    ],
    rows: map.packages.map((p) => ({
      id: p.id,
      tier: p.topQuiet ? 3 : p.onePerson ? 2 : p.owner ? 1 : 0,
      search: p.dir.toLowerCase(),
      cells: {
        package: p.dir,
        commits: p.commits,
        top: nameOf(map, p.shares[0].email),
        share: p.topShare,
        knowers: p.knowers.length,
        truck: p.truckFactor.value,
        flags: [
          p.topQuiet ? 'top quiet' : '',
          p.onePerson ? 'one person' : '',
          p.owner ? '' : 'shared',
        ]
          .filter(Boolean)
          .join(', '),
      },
    })),
    tierNames: ['Shared', 'Owned', 'One person', 'Top quiet'],
    sort: { column: 'commits', descending: true },
  };
}

export const ownershipView: AnalyzerView = {
  id: 'bus-factor',
  layouts: [organicMapLayout],
  findings: ownershipFindings,
  table: ownershipTable,
};
