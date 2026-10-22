// Contributors' Flow (docs/atlas-views.md › Contributors): people on the
// left, packages on the right, a band from each person to each package they
// commit to, as wide as those commits. Each node is as tall as the bands it
// sends or takes, and the bands stack along it (`Link.ends`) in the other
// side's order, so they meet edge to edge and cross as little as the order
// allows. Bands take the person's status: who still works here, and which
// code was left by people who went quiet.
//
// Hovering a node (or its name) lights its bands and fades the rest, drawn by
// the stage alone (`Scene.hoverLinks`). A selected person lights their bands
// and dims the packages they never touched; a selected package lights its
// bands and dims the people who never touched it. People are `person:` marks and packages `dir:` marks (the root
// package is `repo`), so they travel to and from the other lenses; the
// others' nodes are layout-only and select nothing.

import { rowName } from '../churn/swarm';
import {
  LEFT_BEHIND_SHARE,
  notActiveShare,
  type ContributorFlow,
  type FlowLink,
  type FlowPackage,
  type FlowPerson,
  type PersonStatus,
} from '../contributors/flow';
import { formatRelative } from '../format/relativeTime';
import { ids, REPO_ID, type EntityId } from '../ids';
import type { ColorRole, Link, Mark, Scene, Viewport } from '../model';

export const OTHER_PEOPLE_ID = 'flow-others:people';
export const OTHER_PACKAGES_ID = 'flow-others:packages';

/** What a status is called on the stage. */
export const STATUS_TEXT: Record<PersonStatus, string> = {
  active: 'active',
  quiet: 'quiet',
  ghost: 'gone',
};
const STATUS_PAINT: Record<PersonStatus, ColorRole> = {
  active: '--soft',
  quiet: '--risk-1',
  ghost: '--risk-2',
};
// Active bands stay quieter than the ones left by people who went quiet:
// those are what the picture is asking you to notice.
const STATUS_ALPHA: Record<PersonStatus, number> = {
  active: 0.26,
  quiet: 0.42,
  ghost: 0.5,
};
const OTHERS_PAINT: ColorRole = '--ghost';
/** A node the selection doesn't reach: faint, but over the label layer's
 * floor (0.5), so it keeps its name. */
const DIM = 0.55;
const OTHERS_ALPHA = 0.2;

const BAR_W = 8;
const GAP = 6;
/**
 * Each node gets at least this much height for its two-line label; a thin
 * node sits in the middle of its slot, so bands keep their true widths.
 */
const MIN_SLOT = 40;
const TOP = 72;
/** Room beside each column for its names. */
const LABEL_ROOM = 250;
const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');
const plural = (v: number, word: string) =>
  word === 'person'
    ? `${n(v)} ${v === 1 ? 'person' : 'people'}`
    : `${n(v)} ${word}${v === 1 ? '' : 's'}`;
const DAY = 86_400_000;

/** A package's name on the stage: `packages/` dropped, as in Churn. */
export const packageName = (dir: string) =>
  dir === '' ? '(root)' : dir.replace(/^packages\//, '');
export const packageId = (dir: string): EntityId =>
  dir === '' ? REPO_ID : ids.dir(dir);

export interface FlowOptions {
  /** The selection, when it's a drawn person or package. */
  focus?: EntityId | null;
  /** "Now" for last-commit ages: the report's last commit (ms). */
  now?: number;
}

export function flowScene(
  flow: ContributorFlow,
  viewport: Viewport,
  { focus = null, now = Number.NaN }: FlowOptions = {},
): Scene {
  const bounds = { x: 0, y: 0, w: viewport.width, h: viewport.height };
  if (flow.links.length === 0) {
    return {
      marks: [
        {
          id: 'flow-empty',
          shape: 'card',
          paint: '--muted',
          x: viewport.width / 2,
          y: viewport.height / 2,
          ...zero,
          alpha: 1,
          label: 'No commits in the window',
          labelAnchor: 'center',
          labelPriority: 1000,
        },
      ],
      links: [],
      guides: [],
      bounds,
    };
  }

  // Columns far apart: with their names beside them, the picture is about
  // twice as wide as it is tall, the shape of the stage, so a fit fills it
  // across rather than leaving its sides empty. The long bands read better
  // too: crossings spread out over the width.
  const leftX = Math.round(viewport.width * 0.17);
  const rightX = Math.round(viewport.width * 0.83);
  const bottom = viewport.height - 40;

  // Node keys: a person's email or a package's dir; null is the others' node.
  type Key = string | null;
  const leftKeys: Key[] = flow.people.map((p) => p.email);
  if (flow.otherPeople.count > 0 && flow.otherPeople.commits > 0)
    leftKeys.push(null);
  // Packages sit level with the people who commit to them: ordered by the
  // commit-weighted mean place of their (drawn) people, so a team's bands
  // run straight across instead of crossing everyone else's. Size still
  // reads off a node's height. The others' node stays last.
  const personAt = new Map(flow.people.map((p, i) => [p.email, i]));
  const pull = new Map<string, { sum: number; weight: number }>();
  for (const l of flow.links) {
    if (l.email === null || l.dir === null) continue;
    const p = pull.get(l.dir) ?? { sum: 0, weight: 0 };
    p.sum += personAt.get(l.email)! * l.commits;
    p.weight += l.commits;
    pull.set(l.dir, p);
  }
  const place = (dir: string) => {
    const p = pull.get(dir);
    return p ? p.sum / p.weight : Infinity;
  };
  const rightKeys: Key[] = flow.packages
    .map((p, i) => ({ dir: p.dir, i, at: place(p.dir) }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map((o) => o.dir);
  if (flow.otherPackages.commits > 0) rightKeys.push(null);
  const leftIndex = new Map(leftKeys.map((k, i) => [k, i]));
  const rightIndex = new Map(rightKeys.map((k, i) => [k, i]));

  const leftValue = leftKeys.map(() => 0);
  const rightValue = rightKeys.map(() => 0);
  for (const l of flow.links) {
    leftValue[leftIndex.get(l.email)!] += l.commits;
    rightValue[rightIndex.get(l.dir)!] += l.commits;
  }
  const total = leftValue.reduce((s, v) => s + v, 0);
  const span = bottom - TOP;
  // One scale for both sides, so a band is as wide at each end. Slots for
  // thin nodes take room from it, so settle it over a few rounds.
  const slotsAt = (values: number[], scale: number) =>
    values.reduce((s, v) => s + Math.max(v * scale, MIN_SLOT), 0) +
    GAP * (values.length - 1);
  let k = Math.min(
    (span - GAP * (leftKeys.length - 1)) / total,
    (span - GAP * (rightKeys.length - 1)) / total,
  );
  for (let round = 0; round < 4; round++) {
    const over = Math.max(slotsAt(leftValue, k), slotsAt(rightValue, k)) - span;
    if (over <= 0) break;
    k *= Math.max(0.5, 1 - over / span);
  }
  // A node's top, centred in its slot.
  const stack = (values: number[]) => {
    const tops: number[] = [];
    let y = 0;
    for (const v of values) {
      const slot = Math.max(v * k, MIN_SLOT);
      tops.push(y + (slot - v * k) / 2);
      y += slot + GAP;
    }
    const offset = TOP + (span - (y - GAP)) / 2;
    return tops.map((t) => t + offset);
  };
  const leftTop = stack(leftValue);
  const rightTop = stack(rightValue);
  const leftMid = (i: number) => leftTop[i] + (leftValue[i] * k) / 2;
  const rightMid = (i: number) => rightTop[i] + (rightValue[i] * k) / 2;

  // Where each band sits along its two nodes: at a person, in package
  // order; at a package, in people order.
  const ends = new Map<FlowLink, [number, number]>();
  const cursor = (tops: number[]) => tops.slice();
  const atLeft = cursor(leftTop);
  const byLeft = [...flow.links].sort(
    (a, b) =>
      leftIndex.get(a.email)! - leftIndex.get(b.email)! ||
      rightIndex.get(a.dir)! - rightIndex.get(b.dir)!,
  );
  for (const l of byLeft) {
    const i = leftIndex.get(l.email)!;
    const w = l.commits * k;
    ends.set(l, [atLeft[i] + w / 2 - leftMid(i), 0]);
    atLeft[i] += w;
  }
  const atRight = cursor(rightTop);
  const byRight = [...flow.links].sort(
    (a, b) =>
      rightIndex.get(a.dir)! - rightIndex.get(b.dir)! ||
      leftIndex.get(a.email)! - leftIndex.get(b.email)!,
  );
  for (const l of byRight) {
    const j = rightIndex.get(l.dir)!;
    const w = l.commits * k;
    ends.get(l)![1] = atRight[j] + w / 2 - rightMid(j);
    atRight[j] += w;
  }

  // The focus, if it's a node drawn here.
  const personOf = new Map(flow.people.map((p) => [ids.person(p.email), p]));
  const packageOf = new Map(flow.packages.map((p) => [packageId(p.dir), p]));
  const focusPerson = focus ? personOf.get(focus) : undefined;
  const focusPackage = focus ? packageOf.get(focus) : undefined;
  const lit = (l: FlowLink) =>
    focusPerson
      ? l.email === focusPerson.email
      : focusPackage
        ? l.dir === focusPackage.dir
        : null;
  const touched = (side: 'left' | 'right', key: Key) =>
    flow.links.some(
      (l) => lit(l) && (side === 'left' ? l.email === key : l.dir === key),
    );

  const statusOf = new Map(flow.people.map((p) => [p.email, p.status]));
  const nameOf = new Map(flow.people.map((p) => [p.email, p.name]));
  const marks: Mark[] = [];
  const links: Link[] = [];

  leftKeys.forEach((key, i) => {
    const h = Math.max(1, leftValue[i] * k);
    const dim = focusPackage && !touched('left', key);
    const base = {
      shape: 'bar' as const,
      x: leftX,
      y: leftMid(i),
      ...zero,
      w: BAR_W,
      h,
      z: 2,
      labelAnchor: 'left' as const,
      labelPriority: 100 - i,
    };
    if (key === null) {
      const o = flow.otherPeople;
      marks.push({
        ...base,
        id: OTHER_PEOPLE_ID,
        paint: OTHERS_PAINT,
        alpha: dim ? DIM : 0.8,
        label: `${n(o.count)} others`,
        labelSub: `${plural(flow.oneCommit, 'person')} with one commit`,
        tip: [
          `${n(o.count)} other contributors`,
          `${plural(o.commits, 'commit')} into packages`,
          `${n(flow.oneCommit)} of them made one commit`,
        ],
      });
      return;
    }
    const p = flow.people[i];
    marks.push({
      ...base,
      id: ids.person(p.email),
      paint: focusPerson === p ? '--accent' : STATUS_PAINT[p.status],
      alpha: dim ? DIM : 0.95,
      label: p.name,
      labelSub: `${plural(p.commits, 'commit')} · ${STATUS_TEXT[p.status]}`,
      tip: personTip(p, now),
    });
  });

  rightKeys.forEach((key, j) => {
    const h = Math.max(1, rightValue[j] * k);
    const dim = focusPerson && !touched('right', key);
    const base = {
      shape: 'bar' as const,
      x: rightX,
      y: rightMid(j),
      ...zero,
      w: BAR_W,
      h,
      z: 2,
      labelAnchor: 'right' as const,
      labelPriority: 100 - j,
    };
    if (key === null) {
      const o = flow.otherPackages;
      marks.push({
        ...base,
        id: OTHER_PACKAGES_ID,
        paint: OTHERS_PAINT,
        alpha: dim ? DIM : 0.8,
        label: `${n(o.count)} other ${o.count === 1 ? 'package' : 'packages'}`,
        labelSub: plural(o.commits, 'commit'),
        tip: [
          `${n(o.count)} other ${o.count === 1 ? 'package' : 'packages'}`,
          `${plural(o.commits, 'commit')} touch them`,
        ],
      });
      return;
    }
    const pkg = flow.packages.find((p) => p.dir === key)!;
    const share = notActiveShare(pkg);
    const mine = focusPerson
      ? (focusPerson.packages.find((q) => q.dir === pkg.dir)?.commits ?? 0)
      : 0;
    marks.push({
      ...base,
      id: packageId(pkg.dir),
      paint: focusPackage === pkg ? '--accent' : '--muted',
      alpha: dim ? DIM : 0.95,
      label: packageName(pkg.dir),
      labelSub: focusPerson
        ? mine > 0
          ? `${plural(mine, 'commit')} by ${focusPerson.name}`
          : `${plural(pkg.commits, 'commit')}`
        : `${plural(pkg.commits, 'commit')} · ${plural(pkg.people, 'person')}` +
          (share >= LEFT_BEHIND_SHARE
            ? ` · ${Math.round(share * 100)}% by people no longer active`
            : ''),
      labelClass:
        !focusPerson && share >= LEFT_BEHIND_SHARE
          ? 'atlas-label--hot'
          : undefined,
      tip: packageTip(pkg),
    });
  });

  for (const l of flow.links) {
    const status = l.email === null ? null : statusOf.get(l.email)!;
    const on = lit(l);
    const who = l.email === null ? 'Others' : nameOf.get(l.email)!;
    const where = l.dir === null ? 'other packages' : packageName(l.dir);
    links.push({
      id: `flow:${l.email ?? '*'}:${l.dir ?? '*'}`,
      source: l.email === null ? OTHER_PEOPLE_ID : ids.person(l.email),
      target: l.dir === null ? OTHER_PACKAGES_ID : packageId(l.dir),
      curve: 'band',
      width: l.commits * k,
      ends: ends.get(l)!,
      paint: on ? '--accent' : status ? STATUS_PAINT[status] : OTHERS_PAINT,
      alpha:
        on === null
          ? status
            ? STATUS_ALPHA[status]
            : OTHERS_ALPHA
          : on
            ? 0.7
            : 0.05,
      tip: [`${who} → ${where}`, plural(l.commits, 'commit')],
    });
  }

  // Column headings, just above the taller column.
  const headY = Math.min(leftTop[0], rightTop[0]) - 36;
  marks.push(
    heading('flow-head:people', leftX, headY, 'People', 'left'),
    heading('flow-head:packages', rightX, headY, 'Packages', 'right'),
  );

  // Bounds hug the columns and their names, so the stage frames the
  // picture rather than the whole world.
  const lastY = Math.max(
    leftTop.at(-1)! + leftValue.at(-1)! * k,
    rightTop.at(-1)! + rightValue.at(-1)! * k,
  );
  return {
    marks,
    links,
    guides: [],
    hoverLinks: true,
    bounds: {
      x: leftX - LABEL_ROOM,
      y: headY - 24,
      w: rightX - leftX + 2 * LABEL_ROOM,
      h: lastY + 24 - (headY - 24),
    },
  };
}

function personTip(p: FlowPerson, now: number): string[] {
  const last = Date.parse(p.lastCommit);
  const days =
    Number.isFinite(last) && Number.isFinite(now)
      ? Math.max(0, Math.round((now - last) / DAY))
      : null;
  const age = formatRelative(days);
  const tip = [
    p.name,
    `${plural(p.commits, 'commit')} · ${STATUS_TEXT[p.status]}`,
    age === 'today' ? 'Last commit today' : `Last commit ${age}`,
  ];
  if (p.packages.length > 0)
    tip.push(
      `Most in ${p.packages
        .slice(0, 3)
        .map((q) => `${packageName(q.dir)} (${n(q.commits)})`)
        .join(', ')}`,
    );
  if (p.filesOwned > 0) tip.push(`Owns ${plural(p.filesOwned, 'file')}`);
  return tip;
}

function packageTip(pkg: FlowPackage): string[] {
  const { active, quiet, ghost } = pkg.byStatus;
  const pct = (v: number) => `${Math.round((v / pkg.commits) * 100)}%`;
  const tip = [
    rowName(pkg.dir),
    `${plural(pkg.commits, 'commit')} by ${plural(pkg.people, 'person')}`,
    `${pct(active)} by active people · ${pct(quiet)} quiet · ${pct(ghost)} gone`,
  ];
  if (pkg.top)
    tip.push(`Most commits: ${pkg.top.name} (${n(pkg.top.commits)})`);
  return tip;
}

function heading(
  id: string,
  x: number,
  y: number,
  label: string,
  labelAnchor: 'left' | 'right',
): Mark {
  return {
    id,
    shape: 'card',
    paint: '--muted',
    x,
    y,
    ...zero,
    alpha: 1,
    label,
    labelAnchor,
    labelPriority: 1000,
  };
}
