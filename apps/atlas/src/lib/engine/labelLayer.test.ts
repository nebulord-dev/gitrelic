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
    // A heading: 30px tall, as wide as the longer line (19 × 6.5 + 4).
    expect(span.classList.contains('atlas-label--heading')).toBe(true);
    expect(span.style.transform).toBe('translate(36px, 61px)');
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

  it("adds a mark's labelClass, and drops it when the span is reused", () => {
    const host = document.createElement('div');
    const layer = new LabelLayer(host);
    layer.update(
      store({ label: 'Bus Factor', labelClass: 'atlas-label--hot' }),
      IDENTITY,
      screen,
      new Set(),
    );
    expect(spans(host)[0].classList.contains('atlas-label--hot')).toBe(true);
    layer.update(store({ label: 'Coupling' }), IDENTITY, screen, new Set());
    expect(spans(host)[0].classList.contains('atlas-label--hot')).toBe(false);
  });

  it('wraps a centred label within its mark, and only then', () => {
    const host = document.createElement('div');
    const layer = new LabelLayer(host);
    layer.update(
      store(
        {
          label: 'a-very-long-repository-name',
          labelAnchor: 'center',
          r: 50,
        },
        { label: 'CODE HEALTH', labelAnchor: 'center', r: 0, y: 300 },
        { label: 'Ann', r: 50, y: 500 },
      ),
      IDENTITY,
      screen,
      new Set(),
    );
    const [repo, group, beside] = spans(host);
    // 0.9 × 2r = 90px, but never narrower than MIN_WRAP.
    expect(repo.style.maxWidth).toBe('120px');
    expect(group.style.maxWidth).toBe('');
    expect(beside.style.maxWidth).toBe('');
  });

  it('shrinks an inside label to fit its mark, then drops its second line', () => {
    const host = document.createElement('div');
    const layer = new LabelLayer(host);
    const centre = (r: number) =>
      store({
        label: 'react',
        labelSub: '7,009 files',
        labelAnchor: 'center',
        r,
      });
    const span = () => spans(host)[0];
    const sub = () => span().querySelector('.atlas-label__sub') as HTMLElement;
    // 11 × 7.1 = 78.1px of text (set at 12px) in 0.9 × 2r = 81px: full size.
    layer.update(centre(45), IDENTITY, screen, new Set());
    expect(sub().textContent).toBe('7,009 files');
    expect(span().style.transform).toBe(
      'translate(100px, 100px) translate(-50%, -50%)',
    );
    // 72px of room: scaled to 72 / 78.1, wrapping at the unscaled width.
    layer.update(centre(40), IDENTITY, screen, new Set());
    expect(sub().hidden).toBe(false);
    expect(span().style.transform).toBe(
      'translate(100px, 100px) translate(-50%, -50%) scale(0.922)',
    );
    expect(span().style.maxWidth).toBe('130px'); // 120 / 0.922
    // 45px of room would need 0.58: too small to read, so the second line
    // goes and the name keeps full size.
    layer.update(centre(25), IDENTITY, screen, new Set());
    expect(sub().hidden).toBe(true);
    expect(span().firstChild!.textContent).toBe('react');
    expect(span().style.transform).not.toContain('scale');
    // However small the mark gets, the name wraps no narrower than 120px,
    // so it never breaks mid-word.
    layer.update(centre(2), IDENTITY, screen, new Set());
    expect(span().style.maxWidth).toBe('120px');
  });

  describe('a card (a centred label on a card mark with a size)', () => {
    const card = (extra: Partial<Mark> = {}) =>
      store({
        id: 'view:code-health',
        shape: 'card',
        x: 200,
        y: 100,
        r: 0,
        w: 260,
        h: 84,
        labelLead: '8',
        label: 'Code Health',
        labelSub: 'files',
        labelAnchor: 'center',
        ...extra,
      });
    const half = { scale: 0.5, tx: 0, ty: 0 };

    it('is drawn as a box the card’s size on screen, its number set apart', () => {
      const host = document.createElement('div');
      new LabelLayer(host).update(card(), half, screen, new Set());
      const [span] = spans(host);
      expect(span.classList.contains('atlas-label--card')).toBe(true);
      // Laid out at the card's world size, scaled with the view: 130 × 42
      // on screen, centred on the card.
      expect(span.style.width).toBe('260px');
      expect(span.style.height).toBe('84px');
      expect(span.style.maxWidth).toBe('');
      expect(span.style.transform).toBe(
        'translate(100px, 50px) translate(-50%, -50%) scale(0.500)',
      );
      // Not the inside-a-circle label: no wrapping, nothing dropped.
      expect(span.classList.contains('atlas-label--center')).toBe(false);
      expect(span.classList.contains('atlas-label--heading')).toBe(false);
      const lead = span.querySelector('.atlas-label__lead') as HTMLElement;
      expect(lead.textContent).toBe('8');
      expect(lead.hidden).toBe(false);
      expect(span.querySelector('.atlas-label__sub')!.textContent).toBe(
        'files',
      );
      expect(span.textContent).toBe('8Code Healthfiles');
      expect(span.querySelectorAll('*')).toHaveLength(2);
    });

    it('scales its text down, box and all, when the text outgrows the card', () => {
      const host = document.createElement('div');
      new LabelLayer(host).update(
        card({ labelLead: '12,345', label: 'Ownership & Risk' }),
        half,
        screen,
        new Set(),
      );
      const [span] = spans(host);
      const k = Number(/scale\(([\d.]+)\)/.exec(span.style.transform)![1]);
      expect(k).toBeLessThan(0.5);
      // Still the card's size on screen.
      expect(parseFloat(span.style.width) * k).toBeCloseTo(130, 0);
      expect(parseFloat(span.style.height) * k).toBeCloseTo(42, 0);
    });

    it('shows a dimmed card dimmed, and the selected one selected', () => {
      const host = document.createElement('div');
      const layer = new LabelLayer(host);
      layer.update(
        card({ alpha: 0.6 }),
        half,
        screen,
        new Set(['view:code-health']),
        'view:code-health',
      );
      const [span] = spans(host);
      expect(span.style.opacity).toBe('0.6');
      expect(span.classList.contains('atlas-label--selected')).toBe(true);
      layer.update(card(), half, screen, new Set(), null);
      expect(span.style.opacity).toBe('');
      expect(span.classList.contains('atlas-label--selected')).toBe(false);
    });

    it('collapses to a plain label at no size (the ring’s view names)', () => {
      const host = document.createElement('div');
      const layer = new LabelLayer(host);
      layer.update(card(), half, screen, new Set());
      layer.update(
        card({ w: 0, h: 0, labelLead: undefined, labelSub: undefined }),
        half,
        screen,
        new Set(),
      );
      const [span] = spans(host);
      expect(span.classList.contains('atlas-label--card')).toBe(false);
      expect(span.classList.contains('atlas-label--center')).toBe(true);
      expect(span.style.width).toBe('');
      expect(span.style.height).toBe('');
      expect(
        (span.querySelector('.atlas-label__lead') as HTMLElement).hidden,
      ).toBe(true);
      expect(span.style.transform).toBe(
        'translate(100px, 50px) translate(-50%, -50%)',
      );
    });
  });

  it('leans a label by a fraction of its height', () => {
    const host = document.createElement('div');
    new LabelLayer(host).update(
      store({ label: 'Stale', labelSub: '4,644 untouched', labelLean: -0.5 }),
      IDENTITY,
      screen,
      new Set(),
    );
    // Centred on the mark (100 − 30 / 2 = 85), then up half of 30.
    expect(spans(host)[0].style.transform).toBe('translate(109px, 70px)');
  });

  it('aligns a label toward its mark', () => {
    const host = document.createElement('div');
    const layer = new LabelLayer(host);
    layer.update(
      store(
        { label: 'Churn', labelSub: '33 commits', labelAnchor: 'left' },
        { label: 'Shame', labelSub: '173 scored 70+' },
        { label: 'Blast', labelSub: '143', labelAnchor: 'above', y: 300 },
      ),
      IDENTITY,
      screen,
      new Set(),
    );
    const [left, right, above] = spans(host);
    expect(left.classList.contains('atlas-label--left')).toBe(true);
    // Sized like a centred label, so the right edge sits at the mark.
    expect(left.style.width).not.toBe('');
    expect(right.classList.contains('atlas-label--right')).toBe(true);
    expect(above.classList.contains('atlas-label--left')).toBe(false);
    expect(above.classList.contains('atlas-label--right')).toBe(false);
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
    ['center', 'translate(100px, 100px) translate(-50%, -50%)'],
  ] as const)('anchors a label %s of its mark', (labelAnchor, transform) => {
    const host = document.createElement('div');
    new LabelLayer(host).update(
      store({ label: 'Ann', labelAnchor }),
      IDENTITY,
      screen,
      new Set(),
    );
    expect(spans(host)[0].style.transform).toBe(transform);
    // Labels beside or over the mark span their placed width, so the text
    // centres in it, or ends at the mark. A centred one sits at the mark's
    // centre and CSS centres its real box there.
    const span = spans(host)[0];
    expect(span.style.width).toBe(labelAnchor === 'center' ? '' : '24px');
    expect(span.classList.contains('atlas-label--center')).toBe(
      labelAnchor === 'center',
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
