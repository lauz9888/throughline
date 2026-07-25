# 0002. Use localStorage, keyed JSON array, for Aspiration persistence

Status: Accepted
Date: 2026-07-25

## Context

This is the first feature in throughline that persists any user data — there was no data model,
persistence layer, or state-management approach anywhere in the codebase before this change.
Requirements confirm `localStorage` as the mechanism (no backend/account/sync exists or is
planned) and that correctness is verified only via storage inspection, not an in-app view.
Alternatives considered: IndexedDB (unnecessary complexity/async API for a handful of small
records), a wrapper/abstraction library (adds a dependency for a single call site).

## Decision

`src/aspiration-storage.ts` reads/writes a single `localStorage` key
(`throughline:aspirations`) holding a JSON-serialized array of `Aspiration` records
(`{ id, title, description, reason, createdAt }`). Each `saveAspiration()` call reads the full
array, appends one record with a fresh id, and writes the whole array back — no partial-update or
indexing scheme. No wrapper/ORM-style abstraction is introduced; the module exposes only
`saveAspiration()` and the storage-key constant.

## Consequences

Any future feature that also needs client-side persistence (e.g. Goal/Habit creation) can follow
the same one-key-per-entity-type, JSON-array pattern, or introduce a shared read/write helper at
that point if duplication across multiple such modules becomes real (not before). This does not
scale gracefully to large record counts (whole-array read/write on every save) — acceptable for a
single-user, single-device, presumably-small list; would need revisiting if that assumption
changes.
