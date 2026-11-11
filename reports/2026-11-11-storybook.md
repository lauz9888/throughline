```metrics
tracking_issue: 115
started_at: 2026-11-10T22:21:28Z
completed_at: 2026-11-11T17:11:16Z
total_hours: 18.8
coverage_percent: 97.33
branch_coverage_percent: not recorded
coverage_method: v2
storybook_story_count: 60
storybook_interaction_test_count: 60
storybook_a11y_pass_rate: 60/60 stories
outcome: merged-deployment-failed
bugs_by_stage:
  requirement: 0
  design: 8
  unit-test: 0
  bdd-test: 0
  e2e-test: 1
  storybook-test: 0
  qa: 0
  deploy-path: 0
  manual-test: 1
  ci: 1
  cd: 1
bugs_by_category:
  security: 0
  accessibility: 0
```

# Report: Storybook as a fourth test layer (`storybook`)

Tracking issue #115 - PR #126 - merge 52d762b (previous main 4853e3f) - branch `feature/storybook`.

## Requirements

Add Storybook (`@storybook/html-vite` + `@storybook/addon-vitest`) as a fourth test layer beside unit, BDD and e2e: component stories with `play`-function interaction tests and per-story axe scans scoped to the STANDARDS.md WCAG tag set (color-contrast enabled, violations fail the story). Wire it into CI as a `storybook-tests` job and into `npm run test:coverage:merge` as a fourth leg that hard-fails if its coverage file is missing, at the unchanged 90% threshold. Enable the layer in throughline's own pipeline files (`SKILL.md`, agents, `STANDARDS.md`), add an ADR and update the README. Out of scope: visual regression, deploying Storybook, any change to application source, trimming existing tests.

## Solution

- Storybook 10.6.7, exact-pinned across `storybook`, `@storybook/html-vite`, `@storybook/addon-vitest` and `@storybook/addon-a11y`. Storybook 9.x was rejected because its builder-vite peers only Vite 5-7 and throughline is on Vite 8 (#116).
- Stories run as Vitest browser-mode tests in headless Chromium via `@vitest/browser-playwright`, with v8 coverage written to `coverage/storybook`.
- Co-located `src/<module>.stories.ts` for eight modules. The helper modules (`milestone-rows`, `field-kit`, `goal-fields`, `aspiration-fields`) are exercised through the modal stories.
- Shared story support in `.storybook/memory-storage.ts` and `.storybook/story-helpers.ts`. Stories never import `vitest`.
- Storage seam: modules that accept `storage` get in-memory storage. The two create modals read `localStorage` directly and cannot be injected without a source change, so their stories clear their own keys per story (recorded deviation, #117, in the ADR).
- `.storybook/main.ts` strips `vite-plugin-pwa*` in `viteFinal`. `preview.ts` imports `style.css` and sets `a11y.test: 'error'` with the WCAG tag set.
- A root `vitest.config.ts` re-exports `vite.config.ts`, and exposes only the Storybook project when `VITEST_STORYBOOK === 'true'` (added for #123, so the in-UI "Run tests" button works).
- `scripts/merge-coverage.mjs` gains the Storybook leg. `ci.yml` gains the `storybook-tests` job. No `cd.yml` change.
- Pipeline text in `.claude/**` renders the Storybook blocks, with a new Step 11a and no renumbering. `STANDARDS.md` has two small hunks (WCAG intro, coverage lead sentence) that leave the PR #114 paragraph untouched. ADR 0006 records the decision.
- Branch protection: `main` is unprotected, and the user chose to leave it unprotected, so `storybook-tests` is not a required check.

## Test changes

- Unit: none (`unit-test-files: []`). `vite.config.ts` only excludes stories from unit coverage.
- BDD: none. E2E: none.
- Storybook (60 stories, 60 with a `play` function). Each story is scanned by `@storybook/addon-a11y` (automated WCAG 2.1 AA axe scan, real Chromium):
  - `src/add-item-menu.stories.ts`: closed/open menu, keyboard navigation, Escape and focus return.
  - `src/confirm-dialog.stories.ts`: alertdialog open, cancel, confirm, focus containment.
  - `src/goal-modal.stories.ts`: create modal blank, milestones, discard confirm, tooltip, save/disabled behaviour.
  - `src/edit-goal-modal.stories.ts`: prefilled edit, unsaved-changes confirm, delete confirm, save/delete paths.
  - `src/aspiration-modal.stories.ts`: create modal states as goal-modal, without milestones.
  - `src/edit-aspiration-modal.stories.ts`: prefilled edit, unsaved-changes confirm, delete confirm.
  - `src/goal-grid.stories.ts`: empty and populated grid (ordering, accessible names, keyboard, re-render).
  - `src/aspiration-grid.stories.ts`: same for aspirations.
  - `.storybook/memory-storage.ts`, `.storybook/story-helpers.ts`: shared helpers (no scan of their own).

## Accessibility

The change adds no application markup or controls (Requirement 30). Coverage of the testable requirements:

- Req 27 (zero axe violations including color-contrast): global `a11y.test: 'error'` with the STANDARDS.md tag set and no per-story opt-outs. All 60 stories pass.
- Req 28 (role, name, state, keyboard, focus indicator): `play` assertions on menu, dialog and alertdialog roles, `aria-expanded`, `aria-modal`, Escape, Tab containment and `:focus-visible` outlines.
- Req 29 (focus return): menu, modal and confirm-dialog stories assert focus returns to the opener, or to the grid container for the edit modals.
- Dialog stories set `a11y.context: 'body'` so overlays attached to `document.body` are inside the scan.

Issues carrying the `accessibility` label: none.

## Bugs raised

All 12 issues were fetched by number. Each has exactly one stage label. No issue carries `security` or `accessibility`.

**design (8)**

- #116: design pinned Storybook 9.1.20, incompatible with Vite 8. Opened 2026-11-10T22:34:50Z, closed 2026-11-10T22:38:04Z. Resolved by re-deciding on Storybook 10.6.7.
- #117: create-modal stories use real `localStorage` (deviation from Req 9). Opened 2026-11-10T22:34:52Z, closed 2026-11-10T22:38:06Z. Resolved by documenting the deviation and isolation argument.
- #118: STANDARDS.md coverage hunk must leave the PR #114 anchor lines byte-identical. Opened 2026-11-10T22:34:54Z, closed 2026-11-10T22:38:09Z. Resolved by restricting the edit to lines 41-42.
- #119: WCAG-intro hunk misattributed to the Waypoint template. Opened 2026-11-10T22:34:55Z, closed 2026-11-10T22:38:11Z. Resolved by correcting the attribution.
- #120: ADR omitted Playwright drift and version-compat rationale. Opened 2026-11-10T22:34:58Z, closed 2026-11-10T22:38:13Z. Resolved by adding both to the ADR.
- #121: merge-coverage hard-failure probe must be recorded. Opened 2026-11-10T22:34:59Z, closed 2026-11-10T22:38:17Z. Resolved by requiring the probe in the implementer report.
- #124: the in-UI verification command needs `VITEST_STORYBOOK=true` to match the renamed project. Opened 2026-11-11T06:21:00Z, closed 2026-11-11T06:22:21Z. Resolved by correcting the design.
- #125: the design misstated where `STORYBOOK_CONFIG_DIR` is set and which variable gates the config. Opened 2026-11-11T06:21:02Z, closed 2026-11-11T06:22:24Z. Resolved by gating on `VITEST_STORYBOOK` and aligning the ADR addendum and risk 12.

**e2e-test (1)**

- #122: local e2e failure (`add-item-button` `page.goto` ERR_ABORTED). Opened 2026-11-10T23:47:00Z, closed 2026-11-11T05:57:13Z. Resolved as a pre-existing local Windows environmental issue under parallel load (reproduced on main). No config change, and the Linux CI e2e job remains the gate.

**manual-test (1)**

- #123: "Run tests" in the Storybook UI crashed the dev server (no matching Vitest project). Opened 2026-11-11T06:17:42Z, closed 2026-11-11T06:27:06Z. Fixed in 49d2d67 with the root `vitest.config.ts`. Verified: in-UI run of 60 tests, unit 317, BDD 63, e2e 113, Storybook 60 all green.

**ci (1)**

- #127: Format check failed on `reports/2026-07-29-goal-tiles.md`, a file this branch does not touch (pre-existing on main since 4853e3f). Opened 2026-11-11T06:54:54Z, closed 2026-11-11T17:07:25Z. Format check passed on PR #126 before merge.

**cd (1)**

- #130: CD failure in the E2E tests (live deployment) job. Opened 2026-11-11T17:07:22Z, still open. See Outcome.

## Coverage

- Combined statement coverage: 97.33% (unit + Storybook + BDD + e2e, via `npm run test:coverage:merge`).
- Branch coverage: not recorded in `state.md` for this run.
- Coverage method version: v2.
- Open coverage investigations: none recorded.

## Outcome

`merged-deployment-failed`. The CD run 43042794334 for merge 52d762b failed in one job only, E2E tests (live deployment), at `npx playwright install --with-deps chromium`. The cause was a transient runner DNS failure: apt could not resolve the Ubuntu archive hosts, so the live e2e specs never executed (#130, still open). The Deploy job and the post-deploy smoke check passed. The next CD run, 43063339448 (for #128), passed every job.

## Time taken

Started 2026-11-10T22:21:28Z, completed 2026-11-11T17:11:16Z: 18.8 hours elapsed. This is wall-clock time and includes human wait time (approvals, manual testing, review turnaround, CI wait), not only active engineering effort.
