# Architecture Decision Records

This directory holds one markdown file per architecturally significant decision made for
throughline: adopting a new dependency, a new framework/pattern, a state-management approach, or
similar. Unlike `.workflow/<slug>/design.md` (gitignored, per-run scratch), files here are
committed and durable — the record of _why_ survives after the `.workflow/` run that produced it
is gone.

## When to add one

During Step 3 of the `ship-feature` pipeline, if a design introduces one of the above kinds of
decision, `solution-designer.md` adds an ADR file here as part of that same design's file
changes; `solution-reviewer.md` checks that it did. Not every change needs one — routine feature
work, bug fixes, and config tweaks that don't introduce a new dependency/pattern don't qualify.
When in doubt, prefer adding one; a short, low-value ADR costs little, a missing one costs the
"why" permanently.

## Format

One file per decision: `docs/adr/NNNN-short-slug.md`, numbered sequentially starting at `0001`
(check the highest existing number in this directory, don't reuse or guess). Each file:

```markdown
# NNNN. <short title>

Status: Accepted
Date: <YYYY-MM-DD>

## Context

What problem/question prompted this decision. What alternatives were considered, briefly.

## Decision

What was decided.

## Consequences

What this makes easier or harder going forward; any follow-up it implies.
```

Statuses in use: `Accepted` (the default — nothing here proposes anything speculative),
`Superseded by NNNN` (link to the replacing ADR if a later decision reverses this one; don't
delete or edit the original).
