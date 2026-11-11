import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { addCounters, type CoverageMapLike, type PrevCounters } from './coverage-counters';

const NYC_OUTPUT_DIR = path.resolve(process.cwd(), '.nyc_output');
const PREV_KEY = '__cov_prev';

// Custom `test` that, only when COVERAGE=true (set by scripts/merge-coverage.mjs
// for the e2e phase of `test:coverage:merge`), collects Istanbul coverage for
// each test. Under COVERAGE=true the app is built with `vite-plugin-istanbul`
// (vite.config.ts), so each document exposes `window.__coverage__`. That object
// is per-document and tests reload, so an init script synchronously flushes the
// counters into sessionStorage on pagehide; at test end we read the last
// document's counters plus the flushed ones, add them in Node (`addCounters`),
// and write `.nyc_output/<uuid>.json`, which `tests/e2e/global-teardown.ts`
// merges and remaps to source coordinates into `coverage/e2e/coverage-final.json`.
// See docs/adr/0007-canonical-coverage-inventory-and-istanbul-e2e.md.
export const test = base.extend({
  page: async ({ page }, use) => {
    const collectCoverage = process.env.COVERAGE === 'true';

    if (collectCoverage) {
      await page.addInitScript((key) => {
        let flushed = false;
        const flush = () => {
          if (flushed) return;
          flushed = true;
          const cov = (window as unknown as { __coverage__?: CoverageMapLike }).__coverage__;
          if (!cov) return;
          try {
            const prev = JSON.parse(sessionStorage.getItem(key) ?? '{}') as Record<
              string,
              { s: Record<string, number>; f: Record<string, number>; b: Record<string, number[]> }
            >;
            for (const [file, c] of Object.entries(cov)) {
              const p = (prev[file] ??= { s: {}, f: {}, b: {} });
              for (const [id, n] of Object.entries(c.s)) p.s[id] = (p.s[id] ?? 0) + n;
              for (const [id, n] of Object.entries(c.f)) p.f[id] = (p.f[id] ?? 0) + n;
              for (const [id, arms] of Object.entries(c.b)) {
                const t = (p.b[id] ??= arms.map(() => 0));
                arms.forEach((n, i) => {
                  t[i] = (t[i] ?? 0) + n;
                });
              }
            }
            sessionStorage.setItem(key, JSON.stringify(prev));
          } catch {
            // Storage unavailable: this document's counters are lost (under-count only).
          }
        };
        window.addEventListener('pagehide', flush);
        window.addEventListener('beforeunload', flush);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') flush();
        });
      }, PREV_KEY);
    }

    await use(page);

    if (collectCoverage) {
      const read = () =>
        page.evaluate(
          (key) => ({
            current: ((window as unknown as { __coverage__?: CoverageMapLike }).__coverage__ ??
              null) as CoverageMapLike | null,
            prev: JSON.parse(sessionStorage.getItem(key) ?? 'null') as PrevCounters | null,
          }),
          PREV_KEY,
        );
      // A test can end mid-navigation; the old document has flushed to
      // sessionStorage by then, so wait for the new one and read again.
      const snapshot = await read().catch(async () => {
        await page.waitForLoadState('load');
        return read();
      });
      if (snapshot.current) {
        fs.mkdirSync(NYC_OUTPUT_DIR, { recursive: true });
        fs.writeFileSync(
          path.join(NYC_OUTPUT_DIR, `${crypto.randomUUID()}.json`),
          JSON.stringify(addCounters(snapshot.current, snapshot.prev)),
        );
      }
    }
  },
});

export { expect };
