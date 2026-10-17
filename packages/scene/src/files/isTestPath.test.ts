import { describe, expect, it } from 'vitest';

import { isTestPath } from './isTestPath';

describe('isTestPath', () => {
  it('returns false for an empty path', () => {
    expect(isTestPath('')).toBe(false);
  });

  it('returns false for plain source files', () => {
    expect(isTestPath('src/index.ts')).toBe(false);
    expect(isTestPath('packages/core/src/runner.ts')).toBe(false);
    expect(isTestPath('README.md')).toBe(false);
  });

  it('detects __tests__ as a directory segment anywhere in the path', () => {
    expect(isTestPath('__tests__/foo.ts')).toBe(true);
    expect(isTestPath('src/__tests__/foo.ts')).toBe(true);
    expect(
      isTestPath('packages/a/src/__tests__/fixtures/compiler/x.expect.md'),
    ).toBe(true);
  });

  it('detects __snapshots__ as a directory segment', () => {
    expect(isTestPath('src/components/__snapshots__/Button.snap')).toBe(true);
  });

  it('detects __fixtures__ as a directory segment', () => {
    expect(isTestPath('packages/a/__fixtures__/sample.json')).toBe(true);
  });

  it('detects tests/ (plural) as a directory segment', () => {
    expect(isTestPath('tests/integration/api.ts')).toBe(true);
    expect(isTestPath('packages/core/tests/foo.ts')).toBe(true);
  });

  it('does not treat the singular test/ directory as a test path', () => {
    // 'test' singular is too ambiguous (matches latest/, contest/ contexts in some repos);
    // we keep the rule conservative and only match the plural convention.
    expect(isTestPath('src/test/foo.ts')).toBe(false);
  });

  it('detects cypress/ as a directory segment', () => {
    expect(isTestPath('cypress/e2e/checkout.cy.ts')).toBe(true);
  });

  it('detects .test. and .spec. patterns in the basename', () => {
    expect(isTestPath('src/utils/format.test.ts')).toBe(true);
    expect(isTestPath('src/utils/format.spec.ts')).toBe(true);
    expect(isTestPath('src/components/Button.test.tsx')).toBe(true);
  });

  it('does not match a basename that merely starts with "test"', () => {
    expect(isTestPath('src/tests-helper.ts')).toBe(false);
    expect(isTestPath('src/testing.ts')).toBe(false);
  });

  it('does not falsely match directory names that contain test substring', () => {
    expect(isTestPath('latest/foo.ts')).toBe(false);
    expect(isTestPath('contest/bar.ts')).toBe(false);
  });

  it('handles repo-root files (no directory segments)', () => {
    expect(isTestPath('package.json')).toBe(false);
    expect(isTestPath('foo.test.ts')).toBe(true);
  });
});
