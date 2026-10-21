import { describe, expect, it } from 'vitest';

import { ids } from '../ids';
import { checkScene } from '../model';
import { fanOut, labelledBounds } from './overviewParts';

const entities = [
  { id: ids.file('src/a.ts'), label: 'a.ts', value: '12 commits' },
  { id: ids.person('ann@corp.com'), label: 'Ann', value: '80%' },
  { id: ids.dir('src'), label: 'src/', value: '3 files' },
];

describe('fanOut', () => {
  it("puts a lens's entities on an arc beyond it, parented to it", () => {
    const { marks, links } = fanOut('hotspots', 100, 100, 0, 200, entities);
    expect(marks.map((m) => m.id)).toEqual(entities.map((e) => e.id));
    for (const m of marks) {
      expect(m.parent).toBe(ids.analyzer('hotspots'));
      expect(Math.hypot(m.x - 100, m.y - 100)).toBeCloseTo(200);
      // Outward 0 is to the right: nothing fans back over the lens.
      expect(m.x).toBeGreaterThan(100);
    }
    expect(marks.map((m) => m.paint)).toEqual(['--file', '--person', '--dir']);
    expect(links.map((l) => l.source)).toEqual(
      entities.map(() => ids.analyzer('hotspots')),
    );
  });

  it('bounds every mark with room for its labels', () => {
    const lens = {
      id: ids.analyzer('hotspots'),
      shape: 'dot' as const,
      paint: '--risk-0' as const,
      x: 100,
      y: 100,
      r: 5,
      w: 0,
      h: 0,
      a0: 0,
      a1: 0,
      alpha: 1,
    };
    const fan = fanOut('hotspots', 100, 100, 0, 200, entities);
    const marks = [lens, ...fan.marks];
    const scene = {
      marks,
      links: fan.links,
      guides: [],
      bounds: labelledBounds(marks),
    };
    expect(checkScene(scene)).toEqual([]);
  });
});
