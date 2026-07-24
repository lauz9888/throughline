import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { getBasePath } from './src/base-path';

export default defineConfig({
  base: getBasePath(process.env),
  plugins: [
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
  build: {
    sourcemap: process.env.COVERAGE === 'true',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
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
      exclude: ['src/**/*.test.ts'],
    },
  },
});
