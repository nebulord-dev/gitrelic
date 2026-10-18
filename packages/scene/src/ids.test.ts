import { describe, expect, it } from 'vitest';

import { entityKey, entityKind, ids, parentOf, REPO_ID } from './ids';

describe('entity ids', () => {
  it('builds and reads back every kind', () => {
    const cases = [
      [ids.analyzer('coupling'), 'analyzer', 'coupling'],
      [ids.file('src/a.ts'), 'file', 'src/a.ts'],
      [ids.dir('src'), 'dir', 'src'],
      [ids.person('ann@corp.com'), 'person', 'ann@corp.com'],
      [ids.cell(0, 23), 'cell', '0:23'],
      [
        ids.week('ann@corp.com', '2026-01-05'),
        'week',
        'ann@corp.com:2026-01-05',
      ],
      [ids.commit('abc123'), 'commit', 'abc123'],
    ] as const;
    for (const [id, kind, key] of cases) {
      expect(entityKind(id)).toBe(kind);
      expect(entityKey(id)).toBe(key);
    }
    expect(entityKind(REPO_ID)).toBe('repo');
  });

  it('keeps colons in the key (paths may contain them)', () => {
    expect(entityKey(ids.file('docs/a:b.md'))).toBe('docs/a:b.md');
  });

  it('rejects malformed ids', () => {
    for (const id of ['', 'file', 'file:', ':x', 'bogus:x', 'repo:x']) {
      expect(entityKind(id)).toBeNull();
      expect(entityKey(id)).toBe('');
      expect(parentOf(id)).toBeNull();
    }
  });
});

describe('parentOf', () => {
  it('walks files and directories up to the repo', () => {
    expect(parentOf(ids.file('a/b/c.ts'))).toBe(ids.dir('a/b'));
    expect(parentOf(ids.dir('a/b'))).toBe(ids.dir('a'));
    expect(parentOf(ids.dir('a'))).toBe(REPO_ID);
    expect(parentOf(ids.file('README.md'))).toBe(REPO_ID);
  });

  it('puts a week under its person, even if the email has a colon', () => {
    expect(parentOf(ids.week('ann@corp.com', '2026-01-05'))).toBe(
      ids.person('ann@corp.com'),
    );
    expect(parentOf(ids.week('a:b@x', '2026-01-05'))).toBe(ids.person('a:b@x'));
  });

  it('puts everything else directly under the repo', () => {
    for (const id of [
      ids.person('a@b'),
      ids.cell(1, 2),
      ids.commit('abc'),
      ids.analyzer('risk'),
    ]) {
      expect(parentOf(id)).toBe(REPO_ID);
    }
    expect(parentOf(REPO_ID)).toBeNull();
  });
});
