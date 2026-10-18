import { describe, expect, it } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import { fileSections } from './fileSections';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;

describe('fileSections', () => {
  it('offers only sections that render, Activity always', () => {
    expect(fileSections('src/api.ts', report).map((s) => s.anchor)).toContain(
      'insp-people',
    );
    // A file with advice leads with it.
    expect(fileSections('src/helpers.ts', report)[0]).toEqual({
      anchor: 'insp-todo',
      label: 'What to do',
    });
    expect(fileSections('nope.ts', report)).toEqual([
      { anchor: 'insp-activity', label: 'Activity' },
    ]);
  });
});
