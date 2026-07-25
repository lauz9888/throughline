# 0003. Hand-rolled dialog + focus-trap pattern for modals

Status: Accepted
Date: 2026-07-25

## Context

This is the first modal/dialog component in throughline — there was no modal, dialog, or focus-
management pattern anywhere in the codebase before this change, and the add-item menu's five item
types (Aspiration, Goal, Milestone, Task, Habit) each are expected to eventually open some form of
creation modal, making this the first instance of a pattern the other four will likely follow.

Two approaches were considered for the dialog itself:

- **Native `<dialog>` element with `.showModal()`.** Gives automatic top-layer stacking, a
  `::backdrop` pseudo-element, and (in modern browsers) built-in focus containment and a native
  `cancel` event on Escape.
- **Hand-rolled `<div role="dialog" aria-modal="true">` overlay**, with a custom focus-trap
  utility and manual Escape/backdrop-click wiring.

The native `<dialog>` approach was rejected for this codebase specifically because of this
project's three-layer test setup (Vitest/jsdom unit tests, Cucumber BDD against jsdom via
`features/support/world.ts`, Playwright e2e in real browsers). jsdom's support for
`HTMLDialogElement`'s `showModal()`/`close()` focus-containment, `::backdrop` click-outside
detection, and the native `cancel` event is inconsistent/unreliable across jsdom versions, and
this project already needs unit-layer coverage of focus trapping and the close/Escape/backdrop
funnel (per this feature's accessibility requirements). Relying on `<dialog>`'s native behavior
would have made unit-test outcomes depend on exactly how much of the spec jsdom happens to
implement, rather than on code this repo owns and controls — the same category of jsdom-fidelity
risk this feature's design already had to work around for `inert` (not implemented by the pinned
jsdom at all) and native radio-group arrow-key behavior (also not implemented by jsdom, verified
only at the e2e layer). A hand-rolled dialog needs the same custom focus-trap/Escape/backdrop
logic regardless of which element it's built on, since native `<dialog>` still wouldn't have
covered this feature's nested "confirm before discard" `alertdialog` on its own — so there was no
net implementation-cost saving to justify inheriting `<dialog>`'s jsdom-fidelity risk.

## Decision

New modals in this codebase are built as a plain `<div role="dialog" aria-modal="true"
aria-labelledby="...">` (or `role="alertdialog"` for confirmation-style prompts) overlay, portaled
to `document.body`, paired with the shared `createFocusTrap()` utility in `src/focus-trap.ts` for
`Tab`/`Shift+Tab` wrap-around, plus `HTMLElement.inert` set on the app root while any such dialog
is open. `src/aspiration-modal.ts` is the first implementation of this pattern; `src/focus-trap.ts`
is deliberately factored out as a small, reusable (not modal-specific-named) utility so the next
modal (Goal/Habit/Task/Milestone creation, or any other future dialog) can reuse it directly
rather than reimplementing focus trapping.

## Consequences

Future modals get a consistent, already-reviewed accessibility baseline (dialog semantics, focus
trap, focus-on-open, focus-return-on-close, Escape/backdrop-click handling) by following this same
shape, and can reuse `src/focus-trap.ts` without modification. The tradeoff is that this project
forgoes native `<dialog>`'s free top-layer stacking and native backdrop/cancel handling, meaning
every new modal must correctly wire its own overlay stacking (`z-index`), backdrop-click
detection, and Escape handling by hand — a real, recurring cost this ADR accepts explicitly in
exchange for jsdom-testable, this-repo-owned behavior. If a future jsdom release closes the
`<dialog>`/`inert`/native-radio-group fidelity gaps this ADR cites, revisit whether native
`<dialog>` becomes worth adopting for new modals (this ADR would then be superseded, not edited).
