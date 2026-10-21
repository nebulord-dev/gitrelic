import { describe, expect, it } from 'vitest';

import { initialPanels, rememberPanels } from './panelsPref';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

describe('panels preference', () => {
  it('remembers which panels are open', () => {
    const s = memoryStorage();
    expect(initialPanels(s)).toEqual(new Set());
    rememberPanels(new Set(['dashboard:calm']), s);
    expect(initialPanels(s)).toEqual(new Set(['dashboard:calm']));
    rememberPanels(new Set(), s);
    expect(initialPanels(s)).toEqual(new Set());
  });

  it('starts closed when storage holds junk', () => {
    const s = memoryStorage();
    s.setItem('gitrelic-atlas-panels', '{not json');
    expect(initialPanels(s)).toEqual(new Set());
    s.setItem('gitrelic-atlas-panels', '{"a":1}');
    expect(initialPanels(s)).toEqual(new Set());
    s.setItem('gitrelic-atlas-panels', '["ok", 3, null]');
    expect(initialPanels(s)).toEqual(new Set(['ok']));
  });

  it('starts closed when storage throws or is missing', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(initialPanels(broken)).toEqual(new Set());
    expect(() => rememberPanels(new Set(['x']), broken)).not.toThrow();
    expect(initialPanels(undefined)).toEqual(new Set());
  });
});
