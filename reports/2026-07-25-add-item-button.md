# Ship report: add-item-button

- **Tracking issue**: [#19](https://github.com/lauz9888/throughline/issues/19)
- **Branch**: `feature/add-item-button`
- **PR**: [#23](https://github.com/lauz9888/throughline/pull/23) (merged, squashed as `cc1ee53`)
- **Live**: https://lauz9888.github.io/throughline/

## Requirements

Second feature run through this pipeline, building on the `site-scaffold` baseline (a blank white page with a "throughline" wordmark top-left). The ask: "add a button at the top of the page, level with the logo. It should be at the top right of the page on both desktop and mobile views. It should be a square with rounded edges with a plus sign on it. You design the colour scheme. When clicked, a dropdown is displayed, with the options of: Aspiration, Goal, Milestone, Task, Habit."

This expanded into 19 concrete requirements across three groups:

- **Position/layout**: button lives in the same top-bar row as the wordmark (not a separate row), pinned top-right at all viewport widths, vertically centered against the wordmark, with a `1.5rem` top/right inset matching the wordmark's existing `1.5rem` top/left inset.
- **Appearance**: a `44px` × `44px` rounded square (`border-radius: 10px`), plus-sign glyph as the only visible content, and a fully specified color scheme delegated to this pipeline — `#8a6d3b` gold background, `#ffffff` icon, `#6f5730` hover, `#1a1a1a` focus-visible ring — drawn from the existing wordmark/accent palette rather than introducing new colors. `44px` doubles as the minimum touch-target size.
- **Dropdown behavior**: closed by default; click toggles it open/closed; click-outside and `Escape` both close it (`Escape` also returns focus to the button); it anchors below the button without overlapping the wordmark; the five options ("Aspiration", "Goal", "Milestone", "Task", "Habit") render in that exact order as `role="menuitem"` elements inside a `role="menu"`; the button carries `aria-label`, `aria-haspopup`, `aria-expanded`, `aria-controls`; and the whole interaction is keyboard-operable (`Enter`/`Space` to open, `Tab`/arrow keys to reach options).

Explicitly out of scope: any behavior for selecting a dropdown option, any "item" data model/storage, and animations beyond basic show/hide. No open questions remained — the user's own request delegated the color choice, and the requirements step filled in concrete values and sensible defaults for the interaction conventions. Approved by the user on 2026-07-25. Full detail in `.workflow/add-item-button/requirements.md`.

## Solution

`src/app.ts`'s `renderApp` was restructured to build a `<header class="top-bar">` wrapping both the existing wordmark and a new add-item button + dropdown, rather than mounting the wordmark directly into `#app`. `#app` still ends up with exactly one child element (now the `<header>`), keeping the existing "root has one child" contract structurally true even though what that one child *is* changed.

Key decisions:

- **New module, `src/add-item-menu.ts`**: a single `initAddItemMenu()` function owning all open/close/keyboard logic via plain DOM event listeners — no new dependencies. It returns a `destroy()` cleanup function; `src/app.ts` calls the previous instance's `destroy()` before creating a new one, which matters because `renderApp` can be called more than once (an existing idempotency test does this deliberately, and Vite HMR could in practice) — without the cleanup, repeated calls would leak duplicate `document`-level click/keydown listeners closing over stale, detached elements.
- **Plus icon**: drawn with CSS pseudo-elements (`::before`/`::after` bars) on the button rather than an SVG asset or icon font — no new static asset, no `vite-plugin-pwa` glob-pattern change.
- **Dropdown anchoring**: `.add-item { position: relative }` + `.add-item-menu { position: absolute; top: calc(100% + 0.5rem); right: 0 }`, anchoring the menu under the button, which already sits at the row's far right — geometrically clear of the wordmark at any supported width.
- **Contrast check**: white-on-gold (`#ffffff` on `#8a6d3b`) computes to ≈4.85:1, clearing both the WCAG 1.4.11 non-text (3:1) and 1.4.3 text-level (4.5:1) thresholds, so no palette adjustment was needed from the requirements' stated hex values.
- **Accessibility**: real, natively-focusable `<button role="menuitem">` elements (not `<li>` or `<div>`) for menu items, so they're reachable via `Tab` with no extra work; arrow-key roving focus added as an enhancement beyond the letter of the requirement.

Design review went through 2 cycles before approval, raising and resolving 3 issues (#20–#22) — see Bugs raised below. Full detail, including the requirement-coverage map and file-by-file breakdown, is in `.workflow/add-item-button/design.md`.

## Test changes

Per `.workflow/add-item-button/state.md`, red-confirmed then filled in during implementation:

**Unit (Vitest)**
- `src/app.test.ts` — updated to match the new top-bar structure: root still has exactly one top-level child (now `header.top-bar`), the wordmark is queried at `h1.wordmark` rather than assumed to be the root's direct child, the add-item button renders with the correct ARIA attributes and starts closed, the menu contains exactly 5 `role="menuitem"` items in the exact `Aspiration/Goal/Milestone/Task/Habit` order, idempotency (`renderApp` called twice still yields one child) is preserved, and a listener-leak regression case exercises a *stale* first-render button reference directly after a second render to confirm `destroy()` actually detached its listeners (the naive version of this test, which only checks the second render's live button, does not detect the leak — flagged and fixed via issue #20).
- `src/add-item-menu.test.ts` (new) — unit tests against `initAddItemMenu` in isolation using a hand-built fixture: initial state untouched, click toggles open/closed, clicking a menu item closes and refocuses the button, click-outside closes, click on the menu container itself (not an item) does not close it, `Escape` closes and refocuses (and is a no-op when already closed), `ArrowDown`/`ArrowUp` roving focus wraps at both ends, and calling the returned cleanup function actually removes the `document`-level listeners.

**BDD (Cucumber.js)**
- `features/top-bar.feature` and `features/step_definitions/top-bar.steps.ts` (renamed from `features/blank-page.feature` / `blank-page.steps.ts`) — reworded away from "blank page" / "nothing but the wordmark" language, since that premise is no longer true; keeps a scenario confirming the wordmark is still present with accessible text `"throughline"`.
- `features/add-item-button.feature` and `features/step_definitions/add-item-button.steps.ts` (new) — DOM-level coverage of the button/dropdown: closed by default with correct ARIA attributes, click opens with the 5 options in exact order and correct roles, second click toggles closed, `Escape` closes and returns focus to the button.

**E2E (Playwright)**
- `tests/e2e/add-item-button.spec.ts` (new) — visual/browser-level coverage: button visible top-right at mobile (375×667) and desktop (1280×800), vertically centered with the wordmark within tolerance, exact `44px` square with rounded (non-circular) corners, computed background color and hover-darkened color match the spec'd hex values, keyboard-focus shows a visible `:focus-visible` outline, clicking opens a `role="menu"` with 5 `role="menuitem"` entries in order, second click and click-outside both close it, `Escape` closes and refocuses the button, the open menu sits below the button and never overlaps the wordmark, and keyboard-only flows are exercised for **both** `Enter` and `Space` activation (the latter added via issue #22, since native `<button>` Space-activation fires on `keyup` rather than `keydown` and needed its own explicit check against the `document` keydown listener).

Full suite run: unit 21/21 pass, BDD 6/6 scenarios pass, e2e 19/19 pass — all green on the first try, no bug-fix cycles needed at that step. QA review approved with combined coverage 99.61%, no changes requested.

## Bugs raised

### Design review (label: `design`) — issues #20–#22, all closed during the 2-cycle design review, before implementation began

| # | Title | Opened | Closed | Resolution |
|---|---|---|---|---|
| [#20](https://github.com/lauz9888/throughline/issues/20) | regression test doesn't detect listener-leak bug | 2026-07-25 08:16:23 | 2026-07-25 08:21:04 | The proposed unit test for double-`renderApp` cleanup passed even when `cleanupAddItemMenu` was never called, because the leaked first-render `document` click listener closes over the *first* render's button, which the test never clicked. Design updated to capture the stale first-render button/menu references before the second `renderApp` call, dispatch a click directly on the stale button afterward, and assert its `aria-expanded` does not change. |
| [#21](https://github.com/lauz9888/throughline/issues/21) | FILES_TOUCHED list inconsistent with feature file rename | 2026-07-25 08:16:25 | 2026-07-25 08:21:06 | The design's file-changes section instructed renaming `features/blank-page.feature` (and its step definitions), but the `FILES_TOUCHED` summary still listed only the old path. Reconciled so both the rename and the new/old paths are explicit and consistent. |
| [#22](https://github.com/lauz9888/throughline/issues/22) | e2e keyboard scenario only exercises Enter, not Space | 2026-07-25 08:16:26 | 2026-07-25 08:21:08 | Requirement 19 calls for both `Enter` and `Space` to activate the button, but the design's e2e keyboard-flow scenario only exercised `Enter`. Added an equivalent `Space`-key assertion. |

All three were resolved in the same design revision and closed with "Resolved in updated design."

### Unit/BDD/e2e full-suite run, QA review, manual test gate, CI, CD — no bugs filed

Every gate after design approval passed clean on the first attempt: full suite run (unit 21/21, BDD 6/6, e2e 19/19), QA review (99.61% combined coverage, no changes needed), the manual test gate, CI (BDD tests, install & build, lint, type check, unit tests all green), and CD (production build, deploy, PWA validation, live e2e tests, post-deploy smoke check all green). No issues were raised at any of these stages.

## Time taken

- **Started**: 2026-07-25 08:02:15 UTC
- **Completed**: 2026-07-25 08:49:35 UTC
- **Total elapsed**: approximately 47 minutes

This elapsed time spans human wait time as well as active engineering work — user approval of requirements, design-review turnaround across the 2 review cycles, the manual-testing gate, and CI/CD run time — not just active implementation time. It should not be read as a measure of pure engineering effort.

## Pipeline stages traversed

Requirements gathering -> solution design + review (2 cycles, issues #20-#22) -> branch `feature/add-item-button` -> red-phase unit/BDD/e2e tests -> implementation -> full suite run (all green first try) -> QA review (approved, 99.61% combined coverage) -> manual test gate (passed) -> merge via PR #23 (squash commit `cc1ee53`) -> CI (all green first try) -> CD (all green first try) -> docs update -> this report.
