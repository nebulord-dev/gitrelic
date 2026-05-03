import { defineConfig } from 'oxlint';

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
  ],
});
