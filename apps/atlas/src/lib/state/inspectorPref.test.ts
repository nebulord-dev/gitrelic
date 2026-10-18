import { describe, expect, it } from 'vitest';

import { initialCollapsed, rememberCollapsed } from './inspectorPref';

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

describe('inspector preference', () => {
  it('remembers collapsed and open', () => {
    const s = memoryStorage();
    expect(initialCollapsed(s)).toBe(false);
    rememberCollapsed(true, s);
    expect(initialCollapsed(s)).toBe(true);
    rememberCollapsed(false, s);
    expect(initialCollapsed(s)).toBe(false);
  });

  it('starts open when storage throws or is missing', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(initialCollapsed(broken)).toBe(false);
    expect(() => rememberCollapsed(true, broken)).not.toThrow();
    expect(initialCollapsed(undefined)).toBe(false);
  });
});
