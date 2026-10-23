// AI & Co-authors' Where AI writes (docs/atlas-views.md › AI & Co-authors):
// packages as rows, most commits first, each a bar as long as its commits,
// the part with AI in it in the accent (AI-assisted, then a lighter shade
// for commits an AI agent authored), its share at the right. A heading names
// the repo's share, or the selected person's.
//
// Each row's bar is its package's `dir:` mark (`repo` for the root's files),
// so packages travel from Commit Timing's funnel and Churn; the AI parts and
// the names are layout-only (`ai-part:`, `ai-name:`, `ai-share:`) and select
// their package. A selected package keeps its row at full strength and the
// rest fade. Low adoption draws the same picture, nearly all grey: that is
// the reading, not an empty state.

import type { AiPackageRow, AiPackages } from '../ai/packages';
import type { EntityId } from '../ids';
import type { Mark, Paint, Scene, Viewport } from '../model';

export const AUTHORED_PAINT: Paint = {
  mix: ['--accent', '--text'],
  t: 0.45,
};

const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');
const plural = (v: number, word: string) =>
  `${n(v)} ${word}${v === 1 ? '' : 's'}`;
const pct = (v: number, of: number) =>
  of === 0 ? '0%' : `${Math.round((v / of) * 100)}%`;

export interface AiPackagesInput {
  packages: AiPackages;
  /** How many rows to draw; the rest are counted below the last. */
  rows: number;
  /** Whose packages these are, when a person is selected. */
  person?: string | null;
  /** The AI tools seen, for the heading's second line ("Claude 16, Amp 1"). */
  tools?: string;
  focus?: EntityId | null;
}

export function aiPackagesScene(
  {
    packages,
    rows: cap,
    person = null,
    tools = '',
    focus = null,
  }: AiPackagesInput,
  viewport: Viewport,
): Scene {
  const rows = packages.rows.slice(0, cap);
  if (rows.length === 0) {
    return {
      marks: [
        card(
          'ai-empty',
          viewport.width / 2,
          viewport.height / 2,
          person
            ? `${person} has no counted commits`
            : 'No commits in the window',
          'center',
          1000,
        ),
      ],
      links: [],
      guides: [],
      bounds: { x: 0, y: 0, w: viewport.width, h: viewport.height },
    };
  }

  const top = 120;
  const rowH = Math.max(
    18,
    Math.min(34, (viewport.height - top - 70) / rows.length),
  );
  const left = 240;
  const right = viewport.width - 190;
  const max = Math.max(1, ...rows.map((r) => r.commits));
  const len = (v: number) => (v / max) * (right - left);
  const y = (i: number) => top + i * rowH + rowH / 2;
  const barH = Math.max(8, rowH - 10);
  const focusRow = focus ? rows.find((r) => r.id === focus) : undefined;
  const alphaOf = (r: AiPackageRow) => (focusRow && focusRow !== r ? 0.35 : 1);

  const marks: Mark[] = [];
  rows.forEach((r, i) => {
    const ai = r.assisted + r.authored;
    const tip = [
      r.package === '' ? '(root): files at the top level' : r.package,
      `${plural(r.commits, 'commit')} · ${n(ai)} with AI (${pct(ai, r.commits)})`,
      ...(r.assisted > 0 ? [`${n(r.assisted)} AI-assisted`] : []),
      ...(r.authored > 0 ? [`${n(r.authored)} authored by an AI agent`] : []),
    ];
    const alpha = alphaOf(r);
    const total = len(r.commits);
    marks.push({
      id: r.id,
      shape: 'bar',
      paint: '--ghost',
      x: left + total / 2,
      y: y(i),
      ...zero,
      w: Math.max(2, total),
      h: barH,
      alpha,
      z: 1,
      tip,
    });
    const aLen = len(r.assisted);
    const uLen = len(r.authored);
    if (aLen > 0)
      marks.push(
        part(
          `ai-part:${r.package}:assisted`,
          r.id,
          left + aLen / 2,
          y(i),
          aLen,
          barH,
          '--accent',
          alpha,
          tip,
        ),
      );
    if (uLen > 0)
      marks.push(
        part(
          `ai-part:${r.package}:authored`,
          r.id,
          left + aLen + uLen / 2,
          y(i),
          uLen,
          barH,
          AUTHORED_PAINT,
          alpha,
          tip,
        ),
      );
    marks.push({
      ...card(`ai-name:${r.package}`, left - 14, y(i), r.name, 'left', 900 - i),
      selects: r.id,
      alpha,
    });
    marks.push({
      ...card(
        `ai-share:${r.package}`,
        right + 14,
        y(i),
        `${n(ai)} of ${n(r.commits)} · ${pct(ai, r.commits)}`,
        'right',
        800 - i,
      ),
      selects: r.id,
      alpha,
    });
  });

  const bottom = top + rows.length * rowH;
  const more = packages.rows.length - rows.length;
  if (more > 0)
    marks.push(
      card(
        'ai-more',
        left,
        bottom + 18,
        `+${plural(more, 'more package')} in the table`,
        'right',
        700,
      ),
    );

  const share = pct(packages.ai, packages.commits);
  marks.push({
    ...card(
      'ai-head',
      left,
      top - 56,
      person
        ? `${person}: ${n(packages.ai)} of ${plural(packages.commits, 'commit')} with AI (${share})`
        : packages.ai === 0
          ? `No commit had AI in it (${plural(packages.commits, 'commit')})`
          : `${share} of commits had AI in them (${n(packages.ai)} of ${n(packages.commits)})`,
      'right',
      1000,
    ),
    labelSub: person
      ? 'their commits, by package; sweeping and bot commits left out'
      : packages.ai === 0
        ? 'no Co-authored-by trailer names an AI tool, and no AI agent committed'
        : tools
          ? `${tools} · bars are commits by package, AI in the accent`
          : 'bars are commits by package, AI in the accent',
  });

  return {
    marks,
    links: [],
    guides: [],
    bounds: {
      x: 0,
      y: top - 90,
      w: viewport.width,
      h: bottom - top + 90 + (more > 0 ? 40 : 20),
    },
  };
}

function part(
  id: string,
  selects: EntityId,
  x: number,
  y: number,
  w: number,
  h: number,
  paint: Paint,
  alpha: number,
  tip: string[],
): Mark {
  return {
    id,
    shape: 'bar',
    paint,
    x,
    y,
    ...zero,
    w,
    h,
    alpha,
    z: 2,
    selects,
    tip,
  };
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
