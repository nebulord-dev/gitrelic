import { describe, expect, it } from 'vitest';

import reportJson from '../test/fixtures/report.small.json';
import { buildEntityIndex } from './entities';
import { ids } from './ids';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;

describe('buildEntityIndex', () => {
  const index = buildEntityIndex(report);

  it('indexes analyzers, people, directories and files', () => {
    const kinds = new Map<string, number>();
    for (const e of index.entries)
      kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
    expect(kinds.get('analyzer')).toBe(23);
    expect(kinds.get('person')).toBe(3);
    expect(kinds.get('dir')).toBe(3); // docs, src, src/__tests__
    expect(kinds.get('file')).toBe(10);
  });

  it('resolves ids and rejects anything it does not know', () => {
    expect(index.get(ids.file('src/api.ts'))).toMatchObject({
      label: 'api.ts',
      detail: 'src',
      keywords: ['src/api.ts'],
    });
    expect(index.get(ids.dir('src'))).toMatchObject({
      label: 'src/',
      detail: '7 files',
    });
    expect(index.get(ids.person('alice@example.com'))?.label).toBe('Alice');
    expect(index.get(ids.analyzer('bus-factor'))?.detail).toBe(
      'Ownership & Risk',
    );
    expect(index.get(ids.file('<script>alert(1)</script>'))).toBeUndefined();
    expect(index.get('file:../../etc/passwd')).toBeUndefined();
  });

  it('labels root-level files as such', () => {
    expect(index.get(ids.file('README.md'))?.detail).toBe('(repository root)');
  });

  it('makes merged aliases searchable on the person', () => {
    const merged = buildEntityIndex({
      ...report,
      identities: [
        {
          canonicalEmail: 'alice@example.com',
          name: 'Alice',
          aliases: [
            { email: 'alice@example.com', name: 'Alice', commits: 10 },
            { email: 'ally@old.example', name: 'Ally Smith', commits: 3 },
          ],
        },
      ],
    });
    expect(merged.get(ids.person('alice@example.com'))?.keywords).toEqual(
      expect.arrayContaining(['ally@old.example', 'Ally Smith']),
    );
  });
});
