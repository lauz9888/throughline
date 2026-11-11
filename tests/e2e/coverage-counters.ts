// Pure helper for tests/e2e/coverage-fixture.ts: adds the counters flushed from
// earlier documents (kept in sessionStorage across reloads) into the current
// document's `window.__coverage__`. Unit-tested in
// scripts/lib/coverage-counters.test.ts.

export interface FileCounters {
  s: Record<string, number>;
  f: Record<string, number>;
  b: Record<string, number[]>;
}
export type CoverageMapLike = Record<string, FileCounters & Record<string, unknown>>;
export type PrevCounters = Record<string, Partial<FileCounters>>;

export function addCounters(current: CoverageMapLike, prev: PrevCounters | null): CoverageMapLike {
  const out = structuredClone(current);
  if (!prev) return out;
  for (const [file, counters] of Object.entries(prev)) {
    const target = out[file];
    if (!target) continue;
    for (const [id, n] of Object.entries(counters.s ?? {})) {
      const cur = target.s[id];
      if (cur !== undefined) target.s[id] = cur + n;
    }
    for (const [id, n] of Object.entries(counters.f ?? {})) {
      const cur = target.f[id];
      if (cur !== undefined) target.f[id] = cur + n;
    }
    for (const [id, arms] of Object.entries(counters.b ?? {})) {
      const t = target.b[id];
      if (!t) continue;
      arms.forEach((n, i) => {
        const cur = t[i];
        if (cur !== undefined) t[i] = cur + n;
      });
    }
  }
  return out;
}
