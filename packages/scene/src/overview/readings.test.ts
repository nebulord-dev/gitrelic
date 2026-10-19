import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { CATALOG } from '../catalog';
import { normalizeReport } from '../report/normalizeReport';
import { lensReadings, repoReading } from './readings';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;

describe('lensReadings', () => {
  it('reads every lens outside Overview, in lens order, each with a value', () => {
    const readings = lensReadings(report);
    expect(readings.map((r) => r.preset)).toEqual(
      CATALOG.filter((e) => e.group !== 'overview').map((e) => e.id),
    );
    for (const r of readings) {
      expect(r.value.length).toBeGreaterThan(0);
      expect(r.value).not.toMatch(/NaN|undefined/);
    }
  });

  it('grades only lenses with an outlier rule; the rest stay quiet', () => {
    const byId = new Map(lensReadings(report).map((r) => [r.preset, r]));
    expect(byId.get('languages')?.grade).toBe(0);
    expect(byId.get('dead-code')?.grade).toBe(0);
    expect(byId.get('languages')?.reason).toBeUndefined();
  });

  it('reads missing data as a dash, not a zero that looks like a finding', () => {
    const byId = new Map(
      lensReadings(normalizeReport({})).map((r) => [r.preset, r]),
    );
    expect(byId.get('churn')?.value).toBe('—');
    expect(byId.get('languages')?.value).toBe('—');
    expect(byId.get('knowledge-silos')?.value).toBe('—');
  });
});

describe('repoReading', () => {
  it('names the repo, then its size', () => {
    const big = {
      ...report,
      meta: { ...report.meta, totalFiles: 7009 },
      loc: { ...report.loc, totalLines: 998_700 },
    };
    expect(repoReading(big)).toEqual({
      label: 'sample-repo',
      sub: '7,009 files · 999K lines',
    });
  });

  it('leaves out what an older or empty report lacks', () => {
    const bare = normalizeReport({});
    const reading = repoReading({
      ...bare,
      repoName: 'r',
      meta: { ...bare.meta, totalFiles: 2 },
    });
    expect(reading).toEqual({ label: 'r', sub: '2 files' });
  });
});
