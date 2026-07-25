# Ship report: aspiration-tiles

```metrics
tracking_issue: 65
started_at: 2026-07-25T19:56:58Z
completed_at: 2026-07-25T22:09:05Z
total_hours: 2.20
coverage_percent: 97.70
outcome: deployed
bugs_by_stage:
  requirement: 0
  design: 15
  unit-test: 0
  bdd-test: 0
  e2e-test: 0
  qa: 0
  deploy-path: 0
  manual-test: 0
  ci: 0
  cd: 0
bugs_by_category:
  security: 0
  accessibility: 0
```

- **Tracking issue**: [#65](https://github.com/lauz9888/throughline/issues/65)
- **Branch**: `feature/aspiration-tiles`
- **PR**: [#81](https://github.com/lauz9888/throughline/pull/81) (merged, squashed as `01abf97`)
- **Live**: https://lauz9888.github.io/throughline/

## Requirements

Add a tile for every stored aspiration (uniform size, square, rounded corners, the light-purple
`#efe4fb` aspiration-modal color, displaying the aspiration's name), ordered alphabetically by
title (case-insensitive, `createdAt` tiebreak). Selecting a tile opens a new "Edit Aspiration"
modal — identical in structure/copy/tooltips/Links behavior to the existing Create Aspiration
modal except for its heading and an added Delete control. Delete routes through a confirm-are-you
-sure step (continue to delete / return to the aspiration, unchanged). The Edit modal's Save button
starts disabled and enables only once the fields differ from the loaded values (with Title
non-empty); all fields are editable. Saving or deleting closes the modal and updates the grid.

Full detail — 24 numbered behavioral requirements plus 11 accessibility requirements — is in
`.workflow/aspiration-tiles/requirements.md`. Notable context captured there: no tile/grid UI
existed before this feature (`src/app.ts` previously rendered only the top bar); storage previously
supported create-only (no read/update/delete API); and the Edit modal's dirty-check for Save
intentionally differs from Create's existing title-only Save-enable logic (full field-comparison
dirty tracking vs. title-presence only) — an explicit, called-out divergence, not an inconsistency.
Out of scope: real Goals/Habits linking, drag/filter/search/pagination of tiles, multi-tab live
sync, undo-after-delete, and any new route. No open questions remained; approved by the user on
2026-07-25.

## Solution

A new tile grid section is mounted below `.top-bar`, rendering one `<button class="aspiration-tile">`
per stored aspiration (alphabetical/`createdAt`-tiebreak order, via a new
`sortAspirationsAlphabetically` storage helper). Selecting a tile opens a new Edit Aspiration modal.
Rather than duplicating `aspiration-modal.ts`'s ~440 lines, Edit shares its structure/copy/behavior
with Create via two new extracted, shared helper modules:

- `src/aspiration-fields.ts` — the Title/Description/Reason fields, Links fieldset, and tooltip
  state machine, parameterized by an id prefix and optional initial values.
- `src/confirm-dialog.ts` — the generic `role="alertdialog"` confirm mechanics, reused by Create's
  existing discard-confirm and Edit's two confirms (unsaved-changes, delete).

Storage gains `updateAspiration` (preserves `id`/`createdAt`, overwrites only editable fields),
`deleteAspiration`, a now-public `readAspirations`, and `sortAspirationsAlphabetically`. Both
Create's and Edit's save/delete actions notify the grid to re-render via simple in-app callback
hooks (`onSave`/`onChange`) — no `storage`-event listener or cross-tab mechanism was needed, per
the explicit out-of-scope note. Focus management follows the existing hand-rolled dialog pattern
(`docs/adr/0003`): closing Edit after a clean cancel/discard returns focus to the original tile;
after a save, focus is re-queried against the freshly re-rendered grid by `data-aspiration-id`
(the original node is stale post-re-render); after a confirmed delete, focus moves to the grid
section's own `tabindex="-1"` container, since the tile no longer exists.

Design review ran 5 cycles (issues #66-#80, all closed before implementation began) — the user
approved proceeding after the cycle cap, noting the final two rounds were narrow test-coverage
additions rather than substantive design defects. Full detail, including the requirement-coverage
map, the extracted-module contracts, and the risks/edge-cases section (stale `triggerTile`
references, `inert`-before-`focus()` ordering, three-layer Escape precedence), is in
`.workflow/aspiration-tiles/design.md`.

## Test changes

Per `.workflow/aspiration-tiles/state.md`, red-confirmed then filled in during implementation
(full suite: unit 168/168, BDD 29/29 scenarios, e2e 72/72 — no bug-fix cycles needed at any stage):

**Unit (Vitest)**

- `src/aspiration-storage.test.ts` (modify) — extended for `updateAspiration` (preserves
  `id`/`createdAt`, no-throw on unknown id), `deleteAspiration` (no-throw on unknown id),
  `readAspirations` (now public), and `sortAspirationsAlphabetically` (case-insensitive order,
  `createdAt` tiebreak, no input mutation).
- `src/aspiration-fields.test.ts` (new) — direct coverage of the shared field/tooltip builder:
  id-prefix isolation, initial-value pre-fill, Links radio select/deselect/swap, and the
  single-open-tooltip-at-a-time state machine.
- `src/confirm-dialog.test.ts` (new) — direct coverage of the shared confirm-dialog helper:
  dialog semantics, cancel/backdrop/confirm wiring, and idempotent `cancel()` calls.
- `src/aspiration-grid.test.ts` (new) — empty-state vs. populated rendering, alphabetical/tiebreak
  order, untruncated accessible names (including a 200-character long-title DOM case), tile-click
  wiring, and re-render-on-storage-change. **Includes a `jest-axe` scan** (grid populated, grid
  empty-state).
- `src/edit-aspiration-modal.test.ts` (new) — pre-population, Save dirty-check (all four triggers
  individually, plus the whitespace-only-Title edge case), save/delete flows, the three-layer
  Escape precedence (tooltip / unsaved-changes confirm / delete-confirm), the extended focus-trap
  boundary through the new Delete button, and focus-management for every close reason. **Includes a
  `jest-axe` scan** (Edit modal open, unsaved-changes confirm open, delete-confirm open).
- `src/aspiration-modal.test.ts` (modify) — added coverage only for the new optional `onSave` hook;
  every pre-existing test in this file is unmodified, confirming the shared-module refactor changed
  no observable Create behavior.
- `src/app.test.ts` (modify) — updated child-count expectations, new grid/Edit-modal wiring cases
  (including the Create-modal-save-refreshes-grid regression case). **Extended `jest-axe` scans**
  with grid-populated and grid-empty-state DOM states.

**BDD (Cucumber.js)**

- `features/aspiration-tiles.feature` (new) + `features/step_definitions/aspiration-tiles.steps.ts`
  (new) — empty-state, ordering, tile accessible name, Edit pre-population, Save dirty-check
  round-trip, delete confirm/cancel, and Edit's clean-vs-dirty close behavior.

**E2E (Playwright)**

- `tests/e2e/aspiration-tiles.spec.ts` (new) — grid rendering/order in a real browser, the
  long-title-stays-square case (via `boundingBox()` width===height, the layout-engine-dependent
  half jsdom can't verify), Create-save and Edit-save/delete grid-refresh without page reload,
  keyboard tile operation and visible focus ring, the full Save-enable/disable round trip, and
  delete-flow focus assertions. **Includes `@axe-core/playwright` scans** across five distinct
  live-browser states: grid populated, grid empty-state, Edit modal open, unsaved-changes confirm
  open, delete-confirm open.

## Accessibility

Per-requirement coverage (design decision + automated scan) for each UI-facing accessibility
requirement in `requirements.md`:

- **Req 1/2 (real, keyboard-operable tiles)** — tiles are plain `<button>` elements, siblings in
  `.aspiration-grid` (deliberately not a roving-tabindex composite widget, since a tile grid is a
  set of independent controls). Covered by unit/e2e click and keyboard-activation tests.
- **Req 3 (accessible name)** — a tile's accessible name is its text content, the full untruncated
  title. Covered by the unit long-title DOM case and e2e keyboard tests.
- **Req 4 (visible focus indicator)** — `.aspiration-tile:focus-visible` added to the existing
  shared outline rule. Covered by the e2e focus-ring assertion.
- **Req 5 (dialog semantics: role, aria-modal, aria-labelledby, inert, focus trap)** — Edit and both
  its confirms mirror Create's existing dialog frame exactly. Covered by unit assertions in
  `edit-aspiration-modal.test.ts`/`confirm-dialog.test.ts` and e2e dismissal tests.
- **Req 6 (initial focus on open)** — `open()` focuses the Title input. Covered directly.
- **Req 7 (focus returns to triggering tile)** — covered by the cancel/discard unit case and,
  separately (Issue #68), the save-then-re-query case (stale-node regression guard) at both unit
  and e2e layers.
- **Req 8 (focus moves to grid container after delete)** — the grid section carries
  `tabindex="-1"` and exists in both populated and empty states. Covered directly.
- **Req 9 (confirm-prompt focus return)** — the delete-confirm's cancel focuses the Delete button
  (its own unambiguous trigger, Issue #76); the unsaved-changes confirm's cancel focuses the close
  (X) button (no single discrete trigger). Both covered directly.
- **Req 10 (contrast)** — new controls reuse already-verified color pairs (`#1a1a1a`/`#efe4fb` for
  tiles, `#8a6d3b`/white for Delete and the delete-confirm's confirm button) rather than introducing
  an unverified palette entry.
- **Req 11 (automated WCAG scan)** — `jest-axe` (unit) and `@axe-core/playwright` (e2e) scans added
  across every new DOM state, scoped to `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`, matching every
  existing scan in the codebase.

**Issues carrying the `accessibility` label**: none. All 15 design-review issues (#66-#80) carried
only the `design` stage label; several were accessibility-consequential (e.g. #66's Escape-precedence
gap, #76's wrong delete-confirm focus target, #79's focus-trap boundary, #80's tooltip-Escape
integration coverage) but were caught and resolved during design review, before any code was
written — none were filed as post-implementation accessibility defects.

## Bugs raised

Fetched by number via `gh issue view` against the exact `bug-issues` list recorded in `state.md`
(#65 tracking issue + #66-#80). Every issue resolved to exactly one stage label (`design`), so no
`STATUS: blocked` condition applies.

### Design review (label: `design`) — issues #66-#80, all closed during the 5-cycle design review, before implementation began

| # | Title | Opened | Closed | Resolution |
|---|---|---|---|---|
| [#66](https://github.com/lauz9888/throughline/issues/66) | tooltip state query missing for Escape precedence | 2026-07-25 20:19:04 | 2026-07-25 20:25:40 | Exposed `isTooltipOpen()`/`hideOpenTooltip()` directly on `AspirationFieldsResult` (rather than hiding tooltip state behind an opaque `wireTooltips()` wrapper) so each modal's own `handleDocumentKeydown` can reproduce exact Escape precedence. |
| [#67](https://github.com/lauz9888/throughline/issues/67) | undefined CSS class for delete-confirm button | 2026-07-25 20:19:06 | 2026-07-25 20:25:42 | Kept `.modal__delete-confirm` as its own class mapped to the already-verified `#8a6d3b`/white pair; clarified only `.aspiration-tile:focus-visible`/`.modal__delete:focus-visible` are additive since the confirm button's focus style is already covered by the existing `.modal__actions button:focus-visible` catch-all. |
| [#68](https://github.com/lauz9888/throughline/issues/68) | missing test for focus-after-save re-query path | 2026-07-25 20:19:07 | 2026-07-25 20:25:43 | Added explicit unit and e2e cases proving focus lands on the freshly re-rendered tile (looked up by `data-aspiration-id`) after Save, not the stale pre-save `triggerTile` reference. |
| [#69](https://github.com/lauz9888/throughline/issues/69) | no direct unit tests for new shared modules | 2026-07-25 20:19:08 | 2026-07-25 20:25:45 | Added `src/aspiration-fields.test.ts` and `src/confirm-dialog.test.ts` for direct coverage of the two new shared helper modules, rather than relying only on indirect coverage via the two modal test files. |
| [#70](https://github.com/lauz9888/throughline/issues/70) | no test for tile shape not distorting under long title | 2026-07-25 20:25:27 | 2026-07-25 20:35:10 | Added a unit-layer DOM-structure case (200-char untruncated title as full `textContent`) and an e2e-layer real-browser `boundingBox()` width===height assertion, since jsdom has no layout engine. |
| [#71](https://github.com/lauz9888/throughline/issues/71) | Escape-cancel dispatch for two confirm types left as placeholder | 2026-07-25 20:25:29 | 2026-07-25 20:35:12 | Introduced `activeConfirmHandle: { cancel: () => void } \| undefined`, set to whichever of the two confirms is open, so `handleDocumentKeydown`'s Escape branch calls `activeConfirmHandle?.cancel()` unambiguously. |
| [#72](https://github.com/lauz9888/throughline/issues/72) | confirm-dialog actions wrapper class unspecified | 2026-07-25 20:25:30 | 2026-07-25 20:35:14 | Specified that `confirm-dialog.ts` wraps its buttons in the same `.modal__actions` class Create's discard-confirm already uses, so the existing `.modal__actions button:focus-visible` rule covers new confirms with no redundant CSS. |
| [#73](https://github.com/lauz9888/throughline/issues/73) | Per-open state list omits activeConfirm/handles | 2026-07-25 20:25:32 | 2026-07-25 20:35:15 | Added `activeConfirmHandle` to the documented per-open state list in `edit-aspiration-modal.ts`'s design section. |
| [#74](https://github.com/lauz9888/throughline/issues/74) | Create modal save doesn't refresh tile grid | 2026-07-25 20:34:56 | 2026-07-25 20:46:37 | Added an optional `onSave` hook to `AspirationModalElements`, called by `handleSave` immediately after `saveAspiration`, wired in `app.ts` as `onSave: renderGrid` — a newly created aspiration now appears as a tile with no page reload. |
| [#75](https://github.com/lauz9888/throughline/issues/75) | activeConfirm state contradicts its own documented purpose | 2026-07-25 20:34:58 | 2026-07-25 20:46:39 | Removed the redundant `activeConfirm: 'unsaved' \| 'delete' \| null` tag entirely — nothing ever branched on its value; `activeConfirmHandle`'s own truthiness is sufficient. |
| [#76](https://github.com/lauz9888/throughline/issues/76) | delete-confirm cancel focuses wrong control | 2026-07-25 20:34:59 | 2026-07-25 20:46:41 | The delete-confirm's own `onCancel` now focuses the Delete button specifically (its unambiguous trigger), distinct from the unsaved-changes confirm (no single discrete trigger), which still focuses the close (X) button. |
| [#77](https://github.com/lauz9888/throughline/issues/77) | selectedLinkType ownership contradiction risks Requirement 14 regression | 2026-07-25 20:46:42 | 2026-07-25 20:54:24 | Removed the bare `selectedLinkType` local-state reference from `isDirty()`; it now calls `fields.getSelectedLinkType()`, since that state is private to `buildAspirationFields`, not owned by `edit-aspiration-modal.ts`. |
| [#78](https://github.com/lauz9888/throughline/issues/78) | no unit test for Escape-into-open-confirm dispatch precedence | 2026-07-25 20:46:44 | 2026-07-25 20:54:25 | Added named unit cases proving Escape while the unsaved-changes confirm (or delete-confirm) is open cancels only that confirm, not the underlying Edit modal. |
| [#79](https://github.com/lauz9888/throughline/issues/79) | no focus-trap test for Delete button's new tab-order boundary | 2026-07-25 20:54:16 | 2026-07-25 20:55:26 | Added a named unit case verifying the focus trap now wraps Close → ... → Save → Delete → Close (and Shift+Tab from Close wraps to Delete, not Save). |
| [#80](https://github.com/lauz9888/throughline/issues/80) | no integration test for tooltip-Escape precedence in Edit modal's own handler | 2026-07-25 20:54:17 | 2026-07-25 20:55:28 | Added a named unit case at the `edit-aspiration-modal.ts` integration level (mirroring the existing Create-modal test) proving the first Escape while a tooltip is open closes only the tooltip and never reaches `activeConfirmHandle`/`requestClose()`. |

### Implementation, full-suite run, QA, base-path smoke check, manual test, CI, CD — no bug issues filed

- **Implementation** (Step 8): unit 130/130 across the 7 target files, typecheck/lint clean. One
  bug was found in a Step-5 red-phase test itself (`aspiration-fields.test.ts`'s
  tooltip-toggle-on-icon-click assertion contradicted the existing, must-not-break
  `aspiration-modal.test.ts:455-479` behavior) — routed back to the unit-test-author and fixed;
  not tracked as a bug-fixer case since the defect was in test code, not implementation.
- **Full-suite run** (Step 11): unit 168/168, BDD 29/29, e2e 72/72 all passed — no bug-fix cycles
  needed.
- **QA review** (Step 12): one round, changes-made — 6 Prettier formatting fixes across
  implementation/test files (no logic change), not tracked as a separate issue. Combined coverage
  97.70% after the fix; full suites re-confirmed green.
- **Base-path smoke check** (Step 13): passed on the first attempt (`GITHUB_PAGES=true` build +
  preview at `/throughline/`, all 72 e2e tests green), no fixes needed.
- **Manual test** (Step 14): passed, no fix rounds needed.
- **CI** (Step 17): all jobs green on the first attempt (BDD tests, Combined coverage, Dependency
  audit, E2E tests, Format check, Install & build, Lint, Type check, Unit tests) — no CI cycle
  needed.
- **CD** (Step 19): all green on the first attempt (Production build, Deploy, PWA validation, E2E
  tests live, Post-deploy smoke check).
- **Docs** (Step 20): `README.md` (commit `c855a19`) and the wiki's `Home.md` (wiki commit `3fd0f63`)
  both updated.

## Coverage

Combined coverage: **97.70%** (per `state.md`, confirmed at QA review after the Prettier-only fix
round, and re-confirmed green through the full-suite re-run).

## Outcome

**Deployed.** CD completed green on the first attempt (production build, deploy, PWA validation,
live e2e tests, post-deploy smoke check); the change is live at
https://lauz9888.github.io/throughline/.

## Time taken

- **Started**: 2026-07-25 19:56:58 UTC
- **Completed**: 2026-07-25 22:09:05 UTC
- **Total elapsed**: approximately 2 hours 12 minutes (≈2.20 hours)

This elapsed time spans human wait time as well as active engineering work — requirements
approval, the 5-cycle design review (issues #66-#80, including the user's approval to proceed past
the cycle cap), the QA review round, PR review/merge turnaround, and CI/CD run time — not just
active implementation time. It should not be read as a measure of pure engineering effort.

## Pipeline stages traversed

Requirements gathering -> solution design + review (5 cycles, issues #66-#80, user-approved past
cap) -> branch `feature/aspiration-tiles` -> red-phase unit tests -> red-phase BDD tests -> red-phase
e2e tests -> implementation (full suite green: unit 168/168, BDD 29/29, e2e 72/72; one red-phase
test defect fixed, not a bug-fixer case) -> QA review (1 round, changes-made — Prettier fixes only;
97.70% combined coverage) -> base-path smoke check (passed first try) -> manual test (passed) ->
merge via PR #81 (squash commit `01abf97`) -> CI (all green first try) -> CD (all green first try) ->
docs update -> this report.
