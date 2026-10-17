import { defineConfig } from 'oxlint';

// Value imports from core bundle Node.js (execa, node:fs) into the browser.
const coreTypeOnly = {
  name: '@gitrelic/core',
  allowTypeImports: true,
  message:
    'Browser code may only `import type` from @gitrelic/core (see CLAUDE.md).',
};

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
            patterns: [
              {
                group: ['react', 'react-dom', 'react/*', 'svelte', 'svelte/*'],
                message: '@gitrelic/scene must stay framework-free.',
              },
              {
                group: ['node:*'],
                message: '@gitrelic/scene runs in the browser.',
              },
            ],
          },
        ],
      },
    },
  ],
});
