import { describe, expect, it } from 'vitest';

import { knowledgeSilosMetrics } from './knowledge-silos';

import type {
  GitrelicReport,
  KnowledgeConcentrationReport,
} from '@gitrelic/core';

function makeReport(kc: Partial<KnowledgeConcentrationReport>): GitrelicReport {
  return {
    knowledgeConcentration: {
      singleAuthorFiles: kc.singleAuthorFiles ?? 0,
      totalFiles: kc.totalFiles ?? 0,
      concentrationIndex: kc.concentrationIndex ?? 0,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('knowledgeSilosMetrics', () => {
  it('returns healthy zeros and em-dash when there are no files', () => {
    const metrics = knowledgeSilosMetrics(makeReport({}));
    expect(metrics).toHaveLength(4);
    expect(metrics[0].value).toBe('—');
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[1].value).toBe('0');
    expect(metrics[2].value).toBe('0');
    expect(metrics[3].value).toBe('0');
  });

  it('reports healthy index below 15%', () => {
    const metrics = knowledgeSilosMetrics(
      makeReport({
        singleAuthorFiles: 5,
        totalFiles: 100,
        concentrationIndex: 5,
      }),
    );
    expect(metrics[0].value).toBe('5%');
    expect(metrics[0].color).toBe('var(--severity-healthy)');
  });

  it('warns at mid concentration (15-29%)', () => {
    const metrics = knowledgeSilosMetrics(
      makeReport({
        singleAuthorFiles: 20,
        totalFiles: 100,
        concentrationIndex: 20,
      }),
    );
    expect(metrics[0].color).toBe('var(--severity-warning)');
    expect(metrics[1].color).toBe('var(--severity-warning)');
  });

  it('marks critical concentration at 30% or above', () => {
    const metrics = knowledgeSilosMetrics(
      makeReport({
        singleAuthorFiles: 40,
        totalFiles: 100,
        concentrationIndex: 40,
      }),
    );
    expect(metrics[0].color).toBe('var(--severity-critical)');
  });

  it('rounds concentration index to one decimal', () => {
    const metrics = knowledgeSilosMetrics(
      makeReport({
        singleAuthorFiles: 1,
        totalFiles: 7,
        concentrationIndex: 14.285,
      }),
    );
    expect(metrics[0].value).toBe('14.3%');
  });

  it('derives Multi-Author Files as total minus single-author', () => {
    const metrics = knowledgeSilosMetrics(
      makeReport({ singleAuthorFiles: 7, totalFiles: 25 }),
    );
    expect(metrics[3].value).toBe('18');
  });
});
