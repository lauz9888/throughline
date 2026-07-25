# Post-change report: Repo & Workflow Standards Review

- Tracking issue: #25
- Pull request: #29 (squash-merged to `main` as commit `b1678a2a`)
- Branch: `claude/code-workflow-standards-review-ltl21t`
- Docs-update follow-up commit: `694fcf3` (fixed a stale `ci.yml` comment)

## Requirements

Full request: "Do a full review of the current code and workflow... against industry standards and
best practice for requirements, design, development, testing and all aspects of usability. Make
any necessary amendments... to ensure this repo meets those standards and that all future changes
will also meet them."

The audit covered five dimensions (requirements, design, development, testing, usability —
split into application UX and pipeline/developer usability) and found requirements and design
practice already largely solid. 16 items were selected for this run, approved by the user on
2026-07-25:

**(a) Repo tooling / CI / config (10 items)** — `engines`/`license` fields in `package.json`;
`.github/dependabot.yml` (weekly npm + github-actions checks, manual-review PRs, no auto-merge);
a blocking `ci.yml` job running `npm audit --omit=dev --audit-level=high`; a blocking `ci.yml`
job running the full `test:e2e` suite locally (no live deployment); a blocking `ci.yml` job
enforcing the 90% combined-coverage threshold via `test:coverage:merge`; Prettier adopted with an
explicit `.prettierrc` (2-space, single-quote, semicolons, 100-width) plus a full one-time
codebase reformat and a CI `format:check` job; `tsconfig.json` gains
`noUncheckedIndexedAccess: true`; a root `LICENSE` (MIT, Laura Hughes, 2026); `SECURITY.md`
(GitHub-issue-based reporting, no published email).

**(b) Application code / tests** — none required beyond whatever `noUncheckedIndexedAccess`
surfaced (see Implementation summary).

**(c) Ship-feature pipeline-definition changes (6 items)** — a new canonical
`.claude/STANDARDS.md` (WCAG conformance scope, 90% coverage threshold, pinned Node version,
security-hygiene checklist); six agent files (`requirements-analyst`, `solution-designer`,
`solution-reviewer`, `unit-test-author`, `e2e-test-author`, `qa-reviewer`) updated to reference it
instead of repeating literals; `qa-reviewer.md` gains an explicit security-hygiene check step and
a new `STATUS: security-gap` outcome; `SKILL.md` updated so Step 12's description notes CI now
also enforces the audit/e2e/coverage gates as defense-in-depth, and Step 17's job→command mapping
table covers the new CI jobs; `README.md`'s workflow section and script-contract table updated to
match; a lightweight `docs/adr/` Architecture Decision Record convention added (one file per
architecturally significant decision), wired into `solution-designer.md`/`solution-reviewer.md`,
with `docs/adr/0001-adopt-prettier-for-formatting.md` as the first record.

**Explicitly out of scope / follow-up** (found during the audit, deliberately deferred): pre-commit
hooks (husky + lint-staged) — CI already gates every PR; a performance budget / Lighthouse CI check
for the PWA; visual regression testing; type-aware/stricter ESLint rule sets beyond Prettier and
`noUncheckedIndexedAccess`; `CODEOWNERS`/`CONTRIBUTING.md` (low value for a single-maintainer repo);
any change to the pipeline's retry-cap philosophy or pre-authorization scope; rewriting the
coverage-merge internals or test frameworks; Dependabot auto-merge automation.

No accessibility requirements were raised this run — see "Accessibility" below for why.

## Solution design

Because 15 of the 16 requirements touch only config/CI/docs/pipeline-definition files with no
runtime behavior, the design was almost entirely additive: new files (`.prettierrc`,
`.prettierignore`, `LICENSE`, `SECURITY.md`, `.github/dependabot.yml`, `.claude/STANDARDS.md`,
`docs/adr/README.md`, `docs/adr/0001-adopt-prettier-for-formatting.md`) plus targeted edits to
`package.json`, `eslint.config.js`, `ci.yml`, `tsconfig.json`, `README.md`, six agent files, and
`SKILL.md`. Only requirement 8 (`noUncheckedIndexedAccess`) could touch `src/`/`features/`/`tests/`,
and a preliminary sweep (documented in the design's "Migration mechanics") found exactly one
affected file, and it's test code, not production `src/` behavior.

**Design-review loop (Step 3 of the pipeline):** the design went through two review cycles.
The first `solution-reviewer` pass returned `STATUS: changes-requested` with three discrepancies,
each tracked as a GitHub issue (#26, #27, #28 — see "Bugs raised" below) per the pipeline's Step 3
convention (`gh issue create --label design`). `solution-designer` amended `design.md` to address
all three, and a fresh (stateless) `solution-reviewer` pass on the updated design returned
`STATUS: approved`, closing all three issues with "Resolved in updated design." This report cannot
reproduce the verbatim before/after text of what changed between the two cycles — GitHub API/App
access is not enabled in this reporting session, so the three issues' bodies and close comments
could not be independently re-read, and `.workflow/<slug>/` (where the intermediate draft would
have lived) is gitignored and holds only the final, approved `design.md`. What is confirmed: all
three review comments were raised and resolved entirely within Step 3, before Step 4 (branch
creation) or any implementation work began — zero design-review findings survived into
implementation.

Notable design decisions, per the requirement-coverage map:

- Prettier's config is **explicit**, not zero-config defaults — real Prettier defaults
  (`printWidth: 80`, double quotes) differ from what the existing codebase already follows by
  hand (100-width, single-quote), so `.prettierrc` pins those values deliberately.
- `eslint-config-prettier` is added as the **last** entry in the ESLint flat config so it disables
  any stylistic rule that could otherwise fight with Prettier's output.
- The `noUncheckedIndexedAccess` migration is scoped to a 5-site, non-null-assertion fix in
  `src/add-item-menu.test.ts` only, after manually reviewing every indexed-access site across the
  three trees `tsconfig.json` type-checks — zero production `src/` code affected, zero runtime
  behavior change.
- `.claude/STANDARDS.md` is introduced as the single source of truth for the WCAG tag scope, the
  90% coverage threshold, the pinned Node version, and the security-hygiene checklist, replacing
  duplicated literals previously spread across four-plus agent files.
- The new CI jobs (audit, blocking local `test:e2e`, blocking `test:coverage:merge`, `format`)
  are all added to `ci.yml` (pre-merge); `cd.yml`'s existing post-deploy `e2e-live` smoke job is
  kept as-is, unmodified, as an additional confirmation layer rather than a replacement.

## Test changes

**None** — no new or modified unit, BDD, or e2e test files. Per the design's per-item "Test
impact" table, every one of the 16 requirements is either a config/CI/doc/pipeline-definition file
with no test surface (verified by the CI job itself succeeding, or by manual review that the prose
is accurate — not by a Vitest/Cucumber/Playwright test), or, for the one item that could touch
code (`noUncheckedIndexedAccess`), a type-only fix with zero behavior change, verified by
`npm run typecheck` and the _existing_ `src/add-item-menu.test.ts` suite passing unchanged rather
than a new test.

This "no new tests needed" conclusion was independently confirmed by all three test-author agents
during Step 3, per `state.md`:

- **unit-test-author**: no new unit-testable behavior; item 8 is `tsc`-only and invisible to Vitest.
- **bdd-test-author**: no new user-observable behavior.
- **e2e-test-author**: no new or altered UI surface or user flow.

The regression check for the Prettier reformat (item 7) was instead the **existing** full
unit/BDD/e2e suites: run unchanged, after `npm run format` was applied across the repo, with the
requirement that every test pass with zero content changes beyond their own formatting. No test
file in this run includes a new automated WCAG scan (`jest-axe`/`@axe-core/playwright`) — the
existing scans in `src/app.test.ts`, `tests/e2e/home.spec.ts`, and
`tests/e2e/add-item-button.spec.ts` were exercised as regression gates (see Accessibility below),
not modified.

## Accessibility

`requirements.md`'s "Accessibility requirements" section is explicitly empty this run: no
requirement introduces or changes a UI surface, so there is no UI-facing requirement to map
line-by-line. The design confirms it touches none of `src/app.ts`, `src/add-item-menu.ts`, or
`src/style.css` (the files owning the shipped UI's accessibility behavior) beyond the single
type-only `!` fix in `src/add-item-menu.test.ts`, which changes zero runtime behavior. The
existing WCAG 2.1 AA conformance (real button semantics, `aria-haspopup`/`aria-expanded`/
`aria-controls`/`aria-label`, `role="menu"`/`role="menuitem"`, roving focus, `:focus-visible`,
44×44px touch target) was confirmed as a regression gate: the `jest-axe` scan in `src/app.test.ts`
and the `@axe-core/playwright` scans in `tests/e2e/home.spec.ts`/`tests/e2e/add-item-button.spec.ts`
were required to (and did) pass unchanged after the Prettier reformat and the `noUncheckedIndexedAccess`
type fix.

One indirect strengthening: items 11–12 (the new `.claude/STANDARDS.md` and the six agent files
that now reference it) make the _mechanism_ enforcing WCAG 2.1 AA on all future UI work more
maintainable — the WCAG tag scope was previously a literal duplicated across four files; a future
change to the required conformance level now only requires editing one file.

None of the three bugs raised this run (#26–28) carry the `accessibility` label — all three carry
`design` only (see below).

## Implementation summary

31 files changed (474 insertions, 111 deletions), squash-merged as `b1678a2a`, spanning three
categories:

- **Repo tooling / CI additions**: `.claude/STANDARDS.md` (new), `.github/dependabot.yml` (new),
  `.github/workflows/ci.yml` (+70 lines — new `format`, `audit`, `e2e-tests`, `coverage-merge`
  jobs), `.prettierrc`/`.prettierignore` (new), `LICENSE`/`SECURITY.md` (new), `package.json`
  (+8 lines — `engines`, `license`, `format`/`format:check` scripts, `prettier` +
  `eslint-config-prettier` devDependencies), `package-lock.json`, `eslint.config.js`,
  `tsconfig.json` (`noUncheckedIndexedAccess`).
- **Full Prettier reformat**: touched every existing test/step-definition/e2e-spec file for
  whitespace, quote-style, and line-wrap changes only — `features/step_definitions/*.steps.ts`,
  `src/add-item-menu.test.ts`, `src/app.test.ts`, `tests/e2e/*.ts`, `reports/*.md` — no logic
  changes, per the design's mechanical-verification argument (formatting can't alter JS/TS
  behavior; confirmed by the existing suites passing unchanged).
- **tsconfig strictness fix**: 5 non-null-assertion sites in `src/add-item-menu.test.ts`
  (`noUncheckedIndexedAccess` fallout).
- **Ship-feature pipeline-definition updates**: `.claude/agents/{requirements-analyst,
solution-designer,solution-reviewer,unit-test-author,e2e-test-author,qa-reviewer,
docs-updater}.md` and `.claude/skills/ship-feature/SKILL.md` — canonical-standards references,
  `qa-reviewer`'s new security-hygiene step and `STATUS: security-gap` routing, Step 12/17 updates.
- **Docs**: `docs/adr/README.md` and `docs/adr/0001-adopt-prettier-for-formatting.md` (new),
  `README.md` (workflow section and npm-script-contract table).

A separate, small follow-up commit (`694fcf3`, Step 19) fixed a stale comment in `ci.yml` found
during the docs-accuracy pass; README/wiki content itself was already accurate and needed no
change.

## QA outcome

**Approved**, with one self-fix during Step 12: a readability issue in `SKILL.md`'s new
`STATUS: security-gap` routing branch (a shell command was broken mid-string across lines with
inconsistent indentation, and the "re-run Step 9–11" instruction read as scoped to only one of its
two sub-bullets instead of both). `qa-reviewer` corrected this directly rather than escalating it,
consistent with its mandate to fix small, unambiguous issues itself; it was not filed as a tracked
GitHub issue. Combined coverage (`test:coverage:merge` across the unit/BDD/e2e layers) was
**99.61%**, comfortably above the 90% threshold `.claude/STANDARDS.md`/`qa-reviewer.md` now enforce
— expected, since this run added no new application code paths and the existing test suites were
required to pass unchanged.

## Bugs raised

All bug/issue activity this run occurred in a single stage — **design review (Step 3)** — with
zero bugs raised at any later stage:

| #   | Stage/label | Title area                                    | Status                                |
| --- | ----------- | --------------------------------------------- | ------------------------------------- |
| #26 | `design`    | Design-review discrepancy 1 (Step 3, cycle 1) | Closed — "Resolved in updated design" |
| #27 | `design`    | Design-review discrepancy 2 (Step 3, cycle 1) | Closed — "Resolved in updated design" |
| #28 | `design`    | Design-review discrepancy 3 (Step 3, cycle 1) | Closed — "Resolved in updated design" |

All three were filed against tracking issue #25 (body text "Related to #25"), opened by the first
`solution-reviewer` pass (`STATUS: changes-requested`) and closed once the second, fresh
`solution-reviewer` pass approved the amended `design.md` — entirely within Step 3, before any
branch was created or code written. This report cannot restate their verbatim body/close-comment
text: GitHub API/App access is not enabled in this reporting session (confirmed via direct API
calls, which returned "GitHub access is not enabled for this session"), so the issues could not be
independently re-read, and the interim design draft they referred to is not retained anywhere
(`.workflow/<slug>/` is gitignored and holds only the final, approved version). The pipeline's own
Step 3 convention closes each such issue with the fixed comment "Resolved in updated design,"
which is what `state.md`/`SKILL.md`'s documented process confirms happened here.

No bugs were raised during implementation (Step 8), unit/BDD/e2e test runs (Steps 9–11), the QA
review (Step 12, beyond the one self-fix noted above, which was never escalated to a tracked
issue), the manual test gate (Step 13), or CI/CD (Steps 14–18) — every full-suite run, QA pass,
and CI/CD run passed cleanly on the first attempt.

## Time taken

- Started: 2026-07-25 09:07:29 UTC (`meta.json`)
- Completed: 2026-07-25 10:23 UTC (this report)
- **Total elapsed: approximately 1 hour 16 minutes.**

This figure spans the full pipeline run end-to-end, including both human-in-the-loop gates —
Step 2's requirements approval and Step 13's manual test gate — plus any CI wait time. It is
**not** a measure of active engineering effort alone; the actual agent/implementation time within
that window is shorter than the total, since it includes however long the human took to review and
approve requirements, manually test the change, and wait on CI/CD to run.
