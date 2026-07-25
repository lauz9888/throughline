---
name: ship-feature
description: Runs the full throughline change pipeline end-to-end — requirements, solution design/review, branch, test-first unit/BDD/e2e, implementation, bug-fix loops, QA + coverage gate, manual test gate, merge, CI/CD, docs, and a post-change report. Invoke with the change request as the argument, e.g. `/ship-feature add a dark mode toggle to settings`.
---

You are driving a multi-step, largely-autonomous development pipeline for the throughline repo. You run in the main conversation and orchestrate specialized subagents via the `Agent` tool — you do all git/gh/file work and all direct user interaction yourself; subagents never talk to the user, they read/write files and return a `STATUS:` line you act on.

Read this whole file before acting. Follow the steps in order — they mirror the user's 21-step pipeline spec 1:1, so don't skip or reorder one even if it looks safe to shortcut.

## Pre-authorization (read this before Step 4)

The user has explicitly pre-authorized this workflow to create branches, merge to `main`, delete branches, and create GitHub issues **without pausing for per-action confirmation**, scoped exactly to what this file describes. Do not re-ask for confirmation at Steps 4, 14, or 21, or before filing a bug issue. This authorization does **not** extend to anything not described here — never force-push, never touch a branch this workflow didn't create, never change repo/branch-protection settings, never send messages outside GitHub issues/PRs this pipeline creates. If anything outside this file's scope comes up mid-run, stop and ask.

## Conventions

**Artifacts & state.** Everything for one run lives in `.workflow/<slug>/` (gitignored — local scratch, not part of the PR):
- `requirements.md`, `design.md` — the documents subagents read and write.
- `state.md` — plain markdown, updated immediately after every step completes: current step number, branch name, tracking issue number, per-layer test file lists (recorded at Steps 5/6/7), and open/closed bug issue numbers. This is what makes a run resumable.
- `meta.json` — `{"slug": ..., "started_at": ISO timestamp}`, written at Step 2 kickoff; feeds the Step 20 duration metric.

**Resuming.** If invoked with no clear new change request, look for `.workflow/*/state.md`. Exactly one incomplete → tell the user you're resuming it, pick up at its recorded step. More than one → `AskUserQuestion`. None → treat input as a new request.

**Slug.** Derive a short kebab-case slug from the request (e.g. "add a dark mode toggle" → `dark-mode-toggle`). Use it for the artifact directory and branch name `feature/<slug>`.

**Subagents never talk to the user.** Each agent's own file documents its exact `STATUS:` contract. You are the only thing that calls `AskUserQuestion` or otherwise addresses the user mid-pipeline.

**Continuing a subagent vs. spawning fresh.** When a step says "resume agent X with feedback Y", use `SendMessage` (load its schema via `ToolSearch` if not already loaded) addressed to the agent instance you spawned earlier in this run, so it keeps context. Only spawn a fresh `Agent` call the first time a role is needed in this run.

**Bug tracking.** File discrepancies/failures as GitHub issues: `gh issue create --label <label> --title "<slug>: <short summary>" --body "<detail>\n\nRelated to #<tracking-issue>"`. Create labels once if missing (`gh label list`, then `gh label create <name> --color <hex>` for any absent): `requirement`, `design`, `unit-test`, `bdd-test`, `e2e-test`, `qa`, `manual-test`, `ci`, `accessibility`. Close with `gh issue close <n> --comment "<what fixed it>"` once the matching check is green again.

**Accessibility.** This isn't a separate pipeline stage — it's a lens every stage applies to UI-facing work, per each agent's own instructions: requirements-analyst always writes testable WCAG 2.1 AA requirements for new/changed UI (not gated on the user asking); solution-designer/-reviewer treat an accessibility design gap the same as a functional coverage gap; the test-author agents wire automated `jest-axe` (unit)/`@axe-core/playwright` (e2e) WCAG scans alongside behavioral tests; the implementer treats the design's accessibility decisions as part of the implementation, not optional polish; qa-reviewer reviews it explicitly and can hand back `STATUS: accessibility-gap` (handled at Step 12 like a coverage gap). Tag any accessibility-specific bug issue with the `accessibility` label in addition to its stage label.

**Retry caps.** Every loop below (design review, per-layer red/green cycles, QA cycle, manual-test cycle, CI cycle) is capped at 5 iterations. If you hit the cap, stop, summarize what's failing, and ask the user how to proceed (`AskUserQuestion`: keep trying / take over manually / abandon) rather than looping forever.

**Commits.** After every step that changes files, `git add` only the files that step touched and commit `<slug>: <step description>`. Never commit `.workflow/`. Never use `--no-verify` or force operations.

**npm script contract.** CI/CD and every test-running step assume these scripts exist in `package.json`: `build`, `typecheck`, `lint`, `dev`, `test:unit`, `test:bdd`, `test:e2e`, `test:coverage:merge` (outputs one combined coverage % across all three layers). If the project doesn't have these yet (e.g. this is the very first feature and there's no scaffolding), the Step 3 solution design and Step 8 implementation must include creating them — don't silently skip a test layer because the script is missing.

---

## Step 1 — Intake

The user's request that invoked `/ship-feature` *is* Step 1. Nothing to do here except read it carefully before Step 2.

## Step 2 — Requirements (human gate #1)

1. New run: derive the slug, `mkdir .workflow/<slug>`, write `meta.json` with `started_at`, initialize `state.md` at step `2-requirements`.
2. Spawn `Agent(subagent_type="requirements-analyst")` with the raw request and the path to `.workflow/<slug>/requirements.md`.
3. While it reports `STATUS: needs-input`: relay its questions to the user (`AskUserQuestion` if they're multiple-choice-shaped, otherwise plain conversation), then `SendMessage` the answers back to the same agent as an `ANSWERS:` section. Repeat.
4. When it reports `STATUS: ready`: show the user its summary and the full `requirements.md`, and explicitly ask for approval (`AskUserQuestion`: approve / request changes). If they request changes, `SendMessage` the feedback to the same agent and re-check. Cycle until approved.
5. On approval: append `Approved by user on <date>` to `requirements.md`. Create the tracking issue: `gh issue create --title "<slug>" --body "$(cat .workflow/<slug>/requirements.md)"`. Record its number in `state.md`.

## Step 3 — Solution design + review loop

1. Spawn `Agent(subagent_type="solution-designer")` with `requirements.md` and the path to `design.md` (to be created).
2. Spawn `Agent(subagent_type="solution-reviewer")` with both document paths and the repo root.
3. If `STATUS: approved`, move on.
4. If `STATUS: changes-requested` (with a feedback list): `gh issue create --label design ...` for each discrepancy, `SendMessage` the full feedback to the Step 3.1 solution-designer agent to amend `design.md`, then re-spawn a fresh `solution-reviewer` against the updated design (it's stateless per review). Close resolved issues (`gh issue close ... --comment "Resolved in updated design"`). Repeat, capped at 5 cycles.
5. Record `state.md` at step `3-design-approved`.

## Step 4 — Branch

`git checkout main && git pull && git checkout -b feature/<slug>`. Record the branch name in `state.md`. (Skip creating a branch only if Step 3's design concludes no code change is needed at all — rare; ask the user if genuinely unsure.)

## Step 5 — Unit tests (red)

Spawn `Agent(subagent_type="unit-test-author")` with `design.md`. It reviews existing unit tests, adds/changes/removes what's needed for this change, and runs exactly the changed/added tests to confirm they fail (existing unrelated tests are untouched and must stay green). On `STATUS: red-confirmed`, record the exact file list in `state.md` under `unit-test-files`. Commit `<slug>: add/update unit tests (red)`.

## Step 6 — BDD tests (red)

Spawn `Agent(subagent_type="bdd-test-author")` with `design.md`. Same pattern as Step 5 for Cucumber features/steps (`test:bdd` scoped to the changed feature files). On `STATUS: red-confirmed`, record `bdd-test-files` in `state.md`. Commit `<slug>: add/update BDD tests (red)`.

## Step 7 — E2E tests (red)

Spawn `Agent(subagent_type="e2e-test-author")` with `design.md`. Same pattern for Playwright specs. On `STATUS: red-confirmed`, record `e2e-test-files` in `state.md`. Commit `<slug>: add/update e2e tests (red)`.

## Step 8 — Implementation

Spawn `Agent(subagent_type="implementer")` with `design.md` and the three test-file lists from `state.md`. It implements the solution until those specific files pass (it may run them repeatedly, but this is still scoped — not the full suite yet). On `STATUS: green`, commit `<slug>: implement solution`. On `STATUS: blocked`, surface the reason to the user and ask how to proceed.

## Step 9 — Unit test suite (full) + bug loop

Run the **full** unit suite yourself: `npm run test:unit`. On failure: `gh issue create --label unit-test --title "<slug>: unit test failure" --body "<failure output>\n\nRelated to #<tracking-issue>"`, spawn/`SendMessage` `Agent(subagent_type="bug-fixer")` with the failure output and `test:unit`, re-run the full suite when it reports `STATUS: fixed`, close the issue once green. Repeat until the full suite passes, capped at 5 cycles. Commit after each fix.

## Step 10 — BDD test suite (full) + bug loop

Same pattern as Step 9, running `npm run test:bdd`, label `bdd-test`.

## Step 11 — E2E test suite (full) + bug loop

Same pattern as Step 9, running `npm run test:e2e`, label `e2e-test`.

## Step 12 — QA review + coverage gate

1. Spawn `Agent(subagent_type="qa-reviewer")` with the full diff (`git diff main...HEAD`), `design.md`, and `requirements.md`. It reviews best practice/readability/efficiency/maintainability/testability/accessibility, sanity-checks against requirements, computes combined coverage (`npm run test:coverage:merge`), and makes any code-quality/small-a11y fixes directly.
2. On `STATUS: accessibility-gap` (a UI surface is missing an automated WCAG scan, or has a violation the reviewer couldn't fix directly): `gh issue create --label accessibility --label qa ...` for each finding, route back to the matching Step 5/6/7 test-author agent(s) (unit-test-author/e2e-test-author for the missing scan; solution-designer first if the finding implies a design gap, not just a missing test) to add coverage or request a design fix, then re-run Steps 9–11 for the affected layer(s), close the issue(s), then re-spawn `qa-reviewer` fresh.
3. On `STATUS: coverage-gap` (combined coverage < 90%, listing which layer(s) need more cases): route back to the matching Step 5/6/7 author agent(s) to add coverage, then re-run Steps 9–11 for the affected layer(s), then re-spawn `qa-reviewer` fresh.
4. On `STATUS: changes-made`: re-run the full Step 9–11 suites (safety net). Any failure follows the normal bug-fixer loop from those steps.
5. On `STATUS: approved` (no changes needed, coverage ≥ 90%): move on.
6. Cap the whole Step 12 cycle at 5 iterations.

## Step 13 — Manual test gate (human gate #2)

1. Start the app locally (`npm run dev`) and give the user the local URL.
2. Ask (`AskUserQuestion` or plain question) whether manual testing passed, or isn't needed.
3. If the user reports a bug: `gh issue create --label manual-test --title "..." --body "<what the user reported>\n\nRelated to #<tracking-issue>"`, spawn/`SendMessage` `Agent(subagent_type="bug-fixer")` with the report, re-run the full Steps 9–11 suites as a safety net once it reports `STATUS: fixed`, close the issue, ask the user to re-test. Loop until confirmed pass (or explicitly not required).

## Step 14 — Merge to main

On confirmation from Step 13: push the branch (`git push -u origin feature/<slug>`), open a PR (`gh pr create --title "<slug>" --body "Closes #<tracking-issue>" --base main --head feature/<slug>`), record the PR number in `state.md`. This push is what triggers CI (Step 15).

## Steps 15–16 — CI / CD

These run in GitHub Actions (`.github/workflows/ci.yml` on push/PR, `.github/workflows/cd.yml` on merge to main) — nothing to do here except watch them:
`gh pr checks <pr-number> --watch`.

## Step 17 — CI bug-fix loop

On any CI job failure: `gh issue create --label ci --title "<slug>: CI failure — <job name>" --body "<job output>\n\nRelated to #<tracking-issue>"`, spawn/`SendMessage` `Agent(subagent_type="bug-fixer")` with the job output and which local command reproduces it (map job→command: lint→`npm run lint`, typecheck→`npm run typecheck`, build→`npm run build`, unit→`npm run test:unit`, bdd→`npm run test:bdd`), push the fix, re-watch CI, close the issue once green. Cap at 5 cycles.

Once all CI jobs are green: `gh pr merge <pr-number> --squash --delete-branch`. This performs the merge (triggering CD) and deletes the remote branch — and if the current checkout is on `feature/<slug>`, `gh` also switches it back to `main` and deletes the local branch as part of the same command. So by Step 21, local cleanup is very often already done; treat it as the expected common case, not an edge case.

## Step 18 — CD failure logging (no auto-fix)

Watch the CD run: `gh run watch $(gh run list --workflow=cd.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')`. Any failing job: `gh issue create --label ci --title "<slug>: CD failure — <job name>" --body "<job output>\n\nRelated to #<tracking-issue>"`. Per spec, do **not** auto-fix these — just log and tell the user. Wait for CD to finish (pass or fail) before Step 19.

## Step 19 — Documentation update

Spawn `Agent(subagent_type="docs-updater")` with the full diff of what merged (`git diff <previous-main-sha>..<merge-sha>`) and `requirements.md`/`design.md`. On `STATUS: updated`, commit directly to `main` (docs-only, no branch/PR needed): `git checkout main && git pull`, apply, `git add README.md <other files> && git commit -m "<slug>: update docs" && git push`.

## Step 20 — Post-change report

Spawn `Agent(subagent_type="report-generator")` with the full `.workflow/<slug>/` directory and `gh issue list --label <tracking-issue-derived-search> --state all` (or search by "Related to #<tracking-issue>" in issue bodies) for the bug list. It writes `reports/<YYYY-MM-DD>-<slug>.md` with requirements, solution, test changes, all bugs raised + final status, and total time (`meta.json.started_at` to now — note this includes human wait time, not just active engineering time). Commit and push this directly to `main` alongside Step 19, or as its own small commit.

## Step 21 — Cleanup

The remote branch was already deleted by Step 17's `gh pr merge --delete-branch`, and — per that step's note — the local branch is very often already gone too (`gh` deletes it and switches you back to `main` automatically if it was checked out during the merge). Check before acting rather than assuming either outcome:

1. `git branch --list feature/<slug>`. If it's empty, the local branch is already cleaned up — just confirm you're on `main` (`git checkout main` is a safe no-op if already there) and skip straight to step 3.
2. If it still exists (e.g. the merge ran from a different checkout/worktree than the one driving this pipeline), delete it: `git checkout main && git branch -d feature/<slug>`.
3. Mark `state.md` complete. `main` should now be the only branch.

Report a short summary to the user: what shipped, the PR/commit, the tracking issue, total bugs raised/resolved, and the report file path.
