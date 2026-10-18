// Mark labels as DOM text over the canvas, crisp at any zoom. The host is
// aria-hidden: hundreds of shifting spans would only be noise to a screen
// reader, which gets the inspector and detail table instead. Updated imperatively every
// frame from the store (no Svelte reactivity per label), with a pool of
// spans reused across frames. Text goes in through textContent only — labels
// are commit authors and file paths, never markup.

import { planLabels, type LabelCandidate, type Mark } from '@gitrelic/scene';

import { worldToScreen, type ScreenSize, type ViewTransform } from './viewport';
import type { MarkStore } from './markStore';

/** Rough advance of one character at the label font size, px. */
const CHAR_PX = 6.5;
const LABEL_H = 16;
/** Gap between a mark's edge and its label, px. */
const OFFSET = 4;
/** Marks drawn fainter than this (fading, or a faint paint) go unlabelled. */
const MIN_ALPHA = 0.5;

export class LabelLayer {
  private pool: HTMLSpanElement[] = [];

  constructor(private readonly host: HTMLElement) {}

  update(
    store: MarkStore,
    view: ViewTransform,
    screen: ScreenSize,
    pinned: ReadonlySet<string>,
  ): string[] {
    const candidates: LabelCandidate[] = [];
    const text = new Map<string, string>();
    for (let i = 0; i < store.count; i++) {
      const mark = store.marks[i];
      if (!mark.label || store.alpha[i] * store.opacity[i] < MIN_ALPHA)
        continue;
      const [sx, sy] = worldToScreen(view, store.x[i], store.y[i]);
      const edge = (store.r[i] || store.w[i] / 2) * view.scale;
      const w = mark.label.length * CHAR_PX + 4;
      const [x, y] = place(mark.labelAnchor, sx, sy, edge, w);
      candidates.push({
        id: mark.id,
        x,
        y,
        w,
        h: LABEL_H,
        priority: mark.labelPriority ?? 0,
      });
      text.set(mark.id, mark.label);
    }
    const shown = planLabels(candidates, { pinned, view: screen });
    const byId = new Map(candidates.map((c) => [c.id, c]));

    while (this.pool.length < shown.length) {
      const span = document.createElement('span');
      span.className = 'atlas-label';
      this.host.append(span);
      this.pool.push(span);
    }
    shown.forEach((id, k) => {
      const span = this.pool[k];
      const c = byId.get(id);
      if (!c) return;
      const label = text.get(id) ?? '';
      if (span.textContent !== label) span.textContent = label;
      span.dataset.id = id;
      span.classList.toggle('atlas-label--pinned', pinned.has(id));
      span.style.transform = `translate(${Math.round(c.x)}px, ${Math.round(c.y)}px)`;
      span.hidden = false;
    });
    for (let k = shown.length; k < this.pool.length; k++)
      this.pool[k].hidden = true;
    return shown;
  }

  destroy(): void {
    for (const span of this.pool) span.remove();
    this.pool = [];
  }
}

/** A label's top-left corner, from its mark's screen centre and radius. */
function place(
  anchor: Mark['labelAnchor'],
  sx: number,
  sy: number,
  edge: number,
  w: number,
): [number, number] {
  switch (anchor) {
    case 'left':
      return [sx - edge - OFFSET - w, sy - LABEL_H / 2];
    case 'above':
      return [sx - w / 2, sy - edge - OFFSET - LABEL_H];
    case 'below':
      return [sx - w / 2, sy + edge + OFFSET];
    case 'center':
      return [sx - w / 2, sy - LABEL_H / 2];
    default:
      return [sx + edge + OFFSET, sy - LABEL_H / 2];
  }
}
