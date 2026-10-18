import { describe, expect, it } from 'vitest';

import { MarkStore } from './markStore';
import type { Mark, MarkGeom, Rgba } from '@gitrelic/scene';

const geom = (x: number): MarkGeom => ({
  x,
  y: x + 1,
  r: 4,
  w: 0,
  h: 0,
  a0: 0,
  a1: 0,
  alpha: 1,
});
const mark = (id: string, x = 0): Mark => ({
  id,
  shape: 'dot',
  paint: '--file',
  ...geom(x),
});
const grey: Rgba = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

describe('MarkStore', () => {
  it('adds marks into consecutive slots', () => {
    const s = new MarkStore();
    expect(s.upsert(mark('a'), geom(1), grey)).toBe(0);
    expect(s.upsert(mark('b'), geom(2), grey)).toBe(1);
    expect(s.count).toBe(2);
    expect(s.x[1]).toBe(2);
    expect(s.indexOf('b')).toBe(1);
  });

  it('updates data on re-upsert but leaves the in-flight geometry alone', () => {
    const s = new MarkStore();
    s.upsert(mark('a'), geom(1), grey);
    const v = s.version;
    s.upsert({ ...mark('a'), shape: 'ring', label: 'A' }, geom(99), grey);
    expect(s.x[0]).toBe(1);
    expect(s.marks[0].label).toBe('A');
    expect(s.shape[0]).toBe(1);
    expect(s.version).toBe(v);
  });

  it('swap-removes and keeps the id → slot map right', () => {
    const s = new MarkStore();
    for (const id of ['a', 'b', 'c'])
      s.upsert(mark(id), geom(id.charCodeAt(0)), grey);
    s.remove('a');
    expect(s.count).toBe(2);
    expect(s.indexOf('a')).toBe(-1);
    expect(s.indexOf('c')).toBe(0);
    expect(s.x[0]).toBe('c'.charCodeAt(0));
    expect(s.marks.map((m) => m.id)).toEqual(['c', 'b']);
    s.remove('b');
    s.remove('nope');
    expect(s.marks.map((m) => m.id)).toEqual(['c']);
  });

  it('grows past its initial capacity without losing data', () => {
    const s = new MarkStore();
    const start = s.capacity;
    for (let i = 0; i <= start; i++) s.upsert(mark(`m${i}`), geom(i), grey);
    expect(s.capacity).toBeGreaterThan(start);
    expect(s.x[start]).toBe(start);
    expect(s.x[3]).toBe(3);
    expect(s.red[3]).toBe(0.5);
  });

  it('reports live marks with their current geometry', () => {
    const s = new MarkStore();
    s.upsert(mark('a', 0), geom(0), grey);
    s.setGeom(0, geom(7));
    expect(s.live().get('a')).toMatchObject({
      id: 'a',
      x: 7,
      y: 8,
      paint: '--file',
    });
  });
});
