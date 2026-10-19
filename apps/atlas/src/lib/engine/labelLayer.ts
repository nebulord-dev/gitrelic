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
/** A heading's first line (a label with a second line): larger and bolder. */
const HEAD_CHAR_PX = 7.8;
const HEAD_H = 18;
/** Gap between a mark's edge and its label, px. */
const OFFSET = 4;
/** Marks drawn fainter than this (fading, or a faint paint) go unlabelled. */
const MIN_ALPHA = 0.5;

/** A pooled label: its line of text, then the optional quieter second line. */
interface LabelSpan {
  span: HTMLSpanElement;
  main: Text;
  /** Made the first time this span shows a second line. */
  sub: HTMLSpanElement | null;
}

export class LabelLayer {
  private pool: LabelSpan[] = [];

  constructor(private readonly host: HTMLElement) {}

  update(
    store: MarkStore,
    view: ViewTransform,
    screen: ScreenSize,
    pinned: ReadonlySet<string>,
  ): string[] {
    const candidates: LabelCandidate[] = [];
    const text = new Map<string, [string, string]>();
    // Labels centred on their mark get the width they were placed with, so
    // the text centres in it: the width is an estimate, and a shrink-wrapped
    // span would sit left of centre wherever the text runs narrower.
    const centred = new Set<string>();
    for (let i = 0; i < store.count; i++) {
      const mark = store.marks[i];
      if (!mark.label || store.alpha[i] * store.opacity[i] < MIN_ALPHA)
        continue;
      const [sx, sy] = worldToScreen(view, store.x[i], store.y[i]);
      const edge = (store.r[i] || store.w[i] / 2) * view.scale;
      const sub = mark.labelSub ?? '';
      // A label with a second line is a heading: both lines are one
      // candidate, so they're shown or culled together.
      const w = sub
        ? Math.max(mark.label.length * HEAD_CHAR_PX, sub.length * CHAR_PX) + 4
        : mark.label.length * CHAR_PX + 4;
      const h = sub ? HEAD_H + LABEL_H : LABEL_H;
      const [x, y] = place(mark.labelAnchor, sx, sy, edge, w, h);
      candidates.push({
        id: mark.id,
        x,
        y,
        w,
        h,
        priority: mark.labelPriority ?? 0,
      });
      text.set(mark.id, [mark.label, sub]);
      if (
        mark.labelAnchor === 'above' ||
        mark.labelAnchor === 'below' ||
        mark.labelAnchor === 'center'
      )
        centred.add(mark.id);
    }
    const shown = planLabels(candidates, { pinned, view: screen });
    const byId = new Map(candidates.map((c) => [c.id, c]));

    while (this.pool.length < shown.length) {
      const span = document.createElement('span');
      span.className = 'atlas-label';
      const main = document.createTextNode('');
      span.append(main);
      this.host.append(span);
      this.pool.push({ span, main, sub: null });
    }
    shown.forEach((id, k) => {
      const entry = this.pool[k];
      const { span, main } = entry;
      const c = byId.get(id);
      if (!c) return;
      const [label, second] = text.get(id) ?? ['', ''];
      if (main.data !== label) main.data = label;
      if (second && !entry.sub) {
        entry.sub = document.createElement('span');
        entry.sub.className = 'atlas-label__sub';
        span.append(entry.sub);
      }
      if (entry.sub) {
        if (entry.sub.textContent !== second) entry.sub.textContent = second;
        entry.sub.hidden = !second;
      }
      span.classList.toggle('atlas-label--heading', !!second);
      const width = centred.has(id) ? `${Math.round(c.w)}px` : '';
      if (span.style.width !== width) span.style.width = width;
      span.dataset.id = id;
      span.classList.toggle('atlas-label--pinned', pinned.has(id));
      span.style.transform = `translate(${Math.round(c.x)}px, ${Math.round(c.y)}px)`;
      span.hidden = false;
    });
    for (let k = shown.length; k < this.pool.length; k++)
      this.pool[k].span.hidden = true;
    return shown;
  }

  destroy(): void {
    for (const { span } of this.pool) span.remove();
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
  h: number,
): [number, number] {
  switch (anchor) {
    case 'left':
      return [sx - edge - OFFSET - w, sy - h / 2];
    case 'above':
      return [sx - w / 2, sy - edge - OFFSET - h];
    case 'below':
      return [sx - w / 2, sy + edge + OFFSET];
    case 'center':
      return [sx - w / 2, sy - h / 2];
    default:
      return [sx + edge + OFFSET, sy - h / 2];
  }
}
