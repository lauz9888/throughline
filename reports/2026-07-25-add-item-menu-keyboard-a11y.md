# Ship report: add-item-menu-keyboard-a11y

- **Tracking issue**: [#59](https://github.com/lauz9888/throughline/issues/59)
- **Branch**: `feature/add-item-menu-keyboard-a11y`
- **PR**: [#62](https://github.com/lauz9888/throughline/pull/62) (merged, squashed as `28d97c6`)
- **Live**: https://lauz9888.github.io/throughline/

## Requirements

This was a keyboard-accessibility fix to the add-item dropdown menu (`src/add-item-menu.ts`),
triggered by external AI-model accessibility review feedback. The request identified a confirmed
`ArrowUp`-focus bug and a set of missing WAI-ARIA menu-button interaction-model behaviors, and asked
for the full expected interaction model to be implemented:

- `Enter`/`Space` on the trigger opens the menu and focuses the first item.
- `ArrowDown` on the trigger opens the menu (if closed) and focuses the first item; when already
  open, moves focus to the next item, wrapping last→first.
- `ArrowUp` on the trigger opens the menu (if closed) and focuses the last item; when already open,
  moves focus to the previous item, wrapping first→last. This is the fix for the confirmed bug:
  `ArrowUp` while focus was on the trigger button (`activeElement` not in the item list) computed
  the wrong wrap-around index and focused "Task" instead of "Habit" (the last item).
- `Home`/`End` navigate to the first/last item.
- Menu items use managed/roving tab focus (not every item independently `Tab`-able).
- `Tab` exits the menu (closes it and moves focus per normal tab order) rather than cycling through
  every menu item as a normal tab stop.

This expanded into 29 numbered requirements (18 behavioral, 5 required-test-coverage, 6
accessibility) in `.workflow/add-item-menu-keyboard-a11y/requirements.md` — covering opening/initial
focus placement, arrow-key navigation within an open menu, roving tabindex, `Tab`-exit semantics, and
`destroy()` cleanup of the newly added listeners. Out of scope: any visual/CSS change (existing
`:focus-visible` styling was already in place from the prior `add-item-button` feature), typeahead,
changing what happens when an item is _activated_, and mouse-click-open focus behavior (deliberately
unchanged). No open questions remained — the request fully specified the interaction model, and
standard WAI-ARIA menu-button convention filled in the remaining low-risk implementation defaults.
Approved by the user on 2026-07-25.

## Solution

Rather than patching the existing single document-level `keydown` handler (which computed
`menuItems.indexOf(document.activeElement)` and returned `-1` — hence the bug — whenever focus was
on the trigger button instead of an item), the fix restructures keyboard handling by scope:

- A **button-level** `keydown` listener owns "opening" semantics (`Enter`/`Space`/`ArrowDown`/`ArrowUp`
  while focus is on the trigger), always targeting a literal index (`0` or `menuItems.length - 1`) —
  no `indexOf(activeElement)` call exists anywhere in the new code, so the bug class is structurally
  impossible to reintroduce.
- An **item-level** `keydown` listener (shared handler, index derived from `event.currentTarget`)
  owns "navigating/exiting" semantics (`ArrowDown`/`ArrowUp`/`Home`/`End`/`Tab` while focus is on an
  item).
- The **document-level** `keydown` listener is simplified to handle `Escape` only.

A `focusItem(index)` helper centralizes every `.focus()` call and roving-tabindex update together, so
the item that carries `tabindex="0"` can never drift out of sync with the actually-focused item.
`setOpen()` resets the roving position to the first item on every closed→open transition.

Design review went through 2 cycles before approval, raising and resolving 2 issues (#60, #61):

- **#60 (Tab-exit focus-fixup race)**: closing the menu synchronously inside the item-level
  `Tab`/`Shift+Tab` keydown handler (`menu.hidden = true`, which is `display: none` per
  `src/style.css`) would trigger the browser's synchronous focus-fixup algorithm _before_ the
  pending native `Tab` default action ran (since `preventDefault()` is deliberately never called) —
  the native traversal would then compute "next tabbable element" starting from `<body>` instead of
  the real item, plausibly landing back on `#add-item-button`. Resolved by deferring the close to a
  new `focusout` listener on `menu` (`handleMenuFocusOut`), which only fires once the browser has
  already moved focus to its real destination, distinguishing an in-menu roving move
  (`relatedTarget` still inside `menu`) from a genuine exit.
- **#61 (Requirement 23 missing e2e coverage)**: the required-test-coverage list asked for cleanup
  verification (Req 23) in both unit and e2e suites, but design only planned unit coverage. Resolved
  with an explicit, documented justification rather than adding e2e coverage: proving a _second_
  `initAddItemMenu` instance's listeners are truly removed requires calling it twice in the same JS
  realm, which has no reachable analog in the Playwright suite (no user-reachable re-render/refresh
  path exists in the shipped app, and the suite runs against a built `dist/`/live site, not
  individually-importable source modules) — adding a production-only test hook purely to make this
  reachable was judged a worse tradeoff than leaving it as a unit-level guarantee.

Full detail, including the requirement-coverage map, the discovered reentrancy subtlety in
`handleMenuFocusOut`, and the rejected alternatives (`setTimeout(0)`-deferred close; manually
computing the next tabbable element), is in `.workflow/add-item-menu-keyboard-a11y/design.md`.

## Test changes

Per `.workflow/add-item-menu-keyboard-a11y/state.md`, red-confirmed then filled in during
implementation:

**Unit (Vitest)**

- `src/add-item-menu.test.ts` — 2 existing arrow-key wrap tests updated to dispatch on the focused
  item rather than `document` (handling moved off the document-level listener); new tests cover:
  `Enter`/`Space`/`ArrowDown`/`ArrowUp` from the trigger opening the menu and landing on the exact
  expected item (including an explicit regression assertion that `ArrowUp` lands on "Habit", not
  "Task"); `ArrowDown`/`ArrowUp` while already open with focus still on the button; arrow movement
  between two middle items (not just boundary wraps); `Home`/`End` from a non-boundary item; a
  combined roving-tabindex scenario proving reset-on-reopen; `Tab`/`Shift+Tab` keydown alone not
  closing the menu synchronously (the Issue #60 regression guard); `focusout` with an
  out-of-menu `relatedTarget` closing the menu without refocusing the button, and with an in-menu
  `relatedTarget` not closing it; and cleanup assertions that after `destroy()`, button/item keydown
  dispatches and an out-of-menu `focusout` no longer move focus or change menu state.
- `src/app.test.ts` — gains a `jest-axe` scan of the DOM state reached after an `ArrowDown` keydown
  on the first menu item (roving tabindex split `-1`/`0`/`-1`/`-1`/`-1`), in addition to the two
  pre-existing "menu closed"/"menu open" scans, so the roving-tabindex pattern itself is verified
  axe-clean, not just the initial open state.

**BDD (Cucumber.js)**

- No changes. `requirements.md`'s "Required test coverage" section names only the unit and e2e
  suites, and the one feature-level scenario touching this module (`Escape` closes and refocuses)
  exercises behavior this fix explicitly leaves unchanged.

**E2E (Playwright)**

- `tests/e2e/add-item-button.spec.ts` — the existing `'keyboard-only flow: Enter opens...'` scenario
  updated (the extra `Tab` after `Enter` is removed, since `Enter` alone now focuses "Aspiration"
  immediately); the `'Space opens the dropdown'` scenario gains a focus-target assertion; new
  scenarios cover `ArrowDown`/`ArrowUp` opening from the trigger (including the "Habit" not "Task"
  regression assertion), arrow-key navigation through middle items, and `Tab` from the
  last-roving-focused item closing the dropdown with real focus landing on `document.body` (and
  explicitly _not_ back on `#add-item-button`) — the real-browser proof for the Issue #60 fix, since
  jsdom cannot run native `Tab` default actions. This suite also gains a second
  `@axe-core/playwright` scan (same `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` tag scope as the
  pre-existing scan) against the post-`ArrowDown`-navigation state, confirming the roving `tabindex`
  pattern stays axe-clean, not just the initial open state.

Both `src/app.test.ts` (jest-axe) and `tests/e2e/add-item-button.spec.ts` (`@axe-core/playwright`)
carry automated WCAG scans; per the design's Test impact section, both gained an additional scan
scoped to a post-navigation DOM state as part of this fix.

Full suite run: unit 88/88 pass, BDD 18/18 scenarios pass, e2e 53/53 pass — all green on the first
try, no bug-fix cycles needed at implementation (Steps 9–11). QA review found one round of
changes-made: a Prettier formatting fix to `src/add-item-menu.test.ts` (no logic change), after which
combined coverage was 98.53%, with the full suites re-confirmed green.

## Accessibility

Per-requirement coverage (design decision + automated scan) for each UI-facing accessibility
requirement in `requirements.md`:

- **Req 24 (2.1.1 Keyboard)** — every interaction added by this fix (opening, navigating, exiting)
  is driven by `keydown` handlers on the button/items; no path requires a pointer. Covered by the
  full unit/e2e keyboard-scenario suites above; no mouse-only path exists to reach a menu item.
- **Req 25 (2.1.2 No Keyboard Trap)** — `Tab`/`Shift+Tab` never call `preventDefault()`, and (per
  the Issue #60 fix) the menu is not hidden until _after_ native traversal has already resolved and
  landed on its real target, so a user can always leave the widget via `Tab`, `Shift+Tab`, or
  `Escape`. Covered by the unit "Tab keydown alone does not close" / `focusout`-closes tests and the
  e2e real-browser Tab-exit-lands-on-body test.
- **Req 26 (2.4.7 Focus Visible)** — no new CSS; every new focus target is reached via a genuine
  `.focus()` call from a keyboard event, so the existing `.add-item-button:focus-visible` /
  `.add-item-menu__item:focus-visible` rules (`src/style.css` lines 63-66, 119-122) continue to
  match. Covered indirectly by the e2e keyboard-flow scenarios exercising every new focus target;
  no dedicated visual-regression assertion was added since no styling changed.
- **Req 27 (4.1.2 Name, Role, Value)** — the roving-tabindex change only ever writes the `tabIndex`
  DOM property; `role="menuitem"` and item text content are untouched. Covered by the `src/app.test.ts`
  jest-axe scan added for the post-navigation `tabindex` state.
- **Req 28 (2.4.3 Focus Order)** — opening always resolves to a determinate index (first or last,
  never derived from a stale/ambiguous computation — the direct structural fix for the `ArrowUp`
  bug); exiting via `Tab`/`Shift+Tab` proceeds in the same native document order a sighted user would
  expect. Covered by the opening-focus-target tests (Req 20) and the e2e Tab-exit test.
- **Req 29 (automated WCAG scan stays clean)** — the pre-existing `@axe-core/playwright` scan against
  the open menu, plus the new scan against the post-`ArrowDown`-navigation state (roving `tabindex="-1"`
  present), both report zero violations; likewise the new `jest-axe` scan in `src/app.test.ts`.

**Issues carrying the `accessibility` label**: none. Both design-review issues (#60, #61) carried the
`design` label rather than a dedicated `accessibility` label — #60 was an accessibility-consequential
focus-order/keyboard-trap defect (WCAG 2.1.2/2.4.3) caught and resolved during design review before
any code was written, and #61 was a test-coverage-completeness gap, not a defect in the shipped
behavior. No accessibility regressions were found post-implementation.

## Bugs raised

Gathered via `gh issue list --search "Related to #59" --state all`; all four issues below are closed.

### Design review (label: `design`) — issues #60–#61, resolved during the 2-cycle design review, before implementation began

| #                                                        | Title                                      | Opened              | Closed              | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------ | ------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#60](https://github.com/lauz9888/throughline/issues/60) | Tab-exit focus-fixup race with menu.hidden | 2026-07-25 18:07:40 | 2026-07-25 18:21:30 | Closing the menu synchronously inside the item-level Tab/Shift+Tab keydown handler could trigger the browser's synchronous focus-fixup before the pending native Tab default action ran, plausibly landing focus back on `#add-item-button` instead of the real next element. Resolved by deferring the close to a new `focusout` listener on `menu` (`handleMenuFocusOut`), which fires only once native traversal has already moved focus to its real destination. |
| [#61](https://github.com/lauz9888/throughline/issues/61) | Requirement 23 missing e2e coverage        | 2026-07-25 18:07:41 | 2026-07-25 18:21:32 | requirements.md asked for Req 23 (destroy()/cleanup verification) coverage in both unit and e2e suites, but design only planned unit coverage. Resolved with an explicit, documented justification in design.md rather than adding e2e coverage — a second-instance cleanup check has no reachable analog in the Playwright suite (no user-reachable re-render path; suite runs against built/live output, not importable source modules).                           |

### CI (label: `ci`) — issue #63, resolved during the single CI cycle

| #                                                        | Title                     | Opened              | Closed              | Resolution                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------- | ------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [#63](https://github.com/lauz9888/throughline/issues/63) | CI failure — Format check | 2026-07-25 18:55:25 | 2026-07-25 19:03:11 | PR #62's "Format check" job (`npm run format:check`) failed on `reports/2026-07-25-add-aspiration.md`, a file from an earlier, unrelated feature that had never been run through Prettier. Fixed and verified against a clean LF clone matching CI's Linux runner. All other CI jobs (BDD tests, coverage, dependency audit, e2e tests, install & build, lint, typecheck, unit tests) passed on the first attempt. |

### Full-suite run, QA review, base-path smoke check, CD — no bugs filed

- **Full-suite run** (Steps 9–11): unit 88/88, BDD 18/18, e2e 53/53 all passed on the first attempt —
  no bug-fix cycles needed.
- **QA review**: one round, changes-made — a Prettier formatting fix to
  `src/add-item-menu.test.ts` (no logic change), not tracked as a separate issue. Combined coverage
  98.53% after the fix; full suites re-confirmed green.
- **Base-path smoke check**: passed, but is worth recording plainly as a process note rather than a
  code bug — the first attempt at running `vite preview` for this check omitted the `GITHUB_PAGES=true`
  env var (only the build step had it set), so the preview server served assets at the wrong base
  path and all 50 e2e tests then in scope failed with 404s. This was diagnosed as an environment
  setup mistake on the agent's part, not a code regression; the preview was restarted correctly with
  the env var set, and the full 53/53 e2e suite passed clean against the real `/throughline/` base
  path on the second attempt.
- **Manual test gate**: skipped by user choice. The user attempted to reach a dev server three
  times (localhost:5173 via a sandboxed preview browser, then via Bash-started `npm run dev` on both
  default and explicit `127.0.0.1` bindings) but could not connect from their actual local
  machine/browser — this session's tool execution environment(s) are not network-bridged to the
  user's real browser. This is an environment limitation, not a code issue. The user chose to
  proceed given strong automated coverage (unit 88/88, BDD 18/18, e2e 53/53, base-path smoke check
  passed); the core `ArrowUp` bug fix had also been independently, visually verified via the
  sandboxed browser-pane tooling before that path was determined unreachable for the user.
- **CD**: all green (production build, deploy, post-deploy smoke check, live e2e tests, PWA
  validation) on the first attempt.
- **Docs**: wiki `Home.md` updated with the new keyboard interaction model description;
  `README.md` needed no change (it never described keyboard-interaction details).

## Time taken

- **Started**: 2026-07-25 15:28:03 UTC
- **Completed**: 2026-07-25 19:07:06 UTC
- **Total elapsed**: approximately 3 hours 39 minutes

This elapsed time spans human wait time as well as active engineering work — requirements approval,
2 design-review cycles (issues #60-#61), the QA review round, the base-path smoke-check
troubleshooting, three rounds of user attempts to reach a manual-test dev server before the gate was
skipped, PR review/merge turnaround, one CI cycle (issue #63), and CI/CD run time — not just active
implementation time. It should not be read as a measure of pure engineering effort.

## Pipeline stages traversed

Requirements gathering -> solution design + review (2 cycles, issues #60-#61) -> branch
`feature/add-item-menu-keyboard-a11y` -> red-phase unit tests (BDD step a no-op, no `.feature`
changes needed) -> red-phase e2e tests -> implementation (full suite green first try: unit 88/88,
BDD 18/18, e2e 53/53) -> QA review (1 round, changes-made — Prettier fix, no logic change; 98.53%
combined coverage) -> base-path smoke check (passed after correcting a preview-server misconfiguration)
-> manual test gate (skipped by user choice, dev server unreachable from user's browser) -> merge via
PR #62 (squash commit `28d97c6`) -> CI (1 cycle, issue #63, format-check fix) -> CD (all green first
try) -> docs update -> this report.
