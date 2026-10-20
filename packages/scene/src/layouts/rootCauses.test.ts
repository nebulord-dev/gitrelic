import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import {
  FIZZ,
  FLAGS,
  reactShaped,
  withRisk,
} from '../../test/rootCausesReport';
import { checkScene, type Mark } from '../model';
import { rootCauses } from '../risk/rootCauses';
import { rootCausesScene } from './rootCauses';
import type { GitrelicReport } from '@gitrelic/core';

const viewport = { width: 1200, height: 800 };
const scene = rootCausesScene(rootCauses(reactShaped()), viewport);
const byId = new Map(scene.marks.map((m) => [m.id, m]));
const mark = (id: string): Mark => {
  const m = byId.get(id);
  if (!m) throw new Error(`no mark ${id}`);
  return m;
};

describe('rootCausesScene', () => {
  it('is a sound scene', () => {
    expect(checkScene(scene)).toEqual([]);
  });

  it('puts hubs on the left, best first, and risky nodes on the right', () => {
    const types = mark('file:shared/ReactTypes.js');
    const dynamic = mark('file:shared/forks/Dynamic.js');
    const flags = mark(`file:${FLAGS[0]}`);
    expect(types.x).toBeLessThan(flags.x);
    expect(types.y).toBeLessThan(dynamic.y);
    expect(types.labelAnchor).toBe('left');
    expect(flags.labelAnchor).toBe('right');
  });

  it('draws a family as its top member, the others standing in on it', () => {
    const flags = mark(`file:${FLAGS[0]}`);
    expect(flags.label).toBe('ReactFeatureFlags.* (7)');
    expect(byId.has(`file:${FLAGS[1]}`)).toBe(false);
    expect(scene.standIns?.get(`file:${FLAGS[1]}`)).toBe(`file:${FLAGS[0]}`);
    expect(flags.tip?.slice(0, 3)).toEqual([
      'ReactFeatureFlags.*',
      '7 files that change together in nearly every commit',
      'ReactFeatureFlags.js · 55 · cursed',
    ]);
    expect(flags.tip?.at(-1)).toBe('3 hubs change with it');
  });

  it('links each hub to its nodes, wider for more shared commits', () => {
    const dynamic = scene.links.find(
      (l) => l.id === `cause:shared/forks/Dynamic.js:${FLAGS[0]}`,
    )!;
    const types = scene.links.find(
      (l) => l.id === `cause:shared/ReactTypes.js:${FLAGS[0]}`,
    )!;
    expect(dynamic.source).toBe('file:shared/forks/Dynamic.js');
    expect(dynamic.width).toBeGreaterThan(types.width);
    expect(scene.links).toHaveLength(5);
  });

  it('says how often a hub changes with each node', () => {
    expect(mark('file:shared/ReactTypes.js').tip).toEqual([
      'ReactTypes.js',
      'Changes with 8 risky files',
      `ReactFizzServer.js · 4 of its 11 commits`,
      'ReactFeatureFlags.* (7) · 4 of its 11 commits',
    ]);
  });

  it("counts a hub's risky files, every family member included", () => {
    expect(mark('file:shared/ReactTypes.js').labelSub).toBe(
      '8 risky files · 11 commits',
    );
  });

  it('draws ribbons in a role that shows on both themes', () => {
    for (const l of scene.links) expect(l.paint).toBe('--muted');
  });

  it('fits its bounds to the columns, not the whole viewport', () => {
    const { x, y, w, h } = scene.bounds;
    expect(w).toBeLessThan(viewport.width);
    expect(h).toBeLessThan(viewport.height);
    const hubs = scene.marks.filter((m) => m.labelAnchor === 'left');
    for (const m of hubs) expect(m.x).toBeGreaterThan(x);
    for (const m of scene.marks) expect(m.y).toBeLessThan(y + h);
  });

  it('marks a near miss and its score', () => {
    expect(mark(`file:${FIZZ}`).labelSub).toBe('score 45 · near miss');
  });

  it('says so when nothing changes with the risky files', () => {
    const fixture = rootCausesScene(
      rootCauses(reportJson as unknown as GitrelicReport),
      viewport,
    );
    expect(checkScene(fixture)).toEqual([]);
    expect(fixture.marks.find((m) => m.id === 'rc-none')?.label).toBe(
      'No source file changes with them often',
    );
    expect(fixture.marks.some((m) => m.id === 'file:src/helpers.ts')).toBe(
      true,
    );
    expect(fixture.links).toEqual([]);
  });

  it('says so when no file is risky', () => {
    const empty = rootCausesScene(rootCauses(withRisk([], [], [])), viewport);
    expect(checkScene(empty)).toEqual([]);
    expect(empty.marks.map((m) => m.label)).toEqual([
      'No file scores 40 or more',
    ]);
  });
});
