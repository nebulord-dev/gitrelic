import { describe, expect, it } from 'vitest';

import { couplingReport } from '../../test/couplingReport';
import reportJson from '../../test/fixtures/report.small.json';
import { checkScene } from '../model';
import { boundariesScene } from './boundaries';
import type { Scene } from '../model';
import type { GitrelicReport } from '@gitrelic/core';

const viewport = { width: 1200, height: 800 };
const mark = (s: Scene, id: string) => s.marks.find((m) => m.id === id);
const link = (s: Scene, id: string) => s.links.find((l) => l.id === id);
const build = (focus: string | null = null, report = couplingReport()) =>
  boundariesScene({ report, commits: null, focus: focus as never }, viewport);

describe('boundariesScene', () => {
  it('is a sound scene: ring, package focus, file focus, and a quiet repo', () => {
    expect(checkScene(build())).toEqual([]);
    expect(checkScene(build('dir:packages/server'))).toEqual([]);
    expect(checkScene(build('file:packages/server/src/api.ts'))).toEqual([]);
    expect(
      checkScene(build(null, reportJson as unknown as GitrelicReport)),
    ).toEqual([]);
  });

  it('rings the packages as dir marks, bigger for more commits', () => {
    const s = build();
    const server = mark(s, 'dir:packages/server')!;
    const shared = mark(s, 'dir:packages/shared')!;
    expect(server.label).toBe('server');
    expect(server.r).toBeGreaterThan(shared.r);
    expect(mark(s, 'repo')).toBeUndefined();
    expect(mark(s, 'dir:.github')).toBeUndefined();
  });

  it('links packages by commits, naming the file pairs behind each link', () => {
    const s = build();
    const l = link(s, 'couple:packages/client:packages/server')!;
    expect(l).toMatchObject({
      source: 'dir:packages/client',
      target: 'dir:packages/server',
    });
    expect(l.width).toBeGreaterThan(
      link(s, 'couple:packages/flags:packages/shared')!.width,
    );
    expect(l.tip?.join('\n')).toMatch(/14 commits changed both/);
    expect(l.tip?.join('\n')).toMatch(/api\.ts ↔ api\.ts · 12/);
  });

  it('lights a selected package’s links and fades the rest', () => {
    const s = build('dir:packages/server');
    expect(link(s, 'couple:packages/client:packages/server')!.paint).toBe(
      '--accent',
    );
    expect(
      link(s, 'couple:packages/flags:packages/shared')!.alpha,
    ).toBeLessThan(0.1);
    expect(mark(s, 'dir:packages/client')!.labelSub).toBe(
      '14 commits with server',
    );
  });

  it('draws a selected file’s ripple: partners nearer the more they share', () => {
    const s = build('file:packages/server/src/api.ts');
    const centre = mark(s, 'file:packages/server/src/api.ts')!;
    const client = mark(s, 'file:packages/client/src/api.ts')!;
    const db = mark(s, 'file:packages/server/src/db.ts')!;
    const dist = (m: typeof client) =>
      Math.hypot(m.x - centre.x, m.y - centre.y);
    expect(dist(client)).toBeLessThan(dist(db));
    // Another package: the accent.
    expect(client.paint).toBe('--accent');
    expect(db.paint).not.toBe('--accent');
    expect(client.labelSub).toBe('12 of 16 commits');
    expect(centre.labelSub).toMatch(/usually 3 other files per change/);
    // The ring stays, faint, so partners grow out of their packages.
    expect(mark(s, 'dir:packages/client')!.alpha).toBeLessThan(0.5);
    expect(
      s.links.every((l) => l.source === 'file:packages/server/src/api.ts'),
    ).toBe(true);
  });

  it('says so when a file changes alone', () => {
    const s = build('file:packages/client/src/api.ts');
    expect(mark(s, 'ripple-alone')?.label).toMatch(
      /no file shares 3 or more commits with it/,
    );
  });

  it('says so when no two packages change together', () => {
    const s = build(null, reportJson as unknown as GitrelicReport);
    expect(mark(s, 'boundaries-empty')?.label).toBeDefined();
  });

  it('names nested packages by their last folder, unless two would clash', () => {
    const r = couplingReport();
    r.coupling.packageCommits = [
      { package: 'compiler/packages/babel-plugin', commits: 5 },
      { package: 'packages/babel-plugin', commits: 4 },
      { package: 'apps/web', commits: 3 },
    ];
    r.coupling.packages = [];
    const s = build(null, r);
    expect(mark(s, 'dir:apps/web')!.label).toBe('web');
    expect(mark(s, 'dir:packages/babel-plugin')!.label).toBe('babel-plugin');
    expect(mark(s, 'dir:compiler/packages/babel-plugin')!.label).toBe(
      'compiler/packages/babel-plugin',
    );
  });

  it('seats packages in name order, so families sit together', () => {
    const s = build();
    const ys = ['client', 'flags', 'server', 'shared'].map((d) =>
      mark(s, `dir:packages/${d}`)!,
    );
    // Down the right half in name order: client above flags.
    expect(ys[0].x).toBeGreaterThan(600);
    expect(ys[0].y).toBeLessThan(ys[1].y);
  });
});
