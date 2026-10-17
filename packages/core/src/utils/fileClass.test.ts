import { describe, expect, it } from 'vitest';

import { classifyFile } from './fileClass.js';

describe('classifyFile', () => {
  it.each([
    'src/index.ts',
    'packages/core/src/runner.ts',
    'README.md',
    'package.json',
    '',
  ])('source: %s', (p) => {
    expect(classifyFile(p)).toBe('source');
  });

  describe('test', () => {
    it.each([
      '__tests__/foo.ts',
      'src/__tests__/foo.ts',
      'tests/integration/api.ts',
      'packages/core/tests/foo.ts',
      'cypress/e2e/checkout.cy.ts',
      'src/utils/format.test.ts',
      'src/utils/format.spec.ts',
      'src/components/Button.test.tsx',
      'foo.test.ts',
    ])('%s', (p) => {
      expect(classifyFile(p)).toBe('test');
    });

    it('does not treat the singular test/ directory as a test path', () => {
      // Too ambiguous to trust; the plural is the dominant convention.
      expect(classifyFile('src/test/foo.ts')).toBe('source');
    });

    it.each([
      'src/tests-helper.ts',
      'src/testing.ts',
      'latest/foo.ts',
      'contest/bar.ts',
    ])('does not match the substring "test": %s', (p) => {
      expect(classifyFile(p)).toBe('source');
    });
  });

  describe('fixture', () => {
    it.each([
      'packages/a/__fixtures__/sample.json',
      'src/components/__snapshots__/Button.test.tsx.snap',
      'src/__mocks__/fs.ts',
      'pkg/testdata/input.txt',
      'test/fixtures/repo.json',
      'spec/fixture/data.yml',
      'src/Button.snap',
    ])('%s', (p) => {
      expect(classifyFile(p)).toBe('fixture');
    });

    it('wins over test when a fixture lives under a test directory', () => {
      // React's compiler: ~550 of these were "critical" bus-factor files.
      expect(
        classifyFile(
          'compiler/packages/babel-plugin-react-compiler/src/__tests__/fixtures/compiler/x.expect.md',
        ),
      ).toBe('fixture');
    });
  });

  describe('generated', () => {
    it.each([
      'src/__generated__/schema.ts',
      'src/api.generated.ts',
      'proto/user.pb.go',
      'proto/user_pb2.py',
      'lib/model.g.dart',
      'public/vendor.min.js',
      'public/site.min.css',
      'vendor/github.com/x/y.go',
      'third_party/zlib/inflate.c',
    ])('%s', (p) => {
      expect(classifyFile(p)).toBe('generated');
    });

    it('wins over fixture and test', () => {
      expect(classifyFile('tests/__generated__/fixtures/a.ts')).toBe(
        'generated',
      );
    });

    it('does not treat a plain "generated" word in a filename as generated', () => {
      expect(classifyFile('src/generatedReport.ts')).toBe('source');
    });
  });

  it('matches directory rules only on whole path segments', () => {
    expect(classifyFile('src/vendors/a.ts')).toBe('source');
    expect(classifyFile('src/fixtures.ts')).toBe('source');
  });
});
