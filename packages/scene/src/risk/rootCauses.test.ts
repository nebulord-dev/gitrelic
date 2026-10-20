import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import {
  cursed,
  FIZZ,
  FLAGS,
  pair,
  reactShaped,
  withRisk,
} from '../../test/rootCausesReport';
import { familyName, MAX_HUBS, rootCauses, rootCausesOf } from './rootCauses';
import type { GitrelicReport } from '@gitrelic/core';

const fixture = reportJson as unknown as GitrelicReport;

describe('rootCauses', () => {
  const rc = rootCauses(reactShaped());

  it('joins risky files that change together into one family node', () => {
    expect(rc.nodes).toHaveLength(2);
    const [flags, fizz] = rc.nodes;
    expect(flags.family).toBe('ReactFeatureFlags.*');
    expect(flags.members.map((m) => m.file).sort()).toEqual([...FLAGS].sort());
    // Drawn as its highest-scoring member.
    expect(flags.file).toBe(FLAGS[0]);
    expect(flags.cursed).toBe(true);
    expect(fizz).toMatchObject({ file: FIZZ, family: null, cursed: false });
  });

  it('ranks hubs by risky nodes reached, then by commits shared', () => {
    expect(rc.hubs.map((h) => h.file)).toEqual([
      'shared/ReactTypes.js',
      'shared/forks/Dynamic.js',
      // Same reach and shared commits: by path.
      'dom/ReactDOMBrowser.js',
      'reconciler/Hooks.js',
    ]);
    expect(rc.hubs[0].links.map((l) => l.node)).toEqual(
      [FIZZ, FLAGS[0]].sort(),
    );
  });

  it('leaves tests out of the hubs', () => {
    expect(rc.hubs.some((h) => h.file.includes('__tests__'))).toBe(false);
    expect(rc.hubCount).toBe(4);
  });

  it('weighs a family link by its strongest member', () => {
    const dynamic = rc.hubs.find((h) => h.file === 'shared/forks/Dynamic.js')!;
    expect(dynamic.links).toEqual([
      { node: FLAGS[0], coCommits: 12, member: FLAGS[0] },
    ]);
    expect(dynamic.commits).toBe(13);
    expect(dynamic.shared).toBe(12);
    // One node, seven files: reach in files counts every member.
    expect(dynamic.files).toBe(7);
  });

  it('keeps files apart under 75% of the busier file’s commits or 5 commits', () => {
    const a = 'src/a.ts';
    const b = 'src/b.ts';
    const c = 'src/c.ts';
    const r = rootCauses(
      withRisk(
        [cursed(a, 60), cursed(b, 55), cursed(c, 52)],
        [],
        [
          // 9 of 10 and 9 of 20: the quieter file always, the busier not.
          pair(a, b, 9, 10, 20),
          // Every commit, but only 4 of them.
          pair(b, c, 4, 4, 4),
        ],
      ),
    );
    expect(r.nodes.map((nd) => nd.family)).toEqual([null, null, null]);
  });

  it('caps the hubs it keeps', () => {
    const risky = 'src/risky.ts';
    const pairs = Array.from({ length: MAX_HUBS + 3 }, (_, i) =>
      pair(`src/hub${i}.ts`, risky, 3 + i, 20, 20),
    );
    const r = rootCauses(withRisk([cursed(risky, 60)], [], pairs));
    expect(r.hubs).toHaveLength(MAX_HUBS);
    expect(r.hubCount).toBe(MAX_HUBS + 3);
    // Same reach: the most shared commits first.
    expect(r.hubs[0].file).toBe(`src/hub${MAX_HUBS + 2}.ts`);
  });

  it('finds no hub when only risky files couple (the fixture)', () => {
    const r = rootCausesOf(fixture);
    expect(r.nodes.map((nd) => nd.file)).toEqual([
      'src/helpers.ts',
      'src/index.ts',
      'src/api.ts',
      'src/config.ts',
      'src/auth.ts',
    ]);
    expect(r.hubs).toEqual([]);
    expect(rootCausesOf(fixture)).toBe(r);
  });
});

describe('familyName', () => {
  it('is the shared prefix, trimmed to a word, then .*', () => {
    expect(
      familyName(['a/ReactFeatureFlags.js', 'b/ReactFeatureFlags.www.js']),
    ).toBe('ReactFeatureFlags.*');
    expect(familyName(['x/use-store.ts', 'x/use-state.ts'])).toBe('use-st.*');
  });

  it('falls back to the top member when the prefix is too short', () => {
    expect(familyName(['src/api.ts', 'src/auth.ts', 'src/app.ts'])).toBe(
      'api.ts +2',
    );
  });

  it('trims a trailing run of separators, and stays fast on a long inner run', () => {
    expect(familyName(['x/hook-._a.ts', 'x/hook-._b.ts'])).toBe('hook.*');
    // A regex trim backtracks quadratically on separators that aren't trailing.
    const dashes = '-'.repeat(100_000);
    const start = Date.now();
    expect(familyName([`x/abcd${dashes}e1`, `x/abcd${dashes}e2`])).toBe(
      `abcd${dashes}e.*`,
    );
    expect(Date.now() - start).toBeLessThan(500);
  });
});
