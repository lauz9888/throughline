// Pure(ish), unit-tested helpers for scripts/merge-coverage.mjs: builds the canonical coverage
// inventory, credits every layer onto it, and runs the validity checks and investigation signals
// defined in .claude/STANDARDS.md's "Coverage measurement" section. See
// docs/adr/0007-canonical-coverage-inventory-and-istanbul-e2e.md.
//
// Layer data is Istanbul `coverage-final.json`-shaped (`{ [path]: FileCoverageData }`). Items are
// keyed by file + start line + kind + ordinal on that line, because the providers (V8's AST-based
// mapping for unit/Storybook, Istanbul for BDD/e2e) agree on which line a statement starts on but
// not on its exact columns.

import fs from 'node:fs';
import path from 'node:path';

export const SOURCE_ROOT = 'src';
export const PRIMARY_LAYERS = ['unit', 'storybook'];
export const SECONDARY_LAYERS = ['bdd', 'e2e'];
const KINDS = ['statements', 'branches', 'functions'];

// The one exclusion list every layer's config and this script share (STANDARDS.md's
// instrumentation plan). vite.config.ts, vitest.storybook.config.ts, .nycrc.json and the e2e
// build's vite-plugin-istanbul options must exclude exactly these.
export function isInScope(relPath) {
  return (
    relPath.startsWith(`${SOURCE_ROOT}/`) &&
    relPath.endsWith('.ts') &&
    !relPath.endsWith('.test.ts') &&
    !relPath.endsWith('.stories.ts') &&
    !relPath.endsWith('.d.ts')
  );
}

// Known secondary-only artefact classes (STANDARDS.md). Each is demonstrated with evidence in
// the ADR. `resolution: 'exclude'` drops matching items from the figure (counted per class);
// `resolution: 'add'` adds them to the inventory (a primary-layer blind spot). An item a
// secondary layer reports that matches nothing here is unclassified — a blocking validity failure.
//
// All three current classes come from the BDD layer only: ts-node compiles src/ to CommonJS
// (tsconfig.json's "ts-node" override), and nyc instruments that emit, so module plumbing that
// has no counterpart in the ES-module source gets statements attributed to the import/export
// line it came from. Verified against nyc's statementMap for src/aspiration-fields.ts,
// src/aspiration-storage.ts and src/goal-modal.ts (ADR 0007).
const bddOnly = (kinds, test) => (ctx) =>
  ctx.layer === 'bdd' && kinds.includes(ctx.kind) && !ctx.slot && test(ctx.text.trim());

export const ARTEFACT_CLASSES = [
  {
    id: 'ts-node-cjs-require',
    resolution: 'exclude',
    description: 'the `require()` call ts-node emits for an `import` declaration',
    matches: bddOnly(['statements'], (t) => /^import\s/.test(t) && !/^import\s+type\s/.test(t)),
  },
  {
    id: 'ts-node-cjs-export-binding',
    resolution: 'exclude',
    description:
      'the `exports.name = ...` assignment ts-node emits for `export function` / `export const`, attributed to the declaration line',
    matches: bddOnly(['statements'], (t) =>
      /^export\s+(async\s+)?(function|const|let|class)\s/.test(t),
    ),
  },
  {
    id: 'ts-node-cjs-reexport-getter',
    resolution: 'exclude',
    description:
      'the `Object.defineProperty(exports, ..., { get })` statement and getter function ts-node emits for `export { ... } from`',
    matches: bddOnly(['statements', 'functions'], (t) => /^export\s*\{.*\}\s*from\s/.test(t)),
  },
];

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

// Absolute or relative, either separator style -> 'src/foo.ts' relative to root (posix).
export function toRelative(filePath, root) {
  const posix = filePath.split(path.win32.sep).join(path.posix.sep);
  const rootPosix = root.split(path.win32.sep).join(path.posix.sep).replace(/\/$/, '');
  const lowerPosix = posix.toLowerCase();
  const lowerRoot = rootPosix.toLowerCase();
  if (lowerPosix.startsWith(`${lowerRoot}/`)) return posix.slice(rootPosix.length + 1);
  const idx = posix.lastIndexOf(`/${SOURCE_ROOT}/`);
  return idx >= 0 ? posix.slice(idx + 1) : posix;
}

// Normalises keys to root-relative posix paths and keeps only in-scope source files.
export function scopeLayer(data, root) {
  const scoped = {};
  for (const [filePath, fc] of Object.entries(data)) {
    const rel = toRelative(filePath, root);
    if (isInScope(rel)) scoped[rel] = { ...fc, path: rel };
  }
  return scoped;
}

// Validity check 1: a missing or unparseable layer file throws.
export function loadLayer(coverageDir, layer, root) {
  const file = path.join(coverageDir, layer, 'coverage-final.json');
  if (!fs.existsSync(file)) {
    throw new Error(`Missing coverage-final.json for the "${layer}" layer (${file})`);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Unparseable coverage-final.json for the "${layer}" layer: ${err.message}`, {
      cause: err,
    });
  }
  return scopeLayer(data, root);
}

// Disk enumeration: every in-scope source file, independent of any coverage provider.
export function enumerateSource(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (isInScope(rel)) out.push(rel);
    }
  };
  walk(SOURCE_ROOT);
  return out.sort();
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

function posOf(loc) {
  return {
    line: loc?.start?.line ?? 0,
    col: loc?.start?.column ?? 0,
    endLine: loc?.end?.line ?? loc?.start?.line ?? 0,
    endCol: loc?.end?.column ?? 0,
  };
}

function cmp(a, b) {
  return a.col - b.col || a.endLine - b.endLine || a.endCol - b.endCol;
}

// { statements, branches, functions }, each Item = { type, line, col, ..., hits: number[], src }.
// `type` is 's'/'f' or the Istanbul branch type ('if', 'cond-expr', 'binary-expr', ...).
export function extractItems(fc) {
  const statements = Object.entries(fc.statementMap ?? {}).map(([id, loc]) => ({
    type: 's',
    ...posOf(loc),
    hits: [fc.s?.[id] ?? 0],
    src: { loc },
  }));
  const branches = Object.entries(fc.branchMap ?? {}).map(([id, br]) => {
    const loc = br.loc ?? br.locations?.[0];
    return {
      type: br.type ?? 'branch',
      ...posOf(loc),
      hits: [...(fc.b?.[id] ?? [])],
      src: { loc, locations: br.locations },
    };
  });
  const functions = Object.entries(fc.fnMap ?? {}).map(([id, fn]) => ({
    type: 'f',
    ...posOf(fn.decl ?? fn.loc),
    hits: [fc.f?.[id] ?? 0],
    src: { loc: fn.loc, decl: fn.decl, name: fn.name },
  }));
  return { statements, branches, functions };
}

// groupKey 'line|type' -> items sorted by position (the ordinal is the index).
function groupItems(items) {
  const groups = new Map();
  for (const it of items) {
    const k = `${it.line}|${it.type}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  for (const arr of groups.values()) arr.sort(cmp);
  return groups;
}

function sortedGroupEntries(map) {
  return [...map.entries()].sort((a, b) => {
    const [al, at] = a[0].split('|');
    const [bl, bt] = b[0].split('|');
    return Number(al) - Number(bl) || (at < bt ? -1 : at > bt ? 1 : 0);
  });
}

// A secondary branch's arms can be credited by index when the arm counts agree, or for an `if`
// where the secondary has exactly one fewer arm (an implicit `else` one provider omits).
function canCreditArms(type, inventoryArms, secondaryArms) {
  return inventoryArms === secondaryArms || (type === 'if' && secondaryArms === inventoryArms - 1);
}

const isBlankOrComment = (text) => {
  const t = (text ?? '').trim();
  return t === '' || /^(\/\/|\/\*|\*)/.test(t);
};

// ---------------------------------------------------------------------------
// combineCoverage
// ---------------------------------------------------------------------------

/**
 * @param {object} args
 * @param {Record<string, object>} args.primary   layer name -> scoped data (seeds the inventory)
 * @param {Record<string, object>} args.secondary layer name -> scoped data (credited + reconciled)
 * @param {(file: string) => string[]} args.sourceLines  source text of a file, by line
 * @param {Array} [args.artefactClasses]
 */
export function combineCoverage({
  primary,
  secondary,
  sourceLines,
  artefactClasses = ARTEFACT_CLASSES,
}) {
  // file -> kind -> Map(groupKey -> slots[]); slot = { template, hits[], origin }
  const inventory = new Map();
  const ensureFile = (file) => {
    if (!inventory.has(file)) {
      inventory.set(file, { statements: new Map(), branches: new Map(), functions: new Map() });
    }
    return inventory.get(file);
  };

  const primaryNames = Object.keys(primary).sort();
  const secondaryNames = Object.keys(secondary).sort();

  // Seed: union of the primary layers' items by key (max ordinals, max arms), then credit hits.
  for (const name of primaryNames) {
    for (const [file, fc] of Object.entries(primary[name])) {
      const inv = ensureFile(file);
      const items = extractItems(fc);
      for (const kind of KINDS) {
        for (const [gk, arr] of groupItems(items[kind])) {
          if (!inv[kind].has(gk)) inv[kind].set(gk, []);
          const slots = inv[kind].get(gk);
          arr.forEach((item, i) => {
            slots[i] ??= { template: item, hits: item.hits.map(() => 0), origin: 'primary' };
            while (slots[i].hits.length < item.hits.length) slots[i].hits.push(0);
            item.hits.forEach((h, a) => {
              slots[i].hits[a] += h;
            });
          });
        }
      }
    }
  }

  // Credit secondary layers; reconcile anything that doesn't match.
  const reconciliation = { excludedByClass: {}, addedByClass: {}, unclassified: [] };
  const addedCount = {};
  const excludedStatements = {}; // 'layer|file' -> statements excluded as artefacts
  for (const name of secondaryNames) {
    for (const [file, fc] of Object.entries(secondary[name])) {
      const items = extractItems(fc);
      for (const kind of KINDS) {
        for (const [gk, arr] of groupItems(items[kind])) {
          arr.forEach((item, i) => {
            const slot = inventory.get(file)?.[kind].get(gk)?.[i];
            if (
              slot &&
              (kind !== 'branches' || canCreditArms(item.type, slot.hits.length, item.hits.length))
            ) {
              item.hits.forEach((h, a) => {
                slot.hits[a] += h;
              });
              return;
            }
            const text = sourceLines(file)[item.line - 1] ?? '';
            const ctx = { layer: name, file, kind, item, text, slot };
            const cls = artefactClasses.find((c) => c.matches(ctx));
            if (!cls) {
              reconciliation.unclassified.push({
                layer: name,
                file,
                line: item.line,
                kind,
                type: item.type,
                reason: slot
                  ? `arm count ${item.hits.length} vs inventory ${slot.hits.length}`
                  : 'no inventory item at this key',
                text: text.trim(),
              });
            } else if (cls.resolution === 'add' && !slot) {
              const inv = ensureFile(file);
              if (!inv[kind].has(gk)) inv[kind].set(gk, []);
              inv[kind].get(gk)[i] = { template: item, hits: [...item.hits], origin: cls.id };
              reconciliation.addedByClass[cls.id] = (reconciliation.addedByClass[cls.id] ?? 0) + 1;
              addedCount[file] ??= { statements: 0, branches: 0, functions: 0 };
              addedCount[file][kind] += kind === 'branches' ? item.hits.length : 1;
            } else {
              reconciliation.excludedByClass[cls.id] =
                (reconciliation.excludedByClass[cls.id] ?? 0) + 1;
              if (kind === 'statements') {
                const key = `${name}|${file}`;
                excludedStatements[key] = (excludedStatements[key] ?? 0) + 1;
              }
            }
          });
        }
      }
    }
  }

  // Emit the combined map and totals.
  const data = {};
  const totals = {
    statements: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
  };
  for (const file of [...inventory.keys()].sort()) {
    const inv = inventory.get(file);
    const out = { path: file, statementMap: {}, fnMap: {}, branchMap: {}, s: {}, f: {}, b: {} };
    let n = 0;
    for (const [, slots] of sortedGroupEntries(inv.statements)) {
      for (const slot of slots.filter(Boolean)) {
        const id = String(n++);
        out.statementMap[id] = slot.template.src.loc;
        out.s[id] = slot.hits[0];
        totals.statements.total++;
        if (slot.hits[0] > 0) totals.statements.covered++;
      }
    }
    n = 0;
    for (const [, slots] of sortedGroupEntries(inv.branches)) {
      for (const slot of slots.filter(Boolean)) {
        const id = String(n++);
        const t = slot.template;
        out.branchMap[id] = {
          type: t.type,
          loc: t.src.loc,
          locations: slot.hits.map((_, a) => t.src.locations?.[a] ?? t.src.loc),
          line: t.line,
        };
        out.b[id] = slot.hits;
        for (const h of slot.hits) {
          totals.branches.total++;
          if (h > 0) totals.branches.covered++;
        }
      }
    }
    n = 0;
    for (const [, slots] of sortedGroupEntries(inv.functions)) {
      for (const slot of slots.filter(Boolean)) {
        const id = String(n++);
        const t = slot.template;
        out.fnMap[id] = {
          name: t.src.name ?? `fn${id}`,
          decl: t.src.decl ?? t.src.loc,
          loc: t.src.loc ?? t.src.decl,
          line: t.line,
        };
        out.f[id] = slot.hits[0];
        totals.functions.total++;
        if (slot.hits[0] > 0) totals.functions.covered++;
      }
    }
    data[file] = out;
  }

  return { data, totals, addedCount, excludedStatements, reconciliation };
}

const pct = ({ covered, total }) => (total === 0 ? 0 : (covered / total) * 100);

// ---------------------------------------------------------------------------
// Validity checks (blocking) — each returns a list of failure messages.
// ---------------------------------------------------------------------------

// Check 2: zero totals.
export function checkNonZero(result) {
  const out = [];
  if (result.totals.statements.total === 0) out.push('combined statement total is zero');
  if (result.totals.branches.total === 0) out.push('combined branch total is zero');
  return out;
}

// Check 3: the inventory against disk enumeration.
export function checkInventoryAgainstDisk(inventoryFiles, diskFiles) {
  const inv = new Set(inventoryFiles);
  const disk = new Set(diskFiles);
  const out = [];
  for (const f of [...disk].filter((f) => !inv.has(f)).sort()) {
    out.push(`inventory incomplete: ${f} is in scope on disk but absent from the inventory`);
  }
  for (const f of [...inv].filter((f) => !disk.has(f)).sort()) {
    out.push(`inventory lists ${f}, which is not an in-scope source file on disk`);
  }
  return out;
}

// Check 4: unclassified secondary-only items.
export function checkReconciled(result) {
  return result.reconciliation.unclassified.map(
    (u) =>
      `unreconciled ${u.layer} ${u.kind.replace(/s$/, '')} (${u.type}) at ${u.file}:${u.line} — ${u.reason}: ${JSON.stringify(u.text)}`,
  );
}

// Check 5: statements starting on a blank or comment-only line, in any layer.
export function checkStatementsOnCode(layers, sourceLines) {
  const out = [];
  for (const [name, data] of Object.entries(layers)) {
    for (const [file, fc] of Object.entries(data)) {
      const lines = sourceLines(file);
      for (const loc of Object.values(fc.statementMap ?? {})) {
        const text = lines[loc.start.line - 1];
        if (isBlankOrComment(text)) {
          out.push(`${name}: statement on a blank/comment-only line at ${file}:${loc.start.line}`);
        }
      }
    }
  }
  return out;
}

// Check 6: de-duplication — an independent recount of each file's expected inventory size from
// the raw primary inputs (per key: max ordinals across layers; per ordinal: max arms) plus the
// items reconciliation added, compared with what was emitted.
export function checkDedupe(primary, result) {
  const out = [];
  const files = new Set([
    ...Object.values(primary).flatMap((d) => Object.keys(d)),
    ...Object.keys(result.data),
  ]);
  for (const file of [...files].sort()) {
    for (const kind of KINDS) {
      const perLayer = Object.values(primary).map((d) => {
        const groups = new Map();
        if (!d[file]) return groups;
        for (const [gk, arr] of groupItems(extractItems(d[file])[kind])) {
          groups.set(
            gk,
            arr.map((it) => it.hits.length),
          );
        }
        return groups;
      });
      let expected = 0;
      for (const gk of new Set(perLayer.flatMap((g) => [...g.keys()]))) {
        const lists = perLayer.map((g) => g.get(gk) ?? []);
        const ordinals = Math.max(...lists.map((l) => l.length));
        for (let i = 0; i < ordinals; i++) {
          expected += kind === 'branches' ? Math.max(...lists.map((l) => l[i] ?? 0)) : 1;
        }
      }
      const fc = result.data[file];
      const actual = !fc
        ? 0
        : kind === 'statements'
          ? Object.keys(fc.s).length
          : kind === 'functions'
            ? Object.keys(fc.f).length
            : Object.values(fc.b).reduce((n, arms) => n + arms.length, 0);
      const added = result.addedCount[file]?.[kind] ?? 0;
      if (actual !== expected + added) {
        out.push(
          `de-duplication broken for ${file} (${kind}): emitted ${actual}, expected ${expected} seeded + ${added} added`,
        );
      }
    }
  }
  return out;
}

// Check 7: calibration statements. A line containing CALIBRATION_MARKER marks the statement(s)
// starting on the next non-comment line as unreachable from every layer's tests.
export const CALIBRATION_MARKER = 'coverage-calibration: unreachable';

export function findCalibrationPoints(diskFiles, sourceLines) {
  const points = [];
  for (const file of diskFiles) {
    const lines = sourceLines(file);
    lines.forEach((text, i) => {
      if (!text.includes(CALIBRATION_MARKER)) return;
      let j = i + 1;
      while (j < lines.length && isBlankOrComment(lines[j])) j++;
      points.push({ file, line: j + 1 });
    });
  }
  return points;
}

export function checkCalibration(points, layers, result) {
  if (points.length === 0) {
    return [`no calibration statement found (a source line containing "${CALIBRATION_MARKER}")`];
  }
  const out = [];
  for (const { file, line } of points) {
    const inInventory = Object.values(result.data[file]?.statementMap ?? {}).some(
      (loc) => loc.start.line === line,
    );
    if (!inInventory) out.push(`calibration statement ${file}:${line} is not in the inventory`);
    for (const [name, data] of Object.entries(layers)) {
      const fc = data[file];
      if (!fc) continue;
      for (const [id, loc] of Object.entries(fc.statementMap ?? {})) {
        if (loc.start.line === line && (fc.s[id] ?? 0) > 0) {
          out.push(`${name}: calibration statement ${file}:${line} reported hit ${fc.s[id]} times`);
        }
      }
    }
    const combined = result.data[file];
    for (const [id, loc] of Object.entries(combined?.statementMap ?? {})) {
      if (loc.start.line === line && combined.s[id] > 0) {
        out.push(`combined: calibration statement ${file}:${line} counted as covered`);
      }
    }
  }
  return out;
}

// Check 8: determinism — the same inputs in a different layer order give the same figures.
export function checkDeterministic(args, result) {
  const reverse = (o) => Object.fromEntries(Object.entries(o).reverse());
  const again = combineCoverage({
    ...args,
    primary: reverse(args.primary),
    secondary: reverse(args.secondary),
  });
  const same = KINDS.every(
    (k) =>
      again.totals[k].covered === result.totals[k].covered &&
      again.totals[k].total === result.totals[k].total,
  );
  return same ? [] : ['non-deterministic: reversing layer order changed the combined totals'];
}

// ---------------------------------------------------------------------------
// Investigation signals (advisory) — never fail the run.
// ---------------------------------------------------------------------------

export function collectSignals(layers, result) {
  const out = [];
  for (const [name, data] of Object.entries(layers)) {
    let zero = 0;
    for (const [file, fc] of Object.entries(data)) {
      const hits = Object.values(fc.s ?? {});
      zero += hits.filter((h) => h === 0).length;
      // All-zero is just a file this layer never loads; a shared *non-zero* count is the
      // whole-script-range signature worth investigating.
      if (hits.length >= 5 && hits[0] > 0 && new Set(hits).size === 1) {
        out.push(
          `${name}: uniform hit count (${hits[0]}) across all ${hits.length} statements of ${file}`,
        );
      }
      const inv = result.data[file];
      if (inv && Object.keys(inv.fnMap).length > 0 && Object.keys(fc.fnMap ?? {}).length === 0) {
        out.push(`${name}: no function data for ${file}, which has functions`);
      }
      if (
        inv &&
        Object.keys(inv.branchMap).length > 0 &&
        Object.keys(fc.branchMap ?? {}).length === 0
      ) {
        out.push(`${name}: no branch data for ${file}, which has branches`);
      }
      const invCount = inv ? Object.keys(inv.s).length : 0;
      // Statements reconciliation already explained as artefacts don't count as excess.
      const explained = result.excludedStatements?.[`${name}|${file}`] ?? 0;
      const layerCount = Object.keys(fc.statementMap ?? {}).length - explained;
      if (layerCount > invCount + Math.max(2, Math.ceil(0.1 * invCount))) {
        out.push(
          `${name}: ${layerCount} statements for ${file} (after ${explained} classified artefacts) vs ${invCount} in the inventory`,
        );
      }
    }
    if (Object.keys(data).length > 0 && zero === 0) {
      out.push(`${name}: no zero-hit statements anywhere in the layer`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function layerTotals(data) {
  const t = { statements: { covered: 0, total: 0 }, branches: { covered: 0, total: 0 } };
  for (const fc of Object.values(data)) {
    for (const h of Object.values(fc.s ?? {})) {
      t.statements.total++;
      if (h > 0) t.statements.covered++;
    }
    for (const arms of Object.values(fc.b ?? {})) {
      for (const h of arms) {
        t.branches.total++;
        if (h > 0) t.branches.covered++;
      }
    }
  }
  return t;
}

const frac = (t) => `${t.covered}/${t.total}`;

// The lines test:coverage:merge prints, in STANDARDS.md's output-contract order.
export function formatReport({ layers, diskFiles, result, signals }) {
  const lines = [];
  for (const [name, data] of Object.entries(layers)) {
    const t = layerTotals(data);
    lines.push(`Layer ${name}: statements ${frac(t.statements)}, branches ${frac(t.branches)}`);
  }
  const r = result.reconciliation;
  const classes = (o) =>
    Object.entries(o)
      .map(([id, n]) => `${id}=${n}`)
      .join(', ') || 'none';
  lines.push(
    `Inventory: ${diskFiles.length} in-scope source files on disk, ${Object.keys(result.data).length} in the inventory`,
  );
  lines.push(
    `Reconciliation: excluded ${classes(r.excludedByClass)}; added ${classes(r.addedByClass)}; unclassified ${r.unclassified.length}`,
  );
  for (const s of signals) lines.push(`Coverage signal: ${s}`);
  lines.push(
    `Combined coverage: ${pct(result.totals.statements).toFixed(2)}% (${frac(result.totals.statements)} statements)`,
  );
  lines.push(
    `Combined branch coverage: ${pct(result.totals.branches).toFixed(2)}% (${frac(result.totals.branches)} branches)`,
  );
  return lines;
}
