import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { fileContributors } from './fileContributors';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;

describe('fileContributors', () => {
  it('lists authors with the dominant share', () => {
    expect(fileContributors('src/api.ts', report)).toEqual([
      { email: 'alice@example.com', name: 'Alice', percent: 100 },
    ]);
    expect(fileContributors('nope.ts', report)).toEqual([]);
  });
});
