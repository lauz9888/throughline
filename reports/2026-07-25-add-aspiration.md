# Ship report: add-aspiration

- **Tracking issue**: [#50](https://github.com/lauz9888/throughline/issues/50)
- **Branch**: `feature/add-aspiration`
- **PR**: [#57](https://github.com/lauz9888/throughline/pull/57) (merged, squashed as `77eafb9`)
- **Live**: https://lauz9888.github.io/throughline/

## Requirements

Third feature run through this pipeline, building on `add-item-button` (which added the top-right
"add item" button/dropdown but left every option's click behavior unwired). The ask: wire up
"Aspiration" to open a "Create Aspiration" modal — a header, a descriptive blurb, a mandatory
Title field, optional Description and Reason fields, a "Links" section (mutually-exclusive
Goals/Habits radio toggle, both deselected by default, custom re-click-to-deselect behavior,
showing an unconditional "nothing to link" message since no Goal/Habit data model exists yet), a
top-right close (X) control with an unsaved-changes confirmation prompt (also triggered by
`Escape` and backdrop click), and a Save button that persists the aspiration to `localStorage`
across app reloads.

This was greenfield for a modal/dialog component, a focus-trap utility, any data model, and any
persistence layer in this codebase. Key product decisions made during requirements gathering: the
Links section ships only as a radio toggle + unconditional empty-state message this run (the real
goals/habits list, search, and per-item linking are deferred until Goal/Habit exist as real
features); `localStorage` is the confirmed persistence mechanism; Save simply closes the modal with
no in-app confirmation view (correctness is verified only via storage inspection in tests); the
Save button is disabled rather than showing an inline validation error for an empty Title; and
Escape/backdrop-click both route through the same close flow as the X control. 41 numbered
requirements in total, including a dedicated accessibility section (WCAG 2.1 A/AA, requirements
28–41) covering dialog semantics, focus management, labeling, and contrast. No open questions
remained. Approved by the user on 2026-07-25. Full detail in
`.workflow/add-aspiration/requirements.md`.

## Solution

Three new modules, two additive wiring changes, and a styling update:

- **`src/aspiration-modal.ts`** (new) — owns the whole modal lifecycle: builds the dialog DOM
  fresh on `open()` and tears it down completely on close (so no manual state-reset is ever
  needed), portals the overlay to `document.body` as a sibling of `#app` (not a child of it, to
  preserve the existing "root has one child" invariant), sets `#app` `inert` while any dialog is
  open, wires the close/Escape/backdrop-click funnel and the unsaved-changes confirmation prompt
  (`role="alertdialog"`), drives the Goals/Habits custom-deselect logic, and manages focus
  on-open/on-close/on-trap. Critically, it derives `document` and `localStorage` from
  `root.ownerDocument`/`.defaultView` rather than referencing either bare global — required for the
  BDD suite to work at all (see Bugs raised, #54).
- **`src/aspiration-storage.ts`** (new) — a small, single-purpose module exporting
  `saveAspiration(input, storage)` and the `ASPIRATIONS_STORAGE_KEY` constant. Reads/writes a
  single `localStorage` key holding a JSON array of `{ id, title, description, reason, createdAt }`
  records; each save reads the full array, appends a new record with a fresh id, and writes it back
  — no partial-update/indexing scheme. `storage` is passed in explicitly by the caller rather than
  read from a bare global, and `crypto.randomUUID()` has a defensive string-based fallback.
- **`src/focus-trap.ts`** (new) — a small, reusable `createFocusTrap(container)` utility wrapping
  `Tab`/`Shift+Tab` within a container's own focusable elements; used for both the Aspiration
  dialog and the nested confirm `alertdialog`, and designed to be reused by future modals.
- **`src/add-item-menu.ts`** (modified) — gained one optional field, `onItemSelect?: (label:
  string) => void`, invoked after the existing close/refocus behavior; no other behavior changed.
- **`src/app.ts`** (modified) — wires `initAspirationModal` and passes `onItemSelect: (label) => {
  if (label === 'Aspiration') openAspirationModal(); }` into `initAddItemMenu`.
- **`src/style.css`** (modified) — new modal/overlay/field/links/button rules, all drawn from the
  existing three-color palette and existing `:focus-visible` pattern (adjusted mid-run per manual
  testing — see Bugs raised).
- **Two new ADRs**: `docs/adr/0002-localstorage-for-aspiration-persistence.md` (why `localStorage`
  with a single JSON-array key, no ORM/wrapper) and
  `docs/adr/0003-hand-rolled-modal-dialog-pattern.md` (why a hand-rolled `role="dialog"` +
  `createFocusTrap()` pattern was chosen over native `<dialog>`, given jsdom's inconsistent support
  for `showModal()` focus/backdrop semantics — this is expected to be the pattern future
  Goal/Habit/Task/Milestone modals follow).

The trickiest piece of the solution was the Goals/Habits custom deselect-on-reclick behavior
(Requirement 11): native radios can't be unchecked by re-clicking the checked one, and an early
design draft's `if (radio.checked)` check inside the `click` handler was broken by the HTML spec's
pre-click activation steps already flipping `checked` before the event dispatches (see Bugs raised,
#51). The shipped fix tracks the previously-selected value in the module's own closure state
(updated only by the native `change` event), and compares against that — not against
`radio.checked` — inside the `click` handler.

Design review took 5 rounds to reach approval (round 5 found no new issues); round 4 caught a
correctness bug that would have broken nearly the entire BDD suite (bare `document`/`localStorage`
globals — see Bugs raised, #54). Full detail, including the requirement-coverage map and
file-by-file breakdown, is in `.workflow/add-aspiration/design.md`.

## Test changes

Per `.workflow/add-aspiration/state.md`, red-confirmed then filled in during implementation. Final
full-suite counts: **unit 72/72 pass, BDD 18/18 scenarios (150 steps) pass, e2e 47/47 pass.**

**Unit (Vitest + `jest-axe`)**

- `src/aspiration-modal.test.ts` (new) — covers dialog semantics/labeling, content order, the
  single-instance guard, Title/Description/Reason field labeling and required-state, Save
  enable/disable, the Goals/Habits toggle including the re-click deselect path, the close/Escape/
  backdrop-click funnel and confirm-prompt actions, focus-on-open and focus-trap wrap-around, and
  focus-return-on-close. Includes `jest-axe` scans of `document.body` (the dialog is portaled
  outside `root`) for three DOM states: freshly opened/empty, a Links radio selected, and the
  confirm prompt open on top of a dirty modal — an automated WCAG scan.
- `src/aspiration-storage.test.ts` (new) — covers `saveAspiration` writing/appending correctly to
  a passed-in `Storage`, multiple independent saves not overwriting each other, malformed
  pre-existing JSON being tolerated, and a distinct fake-`Storage` regression test proving the
  module never falls back to a bare global.
- `src/focus-trap.test.ts` (new) — `Tab`/`Shift+Tab` wrap-around at both ends, non-`Tab` keys
  ignored, and cleanup actually removing the listener.
- `src/add-item-menu.test.ts` (modified) — adds `onItemSelect` coverage (invoked with the clicked
  item's label, generic across all five item types, and a no-throw check when the callback is
  omitted).
- `src/app.test.ts` (modified) — adds integration coverage that selecting "Aspiration" opens the
  modal exactly once (even across repeated selections) and that the other four item types still
  open nothing.

**BDD (Cucumber.js)**

- `features/add-aspiration.feature` + `features/step_definitions/add-aspiration.steps.ts` (new) —
  DOM-level scenarios covering header/blurb text and order, field labeling/required state, Save
  disabled/enabled transitions, the Links toggle/deselect/empty-state behavior, the close/Escape
  confirmation flow (discard vs. keep-editing), persistence of one and then two independent saved
  records, and the single-instance guard.
- `features/support/world.ts` (modified) — the shared `JSDOM` fixture now passes `{ url:
  'http://localhost/' }`, without which `localStorage` throws for an opaque origin (see Bugs
  raised, #54) — a prerequisite for every persistence-related BDD scenario, not itself a
  WCAG-scanning file.

**E2E (Playwright + `@axe-core/playwright`)**

- `tests/e2e/aspiration-modal.spec.ts` (new) — real-browser coverage of everything the unit/BDD
  layers cannot exercise under jsdom: full keyboard-only Tab/Shift+Tab wrap-around, background
  exclusion from focus/click via `inert` (jsdom doesn't implement `inert` at all), native
  arrow-key navigation between the Goals/Habits radios, an actual `page.reload()` proving
  persistence survives a real browser navigation (not just same-session `localStorage` reads),
  the close/Escape/backdrop-click flows, focus-return after every close path, a visible
  focus-ring check, and `@axe-core/playwright` scans (modal open/empty, Goals selected, confirm
  prompt open) — an automated WCAG scan.

## Accessibility

Per-requirement coverage (design decision + automated scan):

- **28 (dialog semantics)** — `role="dialog"`/`aria-modal="true"`/`aria-labelledby` pointing to the
  "Create Aspiration" heading; verified by `jest-axe` (unit) and `@axe-core/playwright` (e2e).
- **29 (focus on open)** — focus moves to the Title field at the end of `open()`; unit-tested
  directly.
- **30 (focus trap)** — `createFocusTrap()` wrap-around verified at the unit layer; the
  background-fully-excluded-via-`inert` half is real-browser-only (jsdom doesn't implement
  `inert`) and is verified by a dedicated e2e case.
- **31 (focus return)** — always to the add-item button (the only one of the two permitted targets
  that's actually focusable once the menu is hidden); unit- and e2e-tested across every close
  path.
- **32 (labels)** — explicit `<label for>` on Title/Description/Reason with matching visible text;
  unit-tested and covered by axe scans.
- **33 (required exposure)** — `required` + `aria-required="true"` on Title; unit-tested.
- **34 (radio group)** — `<fieldset><legend>Links</legend>` for the accessible group name and
  native same-`name` grouping for arrow-key navigation; the arrow-key half is real-browser-only
  (jsdom doesn't implement it) and verified by a dedicated e2e case.
- **35 (empty-state message)** — real `<p aria-live="polite">` text, not icon/color; unit-tested
  and axe-scanned.
- **36 (close control name)** — `aria-label="Close"`; axe-scanned.
- **37 (keyboard operability)** — all-native `<button>`/`<input>`/`<textarea>` elements; exercised
  throughout unit/BDD/e2e.
- **38 (visible focus indicators)** — existing `:focus-visible` pattern reused; e2e includes a
  visible focus-ring assertion.
- **39 (confirm-prompt focus)** — `role="alertdialog"`, focus to "Keep editing" on open, focus
  back to the modal's close button on return; unit-tested.
- **40 (contrast)** — reuses the existing palette combinations already computed/passing; adjusted
  mid-run after manual-test feedback (see Bugs raised, #56) to fix a disabled-Save-button
  contrast/color regression left over from the purple color-scheme change.
- **41 (disabled-state exposure)** — native `disabled` attribute on Save, not styling alone;
  unit-tested.

No issues carrying the `accessibility` label were raised during this run — all accessibility gaps
found (the `inert`/arrow-key jsdom-fidelity gaps, and the disabled-Save contrast slip) surfaced
through the `design` and `manual-test` labels instead and are covered under Bugs raised below. Both
automated WCAG scan layers (`jest-axe` at unit, `@axe-core/playwright` at e2e) passed with no
violations by the time of the final full-suite run.

## Bugs raised

All issues below are closed. None carry the `accessibility` label (see Accessibility, above).

### Design review (label: `design`) — issues #51–#54, closed across 5 review rounds before implementation began

| # | Title | Opened | Closed | Resolution |
|---|---|---|---|---|
| [#51](https://github.com/lauz9888/throughline/issues/51) | radio deselect mechanism broken | 2026-07-25 12:51:49 | 2026-07-25 12:59:26 | The draft's `if (radio.checked)` branch fired on every click (not just re-clicks) because the HTML spec's pre-click activation steps already flip `checked` before the `click` event dispatches — verified empirically against the pinned jsdom. Fixed by tracking the previously-selected value in the module's own closure state (set only by the `change` handler) and comparing against that instead of `radio.checked`. |
| [#52](https://github.com/lauz9888/throughline/issues/52) | reload persistence and arrow-key operability untested; missing ADR | 2026-07-25 12:59:20 | 2026-07-25 13:05:26 | Added a dedicated e2e scenario performing an actual `page.reload()` to prove Requirement 25's "survives a full reload" claim (no prior scenario exercised a real navigation), added a dedicated e2e arrow-key scenario for Requirement 34 (jsdom doesn't implement native radio-group arrow-key behavior), and added ADR 0003 for the hand-rolled modal/dialog pattern. |
| [#53](https://github.com/lauz9888/throughline/issues/53) | portal-to-body test isolation gap | 2026-07-25 13:05:28 | 2026-07-25 13:12:13 | The design's unit-test plan didn't specify that `jest-axe`/DOM queries must target `document`/`document.body`, not `root` (the dialog is portaled to `body` as a sibling of `root`, so scanning `root` would produce a spuriously-passing, essentially-empty-subtree scan). Also added an `afterEach` cleanup (destroy the modal instance, reset `document.body`) matching the existing `add-item-menu.test.ts` convention, preventing dialogs leaking between tests. |
| [#54](https://github.com/lauz9888/throughline/issues/54) | bare global document/localStorage break BDD suite | 2026-07-25 13:12:14 | 2026-07-25 13:23:26 | The draft used the bare `document` global for the Escape listener and the bare `localStorage` global in `saveAspiration` — neither exists in the BDD execution process (a plain Node process building a standalone `JSDOM` instance per scenario), which would have failed nearly every scenario in the feature. Fixed by deriving `doc`/`win` from `root.ownerDocument`/`.defaultView` (mirroring the existing `add-item-menu.ts` pattern) and threading `storage` into `saveAspiration` as an explicit parameter; also required adding `{ url: 'http://localhost/' }` to `features/support/world.ts`'s `JSDOM` constructor, since an opaque-origin jsdom document throws on `localStorage` access. |

### Manual test (label: `manual-test`) — issues #55–#56, closed across 2 manual-test rounds

| # | Title | Opened | Closed | Resolution |
|---|---|---|---|---|
| [#55](https://github.com/lauz9888/throughline/issues/55) | readability, tooltips, and color scheme feedback | 2026-07-25 14:30:06 | 2026-07-25 14:47:23 | First round of manual-test feedback: font/size adjusted for readability, tooltips added to each field (Title, Description, Reason, Links radios) describing their purpose, and the modal recolored to a light pastel purple background with a darker purple Save button. |
| [#56](https://github.com/lauz9888/throughline/issues/56) | disabled Save button still gold-ish; tooltip should reveal on icon click, not hover | 2026-07-25 14:50:29 | 2026-07-25 15:02:07 | Second round: the disabled-Save-button color was a leftover muted-gold (`#c9bda3`) from before the purple scheme change (the enabled state was already correctly purple) — replaced with a muted/desaturated purple disabled color; tooltip reveal behavior changed from `:hover`/`:focus-within` on the whole field to an explicit click on the tooltip icon itself. |

### CI (label: `ci`) — issue #58, one cycle

| # | Title | Opened | Closed | Resolution |
|---|---|---|---|---|
| [#58](https://github.com/lauz9888/throughline/issues/58) | CI failure — Format check | 2026-07-25 15:06:51 | 2026-07-25 15:18:02 | The Format check job failed on PR #57 (`npm run format:check`); fixed by running the formatter and pushing the corrected formatting, after which all CI jobs (BDD tests, combined coverage, dependency audit, e2e tests, format check, install & build, lint, type check, unit tests) passed green. |

### QA review (Step 12) — 4 rounds, no issues filed

QA review took 4 rounds to reach approval. The first three rounds each made a small direct fix
without filing a GitHub issue (per this pipeline's convention: QA fixes small things itself,
escalating to a filed issue only for security-gap/accessibility-gap/coverage-gap statuses, none of
which occurred here) — removing a dead `eslint-disable` comment, adding missing unit-test coverage
for focus-trap radio tab-stops, and deduplicating a repeated storage-key string literal. Round 4
approved with combined coverage 97.93%.

### Everything else — no bugs filed

The full-suite run (post-implementation, pre-QA), the base-path smoke check (`GITHUB_PAGES=true`
build, 43/43 e2e green against the `/throughline/` base path), and CD (production build, deploy,
live e2e tests, PWA validation, post-deploy smoke check) all passed clean with no issues raised.

## Time taken

- **Started**: 2026-07-25 12:28:20 UTC
- **Completed**: 2026-07-25 15:26:35 UTC
- **Total elapsed**: approximately 2 hours 58 minutes

This elapsed time spans human wait time as well as active engineering work — user approval of
requirements, design-review turnaround across 5 review cycles, two rounds of manual-testing
feedback and fixes, QA review turnaround across 4 rounds, and CI/CD run time (including one CI
failure/fix cycle) — not just active implementation time. It should not be read as a measure of
pure engineering effort.

## Pipeline stages traversed

Requirements gathering -> solution design + review (5 cycles, issues #51-#54) -> branch
`feature/add-aspiration` -> red-phase unit/BDD/e2e tests -> implementation -> full suite run (unit
66/66, BDD 18/18, e2e 43/43, no bug-fix cycles needed) -> QA review (4 rounds, 3 direct fixes, no
issues filed, approved at 97.93% combined coverage) -> manual test gate (2 rounds, issues #55-#56,
both closed) -> merge via PR #57 (squash commit `77eafb9`) -> CI (1 cycle, issue #58, format-check
fix) -> CD (all green) -> base-path smoke check (43/43 e2e green) -> docs update (README.md commit
`4427323`, wiki `Home.md` commit `e487dbf`) -> this report.
