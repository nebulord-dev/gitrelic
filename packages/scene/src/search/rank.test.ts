import { describe, expect, it } from 'vitest';

import { fuzzyScore, rankEntities } from './rank';
import type { EntityEntry } from '../entities';

const entry = (
  id: string,
  kind: EntityEntry['kind'],
  label: string,
  keywords: string[] = [],
): EntityEntry => ({ id, kind, label, detail: '', keywords });

describe('fuzzyScore', () => {
  it('survives characters that grow when lowercased', () => {
    // 'İ'.toLowerCase() is two UTF-16 units; indexing by the lowercased
    // string used to run off the end of the original.
    expect(fuzzyScore('x', 'İx.ts')).not.toBeNull();
    expect(fuzzyScore('s', 'aİİİİs')).not.toBeNull();
    expect(fuzzyScore('ix', 'İx.ts')).not.toBeNull();
    expect(fuzzyScore('q', 'İx.ts')).toBeNull();
    // And on the query side: 'İ' searches like 'i'.
    expect(fuzzyScore('İx', 'İx.ts')).not.toBeNull();
    expect(fuzzyScore('İnd', 'index.ts')).not.toBeNull();
  });

  it('matches subsequences, case-insensitively, and rejects the rest', () => {
    expect(fuzzyScore('bf', 'Bus Factor')).not.toBeNull();
    expect(fuzzyScore('BUS', 'bus factor')).not.toBeNull();
    expect(fuzzyScore('fb', 'Bus Factor')).toBeNull();
    expect(fuzzyScore('xyz', 'Bus Factor')).toBeNull();
  });

  it('prefers word starts and consecutive runs', () => {
    expect(fuzzyScore('bf', 'Bus Factor')!).toBeGreaterThan(
      fuzzyScore('bf', 'abfoo')!,
    );
    expect(fuzzyScore('bf', 'Bus Factor')!).toBeGreaterThan(
      fuzzyScore('bf', 'obscure fence')!,
    );
    // A consecutive run beats the same letters at three word starts.
    expect(fuzzyScore('run', 'runner.ts')!).toBeGreaterThan(
      fuzzyScore('run', 'r_u_n.ts')!,
    );
    expect(fuzzyScore('api', 'api.ts')!).toBeGreaterThan(
      fuzzyScore('api', 'rapid.ts')!,
    );
  });

  it('treats camelCase humps as word starts', () => {
    expect(fuzzyScore('ns', 'normalizeScene')!).toBeGreaterThan(
      fuzzyScore('ns', 'nosyfile')!,
    );
  });

  it('scores an empty query as zero', () => {
    expect(fuzzyScore('', 'anything')).toBe(0);
  });
});

describe('rankEntities', () => {
  const entries = [
    entry('file:src/bus.ts', 'file', 'bus.ts', ['src/bus.ts']),
    entry('analyzer:bus-factor', 'analyzer', 'Bus Factor', ['bus-factor']),
    entry('person:bf@x', 'person', 'Bea Fox', ['bf@x']),
    entry('file:docs/a.md', 'file', 'a.md', ['docs/a.md']),
  ];

  it('returns nothing for an empty query', () => {
    expect(rankEntities('  ', entries)).toEqual([]);
  });

  it('ranks the best matches first', () => {
    const top = rankEntities('bus', entries).map((r) => r.entry.id);
    expect(top[0]).toBe('file:src/bus.ts'); // shorter exact-prefix label
    expect(top).toContain('analyzer:bus-factor');
    expect(top).not.toContain('file:docs/a.md');
  });

  it('matches full paths and emails through keywords', () => {
    expect(rankEntities('docs/a', entries)[0].entry.id).toBe('file:docs/a.md');
    expect(rankEntities('bf@', entries)[0].entry.id).toBe('person:bf@x');
  });

  it('breaks ties toward analyzers', () => {
    const tied = [
      entry('file:x', 'file', 'Coupling'),
      entry('analyzer:coupling', 'analyzer', 'Coupling'),
    ];
    expect(rankEntities('coupling', tied)[0].entry.kind).toBe('analyzer');
  });

  it('caps the result count', () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      entry(`file:f${i}`, 'file', `file${i}.ts`),
    );
    expect(rankEntities('file', many, 7)).toHaveLength(7);
  });
});
