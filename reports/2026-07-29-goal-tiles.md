# Ship report: goal-tiles

```metrics
tracking_issue: 94
started_at: 2026-07-29T17:22:50Z
completed_at: 2026-07-29T21:38:06Z
total_hours: 4.25
coverage_percent: 97.31
outcome: deployed
bugs_by_stage:
  requirement: 0
  design: 1
  unit-test: 0
  bdd-test: 0
  e2e-test: 0
  qa: 0
  deploy-path: 0
  manual-test: 0
  ci: 1
  cd: 0
bugs_by_category:
  security: 0
  accessibility: 0
```

- **Tracking issue**: [#94](https://github.com/lauz9888/throughline/issues/94)
- **Branch**: `feature/goal-tiles`
- **PR**: [#96](https://github.com/lauz9888/throughline/pull/96) (merged)
- **Live**: https://lauz9888.github.io/throughline/

## Requirements

Add a homepage tile grid for goals and an "Edit Goal" modal opened on tile selection, combining two
already-shipped patterns exactly as `aspiration-tiles` combined them for aspirations: the
`aspiration-tiles`/`edit-aspiration-modal` blueprint (grid layout, dialog semantics, focus
management, delete-confirm pattern) crossed with the existing creation-only `add-goal` modal
(Title/Description/Reason plus an unlimited, orderable Milestones list). One tile per stored goal,
title-only content, square/rounded/`#e0f2e4`-green (the color already established and
contrast-verified by the Create Goal modal), alphabetical ordering (case-insensitive, `createdAt`
tiebreak), and an empty-state message when there are zero goals. Selecting a tile opens the Edit
Goal modal pre-populated with the goal's Title/Description/Reason and one row per stored milestone
in stored order; all fields including every milestone row are editable; Save starts disabled and
enables only once the current state (fields + milestone titles/order) differs from what was loaded,
with Title non-empty; a milestone row left untouched keeps its original id on save, a newly added
row gets a fresh id. A Delete control routes through a confirm-are-you-sure step. The goal grid and
aspiration grid are required to be fully independent (Requirement 9) — mutating one must have zero
observable effect on the other.

30 numbered behavioral requirements plus 15 WCAG 2.1 AA accessibility requirements. Explicitly
flagged assumptions (separate, non-merged grid sections; goal section rendered below the aspiration
section; title-only tile content since no milestone-completion data exists to show progress;
milestone-id preservation across an edit as a low-risk implementation default) are recorded in
`.workflow/goal-tiles/requirements.md`'s Context section, each grounded in the existing blueprint or
an existing data-model constraint. Out of scope: milestone fields beyond title, any
progress/completion indicator, milestone reordering, merging the two grids or cross-linking them,
drag/filter/search/pagination, changes to the Create Goal modal's own Save-enable logic, and
multi-tab live sync. No open questions remained; approved by the user on 2026-07-29.

## Solution

`src/goal-grid.ts` (new) mirrors `src/aspiration-grid.ts` verbatim, substituted for goals: a
`<section class="goal-grid-section" aria-label="Your goals" tabindex="-1">` rendering
`<button class="goal-tile" data-goal-id="…">` tiles via a new `sortGoalsAlphabetically` storage
helper, with an empty-state paragraph when there are no goals. `src/edit-goal-modal.ts` (new)
mirrors `src/edit-aspiration-modal.ts` structurally (dialog chrome, `isDirty()`/Save-enable logic,
Delete-then-confirm flow, three-way `closeAndTeardown(reason)` focus routing, three-layer Escape
precedence), extended for the one structural difference between goals and aspirations: an editable,
orderable Milestones list. `src/goal-storage.ts` gains `updateGoal` (preserves `id`/`createdAt`;
each milestone entry keeps its supplied `id` if present or gets a freshly generated one if absent —
see ADR 0005), `deleteGoal`, and `sortGoalsAlphabetically`. `src/goal-fields.ts` gains the
previously-deliberately-omitted `initialValues` parameter (removing the dead-code comment that
flagged it as such), mirroring `buildAspirationFields`'s existing shape. `src/milestone-rows.ts`
gains an optional `initialMilestones` param (seeds rows quietly on construction — no live-region
announcement or focus steal, so it doesn't fight the modal's own initial Title-focus) and an
`onRowsChanged` callback so `edit-goal-modal.ts` can keep its Save-enabled state in sync with
milestone add/remove/edit, plus a new `getMilestonesForSave()` accessor that reports each surviving
row's original milestone id (or `undefined` for a row added this session). `src/goal-modal.ts`
(Create) gains an optional `onSave` hook, mirroring the same addition already made for
`add-goal`/`aspiration-modal.ts`, so a newly created goal appears in the grid without a reload.
`src/app.ts` wires the goal grid and edit modal via the same forward-reference pattern already used
for aspirations, rendering the Goals section below the Aspirations section.

Requirement 9 (grid independence) is enforced architecturally by distinct storage keys, distinct
modules, and distinct `section`s with no shared state, and is checked directly by two new
`app.test.ts` integration tests that create/edit/delete a goal (or aspiration) and assert the other
grid's `aria-label` and tile list are byte-for-byte unchanged after each step, with a non-vacuous
sanity check that the mutated grid did change. One new ADR,
`docs/adr/0005-milestone-identity-preservation-on-edit.md`, records the decision to preserve
milestone identity by row (rather than rebuilding the milestone list wholesale on every save).
Design review surfaced one gap (issue #95, below) before implementation began. Full detail,
including the requirement-coverage map, file-by-file change list, and risks/edge cases (the
easy-to-forget `dialogClassName: 'modal--goal'` on both confirm dialogs, the Save→Delete
tab-order dependency on DOM append order), is in `.workflow/goal-tiles/design.md`.

## Test changes

Per `.workflow/goal-tiles/state.md`, red-confirmed then filled in during implementation (full
suite: unit 317/317, BDD 63/63 scenarios, e2e 113/113 — no bug-fix cycles needed at any stage;
combined coverage 97.31%):

**Unit (Vitest)**

- `src/goal-storage.test.ts` (extended) — `updateGoal` (field updates, `id`/`createdAt`
  preservation, unknown-id no-op, supplied-vs-generated milestone ids), `deleteGoal` (removes only
  the matching record incl. its milestones), `sortGoalsAlphabetically` (case-insensitive,
  `createdAt` tiebreak).
- `src/goal-grid.test.ts` (new) — empty-state render, tile-per-goal in sorted order, tile
  `data-goal-id`/accessible-name/content, click dispatches `onTileSelect`, section
  `aria-label`/`tabindex`.
- `src/goal-fields.test.ts` (extended) — the new `initialValues` param pre-fills or leaves blank
  each of Title/Description/Reason.
- `src/milestone-rows.test.ts` (extended) — `initialMilestones` pre-population order/labels/values,
  no live-region/focus side effect on pre-population, correct continued numbering and
  announce+focus behavior for a subsequent user-added row, `getMilestonesForSave()` id
  preservation/generation/exclusion-of-blanks, `onRowsChanged` firing on add/remove/edit and safe
  omission.
- `src/edit-goal-modal.test.ts` (new) — pre-population of fields and milestone rows, Save
  disabled/enabled across every dirty trigger including milestone add/edit/remove/order, save
  persistence with milestone-id preservation vs. fresh-id generation, Delete-then-confirm flow,
  cancel/discard close paths, Escape-closes-tooltip-first precedence, focus-return targets per
  teardown reason.
- `src/goal-modal.test.ts` (extended) — new case for the `onSave` hook, invoked once before
  teardown on save; existing no-`onSave` tests unchanged.
- `src/app.test.ts` (extended) — full `renderApp` wiring for goal grid render/re-render on
  create/edit/delete, tile selection opening a pre-populated Edit Goal modal, and a new
  `renderApp — goal/aspiration grid independence (Requirement 9)` describe block covering both
  independence directions. **Includes new `jest-axe` scans**: populated goal grid, empty goal grid,
  open Edit Goal modal, open Edit Goal delete-confirm, open Edit Goal unsaved-changes confirm.

**BDD (Cucumber.js)**

- `features/goal-tiles.feature` / `features/step_definitions/goal-tiles.steps.ts` (new,
  self-contained — not a reuse of `add-goal.steps.ts`) — empty-state, ordering, untruncated
  accessible name, Edit pre-population including milestone rows, Save enable/disable including the
  milestone-specific triggers (add/edit/remove a row), save persistence, Delete confirm/cancel/
  confirm, close-clean-vs-dirty behavior including an unsaved milestone-only edit.

**E2E (Playwright)**

- `tests/e2e/goal-tiles.spec.ts` (new) — tile rendering/order/accessible name/empty-state, a
  very-long-title tile staying square, Edit Goal opening pre-populated with milestone rows, Save
  enable/disable reacting to milestone changes, save updating the grid, keyboard reachability
  (Tab) and activation (Enter/Space), Delete confirm open/cancel/confirm, focus-to-grid-container
  after delete, focus-to-re-rendered-tile after a save that changes alphabetical position.
  **Includes `@axe-core/playwright` WCAG scans** (`wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`):
  populated goal grid, empty goal grid, open Edit Goal modal (with a pre-populated milestone row
  present), open Edit Goal delete-confirm, open Edit Goal unsaved-changes confirm.

## Accessibility

Per UI-facing accessibility requirement in `requirements.md`, design decision plus automated-scan
coverage:

- **Req 1 (real, keyboard-operable tile)** — `<button type="button" class="goal-tile">`; covered by
  unit click/keyboard tests and e2e keyboard-activation tests.
- **Req 2 (mouse + keyboard, natural tab order)** — native button semantics, no `tabindex`
  override; covered by the e2e Tab-reachability test.
- **Req 3 (accessible name = visible title)** — a single `.goal-tile__title` span is the button's
  only content; covered by `goal-grid.test.ts`.
- **Req 4 (visible focus indicator)** — `.goal-tile:focus-visible` added to the shared
  `:focus-visible` selector list; covered by the e2e focus-ring assertion.
- **Req 5 (dialog semantics incl. milestone rows immediately in the trap)** — `role="dialog"`,
  `aria-modal="true"`, `aria-labelledby`, `root.inert`, unmodified `createFocusTrap()` (recomputes
  focusable elements on every Tab, so pre-populated rows are covered with no new wiring); covered by
  `edit-goal-modal.test.ts` and the e2e/axe scans.
- **Req 6 (focus to a sensible start point on open)** — `fields.titleInput.focus()`; covered by
  `edit-goal-modal.test.ts` and the e2e focus-on-open assertion.
- **Req 7 (focus returns to the tile after save/cancel/discard)** — `closeAndTeardown('save')`
  re-queries the re-rendered tile by `data-goal-id`; `'cancel'` returns to `triggerTile`; covered by
  `edit-goal-modal.test.ts` and the e2e focus-to-re-rendered-tile test.
- **Req 8 (focus to grid container after delete)** — `gridContainer.focus()`, section carries
  `tabindex="-1"` in both populated and empty states; covered directly.
- **Req 9 (confirm-prompt focus return)** — delete-confirm cancel focuses the Delete button;
  unsaved-changes confirm cancel focuses the close (X) button; covered directly.
- **Req 10 (deterministic add/remove focus, extended to the pre-populated case)** — unmodified
  `milestone-rows.ts` add/remove algorithm; pre-population itself doesn't call it, so it can't
  fight Req 6; covered by `milestone-rows.test.ts` and e2e keyboard-driven equivalents.
- **Req 11 (distinct per-row labels, incl. pre-populated rows)** — pre-populated rows draw numbers
  1..N from the same never-reused counter used for session-added rows; covered by
  `milestone-rows.test.ts`.
- **Req 12 (AT-perceivable row add/remove)** — existing `aria-live="polite"` region plus focus move,
  unaffected by pre-population; covered by `milestone-rows.test.ts`.
- **Req 13 (contrast)** — all new interactive elements reuse already-verified color pairs
  (`#e0f2e4`/`#1a1a1a` for tiles, existing neutral gold/near-black for Delete/confirm/milestone
  controls) rather than introducing unverified colors.
- **Req 14 (Delete/Save disabled state via native `disabled`)** — native `<button>` attribute, not
  style-only; covered by `edit-goal-modal.test.ts`.
- **Req 15 (automated WCAG scan)** — `jest-axe` (unit) and `@axe-core/playwright` (e2e) scans added
  across every new DOM state, scoped to `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`.

**Issues carrying the `accessibility` label**: none. Both bugs raised this run (#95, #97) carry
only their single stage label (`design`, `ci` respectively) with no `accessibility`/`security`
classification.

## Bugs raised

Fetched by number via `gh issue view` against the exact `bug-issues` list recorded in `state.md`
(`[95, 97]`). Each issue carries exactly one stage label, so no `STATUS: blocked` condition applies.

| # | Stage | Title | Opened | Closed | Resolution |
| --- | --- | --- | --- | --- | --- |
| [#95](https://github.com/lauz9888/throughline/issues/95) | `design` | goal-tiles: design missing test coverage for grid independence (Requirement 9) | 2026-07-29 17:38:47 | 2026-07-29 17:42:34 | The design didn't assign a concrete test proving that mutating a goal leaves the aspiration grid unchanged (and vice versa). Resolved by adding a `renderApp — goal/aspiration grid independence (Requirement 9)` `app.test.ts` describe block with two integration tests (create/edit/delete a goal while asserting the aspiration grid's `aria-label` and tile list stay byte-for-byte unchanged, and the mirror-image test for mutating an aspiration against the goal grid), each with a non-vacuous sanity check that the mutated side did change. |
| [#97](https://github.com/lauz9888/throughline/issues/97) | `ci` | goal-tiles: CI failure — Format check | 2026-07-29 21:22:35 | 2026-07-29 21:31:03 | The Format check job failed on PR #96: `prettier --check .` reported formatting issues in `docs/adr/0005-milestone-identity-preservation-on-edit.md`, `features/step_definitions/goal-tiles.steps.ts`, `src/edit-goal-modal.test.ts`, `src/edit-goal-modal.ts`, `tests/e2e/goal-tiles.spec.ts` (`reports/2026-07-29-add-goal.md` also appeared in the warning list but pre-dates this branch and was left out of scope). Fixed by running `npm run format` and re-verifying `npm run format:check` passes. |

## Coverage

Combined coverage: **97.31%** (per `state.md`, recorded at QA review — one round of changes made,
removing a dead BDD step definition; full suites re-verified green after the fix: unit 317/317, bdd
63/63, e2e 113/113).

## Outcome

**Deployed.** CD completed green (Production build, Deploy, E2E tests live, Post-deploy smoke
check, PWA validation); the change is live at https://lauz9888.github.io/throughline/.

## Time taken

- **Started**: 2026-07-29 17:22:50 UTC
- **Completed**: 2026-07-29 21:38:06 UTC
- **Total elapsed**: approximately 4 hours 15 minutes (≈4.25 hours)

This elapsed time spans human wait time as well as active engineering work — requirements approval,
design review, QA review, the base-path smoke check, manual-test confirmation, PR review/merge
turnaround, and CI/CD run time — not just active implementation time. It should not be read as a
measure of pure engineering effort.

## Pipeline stages traversed

Requirements gathering (approved 2026-07-29) -> solution design + review (one gap found and fixed,
issue #95) -> branch `feature/goal-tiles` -> red-phase unit tests -> red-phase BDD tests -> red-phase
e2e tests -> implementation (full suite green: unit 317/317, bdd 63/63, e2e 113/113, no bug-fix
cycles needed) -> QA review (one round of changes-made — removed a dead BDD step definition; 97.31%
combined coverage; full suites re-verified green) -> base-path smoke check (passed, 113/113 e2e
green against the `GITHUB_PAGES=true` build) -> manual test (passed) -> merge via PR #96 -> CI (one
cycle, issue #97, Format check failure, resolved) -> CD (green) -> docs update (README.md, wiki
Home.md) -> this report.
