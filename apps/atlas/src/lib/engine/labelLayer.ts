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
const HEAD_H = 16;
/** A heading's second line. */
const SUB_H = 14;
/** How much of its mark's width a centred label may wrap within. */
const INSIDE = 0.9;
/**
 * An inside label's second line is set larger than CHAR_PX allows for (12px,
 * `.atlas-label--repo .atlas-label__sub`) and never wraps.
 */
const INSIDE_SUB_CHAR_PX = 7.1;
/**
 * An inside label shrinks with its mark below the zoom it was set for, down
 * to this; past it, it drops its second line and keeps full size.
 */
const MIN_FIT = 0.7;
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
  /** The mark's `labelClass` it carries now, removed when the span moves on. */
  cls: string;
}

/** What a shown label draws: its lines, its class and which way it reads. */
interface LabelText {
  label: string;
  sub: string;
  cls: string;
  anchor: Mark['labelAnchor'];
  /** A centred label's mark centre, screen px: CSS centres the real box on it. */
  centre: [number, number] | null;
  /** Px a centred label wraps within, from its mark's size; 0 for none. */
  maxWidth: number;
  /** How far an inside label is scaled down to fit its mark (1: not). */
  fit: number;
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
    const text = new Map<string, LabelText>();
    // Labels above, below or left of their mark get the width they were
    // placed with, so the text centres (or right-aligns) in it: the width is
    // an estimate, and a shrink-wrapped span would drift off its mark
    // wherever the text runs narrower. Centred labels shrink-wrap and CSS
    // centres them.
    const sized = new Set<string>();
    for (let i = 0; i < store.count; i++) {
      const mark = store.marks[i];
      if (!mark.label || store.alpha[i] * store.opacity[i] < MIN_ALPHA)
        continue;
      const [sx, sy] = worldToScreen(view, store.x[i], store.y[i]);
      const edge = (store.r[i] || store.w[i] / 2) * view.scale;
      // A label inside its mark (centred on one with a size) wraps within the
      // mark. The mark shrinks with the zoom and text doesn't, so the label
      // scales down until its one-line second line fits; when that would make
      // it too small to read, it drops the second line instead.
      const inside = mark.labelAnchor === 'center' && edge > 0;
      const room = inside ? 2 * edge * INSIDE : 0;
      let sub = mark.labelSub ?? '';
      let fit = 1;
      if (inside && sub) {
        fit = Math.min(1, room / (sub.length * INSIDE_SUB_CHAR_PX));
        if (fit < MIN_FIT) {
          sub = '';
          fit = 1;
        }
      }
      // The wrap width before scaling, so the scaled label wraps at `room`.
      const maxWidth = inside ? Math.round(room / fit) : 0;
      // A label with a second line is a heading: both lines are one
      // candidate, so they're shown or culled together.
      const w = sub
        ? Math.max(mark.label.length * HEAD_CHAR_PX, sub.length * CHAR_PX) + 4
        : mark.label.length * CHAR_PX + 4;
      const h = sub ? HEAD_H + SUB_H : LABEL_H;
      const [x, placedY] = place(mark.labelAnchor, sx, sy, edge, w, h);
      const y = placedY + (mark.labelLean ?? 0) * h;
      candidates.push({
        id: mark.id,
        x,
        y,
        w,
        h,
        priority: mark.labelPriority ?? 0,
      });
      text.set(mark.id, {
        label: mark.label,
        sub,
        cls: mark.labelClass ?? '',
        anchor: mark.labelAnchor,
        centre: mark.labelAnchor === 'center' ? [sx, sy] : null,
        maxWidth,
        fit,
      });
      if (
        mark.labelAnchor === 'left' ||
        mark.labelAnchor === 'above' ||
        mark.labelAnchor === 'below'
      )
        sized.add(mark.id);
    }
    const shown = planLabels(candidates, { pinned, view: screen });
    const byId = new Map(candidates.map((c) => [c.id, c]));

    while (this.pool.length < shown.length) {
      const span = document.createElement('span');
      span.className = 'atlas-label';
      const main = document.createTextNode('');
      span.append(main);
      this.host.append(span);
      this.pool.push({ span, main, sub: null, cls: '' });
    }
    shown.forEach((id, k) => {
      const entry = this.pool[k];
      const { span, main } = entry;
      const c = byId.get(id);
      if (!c) return;
      const t = text.get(id);
      if (!t) return;
      const { label, sub: second, cls, anchor, centre, maxWidth, fit } = t;
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
      // Two lines read toward their mark: flush right left of it, flush left
      // right of it (above, below and centred stay centred).
      span.classList.toggle('atlas-label--left', anchor === 'left');
      // Centred on its mark by CSS, at its real size: a label class may set
      // a larger font than the estimate the culling placed it with.
      span.classList.toggle('atlas-label--center', anchor === 'center');
      span.classList.toggle(
        'atlas-label--right',
        !!second && (anchor ?? 'right') === 'right',
      );
      if (entry.cls !== cls) {
        if (entry.cls) span.classList.remove(entry.cls);
        if (cls) span.classList.add(cls);
        entry.cls = cls;
      }
      const max = maxWidth > 0 ? `${maxWidth}px` : '';
      if (span.style.maxWidth !== max) span.style.maxWidth = max;
      const width = sized.has(id) ? `${Math.round(c.w)}px` : '';
      if (span.style.width !== width) span.style.width = width;
      span.dataset.id = id;
      span.classList.toggle('atlas-label--pinned', pinned.has(id));
      const [x, y] = centre ?? [c.x, c.y];
      // A centred label's box is centred on the point (and scaled about its
      // own centre, which the default transform-origin keeps in place).
      span.style.transform =
        `translate(${Math.round(x)}px, ${Math.round(y)}px)` +
        (centre ? ' translate(-50%, -50%)' : '') +
        (fit < 1 ? ` scale(${fit.toFixed(3)})` : '');
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
