import { defineConfig, devices } from '@playwright/test';

// Drives both `npm run test:e2e` (Requirement 10, home.spec.ts's assertions
// for Requirements 1-6, 12, 14, 15) and, via `globalTeardown` below, the e2e
// leg of `npm run test:coverage:merge` (Requirement 11) — see design.md's
// "Coverage merge design" section. `globalTeardown` no-ops unless
// `COVERAGE=true`, so normal `test:e2e` runs are unaffected.
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
