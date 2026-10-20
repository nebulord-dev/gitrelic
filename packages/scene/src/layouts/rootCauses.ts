// Risk's Root causes (docs/atlas-views.md › Risk): the source files that
// change with the risky ones on the left, the risky files on the right, a
// ribbon from each hub to every risky node it changes with, as wide as the
// commits they share. A family of risky files that change together is one
// node, drawn as its top member's `file:` mark; the other members stand in
// on it, so a table row or a stacks file lights it.
//
// Hubs run best first, top down. Risky nodes are ordered by where their hubs
// sit (the barycenter), which keeps ribbons from crossing; nodes no hub
// reaches go last, faint. Every node is a `file:` mark, so a file travels
// here from the score stacks and back.

import { distinctNames } from '../format/distinctNames';
import { ids, type EntityId } from '../ids';
import {
  hubTip,
  nodeTip,
  type RootCauses,
  type RiskNode,
} from '../risk/rootCauses';
import type { Link, Mark, Scene, Viewport } from '../model';

const ROW_MAX = 64;
const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export function rootCausesScene(rc: RootCauses, viewport: Viewport): Scene {
  const bounds = { x: 0, y: 0, w: viewport.width, h: viewport.height };
  const { nodes, hubs } = rc;
  if (nodes.length === 0) {
    return {
      marks: [
        {
          ...card(
            'empty',
            viewport.width / 2,
            viewport.height / 2,
            'No file scores 40 or more',
            'center',
            0,
          ),
          labelSub:
            'Healthy repos show none, so nothing upstream of them either.',
        },
      ],
      links: [],
      guides: [],
      bounds,
    };
  }

  const hubX = Math.round(viewport.width / 3);
  const nodeX = Math.round((viewport.width * 2) / 3);
  const top = 112;
  const bottom = viewport.height - 64;
  const names = distinctNames([
    ...hubs.map((h) => h.file),
    ...nodes.flatMap((n) => n.members.map((m) => m.file)),
  ]);
  const name = (file: string) => names.get(file) ?? baseName(file);
  const nodeOf = new Map(nodes.map((n) => [n.file, n]));
  const label = (node: string) => {
    const n = nodeOf.get(node)!;
    return n.family ? `${n.family} (${n.members.length})` : name(n.file);
  };

  // Each column evenly spaced and centred on the same middle.
  const column = (count: number) => {
    const step = Math.min(ROW_MAX, (bottom - top) / Math.max(1, count));
    const mid = (top + bottom) / 2;
    return (i: number) => mid + (i - (count - 1) / 2) * step;
  };

  // Risky nodes by the weighted mean position of the hubs reaching them.
  const pull = new Map<string, { sum: number; weight: number }>();
  hubs.forEach((h, i) => {
    for (const l of h.links) {
      const p = pull.get(l.node) ?? { sum: 0, weight: 0 };
      p.sum += i * l.coCommits;
      p.weight += l.coCommits;
      pull.set(l.node, p);
    }
  });
  const center = (n: RiskNode) => {
    const p = pull.get(n.file);
    return p ? p.sum / p.weight : Infinity;
  };
  const ordered = nodes
    .map((n, i) => ({ n, i, c: center(n) }))
    .sort((a, b) => a.c - b.c || a.i - b.i)
    .map((o) => o.n);

  const marks: Mark[] = [];
  const links: Link[] = [];
  const standIns = new Map<EntityId, string>();

  const hubsOf = new Map<string, number>();
  for (const h of hubs)
    for (const l of h.links) hubsOf.set(l.node, (hubsOf.get(l.node) ?? 0) + 1);

  const nodeY = column(ordered.length);
  ordered.forEach((n, i) => {
    const reached = hubsOf.get(n.file) ?? 0;
    const id = ids.file(n.file);
    const r =
      Math.min(10, Math.max(5, 5 + (n.score - 40) / 8)) +
      (n.family ? Math.min(4, n.members.length / 2) : 0);
    marks.push({
      id,
      shape: 'dot',
      paint: n.cursed ? '--risk-3' : '--risk-2',
      x: nodeX,
      y: nodeY(i),
      ...zero,
      r,
      // Faint, but not under the label layer's floor (0.5): it keeps its name.
      alpha: reached > 0 || hubs.length === 0 ? 0.95 : 0.55,
      z: 2,
      label: label(n.file),
      labelSub:
        (n.cursed ? `score ${n.score}` : `score ${n.score} · near miss`) +
        (reached === 0 && hubs.length > 0 ? ' · no hub' : ''),
      labelAnchor: 'right',
      labelPriority: 20 + reached,
      tip: nodeTip(n, n.family ?? name(n.file), name, reached),
    });
    for (const m of n.members.slice(1)) standIns.set(ids.file(m.file), id);
  });

  if (hubs.length === 0) {
    marks.push({
      ...card(
        'rc-none',
        hubX,
        (top + bottom) / 2,
        'No source file changes with them often',
        'center',
        4,
      ),
      labelSub:
        'Coupling counts pairs sharing 3+ commits; tests aren’t counted as causes.',
    });
    marks.push(
      card('rc-head:risky', nodeX, nodeY(0) - 44, 'Risky files', 'right', 5),
    );
    return { marks, links, guides: [], bounds, standIns };
  }

  const hubY = column(hubs.length);
  const maxCo = Math.max(
    ...hubs.flatMap((h) => h.links.map((l) => l.coCommits)),
  );
  hubs.forEach((h, i) => {
    const id = ids.file(h.file);
    marks.push({
      id,
      shape: 'dot',
      // Neutral: the risk colours belong to the files on the right.
      paint: '--soft',
      x: hubX,
      y: hubY(i),
      ...zero,
      r: Math.min(11, 4 + h.links.length * 1.2),
      alpha: 0.95,
      z: 2,
      label: name(h.file),
      labelSub: `${h.links.length} risky · ${h.commits} commits`,
      labelAnchor: 'left',
      labelPriority: 30 - i,
      tip: hubTip(h, name(h.file), label),
    });
    for (const l of h.links) {
      links.push({
        id: `cause:${h.file}:${l.node}`,
        source: id,
        target: ids.file(l.node),
        curve: 'ribbon',
        width: 1 + 7 * (l.coCommits / maxCo),
        paint: '--link',
        alpha: 0.75,
      });
    }
  });

  // Headings just above the taller column: hubs' over their names, the
  // risky files' over theirs.
  const headY = Math.min(hubY(0), nodeY(0)) - 44;
  marks.push(
    card('rc-head:hubs', hubX, headY, 'Change with them', 'left', 5),
    card('rc-head:risky', nodeX, headY, 'Risky files', 'right', 5),
  );
  return { marks, links, guides: [], bounds, standIns };
}

function card(
  id: string,
  x: number,
  y: number,
  label: string,
  labelAnchor: Mark['labelAnchor'],
  labelPriority: number,
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
    labelPriority: labelPriority + 1000,
    labelAnchor,
  };
}
