# Ship report: site-scaffold

- **Tracking issue**: [#1](https://github.com/lauz9888/throughline/issues/1)
- **Branch**: `feature/site-scaffold`
- **PR**: [#14](https://github.com/lauz9888/throughline/pull/14) (squash-merged as `5f8ba2b`)
- **Live**: https://lauz9888.github.io/throughline/

## Requirements

First feature ever run through this pipeline, against a fully greenfield repo (no `src/`, no `package.json`, no build config). The ask: "create the basic set-up for a website. When loaded, it should be a blank white page with an elegant 'throughline' logo at the top left."

This expanded into 15 concrete requirements, driven largely by pre-existing constraints already baked into `.github/workflows/ci.yml` and `cd.yml`:

- A solid white page with nothing on it but a "throughline" wordmark, rendered as real text (not an image) anchored top-left, in an elegant serif typeface with deliberate weight/letter-spacing/color — not a bare default heading.
- A favicon and PWA icon visually derived from that same wordmark treatment.
- `<title>throughline</title>`, and the wordmark exposed as accessible text.
- A full npm script contract that didn't exist yet: `dev`, `build`, `typecheck`, `lint`, `test:unit`, `test:bdd`, `test:e2e`, `test:coverage:merge` — all required by CI/CD but none of them scaffolded.
- A production build that serves a web app manifest and service worker at `manifest.webmanifest` / `sw.js` (required by `cd.yml`'s PWA validation check), with correct base-path handling for GitHub Pages' `/throughline/` subpath vs. local root.
- No console errors/failed requests on load, and the serif font available without depending on network access at load time.

One round of Q&A with the user resolved the two open design choices: the logo is a text wordmark (not an image asset) in a serif typeface such as Playfair Display, and the favicon/PWA icon should be derived from that same wordmark treatment. Full detail in `.workflow/site-scaffold/requirements.md`.

## Solution

Greenfield Vite + vanilla TypeScript PWA — no UI framework, since a single static page with one rendered element doesn't justify one. Key decisions:

- **Wordmark**: `<h1 class="wordmark">throughline</h1>`, styled via `@fontsource/playfair-display` (self-hosted `.woff2`, no CDN dependency), left in normal document flow (no centering/flex) so it anchors top-left with a small padding margin.
- **Favicon/icon**: a single hand-authored SVG (stylized serif lowercase "t"), reused for both `<link rel="icon">` and the PWA manifest's icon entry.
- **PWA**: `vite-plugin-pwa` in default `generateSW` mode, whose default filenames (`manifest.webmanifest`, `sw.js`) matched `cd.yml`'s PWA check exactly — no workflow edit needed.
- **Base path**: `src/base-path.ts`'s `getBasePath()` returns `/throughline/` when `GITHUB_PAGES=true` (set by CD's build step) and `/` otherwise.
- **Testing stack**: Vitest (unit, jsdom) for DOM-building logic and the base-path helper; Cucumber.js (BDD, jsdom-backed World) for user-observable DOM/content behavior; Playwright/Chromium (e2e) for visual/network-level assertions (computed styles, position, title, console/network errors, manifest/SW reachability) — run against a local production preview by default, or against a live `BASE_URL` post-deploy.
- **Coverage merge**: a bespoke `scripts/merge-coverage.mjs` combining Vitest's native v8 coverage, Cucumber's Istanbul instrumentation (via `nyc` + `ts-node/register`), and Playwright's Chromium coverage API (converted via `v8-to-istanbul`), reset between phases to avoid cross-contaminating the three layers' reports, then merged into one combined percentage.

The design went through 5 review cycles before approval, raising and resolving 11 issues (#2–#12) — see Bugs raised below. Full detail, including the requirement-coverage map and file-by-file breakdown, is in `.workflow/site-scaffold/design.md`.

One scope correction during implementation: the coverage-merge machinery (`scripts/merge-coverage.mjs`, the `.nyc_output` reset logic, the Playwright coverage fixture and global teardown) was initially left out of the first implementation pass and had to be added in a follow-up, since it had been described in the design but was mis-scoped out of the initial build.

## Test changes

Per `.workflow/site-scaffold/state.md`, red-confirmed then filled in during implementation:

**Unit (Vitest)**
- `src/app.test.ts` — `renderApp` produces exactly one child element, that child is `h1.wordmark` with text `"throughline"`, and calling it twice is idempotent (still exactly one child).
- `src/base-path.test.ts` — `getBasePath` returns `/throughline/` when `GITHUB_PAGES=true`, and `/` otherwise (unset or `'false'`).

**BDD (Cucumber.js)**
- `features/blank-page.feature` — one scenario ("The wordmark is the only content rendered") covering single-child-only content and accessible text at the DOM level.
- `features/step_definitions/blank-page.steps.ts` — step definitions driving `renderApp` against a jsdom-backed World.
- `features/support/world.ts` — custom `World` subclass wrapping a `JSDOM` document.
- `cucumber.cjs` — Cucumber config (step/support globs, `ts-node/register`, summary formatter).

**E2E (Playwright)**
- `tests/e2e/home.spec.ts` — title, white background, wordmark position (top-left at mobile + desktop viewports), computed style assertions (font-family, weight, letter-spacing, color), manifest/service-worker reachability (`manifest.webmanifest`, `sw.js` return 200), icon.svg reachability and manifest icon linkage, and no console errors/failed requests on load.
- `playwright.config.ts` — Chromium project, local preview `webServer` (or live `BASE_URL` when set), global teardown wiring.
- `tests/e2e/global-teardown.ts` — merges per-test e2e coverage into `coverage/e2e/coverage-final.json` when `COVERAGE=true`, otherwise a no-op.

Full suite run: unit 6/6 pass, BDD 1/1 scenario pass, e2e 7/7 pass — all green on the first try, no bug-fix cycles needed at that step.

## Bugs raised

### Design review (label: `design`) — issues #2–#12, all closed during the 5-cycle design review, before implementation began

| # | Title | Opened | Closed | Resolution |
|---|---|---|---|---|
| #2 | nyc config missing for BDD coverage instrumentation | 2026-07-24 21:17:49 | 2026-07-24 21:23:40 | Added explicit `.nycrc.json` (extension, require ts-node/register, include/exclude, sourceMap) so BDD coverage instruments TS sources instead of silently producing empty coverage. |
| #3 | Missing Playwright globalTeardown file for e2e coverage merge | 2026-07-24 21:17:50 | 2026-07-24 21:23:42 | Added `tests/e2e/global-teardown.ts` as the actual resolvable module referenced by `playwright.config.ts`'s `globalTeardown` option. |
| #4 | Favicon/PWA icon requirement (4) has no explicit test | 2026-07-24 21:17:51 | 2026-07-24 21:23:44 | Added explicit e2e assertions: `GET icon.svg` returns 200, and the manifest's `icons[0].src` resolves to it. |
| #5 | Unused `@fontsource` 400-weight import | 2026-07-24 21:17:52 | 2026-07-24 21:23:46 | Dropped the unused 400-weight CSS import; only 700 (the weight actually used) is imported. |
| #6 | `tsconfig` `module: ESNext` conflicts with `ts-node/register`, breaks BDD | 2026-07-24 21:23:47 | 2026-07-24 21:32:43 | Added a `"ts-node": { "compilerOptions": { "module": "commonjs" } }` override block in `tsconfig.json`, scoped to ts-node's own require-hook compilation only. |
| #7 | `.nyc_output/` not reset between BDD and e2e coverage phases, contaminates merge | 2026-07-24 21:23:49 | 2026-07-24 21:32:45 | Coverage-merge script resets `.nyc_output/` again immediately after the BDD phase and before the e2e phase, keeping the three layers' reports pure. |
| #8 | Requirement 3 (letter-spacing/weight/color) only partially asserted | 2026-07-24 21:23:50 | 2026-07-24 21:32:47 | Extended the e2e computed-style assertions to cover font-family, weight, letter-spacing, and color, not just typeface. |
| #9 | Missing Playwright browser install step for local `test:e2e` runs | 2026-07-24 21:32:48 | 2026-07-24 21:36:10 | Added a `pretest:e2e` script (`playwright install --with-deps chromium`), scoped to only fire before `test:e2e` rather than on every `npm ci`. |
| #10 | Self-contradictory step numbering in coverage-merge design section | 2026-07-24 21:32:49 | 2026-07-24 21:36:12 | Corrected the prose's step cross-reference (the reset happens before step 5, not step 4 as originally mis-numbered). |
| #11 | `postinstall` Playwright install fires on unrelated CI jobs | 2026-07-24 21:36:13 | 2026-07-24 21:40:35 | Superseded the earlier `postinstall` approach with the `pretest:e2e` hook (see #9's resolution) so unrelated CI jobs (build/typecheck/lint/unit/bdd) don't pay for an unneeded Chromium download. |
| #12 | Requirement 1 coverage-map claims an e2e assertion that isn't actually specified | 2026-07-24 21:36:14 | 2026-07-24 21:40:37 | Corrected the coverage-map wording so it no longer implies an e2e "exactly one child" check that only the unit test actually performs. |

### QA review — no issue filed

QA found the reported coverage figure (a false 20.43%) was caused by a coverage-config bug rather than genuinely missing tests; true combined coverage was 100%. Per QA's live-fix contract (`STATUS: changes-made`), this was fixed directly in the same pass rather than filed as a separate tracked issue.

### Manual test gate (label: `manual-test`) — issue #13

| # | Title | Opened | Closed | Resolution |
|---|---|---|---|---|
| #13 | Hover state — strike through the wordmark with a coloured line | 2026-07-24 22:10:24 | 2026-07-24 22:12:49 | User-requested addition during manual testing: added a coloured strikethrough effect on hover over the wordmark. Fixed and re-confirmed by the user before proceeding to merge. |

### CI/CD (label: `ci`) — issues #15–#18, all raised and closed after merge, during the CD stage

| # | Title | Opened | Closed | Resolution |
|---|---|---|---|---|
| #15 | CD failure — Deploy job (GitHub Pages not enabled) | 2026-07-24 22:17:15 | 2026-07-24 22:22:00 | One-time repo configuration issue, not a code bug: GitHub Pages had to be enabled (Settings > Pages > Source: GitHub Actions) before `actions/deploy-pages@v4` could create a deployment. |
| #16 | CD failure — smoke-check, pwa-check, e2e-live all get empty `page_url` | 2026-07-24 22:19:49 | 2026-07-24 22:20:28 | `cd.yml`'s deploy job set `environment.url` from `steps.deployment.outputs.page_url` but never declared a job-level `outputs:` block, so downstream jobs saw an empty URL. Fixed with an explicit `outputs: page_url: ...` on the deploy job (commit `28a1e2e`). |
| #17 | CD failure — e2e-live, `page.goto('/')` strips the `/throughline/` GitHub Pages subpath | 2026-07-24 22:25:40 | 2026-07-24 22:26:30 | A leading-slash `goto('/')` resolves against the base URL's origin, not its path, so it navigated off the Pages subpath onto GitHub's 404 page. Fixed by switching to a relative `'./'` goto (commit `0253e2d`). |
| #18 | CD failure — e2e-live, `request.get('/path')` also strips the `/throughline/` subpath | 2026-07-24 22:29:04 | 2026-07-24 22:29:13 | Same root cause as #17 but for the `request` fixture's manifest/SW/icon checks. Fixed by switching those to relative paths too (commit `07c7d06`). |

Each CD fix was applied with the user's explicit go-ahead before re-running the pipeline.

## Time taken

- **Started**: 2026-07-24 21:02:27 UTC
- **Completed**: 2026-07-24 22:33:37 UTC
- **Total elapsed**: approximately 1 hour 31 minutes

This elapsed time spans human wait time as well as active engineering work — user approvals (requirements sign-off, each CD fix go-ahead), the manual-testing gate and its round-trip, CI/CD run and re-run wait time, and review turnaround across the 5 design-review cycles — not just active implementation time. It should not be read as a measure of pure engineering effort.

## Pipeline stages traversed

Requirements gathering (1 Q&A round) -> solution design + review (5 cycles, issues #2-#12) -> branch `feature/site-scaffold` -> red-phase unit/BDD/e2e tests -> implementation (plus a follow-up to add coverage-merge machinery initially mis-scoped out) -> full suite run (all green first try) -> QA review (coverage-config bug found and live-fixed, no issue filed) -> manual test gate (issue #13, fixed and re-confirmed) -> merge via PR #14 (squash commit `5f8ba2b`) -> CI (all green first try) -> CD (failed twice post-merge across issues #15-#18, all fixed with follow-up commits and explicit user go-ahead) -> docs update (README refreshed; wiki checked, nothing to update) -> this report.
