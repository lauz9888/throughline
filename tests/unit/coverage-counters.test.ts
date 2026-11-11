// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { addCounters, type CoverageMapLike } from '../e2e/coverage-counters';

const current = (): CoverageMapLike => ({
  'src/a.ts': { s: { 0: 1, 1: 0 }, f: { 0: 1 }, b: { 0: [1, 0] } },
});

describe('addCounters', () => {
  it('adds counters flushed from earlier documents onto the current document', () => {
    const merged = addCounters(current(), {
      'src/a.ts': { s: { 0: 2, 1: 3 }, f: { 0: 1 }, b: { 0: [0, 4] } },
    });
    expect(merged['src/a.ts']).toEqual({ s: { 0: 3, 1: 3 }, f: { 0: 2 }, b: { 0: [1, 4] } });
  });

  it('returns an unchanged copy when nothing was flushed', () => {
    const c = current();
    const merged = addCounters(c, null);
    expect(merged).toEqual(c);
    expect(merged).not.toBe(c);
  });

  it('ignores files, ids and arms the current document does not have', () => {
    const merged = addCounters(current(), {
      'src/other.ts': { s: { 0: 5 } },
      'src/a.ts': { s: { 9: 5 }, b: { 0: [1, 1, 1], 7: [1] } },
    });
    expect(merged['src/a.ts']).toEqual({ s: { 0: 1, 1: 0 }, f: { 0: 1 }, b: { 0: [2, 1] } });
    expect(merged['src/other.ts']).toBeUndefined();
  });
});
