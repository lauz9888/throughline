/* eslint-disable @typescript-eslint/no-require-imports */
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globals = require('globals');

module.exports = tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      '.nyc_output',
      'playwright-report',
      'test-results',
      'node_modules',
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
      'scripts/**/*.mjs',
      'playwright.config.ts',
      'cucumber.cjs',
      'eslint.config.js',
    ],
    languageOptions: {
      globals: globals.node,
    },
  }
);
