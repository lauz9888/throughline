// Coverage-merge pipeline (`npm run test:coverage:merge`). Runs all four test layers with
// coverage on — Vitest v8 (unit), Vitest browser-mode v8 over the Storybook stories (Storybook),
// nyc/ts-node Istanbul around Cucumber (BDD), and an Istanbul-instrumented COVERAGE=true build
// under Playwright (e2e, see `tests/e2e/coverage-fixture.ts`) — then combines them onto one
// canonical inventory and prints combined statement and branch coverage per the output contract
// in .claude/STANDARDS.md's "Coverage measurement" section. Exits non-zero on any validity
// failure; investigation signals are printed but never fail the run. See
// docs/adr/0007-canonical-coverage-inventory-and-istanbul-e2e.md.
//
// `--no-run` skips the test runs and re-combines the existing coverage/<layer>/ files.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import istanbulLibCoverage from 'istanbul-lib-coverage';
import istanbulLibReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';
import {
  PRIMARY_LAYERS,
  SECONDARY_LAYERS,
  loadLayer,
  enumerateSource,
  combineCoverage,
  checkNonZero,
  checkInventoryAgainstDisk,
  checkReconciled,
  checkStatementsOnCode,
  checkDedupe,
  findCalibrationPoints,
  checkCalibration,
  checkDeterministic,
  collectSignals,
  formatReport,
} from './lib/coverage-merge.mjs';

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

if (!process.argv.includes('--no-run')) {
  // 1. Clean stale output.
  rm(coverageDir);
  rm(nycOutputDir);

  // 2. Unit tests with coverage (coverage/unit, per vite.config.ts's `test.coverage`).
  run('npx', ['vitest', 'run', '--coverage']);

  // 3. Storybook stories under Vitest browser mode with coverage (coverage/storybook, per
  // vitest.storybook.config.ts; independent of .nyc_output/).
  run('npx', ['vitest', 'run', '--config', 'vitest.storybook.config.ts', '--coverage']);

  // 4. BDD under nyc's require-hook Istanbul instrumentation (coverage/bdd).
  run('npx', ['nyc', '--reporter=json', '--report-dir=coverage/bdd', 'cucumber-js']);

  // 5. Reset .nyc_output/ — nyc's raw BDD dump must not bleed into the e2e merge.
  rm(nycOutputDir);

  // 6. e2e against the COVERAGE=true (Istanbul-instrumented) build; global-teardown.ts writes
  // coverage/e2e and removes .nyc_output/ again.
  run('npx', ['playwright', 'test'], { env: { ...process.env, COVERAGE: 'true' } });
}

// 7. Load, verify and combine.
const sourceCache = new Map();
const sourceLines = (file) => {
  if (!sourceCache.has(file)) {
    const abs = path.join(root, file);
    sourceCache.set(file, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').split(/\r?\n/) : []);
  }
  return sourceCache.get(file);
};

const invalid = [];
const layers = {};
for (const layer of [...PRIMARY_LAYERS, ...SECONDARY_LAYERS]) {
  try {
    layers[layer] = loadLayer(coverageDir, layer, root);
  } catch (err) {
    invalid.push(err.message);
  }
}
if (invalid.length) {
  for (const msg of invalid) console.error(`Coverage invalid: ${msg}`);
  process.exit(1);
}

const pick = (names) => Object.fromEntries(names.map((n) => [n, layers[n]]));
const args = { primary: pick(PRIMARY_LAYERS), secondary: pick(SECONDARY_LAYERS), sourceLines };
const result = combineCoverage(args);
const diskFiles = enumerateSource(root);

invalid.push(
  ...checkNonZero(result),
  ...checkInventoryAgainstDisk(Object.keys(result.data), diskFiles),
  ...checkReconciled(result),
  ...checkStatementsOnCode(layers, sourceLines),
  ...checkDedupe(args.primary, result),
  ...checkCalibration(findCalibrationPoints(diskFiles, sourceLines), layers, result),
  ...checkDeterministic(args, result),
);
const signals = collectSignals(layers, result);

// 8. Write the combined map and print a text-summary plus the contract lines.
const mergedDir = path.join(coverageDir, 'merged');
fs.mkdirSync(mergedDir, { recursive: true });
fs.writeFileSync(path.join(mergedDir, 'coverage-final.json'), JSON.stringify(result.data));
const context = createContext({ dir: mergedDir, coverageMap: createCoverageMap(result.data) });
reports.create('text-summary', {}).execute(context);

for (const line of formatReport({ layers, diskFiles, result, signals })) console.log(line);

if (invalid.length) {
  for (const msg of invalid) console.error(`Coverage invalid: ${msg}`);
  console.error(
    `${invalid.length} validity check failure(s) — the figures above are not valid (see .claude/STANDARDS.md).`,
  );
  process.exit(1);
}
