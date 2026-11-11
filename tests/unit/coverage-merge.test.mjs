// @vitest-environment node
// Unit tests for scripts/lib/coverage-merge.mjs — the pure logic behind
// `npm run test:coverage:merge` (.claude/STANDARDS.md, "Calibration requirements" 2–5).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  isInScope,
  toRelative,
  scopeLayer,
  loadLayer,
  enumerateSource,
  combineCoverage,
  checkNonZero,
  checkInventoryAgainstDisk,
  checkReconciled,
  checkStatementsOnCode,
  checkDedupe,
  findCalibrationPoints,
  checkCalibration,
  checkDeterministic,
  collectSignals,
  formatReport,
  ARTEFACT_CLASSES,
  CALIBRATION_MARKER,
} from '../../scripts/lib/coverage-merge.mjs';

const loc = (line, col, endCol = col + 5) => ({
  start: { line, column: col },
  end: { line, column: endCol },
});

// fc({ s: [[line, col, hits]], b: [[line, col, type, [arms]]], f: [[line, col, hits]] })
function fc({ s = [], b = [], f = [] } = {}) {
  const out = { statementMap: {}, s: {}, branchMap: {}, b: {}, fnMap: {}, f: {} };
  s.forEach(([line, col, hits], i) => {
    out.statementMap[i] = loc(line, col);
    out.s[i] = hits;
  });
  b.forEach(([line, col, type, arms], i) => {
    out.branchMap[i] = { type, loc: loc(line, col), locations: arms.map(() => loc(line, col)) };
    out.b[i] = arms;
  });
  f.forEach(([line, col, hits], i) => {
    out.fnMap[i] = { name: `fn${i}`, decl: loc(line, col), loc: loc(line, col, 40) };
    out.f[i] = hits;
  });
  return out;
}

const codeLines = (n = 50) => Array.from({ length: n }, (_, i) => `const x${i} = ${i};`);
const lines = () => codeLines();

function combine(primary, secondary, opts = {}) {
  return combineCoverage({ primary, secondary, sourceLines: opts.sourceLines ?? lines, ...opts });
}

describe('scope and paths', () => {
  it('keeps only application source under src/', () => {
    expect(isInScope('src/a.ts')).toBe(true);
    expect(isInScope('src/nested/a.ts')).toBe(true);
    expect(isInScope('src/a.test.ts')).toBe(false);
    expect(isInScope('src/a.stories.ts')).toBe(false);
    expect(isInScope('src/a.d.ts')).toBe(false);
    expect(isInScope('features/step_definitions/a.steps.ts')).toBe(false);
    expect(isInScope('src/style.css')).toBe(false);
  });

  it('normalises Windows and POSIX absolute paths to the same relative key', () => {
    expect(toRelative('C:\\work\\proj\\src\\a.ts', 'C:\\work\\proj')).toBe('src/a.ts');
    expect(toRelative('c:/work/proj/src/a.ts', 'C:\\work\\proj')).toBe('src/a.ts');
    expect(toRelative('/home/u/proj/src/a.ts', '/home/u/proj')).toBe('src/a.ts');
  });

  it('scopes a layer, dropping node_modules, step definitions and tests', () => {
    const scoped = scopeLayer(
      {
        'C:\\p\\src\\a.ts': fc(),
        'C:\\p\\features\\step_definitions\\x.steps.ts': fc(),
        'C:\\p\\src\\a.test.ts': fc(),
      },
      'C:\\p',
    );
    expect(Object.keys(scoped)).toEqual(['src/a.ts']);
  });
});

describe('loading and disk enumeration', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'covmerge-'));

  it('throws for a missing layer file (validity check 1)', () => {
    expect(() => loadLayer(tmp(), 'e2e', '/x')).toThrow(
      /Missing coverage-final.json for the "e2e"/,
    );
  });

  it('throws for an unparseable layer file (validity check 1)', () => {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, 'unit'));
    fs.writeFileSync(path.join(dir, 'unit', 'coverage-final.json'), '{not json');
    expect(() => loadLayer(dir, 'unit', '/x')).toThrow(/Unparseable/);
  });

  it('enumerates in-scope source files from disk, independent of any provider', () => {
    const root = tmp();
    fs.mkdirSync(path.join(root, 'src', 'nested'), { recursive: true });
    for (const f of ['a.ts', 'a.test.ts', 'b.stories.ts', 'nested/c.ts', 'style.css']) {
      fs.writeFileSync(path.join(root, 'src', f), '');
    }
    expect(enumerateSource(root)).toEqual(['src/a.ts', 'src/nested/c.ts']);
  });
});

describe('combineCoverage — one canonical inventory', () => {
  it('counts a statement once, and as covered, when two providers place it at different columns and only one hit it', () => {
    const r = combine(
      { unit: { 'src/a.ts': fc({ s: [[3, 2, 0]] }) } },
      { e2e: { 'src/a.ts': fc({ s: [[3, 9, 4]] }) } },
    );
    expect(r.totals.statements).toEqual({ covered: 1, total: 1 });
    expect(r.reconciliation.unclassified).toEqual([]);
  });

  it('matches multiple statements on one line by ordinal', () => {
    const r = combine(
      {
        unit: {
          'src/a.ts': fc({
            s: [
              [3, 2, 0],
              [3, 20, 0],
            ],
          }),
        },
      },
      {
        e2e: {
          'src/a.ts': fc({
            s: [
              [3, 25, 1],
              [3, 4, 0],
            ],
          }),
        },
      },
    );
    expect(r.totals.statements).toEqual({ covered: 1, total: 2 });
    // ordinal 1 (the later column) was the one hit
    expect(r.data['src/a.ts'].s).toEqual({ 0: 0, 1: 1 });
  });

  it('unions two primary layers, taking the larger ordinal count per key', () => {
    const r = combine(
      {
        unit: { 'src/a.ts': fc({ s: [[1, 0, 1]] }) },
        storybook: {
          'src/a.ts': fc({
            s: [
              [1, 0, 0],
              [1, 10, 2],
            ],
          }),
        },
      },
      {},
    );
    expect(r.totals.statements).toEqual({ covered: 2, total: 2 });
  });

  it('includes a file no test touched, at zero hits, when the primary provider reports it', () => {
    const r = combine(
      {
        unit: {
          'src/untested.ts': fc({
            s: [
              [1, 0, 0],
              [2, 0, 0],
            ],
          }),
        },
      },
      {},
    );
    expect(Object.keys(r.data)).toEqual(['src/untested.ts']);
    expect(r.totals.statements).toEqual({ covered: 0, total: 2 });
  });

  it('credits branch arms by index when arm counts agree, and for an `if` missing its implicit else', () => {
    const r = combine(
      {
        unit: {
          'src/a.ts': fc({
            b: [
              [5, 2, 'if', [0, 0]],
              [9, 2, 'cond-expr', [0, 0]],
            ],
          }),
        },
      },
      {
        e2e: {
          'src/a.ts': fc({
            b: [
              [5, 4, 'if', [2]],
              [9, 6, 'cond-expr', [0, 3]],
            ],
          }),
        },
      },
    );
    expect(r.totals.branches).toEqual({ covered: 2, total: 4 });
    expect(r.reconciliation.unclassified).toEqual([]);
  });

  it('does not credit a branch whose arm count disagrees in any other way', () => {
    const r = combine(
      { unit: { 'src/a.ts': fc({ b: [[5, 2, 'switch', [0, 0, 0]]] }) } },
      { e2e: { 'src/a.ts': fc({ b: [[5, 2, 'switch', [1, 1]]] }) } },
    );
    expect(r.totals.branches).toEqual({ covered: 0, total: 3 });
    expect(r.reconciliation.unclassified).toHaveLength(1);
    expect(r.reconciliation.unclassified[0].reason).toMatch(/arm count 2 vs inventory 3/);
  });

  it('gives the same totals whatever order the layers arrive in', () => {
    const args = {
      primary: {
        unit: {
          'src/a.ts': fc({
            s: [
              [1, 0, 1],
              [2, 0, 0],
            ],
          }),
        },
        storybook: { 'src/a.ts': fc({ s: [[2, 3, 1]] }) },
      },
      secondary: { e2e: { 'src/a.ts': fc({ s: [[1, 1, 0]] }) } },
      sourceLines: lines,
    };
    const r = combineCoverage(args);
    expect(checkDeterministic(args, r)).toEqual([]);
  });
});

describe('secondary-layer reconciliation', () => {
  const primary = { unit: { 'src/a.ts': fc({ s: [[1, 0, 1]] }) } };
  const secondary = {
    bdd: {
      'src/a.ts': fc({
        s: [
          [1, 0, 1],
          [7, 0, 5],
        ],
      }),
    },
  };

  it('surfaces a real item the primary layers lack as unclassified, and fails validity check 4', () => {
    const r = combine(primary, secondary, { artefactClasses: [] });
    expect(r.reconciliation.unclassified).toMatchObject([
      { layer: 'bdd', file: 'src/a.ts', line: 7 },
    ]);
    expect(r.totals.statements.total).toBe(1);
    expect(checkReconciled(r)).toHaveLength(1);
    expect(checkReconciled(r)[0]).toMatch(/unreconciled bdd statement \(s\) at src\/a.ts:7/);
  });

  it('excludes and counts an item matching a declared exclude class', () => {
    const cls = { id: 'demo', resolution: 'exclude', matches: (c) => c.item.line === 7 };
    const r = combine(primary, secondary, { artefactClasses: [cls] });
    expect(r.reconciliation.unclassified).toEqual([]);
    expect(r.reconciliation.excludedByClass).toEqual({ demo: 1 });
    expect(r.totals.statements).toEqual({ covered: 1, total: 1 });
    expect(checkReconciled(r)).toEqual([]);
  });

  it('adds an item matching a declared add class to the inventory, with its hits', () => {
    const cls = { id: 'blind-spot', resolution: 'add', matches: (c) => c.item.line === 7 };
    const r = combine(primary, secondary, { artefactClasses: [cls] });
    expect(r.reconciliation.addedByClass).toEqual({ 'blind-spot': 1 });
    expect(r.totals.statements).toEqual({ covered: 2, total: 2 });
    expect(checkDedupe(primary, r)).toEqual([]);
  });

  it("matches the declared ts-node artefact classes only for the BDD layer's unmatched items", () => {
    const text = [
      "import { a } from './a';",
      'export function f(): void {',
      "export { g } from './g';",
      'export const X =',
      'doSomething();',
    ];
    const sourceLines = () => text;
    const mk = (layer) =>
      combine(
        { unit: { 'src/a.ts': fc({ s: [[4, 0, 1]] }) } },
        {
          [layer]: {
            'src/a.ts': fc({
              s: [
                [1, 0, 1],
                [2, 0, 1],
                [3, 0, 1],
                [4, 0, 1],
                [4, 9, 1],
                [5, 0, 1],
              ],
              f: [[3, 0, 1]],
            }),
          },
        },
        { sourceLines, artefactClasses: ARTEFACT_CLASSES },
      );
    const bdd = mk('bdd');
    expect(bdd.reconciliation.excludedByClass).toEqual({
      'ts-node-cjs-require': 1,
      'ts-node-cjs-export-binding': 2,
      'ts-node-cjs-reexport-getter': 2,
    });
    // line 5 is real code no primary layer reported — never excluded
    expect(bdd.reconciliation.unclassified.map((u) => u.line)).toEqual([5]);
    // the same shapes from e2e are not artefacts of that layer
    // (6 of e2e's 7 items have no inventory match; line 4's first statement does)
    expect(mk('e2e').reconciliation.unclassified).toHaveLength(6);
  });
});

describe('validity checks', () => {
  it('fails on zero statement or branch totals', () => {
    const r = combine({ unit: { 'src/a.ts': fc({ s: [[1, 0, 1]] }) } }, {});
    expect(checkNonZero(r)).toEqual(['combined branch total is zero']);
  });

  it('fails when an in-scope file on disk is absent from the inventory, or vice versa', () => {
    expect(checkInventoryAgainstDisk(['src/a.ts'], ['src/a.ts', 'src/b.ts'])).toEqual([
      'inventory incomplete: src/b.ts is in scope on disk but absent from the inventory',
    ]);
    expect(checkInventoryAgainstDisk(['src/a.ts', 'src/gone.ts'], ['src/a.ts'])).toEqual([
      'inventory lists src/gone.ts, which is not an in-scope source file on disk',
    ]);
    expect(checkInventoryAgainstDisk(['src/a.ts'], ['src/a.ts'])).toEqual([]);
  });

  it('fails on a statement starting on a blank or comment-only line in any layer', () => {
    const sourceLines = () => ['const a = 1;', '', '  // note', ' * doc', 'b();'];
    const layers = {
      e2e: {
        'src/a.ts': fc({
          s: [
            [1, 0, 1],
            [2, 0, 1],
            [3, 0, 1],
            [4, 0, 1],
            [5, 0, 1],
          ],
        }),
      },
    };
    expect(checkStatementsOnCode(layers, sourceLines)).toEqual([
      'e2e: statement on a blank/comment-only line at src/a.ts:2',
      'e2e: statement on a blank/comment-only line at src/a.ts:3',
      'e2e: statement on a blank/comment-only line at src/a.ts:4',
    ]);
  });

  it('passes the de-duplication recount for a correct merge and fails a double-counted one', () => {
    const primary = {
      unit: { 'src/a.ts': fc({ s: [[1, 0, 1]], b: [[2, 0, 'if', [1, 0]]] }) },
      storybook: { 'src/a.ts': fc({ s: [[1, 4, 0]], b: [[2, 3, 'if', [0, 1]]] }) },
    };
    const r = combine(primary, {});
    expect(checkDedupe(primary, r)).toEqual([]);
    r.data['src/a.ts'].s['99'] = 1; // a duplicate copy of the line-1 statement
    expect(checkDedupe(primary, r)).toEqual([
      'de-duplication broken for src/a.ts (statements): emitted 2, expected 1 seeded + 0 added',
    ]);
  });

  describe('calibration', () => {
    const src = [
      'function f() {',
      `  // ${CALIBRATION_MARKER}`,
      '  // more notes',
      '  return 1;',
      '}',
    ];
    const sourceLines = () => src;
    const points = findCalibrationPoints(['src/a.ts'], sourceLines);

    it('finds the statement on the first code line after the marker', () => {
      expect(points).toEqual([{ file: 'src/a.ts', line: 4 }]);
    });

    it('passes when every layer reports the calibration statement unhit', () => {
      const layers = {
        unit: { 'src/a.ts': fc({ s: [[4, 2, 0]] }) },
        e2e: { 'src/a.ts': fc({ s: [[4, 9, 0]] }) },
      };
      const r = combine({ unit: layers.unit }, { e2e: layers.e2e }, { sourceLines });
      expect(checkCalibration(points, layers, r)).toEqual([]);
    });

    it('fails when any layer reports it hit, and when the combined figure counts it covered', () => {
      const layers = {
        unit: { 'src/a.ts': fc({ s: [[4, 2, 0]] }) },
        e2e: { 'src/a.ts': fc({ s: [[4, 9, 3]] }) },
      };
      const r = combine({ unit: layers.unit }, { e2e: layers.e2e }, { sourceLines });
      expect(checkCalibration(points, layers, r)).toEqual([
        'e2e: calibration statement src/a.ts:4 reported hit 3 times',
        'combined: calibration statement src/a.ts:4 counted as covered',
      ]);
    });

    it('fails when no calibration marker exists anywhere', () => {
      const r = combine({ unit: { 'src/a.ts': fc({ s: [[1, 0, 0]] }) } }, {});
      expect(checkCalibration([], {}, r)[0]).toMatch(/no calibration statement found/);
    });
  });
});

describe('investigation signals (advisory)', () => {
  it('reports uniform hits, missing zero-hit statements, missing branch/function data and statement excess', () => {
    const inventoryLayer = {
      'src/a.ts': fc({
        s: [
          [1, 0, 0],
          [2, 0, 0],
          [3, 0, 0],
          [4, 0, 0],
          [5, 0, 0],
        ],
        b: [[2, 0, 'if', [0, 0]]],
        f: [[1, 0, 0]],
      }),
    };
    const flat = fc({
      s: Array.from({ length: 9 }, (_, i) => [i + 1, 0, 488]),
    });
    const layers = { unit: inventoryLayer, e2e: { 'src/a.ts': flat } };
    const r = combine({ unit: inventoryLayer }, {}, {});
    const signals = collectSignals(layers, r);
    // unit's all-zero file is just "never loaded" — not a signal
    expect(signals).toEqual([
      'e2e: uniform hit count (488) across all 9 statements of src/a.ts',
      'e2e: no function data for src/a.ts, which has functions',
      'e2e: no branch data for src/a.ts, which has branches',
      'e2e: 9 statements for src/a.ts (after 0 classified artefacts) vs 5 in the inventory',
      'e2e: no zero-hit statements anywhere in the layer',
    ]);
  });

  it('does not report statement excess that reconciliation already classified as artefacts', () => {
    const unit = {
      'src/a.ts': fc({
        s: [
          [1, 0, 1],
          [5, 0, 0],
        ],
      }),
    };
    const bdd = {
      'src/a.ts': fc({
        s: [
          [1, 0, 2],
          [5, 0, 0],
          [2, 0, 1],
          [3, 0, 1],
          [4, 0, 1],
        ],
      }),
    };
    const cls = { id: 'demo', resolution: 'exclude', matches: (c) => c.item.line < 5 };
    const r = combine({ unit }, { bdd }, { artefactClasses: [cls] });
    expect(r.reconciliation.excludedByClass).toEqual({ demo: 3 });
    expect(collectSignals({ unit, bdd }, r)).toEqual([]);
  });

  it('never makes the run fail: signals are separate from every validity check', () => {
    const unit = {
      'src/a.ts': fc({
        s: [
          [1, 0, 7],
          [2, 0, 7],
          [3, 0, 7],
          [4, 0, 7],
          [5, 0, 7],
        ],
      }),
    };
    const r = combine({ unit }, {});
    expect(collectSignals({ unit }, r)).toHaveLength(2);
    expect(checkReconciled(r)).toEqual([]);
    expect(checkDedupe({ unit }, r)).toEqual([]);
  });
});

describe('output contract', () => {
  it('prints the layer, inventory, reconciliation and signal lines, then the two combined lines last', () => {
    const layers = {
      unit: {
        'src/a.ts': fc({
          s: [
            [1, 0, 1],
            [2, 0, 0],
          ],
          b: [[1, 0, 'if', [1, 0]]],
        }),
      },
    };
    const r = combine(layers, {});
    const out = formatReport({ layers, diskFiles: ['src/a.ts'], result: r, signals: ['e2e: x'] });
    expect(out).toEqual([
      'Layer unit: statements 1/2, branches 1/2',
      'Inventory: 1 in-scope source files on disk, 1 in the inventory',
      'Reconciliation: excluded none; added none; unclassified 0',
      'Coverage signal: e2e: x',
      'Combined coverage: 50.00% (1/2 statements)',
      'Combined branch coverage: 50.00% (1/2 branches)',
    ]);
    // CI's parse expects exactly one match per line
    expect(out.filter((l) => /^Combined coverage: [0-9.]+/.test(l))).toHaveLength(1);
    expect(out.filter((l) => /^Combined branch coverage: [0-9.]+/.test(l))).toHaveLength(1);
  });
});
