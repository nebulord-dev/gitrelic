import { describe, expect, it } from 'vitest';

import { MarkStore } from './markStore';
import { placeTip, TooltipLayer } from './tooltipLayer';
import { IDENTITY } from './viewport';
import type { Mark } from '@gitrelic/scene';

const mark = (id: string, tip?: string[]): Mark => ({
  id,
  shape: 'dot',
  paint: '--file',
  x: 50,
  y: 40,
  r: 4,
  w: 0,
  h: 0,
  a0: 0,
  a1: 0,
  alpha: 1,
  tip,
});

const screen = { width: 400, height: 300 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const put = (store: MarkStore, m: Mark) => store.upsert(m, m, WHITE);

describe('TooltipLayer', () => {
  it('shows the hovered mark’s tip as text, title first, and hides without one', () => {
    const host = document.createElement('div');
    const layer = new TooltipLayer(host);
    const store = new MarkStore();
    put(store, mark('file:a.ts', ['a.ts', 'Score 90', '<b>not markup</b>']));
    put(store, mark('file:b.ts'));
    const card = host.querySelector('.atlas-tip') as HTMLElement;

    layer.update(store, IDENTITY, screen, 'file:a.ts');
    expect(card.hidden).toBe(false);
    expect(card.querySelector('.atlas-tip__title')?.textContent).toBe('a.ts');
    expect(card.querySelectorAll('.atlas-tip__line')).toHaveLength(2);
    expect(card.querySelector('b')).toBeNull();
    expect(card.textContent).toContain('<b>not markup</b>');

    layer.update(store, IDENTITY, screen, 'file:b.ts');
    expect(card.hidden).toBe(true);
    layer.update(store, IDENTITY, screen, null);
    expect(card.hidden).toBe(true);
  });

  it('sits beside the mark, inside the stage', () => {
    const host = document.createElement('div');
    const layer = new TooltipLayer(host);
    const store = new MarkStore();
    put(store, mark('file:a.ts', ['a.ts']));
    layer.update(store, IDENTITY, screen, 'file:a.ts');
    const card = host.querySelector('.atlas-tip') as HTMLElement;
    const [, x, y] = card.style.transform.match(
      /translate\((-?\d+)px, (-?\d+)px\)/,
    )!;
    expect(Number(x)).toBeGreaterThan(50);
    expect(Number(y)).toBeGreaterThanOrEqual(8);
  });

  it('goes across the mark from its label, so the label stays readable', () => {
    const scr = { width: 800, height: 600 };
    // Mark at (400, 300), 10px radius, card 200 × 60.
    const at = (label: Parameters<typeof placeTip>[0]) =>
      placeTip(label, 400, 300, 10, 200, 60, scr);
    expect(at('right')[0]).toBeLessThan(400 - 200); // card left of the mark
    expect(at('left')[0]).toBeGreaterThan(400); // card right of it
    expect(at(null)[0]).toBeGreaterThan(400);
    expect(at('above')[1]).toBeGreaterThan(300); // below
    expect(at('below')[1]).toBeLessThan(300 - 60); // above
    expect(at('center')[1]).toBeGreaterThan(300);
  });

  it('flips when its side would run off the stage, and stays inside', () => {
    const scr = { width: 800, height: 600 };
    // Label on the right of a mark near the left edge: no room on the left.
    const [x] = placeTip('right', 30, 300, 10, 200, 60, scr);
    expect(x).toBeGreaterThan(30);
    const [, y] = placeTip('above', 400, 580, 10, 200, 60, scr);
    expect(y).toBeLessThanOrEqual(600 - 60 - 8);
  });

  it('measures the card once per change of text, not every frame', () => {
    const host = document.createElement('div');
    const layer = new TooltipLayer(host);
    const store = new MarkStore();
    put(store, mark('file:a.ts', ['a.ts']));
    const card = host.querySelector('.atlas-tip') as HTMLElement;
    let reads = 0;
    Object.defineProperty(card, 'offsetWidth', {
      get: () => (reads++, 120),
    });
    layer.update(store, IDENTITY, screen, 'file:a.ts');
    layer.update(store, IDENTITY, screen, 'file:a.ts');
    layer.update(store, { ...IDENTITY, tx: 30 }, screen, 'file:a.ts');
    expect(reads).toBe(1);
    put(store, mark('file:a.ts', ['a.ts', 'new line']));
    layer.update(store, IDENTITY, screen, 'file:a.ts');
    expect(reads).toBe(2);
  });
});
