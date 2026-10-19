import { describe, expect, it } from 'vitest';

import { LabelLayer } from './labelLayer';
import { MarkStore } from './markStore';
import { IDENTITY } from './viewport';
import type { Mark, Rgba } from '@gitrelic/scene';

const grey: Rgba = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
const screen = { width: 800, height: 600 };

function store(...marks: Partial<Mark>[]): MarkStore {
  const s = new MarkStore();
  marks.forEach((extra, i) => {
    const m: Mark = {
      id: `person:${i}`,
      shape: 'dot',
      paint: '--person',
      x: 100,
      y: 100 + i * 50,
      r: 5,
      w: 0,
      h: 0,
      a0: 0,
      a1: 0,
      alpha: 1,
      ...extra,
    };
    s.upsert(m, m, grey);
  });
  return s;
}

const spans = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLSpanElement>('.atlas-label')].filter(
    (s) => !s.hidden,
  );

describe('LabelLayer', () => {
  it('draws a second, quieter line under a label, placed as one', () => {
    const host = document.createElement('div');
    const layer = new LabelLayer(host);
    layer.update(
      store({
        label: 'shared',
        labelSub: '22 files · 7 at 25+',
        labelAnchor: 'above',
      }),
      IDENTITY,
      screen,
      new Set(),
    );
    const [span] = spans(host);
    const sub = span.querySelector('.atlas-label__sub')!;
    expect(span.firstChild!.textContent).toBe('shared');
    expect(sub.textContent).toBe('22 files · 7 at 25+');
    // A heading: 34px tall, as wide as the longer line (19 × 6.5 + 4).
    expect(span.classList.contains('atlas-label--heading')).toBe(true);
    expect(span.style.transform).toBe('translate(36px, 57px)');
    // Reused for a one-line label, the second line hides.
    layer.update(store({ label: 'Ann' }), IDENTITY, screen, new Set());
    expect(spans(host)[0].textContent).toBe('Ann');
    expect(spans(host)[0].classList.contains('atlas-label--heading')).toBe(
      false,
    );
    expect(
      (spans(host)[0].querySelector('.atlas-label__sub') as HTMLElement).hidden,
    ).toBe(true);
  });

  it('places labels beside their marks, as text', () => {
    const host = document.createElement('div');
    const layer = new LabelLayer(host);
    layer.update(store({ label: '<b>Ann</b>' }), IDENTITY, screen, new Set());
    const [span] = spans(host);
    expect(span.textContent).toBe('<b>Ann</b>');
    expect(span.children).toHaveLength(0);
    expect(span.style.transform).toBe('translate(109px, 92px)');
  });

  it.each([
    ['left', 'translate(68px, 92px)'],
    ['above', 'translate(88px, 75px)'],
    ['below', 'translate(88px, 109px)'],
    ['center', 'translate(88px, 92px)'],
  ] as const)('anchors a label %s of its mark', (labelAnchor, transform) => {
    const host = document.createElement('div');
    new LabelLayer(host).update(
      store({ label: 'Ann', labelAnchor }),
      IDENTITY,
      screen,
      new Set(),
    );
    expect(spans(host)[0].style.transform).toBe(transform);
    // Centred labels span their placed width, so the text centres in it.
    expect(spans(host)[0].style.width).toBe(
      labelAnchor === 'left' ? '' : '24px',
    );
  });

  it('skips unlabelled and fading marks', () => {
    const host = document.createElement('div');
    new LabelLayer(host).update(
      store({ label: 'a' }, {}, { label: 'c', alpha: 0.2 }),
      IDENTITY,
      screen,
      new Set(),
    );
    expect(spans(host).map((s) => s.textContent)).toEqual(['a']);
  });

  it('skips marks whose paint is too faint to see', () => {
    const host = document.createElement('div');
    const s = store({ label: 'ghost' });
    s.opacity[0] = 0.3;
    new LabelLayer(host).update(s, IDENTITY, screen, new Set());
    expect(spans(host)).toHaveLength(0);
  });

  it('keeps the higher-priority label when two collide', () => {
    const host = document.createElement('div');
    new LabelLayer(host).update(
      store(
        { label: 'low', y: 100 },
        { label: 'high', y: 104, labelPriority: 5 },
      ),
      IDENTITY,
      screen,
      new Set(),
    );
    expect(spans(host).map((s) => s.textContent)).toEqual(['high']);
  });

  it('always shows and marks the pinned label', () => {
    const host = document.createElement('div');
    new LabelLayer(host).update(
      store(
        { label: 'low', y: 100 },
        { label: 'high', y: 104, labelPriority: 5 },
      ),
      IDENTITY,
      screen,
      new Set(['person:0']),
    );
    const shown = spans(host);
    expect(shown[0].textContent).toBe('low');
    expect(shown[0].classList.contains('atlas-label--pinned')).toBe(true);
  });

  it('reuses its spans across frames and hides the spare ones', () => {
    const host = document.createElement('div');
    const layer = new LabelLayer(host);
    layer.update(
      store({ label: 'a' }, { label: 'b' }),
      IDENTITY,
      screen,
      new Set(),
    );
    layer.update(store({ label: 'a' }), IDENTITY, screen, new Set());
    expect(host.querySelectorAll('span')).toHaveLength(2);
    expect(spans(host)).toHaveLength(1);
    layer.destroy();
    expect(host.querySelectorAll('span')).toHaveLength(0);
  });
});
