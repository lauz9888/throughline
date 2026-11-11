# Stack facts

## test-frameworks

Vitest (unit, jsdom), Cucumber.js (BDD, `.feature` files over a jsdom `World`), Playwright (e2e), and Storybook 10 with `@storybook/addon-vitest` (component stories, run as a Vitest browser-mode suite in Chromium).

## unit-test

- Unit tests live alongside source as `src/<module>.test.ts`, run with `npm run test:unit` (Vitest, jsdom environment; one file: `npx vitest run <path>`). Tests for the coverage tooling itself (`scripts/lib`, `tests/e2e` helpers) live under `tests/unit/**/*.test.{ts,mjs}`.
- Match the naming/style/location of the existing test files you find via Grep/Glob before writing new ones.
- **Accessibility**: `jest-axe` is wired up (`vitest.setup.ts` registers the `toHaveNoViolations` matcher). For any component/DOM-producing code you're covering, follow the pattern in `src/app.test.ts`: append the rendered root to `document.body`, run `axe(root, { runOnly: { type: 'tag', values: WCAG_TAGS }, rules: { 'color-contrast': { enabled: false } } })` for each meaningfully distinct DOM state (e.g. closed/open), and `expect(results).toHaveNoViolations()`. Existing test files declare `WCAG_TAGS` as a file-level const; its value must be exactly `.waypoint/config.json`'s `wcagTags`. Disable `color-contrast` here specifically — jsdom has no real rendering engine and the check throws rather than evaluates; contrast is covered at the e2e and Storybook layers instead. Remove the `root` from `document.body` in a `finally` afterward so it doesn't leak into later tests.

## bdd-test

- Feature files live under `features/*.feature`, step definitions under `features/step_definitions/<feature>.steps.ts`, and the shared `World` (a fresh JSDOM with `<div id="app">` per scenario) in `features/support/world.ts`. Run with `npm run test:bdd` (Cucumber.js via `cucumber.cjs`, TypeScript through ts-node; one file: `npx cucumber-js features/<name>.feature`).
- BDD scenarios describe user-observable behavior in Gherkin (Given/When/Then), at a coarser grain than unit tests and narrower than full e2e specs — they exercise a module's behavior against the jsdom `World`, without a real browser.
- Match the existing conventions (the `World`, hooks, step phrasing style) before writing new ones.
- **Accessibility**: this layer doesn't run automated WCAG scans (that's `jest-axe`, `@storybook/addon-a11y` and `@axe-core/playwright` at the unit, Storybook and e2e layers), but where a scenario covers user-observable behavior with an accessibility dimension in `requirements.md` (keyboard operability, focus management, accessible name/role), drive and assert it the way a screen-reader/keyboard-only user would — e.g. "the add-item button's accessible name is..." in `features/step_definitions/add-item-button.steps.ts` — rather than reaching into implementation details.

## e2e-test

- E2e specs live under `tests/e2e/*.spec.ts`. Run with `npm run test:e2e` (Playwright; `pretest:e2e` installs Chromium). With no `BASE_URL`, the Playwright config builds and serves the app itself on `http://localhost:4173`, so you don't need a separate dev server running.
- Every spec imports `test` and `expect` from `./coverage-fixture`, never directly from `@playwright/test` — the fixture collects the Istanbul counters the e2e coverage leg needs (see `coverage`). Follow `tests/e2e/home.spec.ts`.
- These specs are also re-run against the live GitHub Pages deployment after merge (CD's `e2e-live` job, with `BASE_URL` set) and against a `GITHUB_PAGES=true` build in the base-path smoke check — the app is served under `/throughline/` there. Use relative paths resolved against `baseURL` (e.g. `page.goto('./')`), never absolute `/…` paths or a hardcoded `localhost`.
- Match existing conventions (fixtures, helpers) before writing new ones.
- **Accessibility**: `@axe-core/playwright` is installed. For any new or changed page/flow, follow the pattern in `tests/e2e/home.spec.ts` and `tests/e2e/add-item-button.spec.ts`: `new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()`, then `expect(results.violations).toEqual([])`, with the file-level `WCAG_TAGS` const exactly equal to `.waypoint/config.json`'s `wcagTags`. Since this runs in a real browser, it catches color-contrast violations (deliberately skipped at the unit layer) — scan every meaningfully distinct visible state a real user would reach (e.g. a dropdown/modal in its open state), not just the page at load.

## storybook-test

- Stories are co-located as `src/<module>.stories.ts` next to `src/<module>.ts` (not under `tests/`), one file per UI module named in the design's Storybook story spec; `unit-test-author` writes them alongside the unit tests. Follow `src/aspiration-modal.stories.ts`.
- Import `Meta`/`StoryObj` from `@storybook/html-vite` and `expect`, `fn`, `within`, `userEvent`, `waitFor` from `storybook/test` — never from `vitest`.
- `render` returns an HTMLElement built by calling the real `init*`/`open*` module, hosted in the `div#app` from `.storybook/story-helpers.ts`'s `createAppRoot()`. Mock the same dependencies the sibling unit test does: where the module takes a `storage` option, pass `createMemoryStorage(seed)` from `.storybook/memory-storage.ts`, created inside `render` so each story gets its own seeded state; where it reads `window.localStorage` directly (the create modals), use a per-story `beforeEach` that clears the `throughline:*` keys and returns a cleanup. Every story's `beforeEach` cleanup also calls the module's `destroy()` and `removeOverlays()`.
- Stories showing a modal or confirm dialog set `parameters.a11y.context: 'body'`, because overlays attach to `document.body`.
- Run with `npm run test:storybook` (`vitest run --config vitest.storybook.config.ts`, headless Chromium; one file: `npx vitest run --config vitest.storybook.config.ts <path>`). The full-suite step also runs `npm run build-storybook` first.
- **Accessibility**: `@storybook/addon-a11y` is configured once in `.storybook/preview.ts` with `test: 'error'` and `runOnly` scoped to a `WCAG_TAGS` const that must equal `.waypoint/config.json`'s `wcagTags`. It scans every story after its `play` in real Chromium (color-contrast included), so don't call axe in stories, and never disable it for a story without a documented reason.

## coverage

Implemented by `scripts/merge-coverage.mjs` and `scripts/lib/coverage-merge.mjs` (`npm run test:coverage:merge`); the design and its evidence are in `docs/adr/0007-canonical-coverage-inventory-and-istanbul-e2e.md`.

- **Unit**, **primary**: `@vitest/coverage-v8` via `vitest run --coverage` (`vite.config.ts`'s `test.coverage`), writing `coverage/unit/coverage-final.json`. `coverage.include: ['src/**/*.ts']` makes it report source files no unit test imports, at zero hits.
- **Storybook**, **primary**: `@vitest/coverage-v8` under Vitest browser mode via `vitest run --config vitest.storybook.config.ts --coverage`, writing `coverage/storybook/coverage-final.json`, with the same `include`.
- **BDD**, **secondary**: `nyc` (Istanbul) around `cucumber-js`, instrumenting `src/` through ts-node's require hook (`.nycrc.json`), writing `coverage/bdd/coverage-final.json`.
- **e2e**, **secondary**: only under `COVERAGE=true`, `vite.config.ts` adds `vite-plugin-istanbul` to the build, so the preview server serves Istanbul-instrumented code. `tests/e2e/coverage-fixture.ts` reads `window.__coverage__` (counters survive reloads through a `sessionStorage` flush), and `tests/e2e/global-teardown.ts` remaps them to source coordinates with `istanbul-lib-source-maps` into `coverage/e2e/coverage-final.json`. The normal build (`npm run build`, and CD's `GITHUB_PAGES=true` build) is never instrumented. This replaced V8 `page.coverage` converted by `v8-to-istanbul` over the minified bundle — a known trap, which reported one statement per source line, comments and type-only lines included. Don't reintroduce it.
- **Source root and exclusions** (the single list every layer's config and the merge script share): `src/**/*.ts`, excluding `src/**/*.test.ts`, `src/**/*.stories.ts` and `**/*.d.ts`. `src/main.ts` is deliberately **in** scope — it's real bootstrap code the e2e layer executes.
- **Calibration statement**: the `generateId()` fallback in `src/goal-storage.ts`, marked `coverage-calibration: unreachable`.

**Known secondary-only artefact classes** (each demonstrated, with evidence, by the change that added it — see ADR 0007). All three are BDD-only, `exclude` resolution, defined in `ARTEFACT_CLASSES` in `scripts/lib/coverage-merge.mjs`. ts-node compiles `src/` to CommonJS for Cucumber (`tsconfig.json`'s `"ts-node"` override) and nyc instruments that output, so CommonJS module plumbing with no counterpart in the ES-module source is attributed to the line it came from:

- `ts-node-cjs-require` — the `require()` statement emitted for an `import` declaration.
- `ts-node-cjs-export-binding` — the `exports.name = …` statement emitted for `export function` / `export const`, attributed to the declaration line.
- `ts-node-cjs-reexport-getter` — the `Object.defineProperty(exports, …, { get })` statement and getter function emitted for `export { … } from`.
