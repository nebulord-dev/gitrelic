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
  [...host.querySelectorAll('span')].filter((s) => !s.hidden);

describe('LabelLayer', () => {
  it('places labels beside their marks, as text', () => {
    const host = document.createElement('div');
    const layer = new LabelLayer(host);
    layer.update(store({ label: '<b>Ann</b>' }), IDENTITY, screen, new Set());
    const [span] = spans(host);
    expect(span.textContent).toBe('<b>Ann</b>');
    expect(span.children).toHaveLength(0);
    expect(span.style.transform).toBe('translate(109px, 92px)');
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
