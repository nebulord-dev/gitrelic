import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { normalizeReport } from './normalizeReport';
import { packageResolver, packagesOf } from './packages';
import type { GitrelicReport } from '@gitrelic/core';

describe('packageResolver', () => {
  // Mirrors core's utils/workspace.ts: the same cases, the same answers.
  const of = packageResolver([
    'apps/web',
    'compiler/packages/babel',
    'compiler',
  ]);

  it('maps a file to the longest root containing it', () => {
    expect(of('apps/web/src/main.ts')).toBe('apps/web');
    expect(of('compiler/packages/babel/src/a.ts')).toBe(
      'compiler/packages/babel',
    );
    expect(of('compiler/scripts/x.ts')).toBe('compiler');
  });

  it('falls back to convention, then the top-level folder, then the root', () => {
    expect(of('libs/ui/index.ts')).toBe('libs/ui');
    expect(of('packages/extra/a.ts')).toBe('packages/extra');
    expect(of('scripts/build.js')).toBe('scripts');
    expect(of('README.md')).toBe('');
    expect(of('apps/README.md')).toBe('apps');
  });
});

describe('packagesOf', () => {
  it('reads the report’s workspace, once per report', () => {
    const report = {
      ...(reportJson as unknown as GitrelicReport),
      workspace: { sources: ['pnpm'], roots: ['apps/web'] },
    } as GitrelicReport;
    expect(packagesOf(report)('apps/web/a.ts')).toBe('apps/web');
    expect(packagesOf(report)).toBe(packagesOf(report));
  });

  it('backfills an older report with its packages/<name> roots', () => {
    const old = normalizeReport({
      loc: {
        files: [
          { file: 'packages/react/src/a.js', lines: 1, language: 'JavaScript' },
          { file: 'apps/web/a.ts', lines: 1, language: 'TypeScript' },
        ],
      } as never,
    });
    expect(old.workspace).toEqual({
      sources: ['convention'],
      roots: ['packages/react'],
    });
    const of = packagesOf(old);
    expect(of('packages/react/src/a.js')).toBe('packages/react');
    // The convention fallback splits apps/ too, as a new report would.
    expect(of('apps/web/a.ts')).toBe('apps/web');
  });
});
