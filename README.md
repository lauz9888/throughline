# throughline

A Vite-built Progressive Web App, deployed to GitHub Pages: https://lauz9888.github.io/throughline/

Currently a scaffold: a top bar with the "throughline" wordmark (self-hosted Playfair Display) on the left and a gold/white/near-black "add item" button on the right — the button opens a dropdown of item types to create (Aspiration, Goal, Task, Habit). Selecting "Aspiration" opens a "Create Aspiration" modal: a Title field (mandatory) and Description and Reason fields (both optional). The modal can be dismissed via its close (X) control, `Escape`, or a backdrop click, each prompting an unsaved-changes confirmation if any field has content; Save persists the aspiration to `localStorage`.

Below the top bar, a tile grid shows one square, light-purple tile per stored aspiration (alphabetical by title, case-insensitive, ties broken by creation time), each labelled with its title; with no stored aspirations it shows an empty-state message instead. Selecting a tile (click or keyboard) opens an "Edit Aspiration" modal — the same fields/behavior as Create, pre-populated with that aspiration's data — plus a Delete button that opens its own confirm-are-you-sure sub-dialog before removing the record. Edit's Save button starts disabled and only enables once a field is changed from what was loaded. Saving or deleting closes the modal and refreshes the grid immediately, without a page reload; the same is true of creating a new aspiration via Create. The scaffold also includes a hand-authored SVG favicon/app icon and PWA support (`manifest.webmanifest`, `sw.js`) via `vite-plugin-pwa`.

Selecting "Goal" opens a "Create Goal" modal — the same dialog chrome, Title (mandatory)/Description (optional)/Reason (optional) fields, close/`Escape`/backdrop-click behavior, and unsaved-changes confirmation as Create Aspiration, but themed green (`#e0f2e4` background, `#1e7a42` Save button/info icons) instead of purple, to visually distinguish it. Below Reason, a "Milestones" section lets the user add an unlimited number of milestone rows via an "Add milestone" button, each with its own mandatory-in-spirit-but-not-in-validation title input and its own "Remove milestone N" control (a milestone row left blank at Save time is simply omitted, not treated as an error); row order is preserved as rows are added/removed, and adding/removing a row moves focus deterministically (to the new row's input, or to a sensible remaining control) with an `aria-live` announcement, so the dynamic list stays usable and perceivable via keyboard/screen reader. Save persists the Goal — trimmed Title/Description/Reason plus the non-blank milestone titles — to its own `localStorage` key (`throughline:goals`, separate from `throughline:aspirations`). As with Aspiration before `aspiration-tiles` shipped, there's no in-app list/grid of saved goals yet, and no edit/delete for goals — the only way to confirm a save took effect is to inspect `localStorage` directly. Selecting Task or Habit still does nothing.

## Development

```
npm run dev
```

Build and preview a production build locally:

```
npm run build
npm run preview
```

Tests:

```
npm run test:unit             # Vitest
npm run test:bdd              # Cucumber.js
npm run test:e2e              # Playwright (reads BASE_URL to run against a live deployment)
npm run test:coverage:merge   # combined coverage across all three suites
```

### Accessibility

Automated WCAG 2.1 A/AA scans run alongside the functional tests, scoped via each tool's tag filter so only real success criteria are checked (not axe-core's broader best-practice rules):

- **Unit (`test:unit`)**: `jest-axe`, wired up in `vitest.setup.ts`. See `src/app.test.ts` for the pattern — color-contrast is disabled at this layer since jsdom has no real rendering engine to evaluate it against. `src/aspiration-modal.test.ts` extends this to several dialog states (freshly opened, the unsaved-changes confirmation open on top of the modal); `src/aspiration-grid.test.ts` and `src/edit-aspiration-modal.test.ts` do the same for the tile grid (populated and empty-state) and the Edit Aspiration modal (open, unsaved-changes confirm, delete confirm). `src/goal-modal.test.ts` does the same for the Create Goal modal, including states specific to its dynamic Milestones section (rows added, a tooltip open alongside them) that have no Aspiration-modal equivalent.
- **E2e (`test:e2e`)**: `@axe-core/playwright`, covering color-contrast and any other checks that need a real browser. See `tests/e2e/home.spec.ts`, `tests/e2e/add-item-button.spec.ts`, `tests/e2e/aspiration-modal.spec.ts`, `tests/e2e/aspiration-tiles.spec.ts`, and `tests/e2e/goal-modal.spec.ts` — these also cover real-browser-only behavior jsdom can't verify, like background focus containment via `inert`, native radio-group keyboard navigation, a long-titled tile staying square, and (for the Goal modal) keyboard focus moving deterministically as milestone rows are added/removed and the green color scheme's computed contrast.

## Workflow

Every change — feature, fix, or refactor — runs through the `/ship-feature` pipeline (`.claude/skills/ship-feature/SKILL.md`) rather than being made ad hoc:

1. **(Step 1)** You describe the change: `/ship-feature <description>`.
2. **(Step 2)** A requirements analyst reviews it against the codebase and docs, asks clarifying questions, and drafts `requirements.md` — you approve it or send it back for changes.
3. **(Step 3)** A solution designer proposes an approach; a separate reviewer checks it against the requirements and codebase until it's approved.
4. **(Step 4)** A feature branch is created; work happens there.
5. **(Steps 5–7)** Unit (Vitest), BDD (Cucumber.js), and e2e (Playwright) tests are written test-first and confirmed to fail (red) before any implementation exists — including automated WCAG scans (`jest-axe`/`@axe-core/playwright`) for any new or changed UI.
6. **(Step 8)** The implementation is written until those scoped tests pass.
7. **(Steps 9–11)** The full unit, BDD, and e2e suites are run; any failure is logged as a GitHub issue and fixed, looping until green.
8. **(Step 12)** A QA pass reviews code quality, accessibility, and checks combined test coverage is at least 90%.
9. **(Step 13)** You manually test the change on a local URL; any bug you report is logged and fixed.
10. **(Step 14)** The branch merges to `main` via PR.
11. **(Steps 15–16)** CI (build, typecheck, lint, format check, unit, BDD, dependency audit, e2e, combined coverage ≥90%) and CD (production build, GitHub Pages deploy, smoke check, PWA validation, live e2e) run automatically.
12. **(Step 17)** Any CI failure is logged and fixed automatically before re-running.
13. **(Step 18)** Any CD failure is logged (not auto-fixed) for follow-up.
14. **(Step 19)** Documentation (this README and the wiki) is reconciled against what shipped.
15. **(Step 20)** A post-change report is written to `reports/` — requirements, solution, test changes, bugs raised/resolved, and time taken.
16. **(Step 21)** The feature branch is deleted, leaving `main` as the only branch.

Branch creation, merging, branch deletion, and GitHub issue creation happen automatically as part of this pipeline — see `.claude/skills/ship-feature/SKILL.md` for the exact scope of that automation.

Dependabot opens weekly PRs for npm and GitHub Actions updates (`.github/dependabot.yml`) for manual review. The repo is `engines`-pinned to Node 22 (advisory — installs on other Node versions still succeed). `LICENSE` (MIT) and `SECURITY.md` exist at the repo root.

### npm script contract

CI/CD and the pipeline's test-running steps expect these `package.json` scripts to exist:

| Script                | Purpose                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- |
| `build`               | Production build                                                                        |
| `typecheck`           | Type checking                                                                           |
| `lint`                | Linting                                                                                 |
| `format`              | Prettier auto-format (writes)                                                           |
| `format:check`        | Prettier format check (fails on unformatted files, used in CI)                          |
| `dev`                 | Local dev server                                                                        |
| `test:unit`           | Vitest unit suite                                                                       |
| `test:bdd`            | Cucumber.js BDD suite                                                                   |
| `test:e2e`            | Playwright e2e suite (reads `BASE_URL` when set, for running against a live deployment) |
| `test:coverage:merge` | Combined coverage percentage across all three test layers                               |

If any of these don't exist yet, the pipeline's solution design/implementation steps add them as part of the change rather than skipping the corresponding check.
