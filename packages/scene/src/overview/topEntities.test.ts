import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { CATALOG } from '../catalog';
import { buildEntityIndex } from '../entities';
import { lensTopEntities } from './topEntities';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const index = buildEntityIndex(report);

describe('lensTopEntities', () => {
  it("ranks a lens's entities, each one the index resolves", () => {
    const hot = lensTopEntities('hotspots', report, index);
    expect(hot.length).toBeGreaterThan(0);
    for (const e of hot) expect(index.get(e.id)).toBeDefined();
    const scores = hot.map((e) => Number(e.value.replace('score ', '')));
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('fans people for people lenses', () => {
    const people = lensTopEntities('contributors', report, index);
    expect(people[0].id.startsWith('person:')).toBe(true);
  });

  it('respects the limit and never repeats an entity', () => {
    const files = lensTopEntities('hotspots', report, index, 3);
    expect(files).toHaveLength(3);
    expect(new Set(files.map((f) => f.id)).size).toBe(3);
  });

  it('returns nothing for lenses without entities, or unknown ones', () => {
    expect(lensTopEntities('languages', report, index)).toEqual([]);
    expect(lensTopEntities('nope', report, index)).toEqual([]);
  });

  it('drops ids the index does not know', () => {
    const withStranger = {
      ...report,
      churn: {
        ...report.churn,
        topFiles: [
          { file: 'not/in/the/repo.ts', commitCount: 999 },
          ...report.churn.topFiles,
        ],
      },
    } as GitrelicReport;
    const fanned = lensTopEntities('churn', withStranger, index);
    expect(fanned.some((e) => e.id === 'file:not/in/the/repo.ts')).toBe(false);
  });

  it('every lens outside Overview has a source (Languages by design empty)', () => {
    for (const e of CATALOG.filter((c) => c.group !== 'overview')) {
      const fanned = lensTopEntities(e.id, report, index);
      expect(Array.isArray(fanned)).toBe(true);
    }
  });
});
