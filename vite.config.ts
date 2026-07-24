import { defineConfig } from 'vitest/config';

// NOTE (test-author scaffold stub): this file currently only carries the
// Vitest `test` field needed to run src/app.test.ts and src/base-path.test.ts.
// Per design.md, the full vite.config.ts also needs `base: getBasePath(...)`
// (from src/base-path.ts) and the `plugins: [VitePWA({...})]` / `build.sourcemap`
// settings — left out here because those depend on src/base-path.ts and the
// vite-plugin-pwa/@fontsource packages, which are the implementer's (Step 8)
// responsibility to add, not this test-authoring step's.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['json', 'text-summary'],
      reportsDirectory: 'coverage/unit',
    },
  },
});
