import { buildEntityIndex, ids, lensTopEntities } from '@gitrelic/scene';
import { describe, expect, it } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import { nextFanFocus } from './fanFocus';
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
});
