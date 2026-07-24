// Coverage-merge pipeline for Requirement 11 (`npm run test:coverage:merge`).
// Combines Vitest's native v8 coverage (unit), Cucumber's nyc/ts-node
// Istanbul instrumentation (BDD), and Playwright's Chromium `page.coverage`
// (converted via v8-to-istanbul, see `tests/e2e/coverage-fixture.ts`) into a
// single combined statement-coverage percentage. See design.md's "Coverage
// merge design" section for the full rationale, in particular why
// `.nyc_output/` must be reset between the BDD and e2e phases.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import istanbulLibCoverage from 'istanbul-lib-coverage';
import istanbulLibReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const { createCoverageMap } = istanbulLibCoverage;
const { createContext } = istanbulLibReport;

const root = process.cwd();
const coverageDir = path.join(root, 'coverage');
const nycOutputDir = path.join(root, '.nyc_output');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: true,
    cwd: root,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(' ')}`);
  }
}

function rm(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function readCoverageFinal(dir) {
  const file = path.join(dir, 'coverage-final.json');
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// 1. Clean stale output.
rm(coverageDir);
rm(nycOutputDir);

// 2. Unit tests with coverage (writes coverage/unit/coverage-final.json per
// vite.config.ts's `test.coverage` block).
run('npx', ['vitest', 'run', '--coverage']);

// 3. BDD tests under Istanbul instrumentation (nyc's require-hook
// instruments src/**/*.ts as Cucumber's Node process requires it via
// ts-node/register). Writes coverage/bdd/coverage-final.json.
run('npx', ['nyc', '--reporter=json', '--report-dir=coverage/bdd', 'cucumber-js']);

// 4. Reset .nyc_output/ again, immediately after step 3 and before step 5 —
// nyc's own raw per-process dump from the BDD run is still sitting in
// .nyc_output/ and must not bleed into the e2e-only merge below.
rm(nycOutputDir);

// 5. e2e tests with browser coverage collection (COVERAGE=true flips on
// build.sourcemap in vite.config.ts and tells coverage-fixture.ts to
// collect per-test coverage into .nyc_output/, which global-teardown.ts
// merges into coverage/e2e/coverage-final.json before deleting
// .nyc_output/ again).
run('npx', ['playwright', 'test'], { env: { ...process.env, COVERAGE: 'true' } });

// 6. Merge all three layer-pure coverage-final.json files into one map.
const map = createCoverageMap({});
const layers = ['unit', 'bdd', 'e2e'];
let mergedAny = false;

for (const layer of layers) {
  const data = readCoverageFinal(path.join(coverageDir, layer));
  if (data) {
    map.merge(data);
    mergedAny = true;
  } else {
    console.warn(`Warning: no coverage-final.json found for the "${layer}" layer.`);
  }
}

if (!mergedAny) {
  throw new Error('No coverage data was produced by any test layer — nothing to merge.');
}

const mergedDir = path.join(coverageDir, 'merged');
fs.mkdirSync(mergedDir, { recursive: true });
fs.writeFileSync(path.join(mergedDir, 'coverage-final.json'), JSON.stringify(map.toJSON()));

// 7. Print a text-summary and the single combined percentage as the last
// line of output (parsed by qa-reviewer at pipeline Step 12).
const context = createContext({ dir: mergedDir, coverageMap: map });
const textSummaryReport = reports.create('text-summary', {});
textSummaryReport.execute(context);

// createCoverageMap doesn't itself expose a single combined summary, so sum
// each file's summary via the coverage map's fileCoverageFor helper.
const combined = map.files().reduce((acc, file) => {
  const fileSummary = map.fileCoverageFor(file).toSummary();
  return acc ? acc.merge(fileSummary) : fileSummary;
}, undefined);

const statementPct = combined ? combined.statements.pct : 0;

console.log(`Combined coverage: ${statementPct.toFixed(2)}%`);
