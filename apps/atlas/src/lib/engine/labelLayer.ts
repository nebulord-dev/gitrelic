// Mark labels as DOM text over the canvas, crisp at any zoom. The host is
// aria-hidden: hundreds of shifting spans would only be noise to a screen
// reader, which gets the inspector and detail table instead. Updated imperatively every
// frame from the store (no Svelte reactivity per label), with a pool of
// spans reused across frames. Text goes in through textContent only — labels
// are commit authors and file paths, never markup.

import { planLabels, type LabelCandidate, type Mark } from '@gitrelic/scene';

import { SHAPE_CODES } from './markStore';
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
/**
 * The narrowest an inside label wraps to, px. Past MIN_FIT its mark keeps
 * shrinking; the name runs past it whole rather than breaking mid-word.
 */
const MIN_WRAP = 120;
/** Gap between a mark's edge and its label, px. */
const OFFSET = 4;
/** Marks drawn fainter than this (fading, or a faint paint) go unlabelled. */
const MIN_ALPHA = 0.5;
/**
 * A card's text, laid out in world units (`.atlas-label--card` in app.css:
 * change both): the advance of a character of its lead, name and caption,
 * its side padding and the gap after the lead.
 */
const CARD_LEAD_CHAR = 21.6;
const CARD_NAME_CHAR = 9.9;
const CARD_SUB_CHAR = 7.7;
const CARD_PAD = 18;
const CARD_GAP = 14;

/** A pooled label: its line of text, then the optional quieter second line. */
interface LabelSpan {
  span: HTMLSpanElement;
  main: Text;
  /** Made the first time this span shows a second line. */
  sub: HTMLSpanElement | null;
  /** Made the first time this span shows a lead. */
  lead: HTMLSpanElement | null;
  /** The mark's `labelClass` it carries now, removed when the span moves on. */
  cls: string;
  /** The mark whose label it showed last frame, or null when hidden. */
  owner: string | null;
}

/** What a shown label draws: its lines, its class and which way it reads. */
interface LabelText {
  label: string;
  sub: string;
  lead: string;
  cls: string;
  anchor: Mark['labelAnchor'];
  /** A centred label's mark centre, screen px: CSS centres the real box on it. */
  centre: [number, number] | null;
  /** Px a centred label wraps within, from its mark's size; 0 for none. */
  maxWidth: number;
  /** How far an inside label is scaled down to fit its mark (1: not). */
  fit: number;
  /**
   * A card's box as laid out (CSS px) and the scale that brings it to the
   * card's size on screen; null for any other label.
   */
  card: { w: number; h: number; scale: number } | null;
  /** The mark's alpha, which a card's box shows (other labels don't). */
  alpha: number;
}

export class LabelLayer {
  private pool: LabelSpan[] = [];
  /** The labels shown last frame and their boxes, screen px, for `hit`. */
  private boxes: { id: string; x: number; y: number; w: number; h: number }[] =
    [];

  constructor(private readonly host: HTMLElement) {}

  update(
    store: MarkStore,
    view: ViewTransform,
    screen: ScreenSize,
    pinned: ReadonlySet<string>,
    selected: string | null = null,
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
      const alpha = store.alpha[i] * store.opacity[i];
      const lead = mark.labelLead ?? '';
      // A centred label on a card with a size is the card: a box laid out at
      // the card's world size, its text in world units, scaled with the view
      // (and further, box and all, when the text would outgrow it), so it
      // covers the card exactly at any zoom. At no size (the ring's view
      // names, or a card morphing into one) it is a plain centred label.
      if (
        store.shape[i] === SHAPE_CODES.card &&
        mark.labelAnchor === 'center' &&
        store.w[i] * view.scale >= 1 &&
        store.h[i] * view.scale >= 1
      ) {
        const w = store.w[i];
        const h = store.h[i];
        const sub = mark.labelSub ?? '';
        const content =
          2 * CARD_PAD +
          (lead ? lead.length * CARD_LEAD_CHAR + CARD_GAP : 0) +
          Math.max(
            mark.label.length * CARD_NAME_CHAR,
            sub.length * CARD_SUB_CHAR,
          );
        const k = Math.min(1, w / content);
        const sw = w * view.scale;
        const shh = h * view.scale;
        candidates.push({
          id: mark.id,
          x: sx - sw / 2,
          y: sy - shh / 2,
          w: sw,
          h: shh,
          priority: mark.labelPriority ?? 0,
        });
        text.set(mark.id, {
          label: mark.label,
          sub,
          lead,
          cls: mark.labelClass ?? '',
          anchor: 'center',
          centre: [sx, sy],
          maxWidth: 0,
          fit: 1,
          card: { w: w / k, h: h / k, scale: view.scale * k },
          alpha,
        });
        continue;
      }
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
      const maxWidth = inside ? Math.round(Math.max(room, MIN_WRAP) / fit) : 0;
      // A label with a second line is a heading: both lines are one
      // candidate, so they're shown or culled together.
      // A lead, beside a card's lines, runs before an ordinary label's.
      const w =
        (sub
          ? Math.max(mark.label.length * HEAD_CHAR_PX, sub.length * CHAR_PX) + 4
          : mark.label.length * CHAR_PX + 4) +
        (lead ? (lead.length + 1) * CHAR_PX : 0);
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
        lead,
        cls: mark.labelClass ?? '',
        anchor: mark.labelAnchor,
        centre: mark.labelAnchor === 'center' ? [sx, sy] : null,
        maxWidth,
        fit,
        card: null,
        alpha,
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
    this.boxes = shown.flatMap((id) => {
      const c = byId.get(id);
      return c ? [{ id, x: c.x, y: c.y, w: c.w, h: c.h }] : [];
    });

    // A label shown last frame keeps its span, so a CSS transition on it (a
    // card's fill moving to another card) runs on its own box, never from
    // another mark's. New labels take spare spans, hidden ones first.
    const showing = new Set(shown);
    const entries = new Map<string, LabelSpan>();
    for (const entry of this.pool)
      if (entry.owner !== null && showing.has(entry.owner))
        entries.set(entry.owner, entry);
    const used = new Set(entries.values());
    const spare = this.pool
      .filter((e) => !used.has(e))
      .sort((a, b) => Number(!a.span.hidden) - Number(!b.span.hidden));
    for (const id of shown) {
      if (entries.has(id)) continue;
      let entry = spare.shift();
      if (!entry) {
        const span = document.createElement('span');
        span.className = 'atlas-label';
        const main = document.createTextNode('');
        span.append(main);
        this.host.append(span);
        entry = { span, main, sub: null, lead: null, cls: '', owner: null };
        this.pool.push(entry);
      }
      entries.set(id, entry);
    }
    for (const entry of this.pool) entry.owner = null;
    for (const [id, entry] of entries) entry.owner = id;
    for (const id of shown) {
      const entry = entries.get(id)!;
      const { span, main } = entry;
      const c = byId.get(id);
      if (!c) continue;
      const t = text.get(id);
      if (!t) continue;
      const {
        label,
        sub: second,
        lead,
        cls,
        anchor,
        centre,
        maxWidth,
        fit,
      } = t;
      const card = t.card;
      if (main.data !== label) main.data = label;
      if (lead && !entry.lead) {
        entry.lead = document.createElement('span');
        entry.lead.className = 'atlas-label__lead';
        span.prepend(entry.lead);
      }
      if (entry.lead) {
        if (entry.lead.textContent !== lead) entry.lead.textContent = lead;
        entry.lead.hidden = !lead;
      }
      if (second && !entry.sub) {
        entry.sub = document.createElement('span');
        entry.sub.className = 'atlas-label__sub';
        span.append(entry.sub);
      }
      if (entry.sub) {
        if (entry.sub.textContent !== second) entry.sub.textContent = second;
        entry.sub.hidden = !second;
      }
      // A card styles its own lines; the rest of these are for labels.
      span.classList.toggle('atlas-label--card', !!card);
      span.classList.toggle('atlas-label--heading', !!second && !card);
      // Two lines read toward their mark: flush right left of it, flush left
      // right of it (above, below and centred stay centred).
      span.classList.toggle('atlas-label--left', anchor === 'left');
      // Centred on its mark by CSS, at its real size: a label class may set
      // a larger font than the estimate the culling placed it with.
      span.classList.toggle(
        'atlas-label--center',
        anchor === 'center' && !card,
      );
      span.classList.toggle(
        'atlas-label--right',
        !!second && (anchor ?? 'right') === 'right',
      );
      span.classList.toggle('atlas-label--selected', id === selected);
      if (entry.cls !== cls) {
        if (entry.cls) span.classList.remove(entry.cls);
        if (cls) span.classList.add(cls);
        entry.cls = cls;
      }
      const max = maxWidth > 0 ? `${maxWidth}px` : '';
      if (span.style.maxWidth !== max) span.style.maxWidth = max;
      const width = card
        ? `${Math.round(card.w)}px`
        : sized.has(id)
          ? `${Math.round(c.w)}px`
          : '';
      if (span.style.width !== width) span.style.width = width;
      const height = card ? `${Math.round(card.h)}px` : '';
      if (span.style.height !== height) span.style.height = height;
      // A card's box shows its mark's alpha (a dimmed view while a lens is
      // previewed); a label stays at full strength until it's culled.
      const opacity = card && t.alpha < 1 ? String(+t.alpha.toFixed(2)) : '';
      if (span.style.opacity !== opacity) span.style.opacity = opacity;
      span.dataset.id = id;
      span.classList.toggle('atlas-label--pinned', pinned.has(id));
      const [x, y] = centre ?? [c.x, c.y];
      // A centred label's box is centred on the point (and scaled about its
      // own centre, which the default transform-origin keeps in place).
      span.style.transform =
        `translate(${Math.round(x)}px, ${Math.round(y)}px)` +
        (centre ? ' translate(-50%, -50%)' : '') +
        (card
          ? ` scale(${card.scale.toFixed(3)})`
          : fit < 1
            ? ` scale(${fit.toFixed(3)})`
            : '');
      span.hidden = false;
    }
    for (const entry of this.pool)
      if (entry.owner === null) entry.span.hidden = true;
    return shown;
  }

  /**
   * The mark whose shown label covers a screen point, or null. The layer
   * takes no pointer events (the canvas under it must pan and zoom), so the
   * stage asks it after the marks: a name is as clickable as its mark.
   */
  hit(sx: number, sy: number): string | null {
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h)
        return b.id;
    }
    return null;
  }

  destroy(): void {
    this.boxes = [];
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
