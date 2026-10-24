import { describe, expect, it } from 'vitest';

import {
  manyPackagesReport,
  ownershipReport,
  strandingReport,
} from '../../test/ownershipReport';
import { checkScene } from '../model';
import { normalizeReport } from '../report/normalizeReport';
import { mosaicScene } from './mosaic';
import type { Mark } from '../model';
import type { GitrelicReport } from '@gitrelic/core';

const viewport = { width: 1200, height: 800 };
const build = (
  report: GitrelicReport = ownershipReport(),
  focus: string | null = null,
) => mosaicScene({ report, commits: null, focus }, viewport);
const byId = (marks: Mark[], id: string) => marks.find((m) => m.id === id);

describe('mosaicScene', () => {
  const scene = build();

  it('draws a sound scene', () => {
    expect(checkScene(scene)).toEqual([]);
    expect(
      checkScene(build(strandingReport(), 'person:ann@example.com')),
    ).toEqual([]);
  });

  it('draws each package as a plinth, as wide as its commits, named in one row', () => {
    const plinths = scene.marks.filter((m) => m.id.startsWith('dir:'));
    expect(plinths.map((m) => m.id)).toEqual([
      'dir:packages/server',
      'dir:packages/client',
      'dir:packages/shared',
    ]);
    const names = scene.marks.filter((m) => m.id.startsWith('name:'));
    expect(names.map((m) => [m.label, m.selects, m.x])).toEqual(
      plinths.map((p) => [p.id.split('/').at(-1), p.id, p.x]),
    );
    // One height for every name, below the plinths, whatever the width.
    expect(new Set(names.map((m) => m.y)).size).toBe(1);
    expect(names[0].y).toBeGreaterThan(plinths[0].y + plinths[0].h);
    // server 50 commits, client 34, shared 24.
    expect(plinths[0].w).toBeGreaterThan(plinths[1].w);
    expect(plinths[1].w).toBeGreaterThan(plinths[2].w);
  });

  it('splits a column by share: colored people bottom up, the rest grey on top', () => {
    const shared = scene.marks.filter((m) =>
      m.id.startsWith('share:packages/shared:'),
    );
    // cy, bob and ann have colors; dee and eve stack as one grey block.
    expect(shared.map((m) => [m.id, m.paint])).toEqual([
      ['share:packages/shared:cy@example.com', '--owner-2'],
      ['share:packages/shared:ann@example.com', '--owner-0'],
      ['share:packages/shared:bob@example.com', '--owner-1'],
      ['share:packages/shared:*', '--ghost'],
    ]);
    expect(shared[0].y).toBeGreaterThan(shared[3].y); // bottom up
    expect(shared[0].selects).toBe('person:cy@example.com');
    expect(shared[3].selects).toBeUndefined();
    expect(shared[3].tip?.[1]).toBe('2 others: 42%');
  });

  it('outlines a quiet top contributor’s column', () => {
    expect(byId(scene.marks, 'quiet:packages/client')).toMatchObject({
      shape: 'poly',
      edge: 'dashed',
      selects: 'dir:packages/client',
    });
  });

  it('asks for a person until one is selected', () => {
    expect(byId(scene.marks, 'what-if')?.label).toBe(
      'Select a person to see which packages nobody else would know if they left.',
    );
    expect(scene.marks.some((m) => m.id.startsWith('strand:'))).toBe(false);
  });

  it('fades out a leaver’s share and marks what nobody else knows', () => {
    const s = build(strandingReport(), 'person:ann@example.com');
    expect(
      byId(s.marks, 'share:packages/server:ann@example.com')!.alpha,
    ).toBeLessThan(0.2);
    expect(byId(s.marks, 'strand:packages/server')).toMatchObject({
      paint: '--accent',
      selects: 'dir:packages/server',
    });
    expect(byId(s.marks, 'strand:packages/client')).toBeUndefined();
    expect(byId(s.marks, 'what-if')).toMatchObject({
      label: 'If Ann Lee left, 1 package would have nobody left who knows it.',
      labelClass: 'atlas-label--accent',
    });
  });

  it('says when a leaver strands nothing', () => {
    const s = build(strandingReport(), 'person:cy@example.com');
    expect(byId(s.marks, 'what-if')?.label).toBe(
      'If Cy Dee left, every package they work on still has someone who knows it.',
    );
  });

  it('splits out a leaver without a color from the grey block', () => {
    // Dee has no color: unselected, they're in shared's grey block.
    const s = build(ownershipReport(), 'person:dee@example.com');
    expect(checkScene(s)).toEqual([]);
    const shared = s.marks.filter((m) =>
      m.id.startsWith('share:packages/shared:'),
    );
    expect(shared.map((m) => m.id)).toEqual([
      'share:packages/shared:cy@example.com',
      'share:packages/shared:dee@example.com',
      'share:packages/shared:ann@example.com',
      'share:packages/shared:bob@example.com',
      'share:packages/shared:*',
    ]);
    expect(shared[1]).toMatchObject({
      paint: '--ghost',
      selects: 'person:dee@example.com',
    });
    expect(shared[1].alpha).toBeLessThan(0.2);
    expect(shared[4].tip?.[1]).toBe('1 other: 21%');
    expect(byId(s.marks, 'what-if')?.label).toBe(
      'If Dee Fox left, every package they work on still has someone who knows it.',
    );
  });

  it('says how many stranded packages are off the map', () => {
    // ann is the only knower of all 70 extra packages; the 13 smallest are off the map.
    const s = build(manyPackagesReport(70), 'person:ann@example.com');
    expect(byId(s.marks, 'what-if')?.label).toBe(
      'If Ann Lee left, 70 packages would have nobody left who knows them (13 off the map).',
    );
    expect(s.marks.filter((m) => m.id.startsWith('strand:'))).toHaveLength(57);
  });

  it('draws only the map’s packages', () => {
    const s = build(manyPackagesReport(70));
    expect(s.marks.filter((m) => m.id.startsWith('dir:'))).toHaveLength(60);
    expect(checkScene(s)).toEqual([]);
  });

  it('says what to do with a report from before the lens', () => {
    const s = build(normalizeReport({}));
    expect(s.marks.map((m) => m.label)).toEqual([
      'Rerun gitrelic to see who owns what.',
    ]);
  });
});
