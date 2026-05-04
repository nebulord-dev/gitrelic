import { describe, expect, it } from 'vitest';

import { ghostFilesMetrics } from './ghost-files';
import type {
  GhostFile,
  GhostFilesReport,
  GitrelicReport,
} from '@gitrelic/core';

function makeGhostFile(authorInactiveDays: number, loc = 100): GhostFile {
  return {
    file: `f${authorInactiveDays}.ts`,
    dominantAuthor: `g${authorInactiveDays}@x.com`,
    dominantAuthorPercent: 90,
    lastAuthorCommitDate: '2024-01-01',
    authorInactiveDays,
    loc,
  };
}

function makeReport(
  ghost: Partial<GhostFilesReport> = {},
  totalLines = 100_000,
): GitrelicReport {
  return {
    ghostFiles: {
      files: ghost.files ?? [],
      totalGhostFiles: ghost.totalGhostFiles ?? 0,
      ghostOwners: ghost.ghostOwners ?? 0,
      ghostLoc: ghost.ghostLoc ?? 0,
      tierMix: ghost.tierMix ?? { trueGhost: 0, fading: 0 },
      summary: '',
    },
    loc: { totalLines } as GitrelicReport['loc'],
  } as unknown as GitrelicReport;
}

describe('ghostFilesMetrics', () => {
  it('returns exactly 5 slots in canonical order', () => {
    const m = ghostFilesMetrics(makeReport());
    expect(m).toHaveLength(5);
    expect(m.map((s) => s.label)).toEqual([
      'Ghost Files',
      'Ghost Owners',
      'True Ghosts (≥365d)',
      'Fading (180–364d)',
      'Ghost LOC',
    ]);
  });

  describe('slot 1 — Ghost Files', () => {
    it('healthy at 0', () => {
      expect(
        ghostFilesMetrics(makeReport({ totalGhostFiles: 0 }))[0].color,
      ).toBe('var(--severity-healthy)');
    });
    it('warning at 1..9', () => {
      expect(
        ghostFilesMetrics(makeReport({ totalGhostFiles: 5 }))[0].color,
      ).toBe('var(--severity-warning)');
    });
    it('critical at 10+', () => {
      expect(
        ghostFilesMetrics(makeReport({ totalGhostFiles: 10 }))[0].color,
      ).toBe('var(--severity-critical)');
    });
  });

  describe('slot 2 — Ghost Owners', () => {
    it('healthy at 0', () => {
      expect(ghostFilesMetrics(makeReport({ ghostOwners: 0 }))[1].color).toBe(
        'var(--severity-healthy)',
      );
    });
    it('warning at 1..2', () => {
      expect(ghostFilesMetrics(makeReport({ ghostOwners: 2 }))[1].color).toBe(
        'var(--severity-warning)',
      );
    });
    it('critical at 3+', () => {
      expect(ghostFilesMetrics(makeReport({ ghostOwners: 3 }))[1].color).toBe(
        'var(--severity-critical)',
      );
    });
  });

  describe('slot 3 — True Ghosts', () => {
    it('healthy at 0', () => {
      expect(
        ghostFilesMetrics(
          makeReport({ tierMix: { trueGhost: 0, fading: 0 } }),
        )[2].color,
      ).toBe('var(--severity-healthy)');
    });
    it('critical at 1+', () => {
      expect(
        ghostFilesMetrics(
          makeReport({ tierMix: { trueGhost: 1, fading: 0 } }),
        )[2].color,
      ).toBe('var(--severity-critical)');
    });
  });

  describe('slot 4 — Fading', () => {
    it('healthy at 0', () => {
      expect(
        ghostFilesMetrics(
          makeReport({ tierMix: { trueGhost: 0, fading: 0 } }),
        )[3].color,
      ).toBe('var(--severity-healthy)');
    });
    it('warning at 1..9', () => {
      expect(
        ghostFilesMetrics(
          makeReport({ tierMix: { trueGhost: 0, fading: 5 } }),
        )[3].color,
      ).toBe('var(--severity-warning)');
    });
    it('critical at 10+', () => {
      expect(
        ghostFilesMetrics(
          makeReport({ tierMix: { trueGhost: 0, fading: 10 } }),
        )[3].color,
      ).toBe('var(--severity-critical)');
    });
  });

  describe('slot 5 — Ghost LOC', () => {
    it('value renders absolute LOC formatted', () => {
      expect(
        ghostFilesMetrics(makeReport({ ghostLoc: 12_345 }, 100_000))[4].value,
      ).toBe('12,345');
    });
    it('healthy when ghostLoc < 2% of totalLines', () => {
      expect(
        ghostFilesMetrics(makeReport({ ghostLoc: 1_900 }, 100_000))[4].color,
      ).toBe('var(--severity-healthy)');
    });
    it('warning when ghostLoc is 2..9% of totalLines', () => {
      expect(
        ghostFilesMetrics(makeReport({ ghostLoc: 5_000 }, 100_000))[4].color,
      ).toBe('var(--severity-warning)');
    });
    it('critical when ghostLoc >= 10% of totalLines', () => {
      expect(
        ghostFilesMetrics(makeReport({ ghostLoc: 10_000 }, 100_000))[4].color,
      ).toBe('var(--severity-critical)');
    });
    it('healthy when totalLines is 0 (empty repo)', () => {
      expect(ghostFilesMetrics(makeReport({ ghostLoc: 0 }, 0))[4].color).toBe(
        'var(--severity-healthy)',
      );
    });
  });
});
