import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { dirFacts } from './dirFacts';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;

describe('dirFacts', () => {
  it('sums a directory without counting lookalike siblings', () => {
    const rows = Object.fromEntries(
      dirFacts('src', report).map((r) => [r.label, r.value]),
    );
    expect(rows.Files).toBe('7');
    const lookalike = dirFacts('sr', report);
    expect(lookalike.find((r) => r.label === 'Files')?.value).toBe('0');
  });
});
