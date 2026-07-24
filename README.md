# throughline

A Vite-built Progressive Web App, deployed to GitHub Pages: https://lauz9888.github.io/throughline/

Currently a scaffold: a blank white page with a "throughline" wordmark (self-hosted Playfair Display) at the top left, a hand-authored SVG favicon/app icon, and PWA support (`manifest.webmanifest`, `sw.js`) via `vite-plugin-pwa`.

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

## Workflow

Every change — feature, fix, or refactor — runs through the `/ship-feature` pipeline (`.claude/skills/ship-feature/SKILL.md`) rather than being made ad hoc:

1. You describe the change: `/ship-feature <description>`.
2. A requirements analyst reviews it against the codebase and docs, asks clarifying questions, and drafts `requirements.md` — you approve it or send it back for changes.
3. A solution designer proposes an approach; a separate reviewer checks it against the requirements and codebase until it's approved.
4. A feature branch is created; work happens there.
5–7. Unit (Vitest), BDD (Cucumber.js), and e2e (Playwright) tests are written test-first and confirmed to fail (red) before any implementation exists.
8. The implementation is written until those scoped tests pass.
9–11. The full unit, BDD, and e2e suites are run; any failure is logged as a GitHub issue and fixed, looping until green.
12. A QA pass reviews code quality and checks combined test coverage is at least 90%.
13. You manually test the change on a local URL; any bug you report is logged and fixed.
14. The branch merges to `main` via PR.
15–16. CI (build, typecheck, lint, unit, BDD) and CD (production build, GitHub Pages deploy, smoke check, PWA validation, live e2e) run automatically.
17. Any CI failure is logged and fixed automatically before re-running.
18. Any CD failure is logged (not auto-fixed) for follow-up.
19. Documentation (this README and the wiki) is reconciled against what shipped.
20. A post-change report is written to `reports/` — requirements, solution, test changes, bugs raised/resolved, and time taken.
21. The feature branch is deleted, leaving `main` as the only branch.

Branch creation, merging, branch deletion, and GitHub issue creation happen automatically as part of this pipeline — see `.claude/skills/ship-feature/SKILL.md` for the exact scope of that automation.

### npm script contract

CI/CD and the pipeline's test-running steps expect these `package.json` scripts to exist:

| Script | Purpose |
| --- | --- |
| `build` | Production build |
| `typecheck` | Type checking |
| `lint` | Linting |
| `dev` | Local dev server |
| `test:unit` | Vitest unit suite |
| `test:bdd` | Cucumber.js BDD suite |
| `test:e2e` | Playwright e2e suite (reads `BASE_URL` when set, for running against a live deployment) |
| `test:coverage:merge` | Combined coverage percentage across all three test layers |

If any of these don't exist yet, the pipeline's solution design/implementation steps add them as part of the change rather than skipping the corresponding check.
