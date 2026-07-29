# 0004. Dynamic repeatable-row pattern for milestones (never-reused numbering, focus-move + live-region announcement)

Status: Accepted
Date: 2026-07-28

## Context

The `add-goal` feature introduces the first dynamically-growable/shrinkable repeating field group
in throughline — every prior form (Aspiration create/edit) has a fixed set of fields. Milestones
require unlimited add, per-row remove, and (per the accessibility requirements) each added/removed
row must be immediately part of/excluded from the existing focus trap, each row's remove control
needs a uniquely identifying accessible name, and the add/remove mutation itself must be
perceivable to assistive-technology users, not a silent DOM change. Future features touching
lists of user-added items (e.g. sub-tasks, habit reminders) are likely to face the same
questions, making this worth a durable record rather than a one-off, undocumented choice.

Two questions needed a concrete answer:

1. **How to number/label rows, given rows can be removed from the middle of the list.**
   Renumbering every remaining row's `id`/`for`/`aria-label` on every removal (so labels always
   match visual position, e.g. "Milestone 2" always means "the second row currently on screen")
   was considered, but rejected: it requires rewriting DOM ids on _every_ remaining row on _every_
   single removal, which is a correctness hazard (nothing may depend on those ids remaining
   stable — the ids only need to be _unique_, not order-encoding) for no requirement-mandated
   benefit. The alternative — a permanently unique, monotonically increasing, never-reused counter
   assigned once per row at creation — satisfies "distinct enough to be unambiguous" (the actual
   requirement) with no renumbering step at all.
2. **How to make add/remove perceivable to assistive technology**, given the existing shared
   `createFocusTrap()` (`src/focus-trap.ts`) already recomputes its focusable-element list fresh on
   every `Tab` keydown rather than caching it at trap-creation time — meaning it needed no changes
   at all to correctly include/exclude dynamically added/removed rows.

## Decision

- Each milestone row is assigned a number from a per-modal-open, closure-scoped counter that only
  ever increments (starting at 1 for the first row added after any given modal open) and is never
  reused, even after rows are removed. This number drives both the row's visible label
  ("Milestone `N`") and its remove control's accessible name ("Remove milestone `N`").
- Adding a row moves keyboard focus to that row's own title input immediately. Removing a row
  moves focus to (in order of preference): the row that now visually occupies the removed row's
  position → the new last remaining row → the "Add milestone" button, if the list is now empty.
- A single visually-hidden `aria-live="polite" aria-atomic="true"` status region inside the
  Milestones section is updated with a one-line message ("Milestone 3 added." / "Milestone 2
  removed.") on every add/remove, in addition to (not instead of) the focus move above.
- `src/focus-trap.ts` itself is unmodified — its existing "recompute fresh on every Tab" behavior
  is relied upon as-is, confirmed correct for this use case by reading its implementation before
  writing this design, not assumed.
- This logic lives in its own module (`src/milestone-rows.ts`), not inlined into the Goal modal's
  own orchestration file, so it can be unit-tested (add/remove/focus/announce) independently of a
  full modal fixture.

## Consequences

Future dynamic-list UI in this app (e.g. sub-tasks, repeatable reminders) can reuse this same
shape — a never-reused per-instance counter for row identity/labeling, a deterministic
add/remove focus-target algorithm, and a combined focus-move-plus-`aria-live` announcement — as a
starting point, and can rely on `focus-trap.ts` continuing to need no changes for dynamically
mutated content. The tradeoff accepted here: milestone row labels do not track visual position
after a removal (e.g. after removing "Milestone 2" from a three-row list, the remaining rows read
"Milestone 1" and "Milestone 3", not "Milestone 1"/"Milestone 2") — a reviewer or future feature
extending this pattern should treat that as an intentional, requirements-compliant choice, not an
oversight, unless a future requirement explicitly demands position-tracking labels, in which case
this ADR would be superseded rather than silently reinterpreted.
