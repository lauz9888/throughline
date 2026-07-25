# 0001. Adopt Prettier for code formatting

Status: Accepted
Date: 2026-07-25

## Context

Style consistency (indentation, quote style, line width) previously relied entirely on manual
discipline — `eslint.config.js` had no formatter and no stylistic rules beyond
`js.configs.recommended`/`tseslint.configs.recommended`. A repo & workflow standards review
(tracking issue #25) identified this as a gap: nothing would catch a stylistically inconsistent
PR before merge.

## Decision

Add `prettier` and `eslint-config-prettier` as `devDependencies`. `.prettierrc` fixes 2-space
indent, single quotes, semicolons, and a 100-character print width (see `.prettierrc` for why
these are explicit overrides rather than Prettier's zero-config defaults). `eslint-config-prettier`
disables any ESLint stylistic rule that would otherwise conflict. The existing codebase is
reformatted in the same change so the baseline is clean going forward; `npm run format:check`
runs in CI (`.github/workflows/ci.yml`'s `format` job) as a blocking gate on every PR.

## Consequences

Future diffs won't include stylistic bikeshedding or accidental style drift. `npm run format`
auto-fixes locally before committing. The one-time reformat this decision required touches most
existing files' whitespace/quoting (not their behavior) — see `reports/` for this run's report
covering that reformat's scope.
