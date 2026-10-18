// The hover tooltip: a small card by the hovered mark with the lines its
// layout wrote in `mark.tip` (docs/atlas-views.md › The inspector: hover never
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
  private shownFor: EntityId | null = null;
  private shownText = '';

  constructor(host: HTMLElement) {
    this.card = document.createElement('div');
    this.card.className = 'atlas-tip';
    this.card.hidden = true;
    host.append(this.card);
  }

  /** Shows `id`'s tip beside it, or hides the card (no id, or no tip). */
  update(
    store: MarkStore,
    view: ViewTransform,
    screen: ScreenSize,
    id: EntityId | null,
  ): void {
    const i = id ? store.indexOf(id) : -1;
    const tip = i >= 0 ? store.marks[i].tip : undefined;
    if (!id || !tip || tip.length === 0 || store.alpha[i] <= 0) {
      this.card.hidden = true;
      this.shownFor = null;
      return;
    }
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
    }
    this.card.hidden = false;

    const [sx, sy] = worldToScreen(view, store.x[i], store.y[i]);
    const edge = (store.r[i] || store.w[i] / 2) * view.scale;
    const w = this.card.offsetWidth;
    const h = this.card.offsetHeight;
    // Right of the mark, or left of it when that would run off the stage;
    // vertically centred on it, kept inside.
    let x = sx + edge + GAP;
    if (x + w > screen.width - EDGE) x = sx - edge - GAP - w;
    x = Math.max(EDGE, x);
    const y = Math.min(
      Math.max(EDGE, sy - h / 2),
      Math.max(EDGE, screen.height - h - EDGE),
    );
    this.card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  destroy(): void {
    this.card.remove();
  }
}
