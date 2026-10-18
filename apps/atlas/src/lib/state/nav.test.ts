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

  it('drops what it cannot resolve, and from the URL too', () => {
    history.replaceState(
      null,
      '',
      '/#v=nope&l=hotspots&f=x&t=soon&s=file%3A%3Cimg%20onerror%3Dx%3E',
    );
    const before = history.length;
    const nav = new Nav(() => index);
    expect(nav.view).toBe('overview');
    // Overview's default lens, Repo map, which stays out of the URL.
    expect(nav.lens).toBe('overview');
    expect(nav.form).toBeNull();
    expect(nav.time).toBeNull();
    expect(nav.selection).toBeNull();
    expect(location.hash).toBe('');
    expect(history.length).toBe(before);
    nav.destroy();
  });

  it('opens views, keeping the home view out of the URL', () => {
    history.replaceState(null, '', '/#v=structure');
    const nav = new Nav(() => index);
    expect(nav.view).toBe('structure');
    const before = history.length;
    nav.openView('code-health');
    expect(nav.view).toBe('code-health');
    expect(location.hash).toBe('#v=code-health');
    expect(history.length).toBe(before + 1);
    nav.openView('overview');
    expect(location.hash).toBe('');
    nav.openView('not-a-view');
    expect(nav.view).toBe('overview');
    nav.destroy();
  });

  it('refuses lenses Atlas has no view for yet; the caller links classic', () => {
    const nav = new Nav(() => index);
    expect(nav.openLens('coupling')).toBe(false);
    expect(nav.lens).toBe('overview');
    expect(nav.view).toBe('overview');
    nav.destroy();
  });

  it('drops a time window until something narrows to it', () => {
    history.replaceState(null, '', '/#t=2026-01..2026-03');
    const nav = new Nav(() => index);
    expect(nav.time).toBeNull();
    expect(location.hash).toBe('');
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

  it('refuses to select an unknown entity, keeping the current one', () => {
    const nav = new Nav(() => index);
    nav.select('person:mallory@evil.example');
    expect(nav.selection).toBeNull();
    nav.select(ids.file('src/api.ts'));
    nav.select('cell:2:14');
    expect(nav.selection).toBe('file:src/api.ts');
    expect(location.hash).toBe('#s=file%3Asrc%2Fapi.ts');
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
