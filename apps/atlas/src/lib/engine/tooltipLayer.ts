// The hover tooltip: a small card by the hovered mark with the lines its
// layout wrote in `mark.tip`, or by the pointer for a link's `tip`
// (docs/atlas-views.md › The inspector: hover never
// changes the inspector). Drawn into the label host, updated every frame from
// the store like the labels, so it follows its mark through pans, zooms and
// morphs. Text goes in through textContent only: tips hold file paths and
// names from the report, never markup.

import { worldToScreen, type ScreenSize, type ViewTransform } from './viewport';
import type { MarkStore } from './markStore';
import type { EntityId } from '@gitrelic/scene';

/** Gap between the mark's edge and the card, px. */
const GAP = 10;
/** Room kept between the card and the stage's edges, px. */
const EDGE = 8;

export class TooltipLayer {
  private card: HTMLDivElement;
  /** The mark or link the card shows the tip of. */
  private shownFor: string | null = null;
  private shownText = '';
  /** The card's size, measured once per change of text: reading it every
   * frame would force a layout after the labels' writes, mid-animation. */
  private size: { w: number; h: number } | null = null;

  constructor(host: HTMLElement) {
    this.card = document.createElement('div');
    this.card.className = 'atlas-tip';
    this.card.hidden = true;
    host.append(this.card);
  }

  /**
   * Shows `id`'s tip beside it, or hides the card (no id, or no tip). The
   * card goes on the side opposite the mark's label, so the label it was
   * hovered by stays put.
   */
  update(
    store: MarkStore,
    view: ViewTransform,
    screen: ScreenSize,
    id: EntityId | null,
  ): void {
    const i = id ? store.indexOf(id) : -1;
    const tip = i >= 0 ? store.marks[i].tip : undefined;
    if (!id || !tip || tip.length === 0 || store.alpha[i] <= 0) {
      this.hide();
      return;
    }
    const size = this.show(id, tip);

    const [sx, sy] = worldToScreen(view, store.x[i], store.y[i]);
    // A dot's radius, or a box's half-width and half-height.
    const r = store.r[i];
    const edge: [number, number] = [
      (r || store.w[i] / 2) * view.scale,
      (r || store.h[i] / 2) * view.scale,
    ];
    const [x, y] = placeTip(
      store.marks[i].label ? (store.marks[i].labelAnchor ?? 'right') : null,
      sx,
      sy,
      edge,
      size.w,
      size.h,
      screen,
    );
    this.place(x, y);
  }

  /**
   * Shows a link's tip (`Link.tip`) beside the pointer at (sx, sy), screen
   * px: a link has no one point to stand by, so the card follows the pointer.
   */
  updateAt(
    id: string,
    tip: readonly string[],
    sx: number,
    sy: number,
    screen: ScreenSize,
  ): void {
    if (tip.length === 0) {
      this.hide();
      return;
    }
    const size = this.show(id, tip);
    const [x, y] = placeTip(null, sx, sy, [0, 0], size.w, size.h, screen);
    this.place(x, y);
  }

  /** Fills the card with `tip` (unless it already shows it); its size. */
  private show(id: string, tip: readonly string[]): { w: number; h: number } {
    const text = tip.join('\n');
    if (id !== this.shownFor || text !== this.shownText) {
      this.card.replaceChildren(
        ...tip.map((line, k) => {
          const el = document.createElement('div');
          el.className = k === 0 ? 'atlas-tip__title' : 'atlas-tip__line';
          el.textContent = line;
          return el;
        }),
      );
      this.shownFor = id;
      this.shownText = text;
      this.size = null;
    }
    this.card.hidden = false;
    // Measured visible: a hidden card has no size.
    this.size ??= { w: this.card.offsetWidth, h: this.card.offsetHeight };
    return this.size;
  }

  private hide(): void {
    this.card.hidden = true;
    this.shownFor = null;
  }

  private place(x: number, y: number): void {
    this.card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  destroy(): void {
    this.card.remove();
  }
}

type Anchor = 'right' | 'left' | 'above' | 'below' | 'center';

/** The side across the mark from its label (a centred label: below). */
const ACROSS: Record<Anchor, 'right' | 'left' | 'above' | 'below'> = {
  right: 'left',
  left: 'right',
  above: 'below',
  below: 'above',
  center: 'below',
};

/**
 * Where the card's top-left goes: across the mark from its label (a label on
 * the right puts the card on the left, one above puts it below), flipping if
 * that side runs off the stage, and kept inside it. A mark without a label
 * gets the card on its right. `edge` is the mark's half-width and
 * half-height on screen.
 */
export function placeTip(
  label: Anchor | null,
  sx: number,
  sy: number,
  edge: readonly [number, number],
  w: number,
  h: number,
  screen: ScreenSize,
): [number, number] {
  const side = label ? ACROSS[label] : 'right';
  let x: number;
  let y: number;
  if (side === 'left' || side === 'right') {
    const right = sx + edge[0] + GAP;
    const left = sx - edge[0] - GAP - w;
    x =
      side === 'right'
        ? right + w > screen.width - EDGE
          ? left
          : right
        : left < EDGE
          ? right
          : left;
    y = sy - h / 2;
  } else {
    const below = sy + edge[1] + GAP;
    const above = sy - edge[1] - GAP - h;
    y =
      side === 'below'
        ? below + h > screen.height - EDGE
          ? above
          : below
        : above < EDGE
          ? below
          : above;
    x = sx - w / 2;
  }
  return [
    Math.min(Math.max(EDGE, x), Math.max(EDGE, screen.width - w - EDGE)),
    Math.min(Math.max(EDGE, y), Math.max(EDGE, screen.height - h - EDGE)),
  ];
}
