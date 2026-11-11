import { defineConfig, type ViteUserConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { getBasePath } from './src/base-path';

export default defineConfig(async (): Promise<ViteUserConfig> => ({
  base: getBasePath(process.env),
  plugins: [
    // Coverage-only (never in `npm run build` or CD's base-path build): Istanbul-instrument
    // src/ so the e2e leg of `test:coverage:merge` can read `window.__coverage__`. See
    // docs/adr/0007-canonical-coverage-inventory-and-istanbul-e2e.md. The dynamic import keeps
    // the dev dependency out of every other config load.
    ...(process.env.COVERAGE === 'true'
      ? [
          (await import('vite-plugin-istanbul')).default({
            include: 'src/*',
            exclude: ['node_modules', 'src/**/*.test.ts', 'src/**/*.stories.ts'],
            extension: ['.ts'],
            requireEnv: false,
            forceBuildInstrument: true,
          }),
        ]
      : []),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'throughline',
        short_name: 'throughline',
        description: 'throughline',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
    }),
  ],
  test: {
    environment: 'jsdom',
    // tests/unit/ holds tests for the coverage tooling (scripts/lib, tests/e2e helpers).
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.{ts,mjs}'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['json', 'text-summary'],
      reportsDirectory: 'coverage/unit',
      // Scope this layer's coverage to actual application source. Without an
      // explicit include, v8's coverage provider sweeps in every project
      // file it can see that isn't excluded by Vitest's defaults (config
      // files like playwright.config.ts/cucumber.cjs, scripts/*, and the
      // BDD layer's own features/**/*.ts) as unexecuted 0%-covered "source,"
      // which both dilutes the combined percentage and — because those same
      // files are reported by the BDD/e2e layers under differently-cased
      // path separators — produces duplicate, un-mergeable entries for the
      // same file in the combined report.
      include: ['src/**/*.ts'],
      // Stories are test-layer artifacts (run by vitest.storybook.config.ts), not application source.
      exclude: ['src/**/*.test.ts', 'src/**/*.stories.ts'],
    },
  },
}));
