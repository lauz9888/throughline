import { test as base, expect } from '@playwright/test';
import v8toIstanbul from 'v8-to-istanbul';
import { createCoverageMap } from 'istanbul-lib-coverage';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const NYC_OUTPUT_DIR = path.resolve(process.cwd(), '.nyc_output');

// Custom `test` that, only when COVERAGE=true (set by scripts/merge-coverage.mjs
// for the e2e phase of `test:coverage:merge`), collects V8 JS coverage for
// each test, converts it to Istanbul format via `v8-to-istanbul` (using the
// sourcemaps `vite.config.ts` enables under COVERAGE=true), and writes the
// per-test coverage map into `.nyc_output/<uuid>.json` — where
// `tests/e2e/global-teardown.ts` picks it up and merges it into
// `coverage/e2e/coverage-final.json`.
export const test = base.extend({
  page: async ({ page }, use) => {
    const collectCoverage = process.env.COVERAGE === 'true';

    if (collectCoverage) {
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
    }

    await use(page);

    if (collectCoverage) {
      const entries = await page.coverage.stopJSCoverage();
      const map = createCoverageMap({});

      for (const entry of entries) {
        let pathname: string;
        try {
          pathname = decodeURIComponent(new URL(entry.url).pathname);
        } catch {
          continue;
        }

        // Only our own bundled app code lives under /assets/*.js with a
        // sibling sourcemap; skip everything else (workbox runtime, the
        // service worker, cross-origin scripts, etc).
        if (!pathname.includes('/assets/') || !pathname.endsWith('.js')) {
          continue;
        }

        const filePath = path.join(DIST_DIR, pathname.replace(/^\/+/, ''));
        if (!fs.existsSync(filePath)) {
          continue;
        }

        const converter = v8toIstanbul(filePath, 0, { source: entry.source ?? '' });
        await converter.load();
        converter.applyCoverage(entry.functions);
        map.merge(converter.toIstanbul());
        converter.destroy();
      }

      fs.mkdirSync(NYC_OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(NYC_OUTPUT_DIR, `${crypto.randomUUID()}.json`),
        JSON.stringify(map.toJSON()),
      );
    }
  },
});

export { expect };
