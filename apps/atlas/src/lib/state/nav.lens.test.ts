import { buildEntityIndex } from '@gitrelic/scene';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import { Nav } from './nav.svelte';
import type { GitrelicReport } from '@gitrelic/core';

// No preset has an Atlas view yet; pretend Hotspots and Churn do, so the
// lens and form paths can run.
vi.mock('@gitrelic/scene', async (importOriginal) => {
  const scene = await importOriginal<typeof import('@gitrelic/scene')>();
  const ATLAS = new Set(['hotspots', 'churn']);
  const withAtlas = (id: string) => {
    const entry = scene.catalogEntry(id);
    return entry && { ...entry, atlas: ATLAS.has(id) };
  };
  return {
    ...scene,
    catalogEntry: withAtlas,
    defaultLens: (group: string) =>
      group === 'code-health' ? 'hotspots' : null,
  };
});

const index = buildEntityIndex(reportJson as unknown as GitrelicReport);
const forms = (lens: string) => (lens === 'hotspots' ? ['by-package'] : []);

beforeEach(() => history.replaceState(null, '', '/'));
afterEach(() => history.replaceState(null, '', '/'));

describe('Nav lenses and forms', () => {
  it('opens a view on its default lens, keeping the default out of the URL', () => {
    const nav = new Nav(() => index, window, forms);
    nav.openView('code-health');
    expect(nav.lens).toBe('hotspots');
    expect(location.hash).toBe('#v=code-health');
    nav.destroy();
  });

  it('opens a lens in its own view, from anywhere', () => {
    const nav = new Nav(() => index, window, forms);
    expect(nav.openLens('churn')).toBe(true);
    expect(nav.view).toBe('code-health');
    expect(location.hash).toBe('#v=code-health&l=churn');
    nav.destroy();
  });

  it('reads a lens only inside its own view', () => {
    history.replaceState(null, '', '/#v=structure&l=churn');
    const nav = new Nav(() => index, window, forms);
    expect(nav.view).toBe('structure');
    expect(nav.lens).toBeNull();
    expect(location.hash).toBe('#v=structure');
    nav.destroy();
  });

  it('keeps only forms the lens declares, and pushes a history entry', () => {
    history.replaceState(null, '', '/#v=code-health&f=by-package');
    const nav = new Nav(() => index, window, forms);
    expect(nav.form).toBe('by-package');
    nav.setForm('swimlanes');
    expect(nav.form).toBe('by-package');
    const before = history.length;
    nav.setForm(null);
    expect(location.hash).toBe('#v=code-health');
    expect(history.length).toBe(before + 1);
    nav.openLens('churn');
    nav.setForm('by-package');
    expect(nav.form).toBeNull();
    nav.destroy();
  });
});
