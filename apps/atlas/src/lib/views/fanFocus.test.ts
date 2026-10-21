import { buildEntityIndex, ids, lensTopEntities } from '@gitrelic/scene';
import { describe, expect, it } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import { fanFold, nextFanFocus } from './fanFocus';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const index = buildEntityIndex(report);
const hotspots = ids.analyzer('hotspots');

describe('nextFanFocus', () => {
  it('fans a selected lens and closes on a cleared selection', () => {
    expect(nextFanFocus(null, hotspots, report, index)).toBe(hotspots);
    expect(nextFanFocus(hotspots, null, report, index)).toBeNull();
  });

  it('keeps the fan while one of its entities is selected', () => {
    const [first] = lensTopEntities('hotspots', report, index);
    expect(nextFanFocus(hotspots, first.id, report, index)).toBe(hotspots);
  });

  it('closes it for an entity outside the fan', () => {
    expect(
      nextFanFocus(hotspots, ids.person('nobody@example.com'), report, index),
    ).toBeNull();
    expect(
      nextFanFocus(null, ids.file('src/api.ts'), report, index),
    ).toBeNull();
  });

  it('opens a selected view, and moves between views and lenses', () => {
    const structure = ids.view('structure');
    expect(nextFanFocus(null, structure, report, index)).toBe(structure);
    expect(nextFanFocus(structure, hotspots, report, index)).toBe(hotspots);
    expect(nextFanFocus(hotspots, structure, report, index)).toBe(structure);
  });

  it('closes a view for an entity, which only a lens fan can hold', () => {
    const [first] = lensTopEntities('hotspots', report, index);
    expect(
      nextFanFocus(ids.view('code-health'), first.id, report, index),
    ).toBeNull();
  });
});

describe('fanFold', () => {
  const codeHealth = ids.view('code-health');

  it('folds a file picked from a fan back to its lens', () => {
    const [first] = lensTopEntities('hotspots', report, index);
    expect(fanFold(first.id, hotspots, 'fan')).toBe(hotspots);
    expect(fanFold(first.id, hotspots, 'ring')).toBe(hotspots);
  });

  it('folds a lens on the Fan to its own view, so the Fan stays on it', () => {
    expect(fanFold(hotspots, hotspots, 'fan')).toBe(codeHealth);
    expect(
      fanFold(ids.analyzer('bus-factor'), ids.analyzer('bus-factor'), 'fan'),
    ).toBe(ids.view('ownership-risk'));
  });

  it('folds a lens on the Ring, a view, or nothing, to nothing', () => {
    expect(fanFold(hotspots, hotspots, 'ring')).toBeNull();
    expect(fanFold(codeHealth, codeHealth, 'fan')).toBeNull();
    expect(fanFold(null, null, 'fan')).toBeNull();
  });
});
