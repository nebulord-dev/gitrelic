import { describe, expect, it } from 'vitest';

import { checkScene } from '../model';
import { WEEK_MS } from '../time/week';
import { adoptionLanesScene, adoptionLine } from './adoptionLanes';
import type { AdoptionLanes, AdoptionRow } from '../ai/adoption';

const viewport = { width: 1200, height: 800 };
const MON = Date.UTC(2026, 0, 5);
const row = (
  email: string,
  bins: number[],
  aiBins: number[],
  agent: string | null = null,
): AdoptionRow => {
  const first = aiBins.findIndex((v) => v > 0);
  return {
    id: `person:${email}`,
    name: email,
    agent,
    commits: bins.reduce((s, v) => s + v, 0),
    ai: aiBins.reduce((s, v) => s + v, 0),
    firstAi: first < 0 ? null : MON + first * WEEK_MS,
    bins,
    aiBins,
  };
};
const lanes = (rows: AdoptionRow[], others = 0): AdoptionLanes => ({
  unit: 'week',
  binStarts: [0, 1, 2, 3].map((w) => MON + w * WEEK_MS),
  rows,
  others,
  othersWithAi: others > 0 ? 1 : 0,
});

describe('adoptionLanesScene', () => {
  const rows = [
    row('ann@x', [2, 0, 4, 1], [0, 0, 2, 1]),
    row('bob@x', [3, 1, 0, 0], [0, 0, 0, 0]),
  ];

  it('is a sound scene: a person mark per row, the AI part of each week on the baseline', () => {
    const scene = adoptionLanesScene(lanes(rows, 3), viewport);
    expect(checkScene(scene)).toEqual([]);
    const ann = scene.marks.find((m) => m.id === 'person:ann@x')!;
    expect(ann.labelSub).toBeUndefined();
    expect(ann.tip).toContain('3 of 7 with AI · since Jan 19, 2026');
    expect(
      scene.marks.find((m) => m.id === 'adopt-share:person:ann@x')!.label,
    ).toBe('43% · since Jan 19');
    expect(
      scene.marks.find((m) => m.id === 'adopt-share:person:bob@x')!.label,
    ).toBe('none');
    const all = scene.marks.find((m) => m.id === 'adopt-ai:person:ann@x:3')!;
    // A week that was all AI is one bar, in the accent.
    expect(all.paint).toBe('--accent');
    expect(scene.marks.some((m) => m.id === 'adopt:person:ann@x:3')).toBe(
      false,
    );
    const half = scene.marks.find((m) => m.id === 'adopt-ai:person:ann@x:2')!;
    const rest = scene.marks.find((m) => m.id === 'adopt:person:ann@x:2')!;
    expect(half.h).toBeCloseTo(rest.h);
    // On the baseline: the AI part sits below the rest.
    expect(half.y).toBeGreaterThan(rest.y);
    expect(half.selects).toBe('person:ann@x');
    expect(
      scene.marks.some((m) => m.id.startsWith('adopt-ai:person:bob@x')),
    ).toBe(false);
    expect(scene.marks.find((m) => m.id === 'adopt-others')!.label).toBe(
      '+3 other people not drawn, 1 of them with AI commits',
    );
  });

  it('fades the other rows when a person is selected', () => {
    const scene = adoptionLanesScene(lanes(rows), viewport, {
      focus: 'person:bob@x',
    });
    const alpha = (id: string) => scene.marks.find((m) => m.id === id)!.alpha;
    expect(alpha('person:bob@x')).toBeGreaterThan(alpha('person:ann@x'));
  });

  it('says so when there are no commits', () => {
    const scene = adoptionLanesScene(lanes([]), viewport);
    expect(scene.marks.map((m) => m.id)).toEqual(['adopt-empty']);
  });
});

describe('adoptionLine', () => {
  it('reads an agent’s row, and a row with no AI', () => {
    expect(adoptionLine(row('a@x', [3], [3], 'Claude'))).toBe(
      '3 commits of its own',
    );
    expect(adoptionLine(row('b@x', [1], [0]))).toBe('1 commit · none with AI');
  });
});
