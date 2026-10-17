import { defineConfig } from 'oxlint';

// Value imports from core bundle Node.js (execa, node:fs) into the browser.
const coreTypeOnly = {
  name: '@gitrelic/core',
  allowTypeImports: true,
  message:
    'Browser code may only `import type` from @gitrelic/core (see CLAUDE.md).',
};

// Scene is shared by a React and a Svelte app and bundled for the browser.
const sceneBrowserOnly = [
  {
    group: ['react', 'react-dom', 'react/*', 'svelte', 'svelte/*'],
    message: '@gitrelic/scene must stay framework-free.',
  },
  {
    group: ['node:*', 'execa', 'fs', 'fs/*', 'path', 'os', 'child_process'],
    message: '@gitrelic/scene runs in the browser.',
  },
];

export default defineConfig({
  plugins: ['typescript', 'react'],
  ignorePatterns: [
    'dist/**',
    '.turbo/**',
    'coverage/**',
    'build/**',
    '.sickbay/**',
  ],
  rules: {
    // TypeScript
    'no-unused-vars': 'warn',
    'typescript/no-explicit-any': 'warn',

    // React
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react/react-in-jsx-scope': 'off',
  },
  overrides: [
    {
      files: ['*.test.ts', '*.test.tsx'],
      rules: {
        'typescript/no-explicit-any': 'off',
      },
    },
    {
      files: ['apps/web/src/**', 'apps/atlas/src/**'],
      rules: {
        'typescript/no-restricted-imports': [
          'error',
          { paths: [coreTypeOnly] },
        ],
      },
    },
    {
      // Overrides replace a rule rather than merge it, so scene repeats the
      // core restriction. Scene is shared by a React and a Svelte app and is
      // bundled for the browser: no framework, no Node.
      files: ['packages/scene/src/**'],
      rules: {
        'typescript/no-restricted-imports': [
          'error',
          {
            paths: [coreTypeOnly],
            patterns: sceneBrowserOnly,
          },
        ],
        // Scene compiles with verbatimModuleSyntax, which Vite honors per
        // file: `import { type X } from '@gitrelic/core'` survives as the
        // side-effect import `import {} from '@gitrelic/core'` and drags core
        // (and execa) into the browser bundle. Require `import type { X }`.
        'typescript/no-import-type-side-effects': 'error',
      },
    },
    {
      // Scene tests run in Node and never reach a bundle, so they may call
      // core directly, e.g. to check an adapter against the real encoder.
      files: ['packages/scene/src/**/*.test.ts'],
      rules: {
        'typescript/no-restricted-imports': [
          'error',
          { patterns: sceneBrowserOnly },
        ],
      },
    },
  ],
});
