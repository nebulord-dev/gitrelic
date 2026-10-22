import { describe, expect, it } from 'vitest';

import { parallelReport } from '../../test/parallelReport';
import { ids } from '../ids';
import { checkScene } from '../model';
import { parallelPairs } from '../parallel/pairs';
import { pairsScene } from './pairs';

const VIEWPORT = { width: 1200, height: 800 };
const data = parallelPairs(parallelReport());
const scene = pairsScene(data, VIEWPORT);
const mark = (email: string) =>
  scene.marks.find((m) => m.id === ids.person(email))!;

describe('pairsScene', () => {
  it('is a sound scene', () => {
    expect(checkScene(scene)).toEqual([]);
  });

  it('seats people on an ellipse as person: marks, sized and coloured', () => {
    const at = data.people.map((p) => mark(p.email));
    const cx = VIEWPORT.width / 2;
    const cy = VIEWPORT.height / 2 + 10;
    const ry = VIEWPORT.height / 2 - 100;
    const rx = ry * 1.45;
    for (const m of at)
      expect(((m.x - cx) / rx) ** 2 + ((m.y - cy) / ry) ** 2).toBeCloseTo(1, 6);
    expect(mark('bob@x').r).toBeGreaterThan(mark('dee@x').r);
    expect(mark('bob@x').paint).toBe('--risk-2');
    expect(mark('bob@x').tip).toEqual([
      'bob',
      '2 partners · gone',
      'Weeks on the same files: ann (3), cy (2)',
    ]);
  });

  it('joins pairs with chords bowed toward the centre, as wide as their weeks', () => {
    const chord = (a: string, b: string) =>
      scene.links.find(
        (l) => l.source === ids.person(a) && l.target === ids.person(b),
      )!;
    const strong = chord('ann@x', 'bob@x');
    const weak = chord('cy@x', 'dee@x');
    expect(strong.width).toBeGreaterThan(weak.width);
    expect(strong.curve).toBe('arc');
    expect(strong.tip).toEqual([
      'ann + bob',
      '3 weeks on the same files',
      'flags.js, flags.www.js, flags.native.js',
    ]);
    // The control point lands on the centre's side of every chord.
    const cx = VIEWPORT.width / 2;
    const cy = VIEWPORT.height / 2 + 10;
    for (const l of scene.links) {
      const a = scene.marks.find((m) => m.id === l.source)!;
      const b = scene.marks.find((m) => m.id === l.target)!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      const toCentre =
        nx * (cx - (a.x + b.x) / 2) + ny * (cy - (a.y + b.y) / 2);
      expect(Math.sign(l.bow!)).toBe(Math.sign(toCentre));
    }
    expect(scene.hoverLinks).toBe(true);
  });

  it('lights a selected person’s chords and dims the people they never met', () => {
    const focused = pairsScene(data, VIEWPORT, { focus: ids.person('cy@x') });
    expect(checkScene(focused)).toEqual([]);
    expect(focused.marks.map((m) => m.id)).toEqual(
      scene.marks.map((m) => m.id),
    );
    const lit = focused.links.filter((l) => l.paint === '--accent');
    expect(lit).toHaveLength(2);
    const ann = focused.marks.find((m) => m.id === ids.person('ann@x'))!;
    expect(ann.alpha).toBeLessThan(0.95);
    expect(ann.alpha).toBeGreaterThan(0.5);
    const bob = focused.marks.find((m) => m.id === ids.person('bob@x'))!;
    expect(bob.labelSub).toBe('2 weeks with cy');
  });

  it('says so when nobody collided, and what was left out', () => {
    const empty = pairsScene(parallelPairs(parallelReport([])), VIEWPORT);
    expect(checkScene(empty)).toEqual([]);
    expect(empty.marks[0]).toMatchObject({
      label: 'No two people committed to the same file in the same week',
      labelSub: '3 sweeping commits and 1 bot commit were left out.',
    });
  });
});
