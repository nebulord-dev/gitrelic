import { buildEntityIndex, ids } from '@gitrelic/scene';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import { Nav } from './nav.svelte';
import type { GitrelicReport } from '@gitrelic/core';

const index = buildEntityIndex(reportJson as unknown as GitrelicReport);

beforeEach(() => {
  history.replaceState(null, '', '/');
});
afterEach(() => {
  history.replaceState(null, '', '/');
});

describe('Nav', () => {
  it('reads a known selection from the hash', () => {
    history.replaceState(
      null,
      '',
      `/#s=${encodeURIComponent(ids.file('src/api.ts'))}`,
    );
    const nav = new Nav(() => index);
    expect(nav.selection).toBe('file:src/api.ts');
    nav.destroy();
  });

  it('drops selections and views it cannot resolve', () => {
    history.replaceState(null, '', '/#v=nope&s=file%3A%3Cimg%20onerror%3Dx%3E');
    const nav = new Nav(() => index);
    expect(nav.selection).toBeNull();
    expect(nav.view).toBeNull();
    nav.destroy();
  });

  it('ignores views Atlas does not have yet', () => {
    history.replaceState(null, '', '/#v=coupling&l=matrix');
    const nav = new Nav(() => index);
    expect(nav.view).toBeNull();
    expect(nav.layout).toBeNull();
    nav.open('coupling');
    expect(nav.view).toBeNull();
    nav.destroy();
  });

  it('writes the selection to the hash without a new history entry', () => {
    const nav = new Nav(() => index);
    const before = history.length;
    nav.select(ids.person('alice@example.com'));
    expect(location.hash).toBe('#s=person%3Aalice%40example.com');
    expect(history.length).toBe(before);
    nav.select(null);
    expect(location.hash).toBe('');
    nav.destroy();
  });

  it('refuses to select an unknown entity', () => {
    const nav = new Nav(() => index);
    nav.select('person:mallory@evil.example');
    expect(nav.selection).toBeNull();
    nav.destroy();
  });

  it('follows the hash when it changes (Back, edited URL)', () => {
    const nav = new Nav(() => index);
    history.replaceState(null, '', '/#s=dir%3Asrc');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(nav.selection).toBe('dir:src');
    nav.destroy();
    history.replaceState(null, '', '/#s=dir%3Adocs');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(nav.selection).toBe('dir:src');
  });
});
