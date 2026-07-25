# throughline standards

Canonical source for cross-cutting values referenced by multiple `.claude/agents/*.md` files
and `SKILL.md`. If any of these change, update it here first — the agent files below point here
rather than repeating the literal value, so a change only requires editing this file plus any
place a _new_ literal genuinely needs introducing (there shouldn't be one).

## WCAG conformance scope

Automated accessibility scans (`jest-axe` at the unit layer, `@axe-core/playwright` at the e2e
layer) must be scoped to exactly these tags:

`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`

As an array literal (the shape both tools' APIs expect):

```js
['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
```

## Combined coverage threshold

The combined statement-coverage percentage across all three test layers (unit + BDD + e2e, per
`npm run test:coverage:merge`) must be **at least 90%** before a change passes `qa-reviewer`'s
Step 12 gate or CI's `coverage-merge` job.

## Node version

Development and CI both target **Node 20** (`package.json`'s `engines.node: "20.x"`,
`.github/workflows/ci.yml` and `cd.yml`'s `node-version: 20`).

## Security hygiene checklist

Applied by `qa-reviewer.md` to every change, and by anyone reviewing a PR manually:

- No committed secrets or credentials (API keys, tokens, passwords) anywhere in the diff.
- No unsanitized injection of user-controlled data into the DOM/HTML (e.g. raw `innerHTML`
  assignment from user input without escaping/sanitization).
- `npm audit --omit=dev` reports no high/critical vulnerabilities in any dependency touched by
  the change (mirrors the CI `audit` job's `--audit-level=high` gate).
