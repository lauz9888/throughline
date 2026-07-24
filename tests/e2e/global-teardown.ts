import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Real teardown logic for Requirement 11's `test:coverage:merge`: merges the
// per-test raw V8→Istanbul coverage dumps written into `.nyc_output/` by
// `tests/e2e/coverage-fixture.ts` (only populated when COVERAGE=true) into a
// single `coverage/e2e/coverage-final.json`, then removes the now-redundant
// `.nyc_output/` directory. No-ops immediately for normal (non-coverage)
// `npm run test:e2e` runs.
export default async function globalTeardown(): Promise<void> {
  if (process.env.COVERAGE !== 'true') {
    return;
  }

  const nycOutputDir = path.resolve(process.cwd(), '.nyc_output');
  if (!fs.existsSync(nycOutputDir)) {
    return;
  }

  const outDir = path.resolve(process.cwd(), 'coverage/e2e');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'coverage-final.json');

  execFileSync('npx', ['nyc', 'merge', nycOutputDir, outFile], {
    stdio: 'inherit',
    shell: true,
  });

  fs.rmSync(nycOutputDir, { recursive: true, force: true });
}
