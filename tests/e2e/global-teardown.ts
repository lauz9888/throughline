// NOTE (e2e-test-author scaffold): design.md's global-teardown design also
// merges per-test browser coverage (written to `.nyc_output/`) into
// `coverage/e2e/coverage-final.json` via `nyc merge`, as part of Requirement
// 11's `test:coverage:merge` support. That merge plumbing (and the paired
// `tests/e2e/coverage-fixture.ts`) is out of scope for this step — this file
// exists only because `playwright.config.ts` requires a resolvable
// `globalTeardown` module. It is a documented no-op until the coverage-merge
// work wires up `COVERAGE=true` behavior here.
export default async function globalTeardown(): Promise<void> {
  if (process.env.COVERAGE !== 'true') {
    return;
  }
}
