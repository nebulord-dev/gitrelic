import { describe, expect, it } from 'vitest';

import { cn } from './cn';

describe('cn', () => {
  it('joins string args', () => {
    expect(cn('flex', 'gap-2')).toBe('flex gap-2');
  });

  it('handles conditional values via clsx semantics', () => {
    expect(cn('flex', false && 'hidden', 'gap-2')).toBe('flex gap-2');
    expect(cn('flex', true && 'gap-2')).toBe('flex gap-2');
    expect(cn('flex', null, undefined, 'gap-2')).toBe('flex gap-2');
  });

  it('resolves Tailwind conflicts via tailwind-merge', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('accepts arrays and objects (clsx semantics)', () => {
    expect(cn(['flex', 'gap-2'])).toBe('flex gap-2');
    expect(cn({ flex: true, hidden: false })).toBe('flex');
  });
});
