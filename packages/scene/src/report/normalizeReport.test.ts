import { describe, expect, it } from 'vitest';

import { normalizeReport } from './normalizeReport';

describe('normalizeReport', () => {
  it('defaults testCoverage.files to empty array when raw report omits it', () => {
    const raw = {
      testCoverage: {
        directories: [],
        uncoveredDirectories: [],
        overallRatio: 0,
        summary: 'old report',
      },
    };
    const out = normalizeReport(raw as any);
    expect(out.testCoverage.files).toEqual([]);
  });

  it('preserves testCoverage.files when present', () => {
    const raw = {
      testCoverage: {
        directories: [],
        uncoveredDirectories: [],
        files: [{ file: 'a.ts', hasTestSibling: true }],
        overallRatio: 0,
        summary: '',
      },
    };
    const out = normalizeReport(raw as any);
    expect(out.testCoverage.files).toHaveLength(1);
    expect(out.testCoverage.files[0].hasTestSibling).toBe(true);
  });

  it('defaults entire testCoverage when missing', () => {
    const out = normalizeReport({} as any);
    expect(out.testCoverage.files).toEqual([]);
    expect(out.testCoverage.directories).toEqual([]);
  });

  it('fills empty defaults for new forensics aggregates on older reports', () => {
    const result = normalizeReport({});
    expect(result.forensics.keywordTiers).toEqual({
      critical: 0,
      moderate: 0,
      mild: 0,
    });
    expect(result.forensics.byMonth).toEqual([]);
  });

  it('fills ageMap.thresholds from meta.ageInDays when the field is absent (older report)', () => {
    const result = normalizeReport({
      meta: { ageInDays: 365 } as never,
      ageMap: {
        files: [],
        medianAgeDays: 0,
        summary: '',
      } as never,
    });
    expect(result.ageMap.thresholds).toEqual({
      freshLimit: 29,
      agingLimit: 120,
      staleLimit: 241,
    });
  });

  it('backfills ageMap.source and dormantPackages for reports before RELIC-374', () => {
    const result = normalizeReport({
      meta: { ageInDays: 365 } as never,
      ageMap: {
        files: [],
        medianAgeDays: 0,
        summary: '',
      } as never,
    });
    // Older reports aged only the files touched in their window.
    expect(result.ageMap.source).toBe('window');
    expect(result.ageMap.dormantPackages).toEqual([]);
  });

  it('backfills coupling’s packages and families and blast radius’s floor for older reports', () => {
    const result = normalizeReport({
      coupling: {
        pairs: [],
        fileProfiles: [],
        topPairs: [],
        summary: '',
      } as never,
      blastRadius: { files: [], topBlasters: [], summary: '' } as never,
    });
    expect(result.coupling.packageCommits).toEqual([]);
    expect(result.coupling.packages).toEqual([]);
    expect(result.coupling.families).toEqual([]);
    // No file in an older report has a median, so none is rated.
    expect(result.blastRadius.minCommits).toBe(8);
    expect(result.blastRadius.rated).toBe(0);
  });

  it('preserves ageMap.thresholds from a fresh report and does not overwrite', () => {
    const result = normalizeReport({
      meta: { ageInDays: 100 } as never,
      ageMap: {
        files: [],
        medianAgeDays: 0,
        thresholds: { freshLimit: 8, agingLimit: 33, staleLimit: 66 },
        summary: '',
      } as never,
    });
    expect(result.ageMap.thresholds).toEqual({
      freshLimit: 8,
      agingLimit: 33,
      staleLimit: 66,
    });
  });

  it('fills empty defaults for new contributors aggregates on a pre-RELIC-306 contributors object', () => {
    // Simulate a report generated before top3CommitShare and newcomers90d landed:
    // contributors exists but lacks the two new fields. The previous object-level
    // ?? fallback would skip them, leaving them undefined. Field-level defaults
    // must rescue them.
    const result = normalizeReport({
      contributors: {
        contributors: [],
        activeContributors: [],
        ghostContributors: [],
        topContributor: {
          email: '',
          name: '',
          commitCount: 0,
          firstCommit: '',
          lastCommit: '',
          filesOwned: 0,
          linesChanged: 0,
          activeDays: 0,
          focusAreas: [],
          isActive: false,
          isGhost: false,
        },
        summary: 'old report',
      } as never,
    });

    expect(result.contributors.top3CommitShare).toBe(0);
    expect(result.contributors.newcomers90d).toBe(0);
  });

  it('preserves contributors aggregates from a fresh report and does not overwrite', () => {
    const result = normalizeReport({
      contributors: {
        contributors: [],
        activeContributors: [],
        ghostContributors: [],
        topContributor: {
          email: '',
          name: '',
          commitCount: 0,
          firstCommit: '',
          lastCommit: '',
          filesOwned: 0,
          linesChanged: 0,
          activeDays: 0,
          focusAreas: [],
          isActive: false,
          isGhost: false,
        },
        summary: '',
        top3CommitShare: 67.5,
        newcomers90d: 4,
      } as never,
    });
    expect(result.contributors.top3CommitShare).toBe(67.5);
    expect(result.contributors.newcomers90d).toBe(4);
  });

  it('fills empty defaults for new commit-timing aggregates on a pre-0.40 commitTiming object', () => {
    // Simulate a report from GitRelic ≤ 0.39: commitTiming exists but lacks the
    // new aggregates added in 0.40 (repoHourDayMatrix, highStress, tierMix,
    // byMonth, authorStress). The object-level ?? fallback would skip these,
    // leaving them undefined. Field-level defaults must rescue them.
    const result = normalizeReport({
      commitTiming: {
        files: [],
        stressFiles: [],
        repoLateNightPercent: 0,
        repoWeekendPercent: 0,
        summary: 'old report',
      } as never,
    });

    expect(result.commitTiming.repoHourDayMatrix).toHaveLength(7);
    for (const row of result.commitTiming.repoHourDayMatrix) {
      expect(row).toHaveLength(24);
      expect(row.every((cell) => cell === 0)).toBe(true);
    }
    expect(result.commitTiming.highStress).toBe(0);
    expect(result.commitTiming.tierMix).toEqual({
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    });
    expect(result.commitTiming.byMonth).toEqual([]);
    expect(result.commitTiming.authorStress).toEqual([]);
  });

  it('fills empty defaults for new co-author aggregates on a pre-0.45 coAuthors object', () => {
    // Simulate a report from GitRelic ≤ 0.44: coAuthors exists but lacks the
    // new aggregates added in 0.45 (aiAssistedCommits, humanAuthoredCommits,
    // aiAdoptionPercent, aiAdoptionTier, aiAuthors, humanPairs,
    // filteredBotCommits, byMonth, perAuthorMix). The object-level ?? fallback
    // would skip these, leaving them undefined. Field-level defaults must
    // rescue them.
    const result = normalizeReport({
      coAuthors: {
        pairs: [],
        authorStats: [],
        totalCoAuthoredCommits: 0,
        summary: 'old report',
      } as never,
    });

    expect(result.coAuthors.aiAssistedCommits).toBe(0);
    expect(result.coAuthors.humanAuthoredCommits).toBe(0);
    expect(result.coAuthors.aiAdoptionPercent).toBe(0);
    expect(result.coAuthors.aiAdoptionTier).toBe('none');
    expect(result.coAuthors.aiAuthors).toEqual([]);
    expect(result.coAuthors.humanPairs).toEqual([]);
    expect(result.coAuthors.filteredBotCommits).toBe(0);
    expect(result.coAuthors.byMonth).toEqual([]);
    expect(result.coAuthors.perAuthorMix).toEqual([]);
  });

  // cursedFiles changed from CursedFile[] to CursedFilesReport in RELIC-307.
  // This lift is the entire backward-compat story for every report written
  // before that, so both directions are pinned here.
  it('lifts a pre-RELIC-307 cursedFiles array into a report object', () => {
    const raw = {
      cursedFiles: [
        {
          file: 'a.ts',
          curseScore: 80,
          reasons: ['Modified in 40% of all commits'],
          churn: 12,
          authors: 1,
          ageDays: 30,
          narrative: 'a.ts is a problem.',
        },
      ],
    };

    const out = normalizeReport(raw as any);
    expect(out.cursedFiles.files).toHaveLength(1);
    expect(out.cursedFiles.files[0].file).toBe('a.ts');
    // Old reports predate bot filtering, so nothing was withheld when written.
    expect(out.cursedFiles.excludedBotFiles).toEqual([]);
  });

  it('preserves a fresh cursedFiles report object', () => {
    const raw = {
      cursedFiles: {
        files: [
          {
            file: 'b.ts',
            curseScore: 60,
            reasons: [],
            churn: 5,
            authors: 2,
            ageDays: 10,
            narrative: '',
          },
        ],
        excludedBotFiles: ['CHANGELOG.md'],
        summary: '1 cursed file. 1 file withheld as machine-generated churn.',
      },
    };

    const out = normalizeReport(raw as any);
    expect(out.cursedFiles.files).toHaveLength(1);
    expect(out.cursedFiles.excludedBotFiles).toEqual(['CHANGELOG.md']);
    expect(out.cursedFiles.summary).toContain('withheld');
  });

  it('defaults cursedFiles entirely when the field is missing', () => {
    const out = normalizeReport({} as any);
    expect(out.cursedFiles.files).toEqual([]);
    expect(out.cursedFiles.excludedBotFiles).toEqual([]);
    expect(out.cursedFiles.nearMisses).toEqual([]);
    expect(out.cursedFiles.threshold).toBe(50);
  });

  // Per-reason points (RELIC-343) arrived after the report object. Older
  // files get an empty breakdown: the split is unknown, not zero points.
  it('backfills breakdown, near misses and the threshold on older reports', () => {
    const file = {
      file: 'c.ts',
      curseScore: 55,
      reasons: ['x'],
      churn: 9,
      authors: 1,
      ageDays: 3,
      narrative: '',
    };
    const fromObject = normalizeReport({
      cursedFiles: { files: [file], excludedBotFiles: [], summary: '' },
    } as any);
    const fromArray = normalizeReport({ cursedFiles: [file] } as any);
    for (const out of [fromObject, fromArray]) {
      expect(out.cursedFiles.files[0].breakdown).toEqual([]);
      expect(out.cursedFiles.files[0].reasons).toEqual(['x']);
      expect(out.cursedFiles.nearMisses).toEqual([]);
      expect(out.cursedFiles.threshold).toBe(50);
    }
  });

  it('keeps a current breakdown, threshold and near misses as written', () => {
    const breakdown = [{ kind: 'churn', label: 'x', points: 35 }];
    const near = { file: 'n.ts', curseScore: 45, reasons: ['x'], breakdown };
    const out = normalizeReport({
      cursedFiles: {
        files: [{ file: 'c.ts', curseScore: 60, reasons: ['x'], breakdown }],
        excludedBotFiles: [],
        threshold: 50,
        nearMisses: [near],
        summary: '',
      },
    } as any);
    expect(out.cursedFiles.files[0].breakdown).toEqual(breakdown);
    expect(out.cursedFiles.nearMisses).toEqual([near]);
  });

  it('defaults identities to an empty list on pre-0.49 reports', () => {
    expect(normalizeReport({} as any).identities).toEqual([]);
  });

  it('preserves identities from a fresh report', () => {
    const identities = [
      {
        canonicalEmail: 'ann@corp.com',
        name: 'Ann Lee',
        aliases: [
          { email: 'ann@corp.com', name: 'Ann Lee', commits: 2 },
          { email: 'ann@home.net', name: 'Ann Lee', commits: 1 },
        ],
      },
    ];
    expect(normalizeReport({ identities } as any).identities).toBe(identities);
  });

  it('backfills fileClasses and busFactors.excluded on reports without them', () => {
    const out = normalizeReport({
      busFactors: {
        files: [],
        criticalFiles: [],
        overallBusFactor: 1,
        summary: 'old',
      },
    } as any);
    expect(out.fileClasses).toEqual({});
    expect(out.busFactors.excluded).toEqual({ fixture: 0, generated: 0 });
    expect(out.busFactors.overallBusFactor).toBe(1);
  });

  it('preserves fileClasses and excluded counts from a fresh report', () => {
    const fileClasses = { 'a.snap': 'fixture' };
    const out = normalizeReport({
      fileClasses,
      busFactors: {
        files: [],
        criticalFiles: [],
        overallBusFactor: 1,
        excluded: { fixture: 3, generated: 2 },
        summary: '',
      },
    } as any);
    expect(out.fileClasses).toBe(fileClasses);
    expect(out.busFactors.excluded).toEqual({ fixture: 3, generated: 2 });
  });

  it('backfills fixRate on reports from before it, and keeps a real one', () => {
    const old = normalizeReport({} as any).fixRate;
    expect(old.files).toEqual([]);
    expect(old.rate).toBeNull();
    expect(old.windowDays).toBe(0);
    const fixRate = {
      files: [],
      rate: 0.02,
      windowDays: 30,
      ai: { changes: 4, fixedAfter: 1, versusOthers: null },
    };
    expect(normalizeReport({ fixRate } as any).fixRate).toBe(fixRate);
  });

  it('backfills fix rate’s AI split on reports from before it', () => {
    const out = normalizeReport({ fixRate: { files: [], rate: 0.02 } } as any);
    expect(out.fixRate.rate).toBe(0.02);
    expect(out.fixRate.ai).toEqual({
      changes: 0,
      fixedAfter: 0,
      versusOthers: null,
    });
  });

  it('backfills AI-authored counts, tools, agents and packages on older co-author reports', () => {
    const out = normalizeReport({
      coAuthors: {
        pairs: [],
        byMonth: [{ month: '2026-01', aiAssisted: 1, pureHuman: 2, total: 3 }],
      },
    } as any).coAuthors;
    expect(out.aiAuthoredCommits).toBe(0);
    expect(out.aiTools).toEqual([]);
    expect(out.aiAgents).toEqual([]);
    expect(out.packages).toEqual([]);
    expect(out.sweepingLeftOut).toBe(0);
    expect(out.byMonth).toEqual([
      {
        month: '2026-01',
        aiAssisted: 1,
        pureHuman: 2,
        total: 3,
        aiAuthored: 0,
      },
    ]);
  });

  it('backfills parallel dev’s pairs, left-out counts and windows on older reports', () => {
    const window = {
      weekStart: '2026-01-05T00:00:00.000Z',
      authors: ['a@x', 'b@x'],
      commitCount: 2,
    };
    const old = {
      file: 'a.ts',
      parallelScore: 40,
      totalActiveWeeks: 5,
      parallelWeeks: 2,
      peakAuthors: 2,
      peakWindow: window,
      topWindows: [window],
      narrative: '',
    };
    const r = normalizeReport({
      parallelDev: {
        files: [old],
        hotFiles: [old],
        totalParallelFiles: 1,
        highParallel: 0,
        tierMix: { low: 0, medium: 1, high: 0, critical: 0 },
        byMonth: [],
        summary: 'x',
      },
    } as never);
    expect(r.parallelDev.pairs).toEqual([]);
    expect(r.parallelDev.leftOut).toEqual({
      sweepingCommits: 0,
      botCommits: 0,
    });
    expect(r.parallelDev.files[0].windows).toEqual([window]);
    expect(r.parallelDev.totalParallelFiles).toBe(1);
    // Missing entirely: empty.
    expect(normalizeReport({}).parallelDev.files).toEqual([]);
  });

  it('backfills Commit Timing’s off-hours on reports from before it', () => {
    const r = normalizeReport({ commitTiming: { files: [] } } as never);
    expect(r.commitTiming.offHours).toEqual({
      commits: 0,
      offHours: 0,
      rate: 0,
      minCommits: 10,
      packages: [],
    });
  });
});
