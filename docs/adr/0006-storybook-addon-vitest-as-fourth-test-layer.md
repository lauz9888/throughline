# 0006. Storybook with addon-vitest as a fourth test layer

Status: Accepted
Date: 2026-11-10

## Context

throughline's three test layers (Vitest/jsdom unit tests, Cucumber BDD against jsdom, Playwright
e2e) give no isolated, real-browser view of a single module's states. The jsdom unit layer cannot
evaluate `color-contrast` (jsdom has no rendering engine, so `jest-axe` runs with that rule
disabled), and the e2e layer only reaches a state by driving the whole app. A module-level layer
in a real browser closes both gaps: each distinct state of the add-item menu, the confirm dialog,
the create/edit modals and the goal/aspiration grids is rendered on its own, exercised through a
`play` interaction, and scanned by axe including contrast.

Alternatives considered:

- **`@storybook/test-runner` against a static build.** Runs stories through a separate Playwright
  CLI against a built or served Storybook. It adds a second runner, needs a built artifact, and
  produces no v8 coverage that merges cheaply into `scripts/merge-coverage.mjs`.
- **Vue-style composable stubbing and `vitest` alias stubs** (as in the untangle reference
  project). Not applicable: throughline is plain TypeScript/DOM with no framework, and stories
  here never import `vitest`.

Version rationale: Storybook 9.1.x (what the reference project uses) was rejected because
`@storybook/builder-vite@9.1.x` peers `vite ^5 || ^6 || ^7`, while throughline is on Vite 8 and
`npm ci` fails with ERESOLVE. Storybook 10.6.7 peers `vite ^8` and `vitest ^4`, and
`@storybook/addon-vitest@10.6.7` peers `@vitest/browser` and `@vitest/browser-playwright` `^4`.

## Decision

Add Storybook as a fourth test layer using `@storybook/html-vite` and `@storybook/addon-vitest`,
which turns each story into a Vitest test in browser mode with headless Chromium via
`@vitest/browser-playwright`. `@storybook/addon-a11y` is configured once in `.storybook/preview.ts`
with `test: 'error'` and the WCAG tag set from `.claude/STANDARDS.md`, so every story is scanned
after its `play` function, color-contrast included.

- `storybook`, `@storybook/html-vite`, `@storybook/addon-vitest` and `@storybook/addon-a11y` are
  exact-pinned to 10.6.7 (no caret) and must be upgraded together.
- Coverage is collected with the existing `@vitest/coverage-v8` into `coverage/storybook` and
  folded into `scripts/merge-coverage.mjs` as a fourth leg that throws if its
  `coverage-final.json` is missing (the other layers keep their warn-and-continue behaviour).
- Stories are co-located as `src/<module>.stories.ts`. They are excluded from every layer's
  coverage, and `src/main.ts` is excluded from the Storybook leg.
- Stories never import `vitest`; they use `expect`, `fn`, `within`, `userEvent` and `waitFor`
  from `storybook/test`.
- `viteFinal` in `.storybook/main.ts` strips `vite-plugin-pwa*` plugins that `storybook build`
  would otherwise merge in from `vite.config.ts` and then fail to precache.
- Storage seams: modules that accept a `storage` option (the grids and the edit modals) get an
  in-memory `Storage` from `.storybook/memory-storage.ts`. The create modals (`goal-modal`,
  `aspiration-modal`) read `window.localStorage` directly and accept no storage option, so their
  stories use the real browser `localStorage`, isolated by clearing their own keys
  (`throughline:goals` / `throughline:aspirations`) before and after each story. This is a
  recorded deviation from "no real localStorage"; fixing it needs an application source change,
  which this change does not make.

## Consequences

- A fourth CI job, `storybook-tests`, runs on every push and PR. Making it a required status
  check is a manual branch-protection change.
- Chromium is needed in both `storybook-tests` (installed by `pretest:storybook`) and
  `coverage-merge` (installed explicitly, because the merge script calls `npx vitest` directly).
- Storybook upgrades must move all four Storybook packages together.
- Modals and confirm dialogs attach to `document.body`, outside `#storybook-root`, so their stories
  set `parameters.a11y.context: 'body'` for the axe scan to cover them.
- `playwright` and `@playwright/test` share one version range and must be bumped together; a
  Dependabot bump of only one would install two Chromium revisions.
- Revisit this ADR before adding visual regression testing.

## Addendum: vitest configuration for Storybook's in-UI "Run tests" (bug #123)

`vitest.storybook.config.ts` is the Storybook project and is what every script passes with
`--config`. A root `vitest.config.ts` re-exports `vite.config.ts` for normal runs and, only when
`VITEST_STORYBOOK === 'true'`, exposes just that project through `test.projects`. The addon sets
that variable in the forked child process that Storybook's UI test provider starts, and its Vite
plugin uses the same flag to name the project `storybook:<configDir>`. This is needed because the
addon locates its project through Vitest's default config for the root and filters for
`storybook:<configDir>`; without it Vitest throws "No projects matched the filter" and the dev
server exits.

Consequences:

- Do not add a `vitest.workspace` file (Vitest 4 ignores it; only `test.projects` is honoured).
- If the unit settings in `vite.config.ts` change, `vitest.config.ts` follows automatically.
- The comment in `vitest.config.ts` deliberately contains `@storybook/addon-vitest` so the addon's
  config-file scan selects the project root.
- A future Storybook upgrade should re-check the addon's config lookup.
