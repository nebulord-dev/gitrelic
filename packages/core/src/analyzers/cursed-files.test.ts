import { describe, it, expect } from 'vitest';

import {
  CURSED_THRESHOLD,
  findCursedFiles,
  NEAR_MISS_CAP,
  NEAR_MISS_FLOOR,
} from './cursed-files.js';
import type {
  ChurnReport,
  BusFactorReport,
  AgeMapReport,
  FileFixRate,
  FixRateReport,
  ParallelDevReport,
} from '../types.js';
import type { RawCommit } from '../utils/git.js';

function makeChurnReport(
  files: { file: string; commitCount: number; churnScore: number }[],
): ChurnReport {
  return {
    files: files.map((f) => ({
      ...f,
      category:
        f.churnScore > 75
          ? ('hot' as const)
          : f.churnScore > 40
            ? ('warm' as const)
            : ('cold' as const),
    })),
    topFiles: files
      .slice(0, 20)
      .map((f) => ({ ...f, category: 'hot' as const })),
    hotspotCount: files.filter((f) => f.churnScore > 75).length,
    summary: '',
  };
}

function makeBusFactorReport(
  files: {
    file: string;
    risk: 'critical' | 'high' | 'medium' | 'low';
    dominantAuthorPercent: number;
    uniqueAuthors: number;
  }[],
): BusFactorReport {
  return {
    files: files.map((f) => ({
      ...f,
      authors: ['alice@example.com'],
      dominantAuthor: 'alice@example.com',
    })),
    criticalFiles: files
      .filter((f) => f.risk === 'critical')
      .map((f) => ({
        ...f,
        authors: ['alice@example.com'],
        dominantAuthor: 'alice@example.com',
      })),
    overallBusFactor: 1,
    excluded: { fixture: 0, generated: 0 },
    summary: '',
  };
}

function makeAgeMapReport(
  files: { file: string; ageInDays: number }[],
): AgeMapReport {
  return {
    files: files.map((f) => ({
      ...f,
      lastCommitDate: new Date(
        Date.now() - f.ageInDays * 86_400_000,
      ).toISOString(),
      status: 'fresh' as const,
    })),
    staleFiles: [],
    ancientFiles: [],
    medianAgeDays: 0,
    thresholds: { freshLimit: 30, agingLimit: 90, staleLimit: 180 },
    source: 'history',
    dormantPackages: [],
    summary: '',
  };
}

function makeEmptyFixRate(): FixRateReport {
  return {
    files: [],
    unratedFiles: 0,
    changes: 0,
    fixedAfter: 0,
    rate: null,
    byMonth: [],
    fixCommits: 0,
    reverts: 0,
    sweepingSkipped: 0,
    blameTimeouts: 0,
    windowDays: 30,
    minChanges: 8,
    ai: { changes: 0, fixedAfter: 0, versusOthers: null },
    summary: '',
  };
}

/** A fix-rate report at a 2% repo rate with these rated files. */
function makeFixRate(
  files: Array<Pick<FileFixRate, 'file' | 'changes' | 'fixedAfter'>>,
): FixRateReport {
  return {
    ...makeEmptyFixRate(),
    rate: 0.02,
    files: files.map((f) => ({
      ...f,
      rate: f.fixedAfter / f.changes,
      fixes: [],
    })),
  };
}

function makeEmptyParallelDev(): ParallelDevReport {
  return {
    files: [],
    hotFiles: [],
    totalParallelFiles: 0,
    highParallel: 0,
    tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
    byMonth: [],
    pairs: [],
    leftOut: { sweepingCommits: 0, botCommits: 0 },
    summary: '',
  };
}

/**
 * Synthetic commit history. `findCursedFiles` only reads authorEmail and
 * files, so the rest stays minimal. `authorEmail` drives bot attribution.
 */
function makeCommits(
  count: number,
  opts: { files?: string[]; authorEmail?: string } = {},
): RawCommit[] {
  const { files = [], authorEmail = 'alice@example.com' } = opts;
  return Array.from({ length: count }, (_, i) => ({
    hash: `c${i}`,
    authorEmail,
    authorName: authorEmail.split('@')[0],
    date: '2026-03-08T12:00:00Z',
    message: 'chore: change',
    coAuthors: [],
    files,
    fileStats: [],
    insertions: 1,
    deletions: 0,
  }));
}

describe('findCursedFiles', () => {
  it('requires score >= 50 to qualify', () => {
    // high churn (>75 → 35) + high bus factor (15) = 50 → qualifies
    const churn = makeChurnReport([
      { file: 'a.ts', commitCount: 10, churnScore: 80 },
    ]);
    const bus = makeBusFactorReport([
      {
        file: 'a.ts',
        risk: 'high',
        dominantAuthorPercent: 80,
        uniqueAuthors: 2,
      },
    ]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 50 }]);

    const result = findCursedFiles(
      churn,
      bus,
      age,
      makeEmptyFixRate(),
      makeEmptyParallelDev(),
      makeCommits(20),
    );
    expect(result.files.length).toBe(1);
    expect(result.files[0].curseScore).toBe(50);
  });

  it('excludes files below threshold 50', () => {
    // warm churn (>40 → 15) + high bus factor (15) = 30 → excluded
    const churn = makeChurnReport([
      { file: 'a.ts', commitCount: 5, churnScore: 50 },
    ]);
    const bus = makeBusFactorReport([
      {
        file: 'a.ts',
        risk: 'high',
        dominantAuthorPercent: 80,
        uniqueAuthors: 2,
      },
    ]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 50 }]);

    const result = findCursedFiles(
      churn,
      bus,
      age,
      makeEmptyFixRate(),
      makeEmptyParallelDev(),
      makeCommits(20),
    );
    expect(result.files.length).toBe(0);
  });

  it('requires multiple strong signals', () => {
    // Only critical bus factor (30), no churn signal (churnScore <= 40 → 0 from churn) → excluded
    const churn = makeChurnReport([
      { file: 'a.ts', commitCount: 2, churnScore: 30 },
    ]);
    const bus = makeBusFactorReport([
      {
        file: 'a.ts',
        risk: 'critical',
        dominantAuthorPercent: 100,
        uniqueAuthors: 1,
      },
    ]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 50 }]);

    const result = findCursedFiles(
      churn,
      bus,
      age,
      makeEmptyFixRate(),
      makeEmptyParallelDev(),
      makeCommits(20),
    );
    expect(result.files.length).toBe(0);
  });

  it('combines hot churn (35) + critical bus factor (30) = 65', () => {
    const churn = makeChurnReport([
      { file: 'a.ts', commitCount: 10, churnScore: 80 },
    ]);
    const bus = makeBusFactorReport([
      {
        file: 'a.ts',
        risk: 'critical',
        dominantAuthorPercent: 100,
        uniqueAuthors: 1,
      },
    ]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 50 }]);

    const result = findCursedFiles(
      churn,
      bus,
      age,
      makeEmptyFixRate(),
      makeEmptyParallelDev(),
      makeCommits(20),
    );
    expect(result.files[0].curseScore).toBe(65);
  });

  it('caps score at 100', () => {
    // hot churn (35) + critical bus (30) + age paradox (10) + many signals
    // We need churnScore > 60 and ageInDays < 30 for the age paradox bonus
    const churn = makeChurnReport([
      { file: 'a.ts', commitCount: 50, churnScore: 95 },
    ]);
    const bus = makeBusFactorReport([
      {
        file: 'a.ts',
        risk: 'critical',
        dominantAuthorPercent: 100,
        uniqueAuthors: 1,
      },
    ]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 5 }]);

    const result = findCursedFiles(
      churn,
      bus,
      age,
      makeEmptyFixRate(),
      makeEmptyParallelDev(),
      makeCommits(50),
    );
    // 35 + 30 + 10 = 75, capped at 100 (doesn't exceed here, but test the cap mechanism)
    expect(result.files[0].curseScore).toBeLessThanOrEqual(100);
  });

  it('sorts by curseScore descending', () => {
    const churn = makeChurnReport([
      { file: 'low.ts', commitCount: 10, churnScore: 80 },
      { file: 'high.ts', commitCount: 20, churnScore: 90 },
    ]);
    const bus = makeBusFactorReport([
      {
        file: 'low.ts',
        risk: 'high',
        dominantAuthorPercent: 80,
        uniqueAuthors: 2,
      },
      {
        file: 'high.ts',
        risk: 'critical',
        dominantAuthorPercent: 100,
        uniqueAuthors: 1,
      },
    ]);
    const age = makeAgeMapReport([
      { file: 'low.ts', ageInDays: 50 },
      { file: 'high.ts', ageInDays: 50 },
    ]);

    const result = findCursedFiles(
      churn,
      bus,
      age,
      makeEmptyFixRate(),
      makeEmptyParallelDev(),
      makeCommits(30),
    );
    expect(result.files[0].file).toBe('high.ts');
    expect(result.files[0].curseScore).toBeGreaterThan(
      result.files[1].curseScore,
    );
  });

  it('includes reasons for each signal', () => {
    const churn = makeChurnReport([
      { file: 'a.ts', commitCount: 10, churnScore: 80 },
    ]);
    const bus = makeBusFactorReport([
      {
        file: 'a.ts',
        risk: 'critical',
        dominantAuthorPercent: 100,
        uniqueAuthors: 1,
      },
    ]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 50 }]);

    const result = findCursedFiles(
      churn,
      bus,
      age,
      makeEmptyFixRate(),
      makeEmptyParallelDev(),
      makeCommits(20),
    );
    expect(result.files[0].reasons.length).toBeGreaterThanOrEqual(2);
    expect(
      result.files[0].reasons.some((r) => r.toLowerCase().includes('commit')),
    ).toBe(true);
    expect(
      result.files[0].reasons.some((r) => r.toLowerCase().includes('author')),
    ).toBe(true);
  });

  it('only considers candidates from topFiles and criticalFiles', () => {
    // File exists in churn.files but NOT in topFiles or criticalFiles
    const churn: ChurnReport = {
      files: [
        { file: 'hidden.ts', commitCount: 10, churnScore: 80, category: 'hot' },
      ],
      topFiles: [], // not in topFiles
      hotspotCount: 1,
      summary: '',
    };
    const bus = makeBusFactorReport([
      {
        file: 'hidden.ts',
        risk: 'high',
        dominantAuthorPercent: 80,
        uniqueAuthors: 2,
      },
    ]);
    const age = makeAgeMapReport([{ file: 'hidden.ts', ageInDays: 50 }]);

    const result = findCursedFiles(
      churn,
      bus,
      age,
      makeEmptyFixRate(),
      makeEmptyParallelDev(),
      makeCommits(20),
    );
    expect(result.files.length).toBe(0);
  });

  it('drops fix-prone files with no churn data', () => {
    // 4 of 10 at a 2% repo rate: far above chance.
    const fixRate = makeFixRate([
      { file: 'fix-only.ts', changes: 10, fixedAfter: 4 },
    ]);

    // No churn data for fix-only.ts
    const churn = makeChurnReport([]);
    const busFactor = makeBusFactorReport([]);
    const ageMap = makeAgeMapReport([]);

    const result = findCursedFiles(
      churn,
      busFactor,
      ageMap,
      fixRate,
      makeEmptyParallelDev(),
      makeCommits(100),
    );
    expect(result.files.find((f) => f.file === 'fix-only.ts')).toBeUndefined();
  });

  it('adds 20 points for a file fixed more often than chance', () => {
    // 4 of 10 at a 2% repo rate: chance gives that well under 2.5% of the time.
    const fixRate = makeFixRate([
      { file: 'src/auth.ts', changes: 10, fixedAfter: 4 },
    ]);

    // churnScore > 75 = +35, fixed above chance = +20 → total 55
    const churn = makeChurnReport([
      {
        file: 'src/auth.ts',
        commitCount: 20,
        churnScore: 80,
      },
    ]);
    const busFactor = makeBusFactorReport([]);
    const ageMap = makeAgeMapReport([]);

    const result = findCursedFiles(
      churn,
      busFactor,
      ageMap,
      fixRate,
      makeEmptyParallelDev(),
      makeCommits(100),
    );
    const auth = result.files.find((f) => f.file === 'src/auth.ts');
    expect(auth?.curseScore).toBe(55);
    expect(auth?.breakdown.at(-1)).toEqual({
      kind: 'fixes',
      label:
        '4 of 10 changes needed a fix within 30 days, more than chance explains',
      points: 20,
    });
  });

  it('gives no fix points when chance explains the fixes', () => {
    // 1 of 10 at 2%: chance gives at least one about 18% of the time.
    const fixRate = makeFixRate([
      { file: 'src/auth.ts', changes: 10, fixedAfter: 1 },
    ]);
    const result = findCursedFiles(
      makeChurnReport([
        { file: 'src/auth.ts', commitCount: 20, churnScore: 80 },
      ]),
      makeBusFactorReport([]),
      makeAgeMapReport([]),
      fixRate,
      makeEmptyParallelDev(),
      makeCommits(100),
    );
    const all = [...result.files, ...result.nearMisses];
    expect(all.some((f) => f.breakdown.some((r) => r.kind === 'fixes'))).toBe(
      false,
    );
  });

  it('makes a file fixed more often than chance a candidate', () => {
    // Not top churn, critical or parallel: only its fix rate brings it in.
    const churn: ChurnReport = {
      ...makeChurnReport([]),
      files: [
        { file: 'quiet.ts', commitCount: 10, churnScore: 80, category: 'hot' },
      ],
    };
    const result = findCursedFiles(
      churn,
      makeBusFactorReport([]),
      makeAgeMapReport([]),
      makeFixRate([{ file: 'quiet.ts', changes: 10, fixedAfter: 4 }]),
      makeEmptyParallelDev(),
      makeCommits(100),
    );
    // Scored only because it's a candidate: churn 35 + fixes 20.
    expect(result.files.map((f) => [f.file, f.curseScore])).toEqual([
      ['quiet.ts', 55],
    ]);
  });

  it('adds parallel development bonus to curse score', () => {
    // churnScore > 75 → +35, parallelScore >= 70 → +20 = 55
    const churn = makeChurnReport([
      { file: 'a.ts', commitCount: 10, churnScore: 80 },
    ]);
    const bus = makeBusFactorReport([]);
    const age = makeAgeMapReport([]);

    const parallelDev: ParallelDevReport = {
      files: [
        {
          file: 'a.ts',
          parallelScore: 75,
          totalActiveWeeks: 10,
          parallelWeeks: 8,
          peakAuthors: 3,
          peakWindow: {
            weekStart: '2025-06-02T00:00:00Z',
            authors: ['a@x.com', 'b@x.com', 'c@x.com'],
            commitCount: 5,
          },
          topWindows: [],
          windows: [],
          narrative: 'test',
        },
      ],
      hotFiles: [
        {
          file: 'a.ts',
          parallelScore: 75,
          totalActiveWeeks: 10,
          parallelWeeks: 8,
          peakAuthors: 3,
          peakWindow: {
            weekStart: '2025-06-02T00:00:00Z',
            authors: ['a@x.com', 'b@x.com', 'c@x.com'],
            commitCount: 5,
          },
          topWindows: [],
          windows: [],
          narrative: 'test',
        },
      ],
      totalParallelFiles: 1,
      highParallel: 0,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth: [],
      pairs: [],
      leftOut: { sweepingCommits: 0, botCommits: 0 },
      summary: '',
    };

    const result = findCursedFiles(
      churn,
      bus,
      age,
      makeEmptyFixRate(),
      parallelDev,
      makeCommits(20),
    );
    expect(result.files.length).toBe(1);
    expect(result.files[0].curseScore).toBe(55); // 35 churn + 20 parallel
    expect(
      result.files[0].reasons.some((r) => r.includes('parallel development')),
    ).toBe(true);
  });

  it('includes parallel dev hot files in candidate set', () => {
    // File is NOT in churn.topFiles or busFactor.criticalFiles or fixRate's fix-prone files
    // but IS in parallelDev.hotFiles — should still be evaluated
    const churn: ChurnReport = {
      files: [
        {
          file: 'parallel-only.ts',
          commitCount: 10,
          churnScore: 80,
          category: 'hot',
        },
      ],
      topFiles: [], // not in topFiles
      hotspotCount: 0,
      summary: '',
    };
    const bus = makeBusFactorReport([
      {
        file: 'parallel-only.ts',
        risk: 'critical',
        dominantAuthorPercent: 100,
        uniqueAuthors: 1,
      },
    ]);
    const age = makeAgeMapReport([]);

    const parallelDev: ParallelDevReport = {
      files: [
        {
          file: 'parallel-only.ts',
          parallelScore: 75,
          totalActiveWeeks: 10,
          parallelWeeks: 8,
          peakAuthors: 3,
          peakWindow: {
            weekStart: '2025-06-02T00:00:00Z',
            authors: ['a@x.com', 'b@x.com', 'c@x.com'],
            commitCount: 5,
          },
          topWindows: [],
          windows: [],
          narrative: 'test',
        },
      ],
      hotFiles: [
        {
          file: 'parallel-only.ts',
          parallelScore: 75,
          totalActiveWeeks: 10,
          parallelWeeks: 8,
          peakAuthors: 3,
          peakWindow: {
            weekStart: '2025-06-02T00:00:00Z',
            authors: ['a@x.com', 'b@x.com', 'c@x.com'],
            commitCount: 5,
          },
          topWindows: [],
          windows: [],
          narrative: 'test',
        },
      ],
      totalParallelFiles: 1,
      highParallel: 0,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth: [],
      pairs: [],
      leftOut: { sweepingCommits: 0, botCommits: 0 },
      summary: '',
    };

    const result = findCursedFiles(
      churn,
      bus,
      age,
      makeEmptyFixRate(),
      parallelDev,
      makeCommits(20),
    );
    // 35 (churn) + 30 (critical bus) + 20 (parallel) = 85
    expect(
      result.files.find((f) => f.file === 'parallel-only.ts'),
    ).toBeDefined();
  });

  describe('bot-driven churn', () => {
    // 35 (churn > 75) + 15 (high bus factor) = 50, the qualifying floor.
    const cursedCandidate = () => ({
      churn: makeChurnReport([
        { file: 'CHANGELOG.md', commitCount: 20, churnScore: 80 },
      ]),
      bus: makeBusFactorReport([
        {
          file: 'CHANGELOG.md',
          risk: 'high' as const,
          dominantAuthorPercent: 80,
          uniqueAuthors: 2,
        },
      ]),
      age: makeAgeMapReport([{ file: 'CHANGELOG.md', ageInDays: 5 }]),
    });

    it('withholds files whose churn is mostly automated', () => {
      const { churn, bus, age } = cursedCandidate();
      const result = findCursedFiles(
        churn,
        bus,
        age,
        makeEmptyFixRate(),
        makeEmptyParallelDev(),
        // The real pattern behind this: semantic-release rewrites CHANGELOG.md
        // on every release, which made it the top "cursed" file in gitrelic's
        // own report despite no human ever editing it.
        makeCommits(20, {
          files: ['CHANGELOG.md'],
          authorEmail: 'semantic-release-bot@martynus.net',
        }),
      );

      expect(result.files).toHaveLength(0);
      expect(result.excludedBotFiles).toEqual(['CHANGELOG.md']);
      expect(result.summary).toContain('withheld');
    });

    it('keeps the same file when humans drive the churn', () => {
      const { churn, bus, age } = cursedCandidate();
      const result = findCursedFiles(
        churn,
        bus,
        age,
        makeEmptyFixRate(),
        makeEmptyParallelDev(),
        makeCommits(20, { files: ['CHANGELOG.md'] }),
      );

      expect(result.files.map((f) => f.file)).toEqual(['CHANGELOG.md']);
      expect(result.excludedBotFiles).toEqual([]);
    });

    it.each([
      ['Copilot', 'copilot[bot]@users.noreply.github.com'],
      ['Devin', 'devin-ai-integration[bot]@users.noreply.github.com'],
      ['Claude', 'noreply@anthropic.com'],
      ['Aider', 'aider@aider.chat'],
    ])('keeps files whose churn is %s-authored', (_name, email) => {
      // AI commits are human churn: a person prompted them and owns the result.
      // Copilot and Devin address as `…[bot]@users.noreply.github.com`, which
      // isBotEmail's catch-all matches — so this only holds while the analyzer
      // uses classifyAuthor, which checks AI patterns first. Devin has no
      // non-[bot] form at all, so every Devin commit depends on that ordering.
      const { churn, bus, age } = cursedCandidate();
      const result = findCursedFiles(
        churn,
        bus,
        age,
        makeEmptyFixRate(),
        makeEmptyParallelDev(),
        makeCommits(20, { files: ['CHANGELOG.md'], authorEmail: email }),
      );

      expect(result.files.map((f) => f.file)).toEqual(['CHANGELOG.md']);
      expect(result.excludedBotFiles).toEqual([]);
    });

    it('keeps files where bots are only a minority of the churn', () => {
      const { churn, bus, age } = cursedCandidate();
      const result = findCursedFiles(
        churn,
        bus,
        age,
        makeEmptyFixRate(),
        makeEmptyParallelDev(),
        [
          ...makeCommits(9, {
            files: ['CHANGELOG.md'],
            authorEmail: 'dependabot[bot]@users.noreply.github.com',
          }),
          ...makeCommits(11, { files: ['CHANGELOG.md'] }),
        ],
      );

      expect(result.files).toHaveLength(1);
      expect(result.excludedBotFiles).toEqual([]);
    });
  });

  describe('abandoned hot files', () => {
    const abandoned = (ageInDays = 337) => ({
      churn: makeChurnReport([
        { file: 'a.ts', commitCount: 10, churnScore: 80 },
      ]),
      bus: makeBusFactorReport([
        {
          file: 'a.ts',
          risk: 'high' as const,
          dominantAuthorPercent: 80,
          uniqueAuthors: 2,
        },
      ]),
      age: makeAgeMapReport([{ file: 'a.ts', ageInDays }]),
    });

    it('flags a file abandoned long before the repo went quiet', () => {
      const { churn, bus, age } = abandoned();
      const result = findCursedFiles(
        churn,
        bus,
        age,
        makeEmptyFixRate(),
        makeEmptyParallelDev(),
        makeCommits(10, { files: ['other.ts'] }),
      );

      expect(
        result.files[0].reasons.some((r) => r.startsWith('Heavily churned')),
      ).toBe(true);
    });

    it('does not flag a file quiet for under 180 days', () => {
      // Ages come from Age Map, counted back from the analyzed commit, so a
      // dormant repo's last-touched files are young there and this holds.
      const { churn, bus, age } = abandoned(170);
      const result = findCursedFiles(
        churn,
        bus,
        age,
        makeEmptyFixRate(),
        makeEmptyParallelDev(),
        makeCommits(10, { files: ['a.ts'] }),
      );

      expect(
        result.files[0].reasons.some((r) => r.startsWith('Heavily churned')),
      ).toBe(false);
    });
  });

  it('never lists files in excludedFiles, however hot', () => {
    const churn = makeChurnReport([
      { file: 'src/__snapshots__/a.snap', commitCount: 50, churnScore: 100 },
      { file: 'a.ts', commitCount: 10, churnScore: 80 },
    ]);
    const bus = makeBusFactorReport([
      // Both qualify on churn (35) + bus factor (15) = 50, so only the
      // exclusion set can keep the snapshot out.
      {
        file: 'src/__snapshots__/a.snap',
        risk: 'high',
        dominantAuthorPercent: 80,
        uniqueAuthors: 2,
      },
      {
        file: 'a.ts',
        risk: 'high',
        dominantAuthorPercent: 80,
        uniqueAuthors: 2,
      },
    ]);
    const age = makeAgeMapReport([
      { file: 'src/__snapshots__/a.snap', ageInDays: 50 },
      { file: 'a.ts', ageInDays: 50 },
    ]);
    const args = [
      churn,
      bus,
      age,
      makeEmptyFixRate(),
      makeEmptyParallelDev(),
      makeCommits(20),
    ] as const;

    expect(findCursedFiles(...args).files.map((f) => f.file)).toContain(
      'src/__snapshots__/a.snap',
    );
    const withExclusion = findCursedFiles(
      ...args,
      new Set(['src/__snapshots__/a.snap']),
    );
    expect(withExclusion.files.map((f) => f.file)).toEqual(['a.ts']);
  });

  // RELIC-343: the score split by reason, so a view can stack it.
  describe('points per reason', () => {
    const hotCritical = () => ({
      churn: makeChurnReport([
        { file: 'a.ts', commitCount: 10, churnScore: 80 },
      ]),
      bus: makeBusFactorReport([
        {
          file: 'a.ts',
          risk: 'critical',
          dominantAuthorPercent: 100,
          uniqueAuthors: 1,
        },
      ]),
      age: makeAgeMapReport([{ file: 'a.ts', ageInDays: 50 }]),
    });

    it('splits the score by reason, in the order of the reasons', () => {
      const { churn, bus, age } = hotCritical();
      const [file] = findCursedFiles(
        churn,
        bus,
        age,
        makeEmptyFixRate(),
        makeEmptyParallelDev(),
        makeCommits(20),
      ).files;

      expect(file.breakdown.map((r) => [r.kind, r.points])).toEqual([
        ['churn', 35],
        ['ownership', 30],
      ]);
      expect(file.breakdown.map((r) => r.label)).toEqual(file.reasons);
      expect(file.curseScore).toBe(65);
    });

    it('marks many authors as its own kind, never alongside ownership', () => {
      const churn = makeChurnReport([
        { file: 'a.ts', commitCount: 10, churnScore: 80 },
      ]);
      const bus = makeBusFactorReport([
        {
          file: 'a.ts',
          risk: 'low',
          dominantAuthorPercent: 30,
          uniqueAuthors: 8,
        },
      ]);
      const result = findCursedFiles(
        churn,
        bus,
        makeAgeMapReport([]),
        makeEmptyFixRate(),
        makeEmptyParallelDev(),
        makeCommits(20),
      );
      // 35 + 10 = 45: a near miss, which carries a breakdown too.
      const [near] = result.nearMisses;
      expect(near.breakdown.map((r) => r.kind)).toEqual(['churn', 'authors']);
    });

    it('sums to the uncapped score; curseScore is that sum capped at 100', () => {
      // churn 35 + ownership 30 + abandoned 10 + fixes 20 + parallel 20 = 115
      const { churn, bus } = hotCritical();
      const fixRate = makeFixRate([
        { file: 'a.ts', changes: 10, fixedAfter: 4 },
      ]);
      const parallelFile = {
        file: 'a.ts',
        parallelScore: 75,
        totalActiveWeeks: 10,
        parallelWeeks: 8,
        peakAuthors: 3,
        peakWindow: {
          weekStart: '2025-06-02T00:00:00Z',
          authors: ['a@x.com', 'b@x.com', 'c@x.com'],
          commitCount: 5,
        },
        topWindows: [],
        windows: [],
        narrative: '',
      };
      const parallel: ParallelDevReport = {
        ...makeEmptyParallelDev(),
        files: [parallelFile],
        hotFiles: [parallelFile],
      };
      const [file] = findCursedFiles(
        churn,
        bus,
        makeAgeMapReport([{ file: 'a.ts', ageInDays: 337 }]),
        fixRate,
        parallel,
        makeCommits(20, { files: ['other.ts'] }),
      ).files;

      expect(file.breakdown.map((r) => r.kind)).toEqual([
        'churn',
        'ownership',
        'abandoned',
        'fixes',
        'parallel',
      ]);
      expect(file.breakdown.reduce((n, r) => n + r.points, 0)).toBe(115);
      expect(file.curseScore).toBe(100);
    });
  });

  describe('near misses', () => {
    it('reports the threshold the cursed set was drawn at', () => {
      const result = findCursedFiles(
        makeChurnReport([]),
        makeBusFactorReport([]),
        makeAgeMapReport([]),
        makeEmptyFixRate(),
        makeEmptyParallelDev(),
        makeCommits(1),
      );
      expect(result.threshold).toBe(CURSED_THRESHOLD);
      expect(result.nearMisses).toEqual([]);
    });

    it('keeps files from the floor up to the threshold apart from the cursed', () => {
      // warm 15 + critical 30 = 45 (near); hot 35 + high 15 = 50 (cursed);
      // warm 15 + high 15 = 30 (neither).
      const churn = makeChurnReport([
        { file: 'near.ts', commitCount: 5, churnScore: 50 },
        { file: 'cursed.ts', commitCount: 10, churnScore: 80 },
        { file: 'low.ts', commitCount: 5, churnScore: 50 },
      ]);
      const bus = makeBusFactorReport([
        {
          file: 'near.ts',
          risk: 'critical',
          dominantAuthorPercent: 100,
          uniqueAuthors: 1,
        },
        {
          file: 'cursed.ts',
          risk: 'high',
          dominantAuthorPercent: 80,
          uniqueAuthors: 2,
        },
        {
          file: 'low.ts',
          risk: 'high',
          dominantAuthorPercent: 80,
          uniqueAuthors: 2,
        },
      ]);
      const result = findCursedFiles(
        churn,
        bus,
        makeAgeMapReport([]),
        makeEmptyFixRate(),
        makeEmptyParallelDev(),
        makeCommits(20),
      );

      expect(result.files.map((f) => f.file)).toEqual(['cursed.ts']);
      expect(result.nearMisses.map((f) => [f.file, f.curseScore])).toEqual([
        ['near.ts', 45],
      ]);
      expect(NEAR_MISS_FLOOR).toBeLessThanOrEqual(45);
      // The summary still counts only the cursed.
      expect(result.summary).toMatch(/^1 cursed file\./);
    });

    it('keeps the closest few, highest first, ties broken by churn then path', () => {
      // Critical files are always candidates: warm 15 + critical 30 = 45 each.
      const names = Array.from(
        { length: NEAR_MISS_CAP + 5 },
        (_, i) => `f${String(i).padStart(2, '0')}.ts`,
      );
      const churn = makeChurnReport(
        names.map((file, i) => ({
          file,
          commitCount: i % 3,
          churnScore: 50,
        })),
      );
      const bus = makeBusFactorReport(
        names.map((file) => ({
          file,
          risk: 'critical' as const,
          dominantAuthorPercent: 100,
          uniqueAuthors: 1,
        })),
      );
      const near = findCursedFiles(
        churn,
        bus,
        makeAgeMapReport([]),
        makeEmptyFixRate(),
        makeEmptyParallelDev(),
        makeCommits(20),
      ).nearMisses;

      expect(near).toHaveLength(NEAR_MISS_CAP);
      const expected = [...names]
        .sort(
          (a, b) =>
            (names.indexOf(b) % 3) - (names.indexOf(a) % 3) ||
            a.localeCompare(b),
        )
        .slice(0, NEAR_MISS_CAP);
      expect(near.map((f) => f.file)).toEqual(expected);
    });

    it('drops a bot-driven near miss without listing it as withheld', () => {
      const churn = makeChurnReport([
        { file: 'near.ts', commitCount: 5, churnScore: 50 },
      ]);
      const bus = makeBusFactorReport([
        {
          file: 'near.ts',
          risk: 'critical',
          dominantAuthorPercent: 100,
          uniqueAuthors: 1,
        },
      ]);
      const result = findCursedFiles(
        churn,
        bus,
        makeAgeMapReport([]),
        makeEmptyFixRate(),
        makeEmptyParallelDev(),
        makeCommits(10, {
          files: ['near.ts'],
          authorEmail: 'dependabot[bot]@users.noreply.github.com',
        }),
      );
      expect(result.nearMisses).toEqual([]);
      expect(result.excludedBotFiles).toEqual([]);
    });
  });
});
