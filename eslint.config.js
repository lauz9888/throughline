/* eslint-disable @typescript-eslint/no-require-imports */
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      '.nyc_output',
      'playwright-report',
      'test-results',
      'node_modules',
      'storybook-static',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: [
      'features/**/*.ts',
      'tests/**/*.ts',
      'tests/**/*.mjs',
      'scripts/**/*.mjs',
      'playwright.config.ts',
      'cucumber.cjs',
      'eslint.config.js',
      '.storybook/**/*.ts',
      'vitest.storybook.config.ts',
      'vitest.config.ts',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  prettier,
);
