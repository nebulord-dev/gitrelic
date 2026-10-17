import { describe, expect, it } from 'vitest';

import commitsJson from '../../test/fixtures/commits.small.json';
import reportJson from '../../test/fixtures/report.small.json';
import { fromCommitIndex, fromRawCommits } from '../commits/commitLike';
import { normalizeReport } from './normalizeReport';
import type { CommitIndex, GitrelicReport } from '@gitrelic/core';

// The fixture feeds scene's layout tests and the Atlas dev server. These
// checks fail when it falls behind the report shape; regenerate it with
// `node scripts/make-scene-fixtures.mjs`.
const report = reportJson as unknown as GitrelicReport;
const index = commitsJson as unknown as CommitIndex;

describe('small report fixture', () => {
  it('has every field normalizeReport would backfill', () => {
    expect(normalizeReport(report)).toEqual(report);
  });

  it('pairs with a commit index built from the same commits', () => {
    expect(report.commits.length).toBeGreaterThan(0);
    expect(fromCommitIndex(index)).toEqual(fromRawCommits(report.commits));
  });
});
