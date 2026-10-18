// Mark labels as DOM text over the canvas: crisp at any zoom and selectable
// by assistive tech, which canvas text isn't. Updated imperatively every
// frame from the store (no Svelte reactivity per label), with a pool of
// spans reused across frames. Text goes in through textContent only — labels
// are commit authors and file paths, never markup.

import { planLabels, type LabelCandidate } from '@gitrelic/scene';

import { worldToScreen, type ScreenSize, type ViewTransform } from './viewport';
import type { MarkStore } from './markStore';

/** Rough advance of one character at the label font size, px. */
const CHAR_PX = 6.5;
const LABEL_H = 16;
/** Gap between a mark's edge and its label, px. */
const OFFSET = 4;

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
      if (!mark.label || store.alpha[i] < 0.5) continue;
      const [sx, sy] = worldToScreen(view, store.x[i], store.y[i]);
      const edge = (store.r[i] || store.w[i] / 2) * view.scale;
      candidates.push({
        id: mark.id,
        x: sx + edge + OFFSET,
        y: sy - LABEL_H / 2,
        w: mark.label.length * CHAR_PX + 4,
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
