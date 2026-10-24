import { describe, expect, it, vi } from 'vitest';

import { ageReport } from '../../test/ageReport';
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
    expect(byId.get('coupling')?.grade).toBe(0);
    expect(byId.get('languages')?.reason).toBeUndefined();
  });

  it('reads Commit Timing as the repo’s off-hours share', () => {
    const withOffHours = {
      ...report,
      commitTiming: {
        ...report.commitTiming,
        offHours: {
          commits: 100,
          offHours: 12,
          rate: 0.12,
          minCommits: 10,
          packages: [
            {
              package: 'packages/server',
              commits: 40,
              offHours: 12,
              percent: 30,
              allowed: 8,
              aboveChance: true,
            },
            {
              package: '',
              commits: 20,
              offHours: 2,
              percent: 10,
              allowed: 5,
              aboveChance: false,
            },
            {
              package: 'src',
              commits: 30,
              offHours: 3,
              percent: 10,
              allowed: 7,
              aboveChance: false,
            },
          ],
        },
      },
    } as GitrelicReport;
    const byId = new Map(lensReadings(withOffHours).map((r) => [r.preset, r]));
    expect(byId.get('commit-timing')?.value).toBe('12% off-hours');
  });

  it('reads missing data as a dash, not a zero that looks like a finding', () => {
    const byId = new Map(
      lensReadings(normalizeReport({})).map((r) => [r.preset, r]),
    );
    expect(byId.get('churn')?.value).toBe('—');
    expect(byId.get('languages')?.value).toBe('—');
    expect(byId.get('bus-factor')?.value).toBe('—');
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

  it("formats both numbers in English, whatever the viewer's locale", () => {
    const local = vi
      .spyOn(Number.prototype, 'toLocaleString')
      .mockReturnValue('7.009');
    try {
      const big = {
        ...report,
        meta: { ...report.meta, totalFiles: 7009 },
        loc: { ...report.loc, totalLines: 998_700 },
      };
      expect(repoReading(big).sub).toBe('7,009 files · 999K lines');
    } finally {
      local.mockRestore();
    }
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

  it('reads Age as its dormant packages, else its cold share', () => {
    const age = (r: GitrelicReport) =>
      lensReadings(r).find((x) => x.preset === 'age-map')!;
    expect(age(ageReport())).toMatchObject({ value: '1 dormant', grade: 2 });
    expect(age(ageReport({ dormantPackages: [] })).value).toBe('20% cold');
  });
});
