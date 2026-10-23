import { describe, expect, it } from 'vitest';

import { checkScene } from '../model';
import { AUTHORED_PAINT, aiPackagesScene } from './aiPackages';
import type { AiPackageRow, AiPackages } from '../ai/packages';

const viewport = { width: 1200, height: 800 };
const row = (
  pkg: string,
  commits: number,
  assisted: number,
  authored = 0,
): AiPackageRow => ({
  id: pkg === '' ? 'repo' : `dir:${pkg}`,
  package: pkg,
  name: pkg || '(root)',
  commits,
  assisted,
  authored,
});
const pkgs = (rows: AiPackageRow[], ai = 10, commits = 100): AiPackages => ({
  rows,
  commits,
  ai,
});

describe('aiPackagesScene', () => {
  const rows = [
    row('apps', 200, 100, 20),
    row('docs', 100, 0),
    row('', 50, 25),
  ];

  it('is a sound scene: one bar per package under its own id, AI parts on top', () => {
    const scene = aiPackagesScene({ packages: pkgs(rows), rows: 18 }, viewport);
    expect(checkScene(scene)).toEqual([]);
    const ids = scene.marks.map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining(['dir:apps', 'dir:docs', 'repo']),
    );
    const apps = scene.marks.find((m) => m.id === 'dir:apps')!;
    const assisted = scene.marks.find((m) => m.id === 'ai-part:apps:assisted')!;
    const authored = scene.marks.find((m) => m.id === 'ai-part:apps:authored')!;
    expect(assisted.w / apps.w).toBeCloseTo(0.5);
    expect(authored.w / apps.w).toBeCloseTo(0.1);
    expect(authored.paint).toEqual(AUTHORED_PAINT);
    expect(assisted.selects).toBe('dir:apps');
    // No AI, no part.
    expect(ids.some((id) => id.startsWith('ai-part:docs'))).toBe(false);
    const share = scene.marks.find((m) => m.id === 'ai-share:apps')!;
    expect(share.label).toBe('120 of 200 · 60%');
  });

  it('fades every row but a selected package', () => {
    const scene = aiPackagesScene(
      { packages: pkgs(rows), rows: 18, focus: 'dir:docs' },
      viewport,
    );
    const alpha = (id: string) => scene.marks.find((m) => m.id === id)!.alpha;
    expect(alpha('dir:docs')).toBe(1);
    expect(alpha('dir:apps')).toBeLessThan(1);
  });

  it('draws low adoption as the same picture and says no commit had AI', () => {
    const scene = aiPackagesScene(
      { packages: pkgs([row('src', 30, 0)], 0, 30), rows: 18 },
      viewport,
    );
    expect(checkScene(scene)).toEqual([]);
    const head = scene.marks.find((m) => m.id === 'ai-head')!;
    expect(head.label).toBe('No commit had AI in it (30 commits)');
  });

  it('counts the packages it leaves out, and names a selected person', () => {
    const scene = aiPackagesScene(
      { packages: pkgs(rows, 4, 8), rows: 2, person: 'Ann' },
      viewport,
    );
    expect(scene.marks.find((m) => m.id === 'ai-more')!.label).toBe(
      '+1 more package in the table',
    );
    expect(scene.marks.find((m) => m.id === 'ai-head')!.label).toBe(
      'Ann: 4 of 8 commits with AI (50%)',
    );
  });

  it('says so when there are no packages', () => {
    const scene = aiPackagesScene(
      { packages: pkgs([], 0, 0), rows: 18 },
      viewport,
    );
    expect(scene.marks.map((m) => m.id)).toEqual(['ai-empty']);
  });
});
