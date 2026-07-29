# 0005. Milestone identity preservation across an edit

Status: Accepted
Date: 2026-07-29

## Context

`goal-tiles` introduces the first _edit_ (as opposed to create-only) flow for a nested,
repeatable field group (milestones). Unlike Title/Description/Reason — plain scalar fields where
"update in place" is unambiguous — a milestone list raises a question scalar fields don't: when a
row survives an edit unchanged-or-edited, should its underlying stored record be _the same
record_ (same `id`) with an updated title, or should the whole milestone list be deleted and
rebuilt fresh from the saved rows on every save?

Two options were considered:

1. **Rebuild wholesale**: on every save, discard the goal's existing `milestones` array entirely
   and regenerate fresh `{ id, title }` records from whatever rows are currently in the DOM.
   Simplest to implement (mirrors `saveGoal`'s existing `milestoneTitles: string[]` shape
   exactly), but discards milestone identity on every single edit, even one that only touches the
   Title field and touches no milestone row at all.
2. **Preserve by row**: each row created from a pre-populated (i.e. previously-stored) milestone
   remembers that milestone's original `id` (via a `data-milestone-id` attribute); a row added
   during the current edit session has no such id. On save, rows with a remembered id keep it
   (title updated in place); rows without one get a freshly generated id, exactly as a new
   milestone created via Create Goal would.

## Decision

Option 2. `src/milestone-rows.ts`'s `buildMilestoneRows` accepts an `initialMilestones` option
that seeds each pre-populated row with its original `id` as a data attribute, and exposes
`getMilestonesForSave(): Array<{ id?: string; title: string }>`. `src/goal-storage.ts`'s new
`updateGoal` accepts that same shape and only generates a fresh id where none was supplied,
otherwise reusing the caller-supplied id. Nothing in the app currently depends on milestone-id
stability across an edit (no cross-references, no completion-state keyed by id), so this is a
low-risk default that keeps the storage layer symmetric with `updateAspiration`'s existing
"preserve id/createdAt, update the rest" pattern rather than a special case for goals.

## Consequences

A goal's milestone list, once saved, keeps each surviving milestone's `id` stable across any
number of subsequent title-only edits — useful groundwork if a future feature ever needs to
reference an individual milestone by id (e.g. per-milestone completion state, deep-linking to a
specific milestone) without that feature having to first solve "how do we even know which stored
milestone this row used to be." The tradeoff: `edit-goal-modal.ts` and `milestone-rows.ts` carry
slightly more bookkeeping (a per-row dataset attribute, a second accessor alongside
`getNonBlankTitles`) than the simpler "rebuild wholesale" option would have. A future feature
introducing milestone reordering would need to re-examine whether this id-preservation contract
still holds once row _position_ is no longer create-session-append-only.
