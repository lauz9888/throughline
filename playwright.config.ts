import { defineConfig, devices } from '@playwright/test';

// NOTE (e2e-test-author scaffold): this config intentionally omits the
// coverage-fixture/global-teardown "browser coverage collection" wiring
// described in design.md's Coverage merge design section (Requirement 11,
// `test:coverage:merge`) — that plumbing is a later pipeline step. This file
// covers what's needed to run `npm run test:e2e` (Requirement 10) and the
// home.spec.ts assertions (Requirements 1-6, 12, 14, 15) per design.md's
// "Test impact" > E2E section.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  // Only spin up a local build+preview server when no BASE_URL is supplied —
  // when BASE_URL is set (the CD `e2e-live` job, post-deploy), the suite runs
  // against the already-deployed site instead.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port 4173 --strictPort',
        port: 4173,
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  globalTeardown: './tests/e2e/global-teardown.ts',
});
