# 0007. Canonical coverage inventory and Istanbul-instrumented e2e

Status: Accepted
Date: 2026-11-11

## Context

Waypoint's updated standards (`.claude/STANDARDS.md`, "Coverage measurement") require the
combined coverage figure to be provably valid — one canonical inventory of statements and
branches, verified against the source on disk and reconciled against every layer — and gate
branches alongside statements. Measured against those rules, `npm run test:coverage:merge` was
invalid in three ways:

1. **The e2e layer counted lines, not statements.** It converted Playwright's V8
   `page.coverage` with `v8-to-istanbul` over the minified production bundle, which yields one
   "statement" per source line — comments, blank lines and type-only lines included. The e2e
   layer reported 2,355 statements against 976 real ones (`src/aspiration-fields.ts`: 109 vs 9).
2. **Layers were raw-merged.** `CoverageMap.merge` keys by exact location, and the four
   providers place the same statement differently, so each layer's copy counted separately: the
   combined figure was 97.33% of 4,999 "statements" when the source has 977.
3. **Branches weren't measured**, and the shared exclusions had drifted (the Storybook layer
   excluded `src/main.ts`; the unit layer didn't; nyc instrumented step definitions).

## Decision

- **e2e via Istanbul.** Under `COVERAGE=true` only, `vite.config.ts` dynamically imports
  `vite-plugin-istanbul` and instruments `src/`. `tests/e2e/coverage-fixture.ts` reads
  `window.__coverage__`, carrying counters across reloads with a synchronous `sessionStorage`
  flush on `pagehide`; `tests/e2e/global-teardown.ts` remaps them to source coordinates with
  `istanbul-lib-source-maps`. The e2e layer now reports exactly the unit layer's statement
  count for every file. Coverage runs get a 90s test timeout (the instrumented bundle is slower).
- **One canonical inventory** (`scripts/lib/coverage-merge.mjs`). The unit and Storybook layers
  seed it, keyed by file + start line + kind + ordinal; BDD and e2e hits are credited onto it.
  The seed is then verified, every run: against a disk enumeration of `src/` (minus the one
  shared exclusion list), and by reconciling every BDD/e2e item that matches no inventory item —
  each must fall in a declared artefact class or the run fails.
- **Three declared artefact classes**, all BDD-only: ts-node compiles `src/` to CommonJS for
  Cucumber, and nyc instruments that emit, so `require()` calls for `import` lines,
  `exports.x = …` bindings for `export function`/`export const`, and re-export getters for
  `export { … } from` appear as statements/functions with no ES-module counterpart (71 items on
  first run; listed with their predicates in `ARTEFACT_CLASSES`). e2e reconciles with zero
  unmatched items.
- **Validity checks fail the run; investigation signals don't.** Missing/unparseable layer
  files, zero totals, inventory vs disk mismatch, unreconciled items, statements on blank or
  comment lines, a failed de-duplication recount, a hit on the calibration statement, and
  order-dependent totals all exit non-zero. Uniform non-zero hit counts, missing function/branch
  data, statement excess (after classified artefacts), and a layer with no zero-hit statements
  are printed as `Coverage signal:` lines only.
- **Calibration point:** the `generateId()` fallback in `src/goal-storage.ts`, taken only when
  `crypto.randomUUID` is missing — which no test environment lacks — marked
  `coverage-calibration: unreachable`.
- **Gate statements and branches at 90% each**, in `ci.yml` and `.claude/STANDARDS.md`.
- **One exclusion list** — `src/**/*.ts` minus tests, stories and `.d.ts` — now shared by
  `vite.config.ts`, `vitest.storybook.config.ts`, `.nycrc.json`, the e2e instrumentation and
  the merge script. `src/main.ts` is in scope.

## Alternatives considered

- **V8 over an unminified build:** `v8-to-istanbul` still applies ranges at generated-line
  granularity and produces no reliable branch data.
- **Switching unit/Storybook to `@vitest/coverage-istanbul`:** wouldn't align BDD's CommonJS
  emit, so reconciliation would still be needed — and it trades a provider swap for nothing.
- **Union of every layer's items:** inflates the denominator with BDD's CommonJS plumbing.
- **Dropping unmatched secondary items silently** (what a seed-only inventory does): hides any
  real code the primary layers miss. Requiring each to be classified keeps that visible.

## Consequences

- Figures changed because measurement changed, not tests: statements 97.33% (raw union) →
  98.77% (965/977), branches newly reported at 91.84% (259/282). `.claude/STANDARDS.md`'s
  coverage method version is `v2`; reports from before this change are `v1`.
- A new BDD-only artefact (e.g. from a different TypeScript emit) fails the run until it's
  classified with evidence — intended, but it can surprise whoever changes the BDD toolchain.
- A test that crashes before the fixture's final read loses that test's e2e counters
  (under-count only).
- `vite-plugin-istanbul`, `istanbul-lib-source-maps` and its types are new dev dependencies;
  `v8-to-istanbul` is removed. Production builds and installs are unaffected.
