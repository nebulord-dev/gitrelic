import { describe, expect, it } from 'vitest';

import { chanceAllows } from '../fixRate/points';
import { checkScene } from '../model';
import { offHoursFunnelScene, type OffHoursPoint } from './offHoursFunnel';

const VIEWPORT = { width: 1200, height: 800 };
const RATE = 0.1;
const pt = (
  name: string,
  commits: number,
  offHours: number,
  over: Partial<OffHoursPoint> = {},
): OffHoursPoint => {
  const allowed = chanceAllows(commits, RATE);
  const aboveChance = offHours > allowed;
  const share = offHours / commits;
  return {
    id: name === '(root)' ? 'repo' : `dir:${name}`,
    name,
    commits,
    offHours,
    allowed,
    aboveChance,
    tier: aboveChance ? (share >= 2 * RATE ? 3 : 2) : share > RATE ? 1 : 0,
    ...over,
  };
};
const points = [
  pt('server', 66, 15),
  pt('dom', 86, 16),
  pt('compiler', 87, 2),
  pt('(root)', 20, 3),
  pt('a', 12, 1),
  pt('b', 12, 1),
];
const mark = (s: ReturnType<typeof offHoursFunnelScene>, id: string) =>
  s.marks.find((m) => m.id === id)!;

describe('offHoursFunnelScene', () => {
  const scene = offHoursFunnelScene(
    { points, rate: RATE, minCommits: 10 },
    VIEWPORT,
  );

  it('is a sound scene, one dot per package, keyed by its entity', () => {
    expect(checkScene(scene)).toEqual([]);
    expect(
      scene.marks.filter((m) => m.shape === 'dot').map((m) => m.id),
    ).toEqual([
      'dir:server',
      'dir:dom',
      'dir:compiler',
      'repo',
      'dir:a',
      'dir:b',
    ]);
  });

  it('places packages by commits across (log) and share up', () => {
    const server = mark(scene, 'dir:server');
    const dom = mark(scene, 'dir:dom');
    const compiler = mark(scene, 'dir:compiler');
    expect(server.x).toBeLessThan(dom.x);
    expect(server.y).toBeLessThan(dom.y); // 23% over 19%
    expect(compiler.y).toBeGreaterThan(dom.y);
    // Same size and count sit side by side, not on top of each other.
    expect(mark(scene, 'dir:a').x).not.toBe(mark(scene, 'dir:b').x);
  });

  it('paints and names packages above chance first', () => {
    const server = mark(scene, 'dir:server');
    expect(server.paint).toBe('--risk-3');
    expect(server.label).toBe('server');
    expect(server.labelPriority).toBeGreaterThan(
      mark(scene, 'dir:compiler').labelPriority!,
    );
    expect(server.tip).toEqual([
      'server',
      '15 of 66 commits off-hours (23%)',
      `Chance allows up to ${chanceAllows(66, RATE)} at this size: above chance`,
    ]);
    expect(mark(scene, 'dir:compiler').paint).toBe('--risk-0');
  });

  it('draws the band up to what chance allows, and the repo’s rate', () => {
    const band = scene.marks.filter((m) => m.id.startsWith('band:'));
    expect(band.length).toBeGreaterThan(10);
    const first = band[0];
    expect(first.tip).toEqual([
      'What chance gives at the repo’s 10%',
      `Up to ${chanceAllows(12, RATE)} of 12 commits off-hours`,
    ]);
    // Narrows as packages grow: the last bar's top sits lower.
    expect(band.at(-1)!.y - band.at(-1)!.h / 2).toBeGreaterThan(
      first.y - first.h / 2,
    );
    expect(scene.guides.find((g) => g.id === 'rate')).toBeTruthy();
    expect(mark(scene, 'rate-label').label).toBe('repo 10%');
  });

  it('rings the selected package and names it first', () => {
    const s = offHoursFunnelScene(
      { points, rate: RATE, minCommits: 10, focus: 'dir:compiler' },
      VIEWPORT,
    );
    expect(checkScene(s)).toEqual([]);
    expect(mark(s, 'home:dir:compiler')).toMatchObject({
      shape: 'ring',
      parent: 'dir:compiler',
    });
    expect(mark(s, 'dir:compiler').labelPriority).toBe(3000);
  });

  it('says so when no package has enough commits', () => {
    const s = offHoursFunnelScene(
      { points: [], rate: RATE, minCommits: 10 },
      VIEWPORT,
    );
    expect(checkScene(s)).toEqual([]);
    expect(s.marks[0].label).toBe('No package has 10 commits to test yet.');
  });
});
