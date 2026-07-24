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
    },
  },
});
