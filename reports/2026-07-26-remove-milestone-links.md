# Ship report: remove-milestone-links

```metrics
tracking_issue: 84
started_at: 2026-07-26T09:02:09Z
completed_at: 2026-07-26T10:06:57Z
total_hours: 1.08
coverage_percent: 97.09
outcome: deployed
bugs_by_stage:
  requirement: 0
  design: 1
  unit-test: 1
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

- **Tracking issue**: [#84](https://github.com/lauz9888/throughline/issues/84)
- **Branch**: `feature/remove-milestone-links`
- **PR**: [#87](https://github.com/lauz9888/throughline/pull/87) (merged, squashed as `10e2873`)
- **Live**: https://lauz9888.github.io/throughline/

## Requirements

Two independent removals: drop the "Milestone" option from the add-item dropdown's
`ADD_ITEM_TYPES` array in `src/app.ts` (so exactly four menu items remain, in order — Aspiration,
Goal, Task, Habit — with no `role="menuitem"` for Milestone ever created), and delete the Links
section (Goals/Habits radio toggle, its tooltip/info-icon, and its "nothing to link yet"
empty-state message) from the single shared `buildAspirationFields()` builder consumed by both the
Create and Edit aspiration modals. Both modals' field order becomes Title, Description, Reason,
then Save (Create) / Save then Delete (Edit); `isDirty()` in both modals drops its link-type clause
so the unsaved-changes confirmation and the Edit modal's Save enablement depend only on
Title/Description/Reason. No persisted data is affected — no link-type field was ever written to
storage. 26 numbered requirements in total, including explicit "must not change" items (the other
three dropdown entries, Title/Description/Reason behavior, the Edit modal's Delete flow,
focus-return behavior) and five WCAG 2.1 AA requirements (no dangling ARIA references, unbroken
sequential focus order, correct role/name/state on all surviving controls with a continuing
automated scan, no shared focus-visible style lost, no new contrast issue). Full detail is in
`.workflow/remove-milestone-links/requirements.md`. No open questions remained; approved by the
user on 2026-07-26.

## Solution

Both removals are additive-free, entirely within existing patterns — no new files, dependencies,
frameworks, or state-management approach, so no ADR was warranted. `ADD_ITEM_TYPES` loses its
`'Milestone'` entry; `renderApp`'s render loop and `onItemSelect` callback are otherwise unchanged,
since they already operate generically over whatever the array contains. `buildAspirationFields()`
loses its `LINKS_TOOLTIP_TEXT` constant, `selectedLinkType` state, `getSelectedLinkType`/
`updateLinksState`/`handleLinkRadioClick`/`handleLinkRadioChange` functions, the entire Links
DOM-construction block, and the eight corresponding keys from `AspirationFieldsResult`; both
`aspiration-modal.ts` and `edit-aspiration-modal.ts` drop `fields.linksFieldset` from their
`dialog.append(...)` calls and the link-type clause from `isDirty()`, and the edit modal also drops
its now-dead Goals/Habits listener-wiring block. `src/style.css` loses the Links-only rule block and
one selector from the shared focus-visible rule's comma list, while shared/general classes
(`.modal__field`, `.modal__info-wrapper`, `.modal__tooltip-text`) are explicitly kept per
Requirement 14 even though `.modal__info-wrapper` becomes momentarily unused. `src/focus-trap.ts`
needed no code change — its `focusableElements()` re-queries the live DOM on every Tab keydown, so
the trap's boundaries shift automatically once Links is never appended.

Design review ran 2 cycles (issue #85, closed before implementation began) — the design's own
review sweep, run twice (once for link-prefixed symbols/ids, once specifically for the ARIA
role-name text a Testing-Library/Playwright query would use), surfaced test/doc files the
requirements' Context section hadn't enumerated (`tests/e2e/aspiration-modal.spec.ts`,
`tests/e2e/aspiration-tiles.spec.ts`, and three BDD files), all folded into the design's "Test
impact" section as pure follow-on consequences of the same scoped removal, not new functional
scope. Full detail, including the requirement-coverage map, file-by-file change list, and the
accessibility/risks sections, is in `.workflow/remove-milestone-links/design.md`.

## Test changes

Per `.workflow/remove-milestone-links/state.md`, red-confirmed then filled in during implementation
(full suite: unit 160/160, BDD 28/28 scenarios, e2e 68/68 — no bug-fix cycles needed at any stage):

**Unit (Vitest)**

- `src/app.test.ts` (modify) — `ADD_ITEM_TYPES`/menu-item-count assertions updated from 5 to 4
  items; the `it.each(['Goal', 'Task', 'Habit'])` no-op assertion drops `'Milestone'`.
- `src/add-item-menu.test.ts` (modify) — `ITEM_LABELS` fixture re-pointed to the 4 remaining items;
  every hardcoded-index test (wrap-around, middle-to-middle Arrow navigation, Home/End from a
  non-boundary item, Tab-exit) re-based onto the new 4-item indices with no loss of navigation-path
  coverage.
- `src/aspiration-modal.test.ts` (modify) — DOM-order test drops the Links assertions; three
  Links-radio-behavior tests deleted outright; the WCAG scan variant "with the Goals radio
  selected" deleted since that state can no longer occur. **Includes surviving `jest-axe` scans**
  (freshly opened; confirm-prompt open; tooltip open) re-run against Links-free DOM.
- `src/edit-aspiration-modal.test.ts` (modify) — pre-fill test drops its Links-radio-unchecked
  clause; the Links-radio-enables-Save test deleted outright. **Includes surviving `jest-axe` scans**
  (populated open; unsaved-changes confirm open; delete confirm open).
- `src/aspiration-fields.test.ts` (modify) — `appendFields` helper drops `linksFieldset`; four
  Links-radio-behavior tests (select/deselect/swap, `getSelectedLinkType()`) deleted outright;
  idPrefix/initialValues/tooltip-state tests untouched.

**BDD (Cucumber.js)**

- `features/add-item-button.feature` (modify) — the item-types-in-order scenario's data table drops
  its `| Milestone |` row.
- `features/add-aspiration.feature` (modify) — feature description drops its Links-toggle mention;
  the "Links section starts with neither radio selected..." scenario deleted outright.
- `features/aspiration-tiles.feature` (modify) — one line asserting neither Links radio is selected
  in the Edit modal removed from the tile-pre-population scenario.
- `features/step_definitions/add-aspiration.steps.ts` (modify) — `getLinkRadio`/
  `getLinksEmptyMessage` helpers and the entire Links step-definition block removed.
- `features/step_definitions/aspiration-tiles.steps.ts` (modify) — `getEditLinkRadio` helper and its
  now-unused step definition removed.

**E2E (Playwright)**

- `tests/e2e/add-item-button.spec.ts` (modify) — item-count/label assertions updated to 4 items;
  mid-navigation Arrow-key targets re-pointed from `'Milestone'` to `'Task'`. **Includes surviving
  `@axe-core/playwright` scans** (open dropdown; after arrow-navigation), now implicitly covering
  the 4-item dropdown.
- `tests/e2e/aspiration-modal.spec.ts` (modify) — DOM-order test drops its three Links assertions;
  the Tab-cycle test's hardcoded sequence drops the two Links-related stops (info icon, Goals
  radio); three Links-radio-behavior tests and the "Goals radio selected" WCAG scan variant deleted
  outright. **Includes surviving `@axe-core/playwright` scans** re-run against Links-free DOM.
- `tests/e2e/aspiration-tiles.spec.ts` (modify) — the tile-pre-population test drops its two
  Goals/Habits-unchecked assertions; Title/Description/Reason pre-fill assertions unchanged.

## Accessibility

Per-requirement coverage (design decision + automated scan) for each UI-facing accessibility
requirement in `requirements.md`:

- **Req 22 (no dangling ARIA references)** — all producers and consumers of the three Links-specific
  ids (`${idPrefix}-links-tooltip`, `${idPrefix}-link-goals`, `${idPrefix}-link-habits`) lived
  entirely inside the single deleted block in `aspiration-fields.ts`; confirmed by grep across all
  three touched files post-implementation (no `-link-`/`-links-` id pattern remains outside
  incidental English words).
- **Req 23 (sequential focus order, no dead/skipped stops)** — pure DOM removal, no code change to
  `focus-trap.ts` needed since `focusableElements()` re-queries the live DOM on every Tab keydown.
  Covered directly by the e2e Tab-cycle test's updated 5-stop sequence (Description icon,
  Description, Reason icon, Reason, Save — landing directly on Save with no intervening stop).
- **Req 24 (correct role/name/state on surviving controls; scan continues to pass; obsolete scan
  variant removed, not left dead)** — the unit- and e2e-layer "Goals radio selected" WCAG scan
  variants were deleted outright (state can no longer occur); every other pre-existing scan at both
  layers continues to pass with zero violations against the Links-free DOM.
- **Req 25 (no shared focus-visible style lost)** — only the one
  `.aspiration-modal__link-option input:focus-visible,` selector was removed from the shared rule's
  comma list; `.modal__close`, `.modal__field input`/`textarea`, `.modal__info`, `.modal__save`,
  `.modal__actions button`, `.aspiration-tile`, and `.modal__delete` all keep their focus-visible
  outline.
- **Req 26 (no new contrast issue from adjacency)** — no color or text was added or restyled;
  `.modal__field` (Reason) and `.modal__save` became DOM-adjacent again using their pre-existing,
  unchanged `margin` rules.

**Issues carrying the `accessibility` label**: none. Issue #85 (design review) touched
accessibility-adjacent surface — the design's under-inclusive test/doc sweep left the "Goals radio
selected" WCAG scan description undeleted in README.md — but was filed and resolved purely as a
`design` completeness gap, not a distinct accessibility defect, since no accessibility requirement
was ever left unmet by the design itself.

## Bugs raised

Fetched by number via `gh issue view` against the exact `bug-issues` list recorded in `state.md`
(#85, #86, #88). Every issue resolved to exactly one stage label, so no `STATUS: blocked` condition
applies.

| #                                                        | Stage       | Title                                                                                | Opened              | Closed              | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------ | ------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [#85](https://github.com/lauz9888/throughline/issues/85) | `design`    | remove-milestone-links: missed e2e/doc references in design sweep                    | 2026-07-26 09:19:11 | 2026-07-26 09:23:54 | Solution-reviewer found the design's test/doc sweep under-inclusive: two `tests/e2e/aspiration-modal.spec.ts` tests (DOM-order assertions; hardcoded Tab-cycle stops) and one `tests/e2e/aspiration-tiles.spec.ts` test (Goals/Habits-unchecked assertions) referenced removed Links markup without being scoped in the design, and README.md's Accessibility section still described the "Links radio selected" WCAG scan variant being deleted elsewhere. All four folded into the design's "Test impact"/doc-update sections before implementation began. |
| [#86](https://github.com/lauz9888/throughline/issues/86) | `unit-test` | remove-milestone-links: stale hardcoded item-count assertion missed in red-test pass | 2026-07-26 09:38:10 | 2026-07-26 09:38:49 | `src/app.test.ts`'s "renders exactly 5 menu items..." test had a hardcoded `toHaveLength(5)` left over from the red-authoring step (only the separate `it.each` line in the same file had been updated), contradicting approved Requirement 1 (exactly 4 items) and blocking the implementer. Fixed: updated to `toHaveLength(4)` and renamed the test description from "5" to "4".                                                                                                                                                                          |
| [#88](https://github.com/lauz9888/throughline/issues/88) | `ci`        | remove-milestone-links: CI failure — Format check                                    | 2026-07-26 09:56:36 | 2026-07-26 10:00:37 | The Format check job failed on PR #87 (CRLF/LF drift). Reproduced locally with `npm run format:check`, fixed via `npm run format`, re-verified green.                                                                                                                                                                                                                                                                                                                                                                                                        |

## Coverage

Combined coverage: **97.09%** (per `state.md`, recorded at QA review — approved with no changes
needed).

## Outcome

**Deployed.** CD completed green (Production build, Deploy, Post-deploy smoke check, PWA
validation, E2E tests live); the change is live at https://lauz9888.github.io/throughline/.

## Time taken

- **Started**: 2026-07-26 09:02:09 UTC
- **Completed**: 2026-07-26 10:06:57 UTC
- **Total elapsed**: approximately 1 hour 5 minutes (≈1.08 hours)

This elapsed time spans human wait time as well as active engineering work — requirements
approval, the 2-cycle design review, QA review, PR review/merge turnaround, and CI/CD run time —
not just active implementation time. It should not be read as a measure of pure engineering effort.

## Pipeline stages traversed

Requirements gathering -> solution design + review (2 cycles, issue #85, closed before
implementation) -> branch `feature/remove-milestone-links` -> red-phase unit/BDD/e2e tests ->
implementation (one bug-fix cycle, issue #86, stale test-count assertion, closed) -> full-suite run
(unit 160/160, BDD 28/28, e2e 68/68, no further bug-fix cycles) -> QA review (approved, no changes
needed; 97.09% combined coverage) -> base-path smoke check (passed first try, all 68 e2e tests green
against `/throughline/`) -> manual test (passed first attempt) -> merge via PR #87 (squash commit
`10e2873`) -> CI (one cycle, issue #88, format-check CRLF/LF drift, resolved) -> CD (green first
try) -> docs update (README.md, wiki Home.md) -> this report.
