import fs from 'node:fs';
import path from 'node:path';
import { createCoverageMap } from 'istanbul-lib-coverage';
import { createSourceMapStore } from 'istanbul-lib-source-maps';

// Real teardown logic for `test:coverage:merge`: merges the per-test Istanbul
// coverage dumps written into `.nyc_output/` by `tests/e2e/coverage-fixture.ts`
// (only populated when COVERAGE=true), remaps them from the built code's
// coordinates to original-source coordinates via each file's embedded
// `inputSourceMap` (`istanbul-lib-source-maps`), writes a single
// `coverage/e2e/coverage-final.json`, then removes `.nyc_output/` so it can't
// bleed into another phase. No-ops immediately for normal (non-coverage)
// `npm run test:e2e` runs.
export default async function globalTeardown(): Promise<void> {
  if (process.env.COVERAGE !== 'true') {
    return;
  }

  const nycOutputDir = path.resolve(process.cwd(), '.nyc_output');
  if (!fs.existsSync(nycOutputDir)) {
    return;
  }

  const map = createCoverageMap({});
  for (const name of fs.readdirSync(nycOutputDir).sort()) {
    if (!name.endsWith('.json')) continue;
    map.merge(JSON.parse(fs.readFileSync(path.join(nycOutputDir, name), 'utf8')));
  }

  const transformed = await createSourceMapStore().transformCoverage(map);

  const outDir = path.resolve(process.cwd(), 'coverage/e2e');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'coverage-final.json'), JSON.stringify(transformed.toJSON()));

  fs.rmSync(nycOutputDir, { recursive: true, force: true });
}
