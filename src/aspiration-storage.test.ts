import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveAspiration,
  updateAspiration,
  deleteAspiration,
  readAspirations,
  sortAspirationsAlphabetically,
  ASPIRATIONS_STORAGE_KEY,
  type Aspiration,
} from './aspiration-storage';

function readStored(storage: Storage): unknown[] {
  const raw = storage.getItem(ASPIRATIONS_STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

// A distinct in-memory fake Storage, deliberately not `window.localStorage`, to prove
// `saveAspiration` genuinely writes to whatever `storage` it's given rather than silently
// falling back to a global (the direct regression test for GitHub issue #54).
function createFakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size;
    },
  };
}

describe('saveAspiration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('writes an array containing the new record to the passed-in storage under ASPIRATIONS_STORAGE_KEY', () => {
    saveAspiration(
      { title: 'Live a healthy life', description: 'desc', reason: 'reason' },
      window.localStorage,
    );

    const stored = readStored(window.localStorage);
    expect(stored).toHaveLength(1);
    expect((stored[0] as { title: string }).title).toBe('Live a healthy life');
  });

  it('returns the record it saved, with title/description/reason matching the trimmed input and no link/radio field', () => {
    const record = saveAspiration(
      { title: '  Healthy life  ', description: '  desc  ', reason: '  reason  ' },
      window.localStorage,
    );

    expect(record.title).toBe('Healthy life');
    expect(record.description).toBe('desc');
    expect(record.reason).toBe('reason');
    expect(record).not.toHaveProperty('links');
    expect(record).not.toHaveProperty('selectedLinkType');
    expect(record.id).toBeTruthy();
    expect(record.createdAt).toBeTruthy();
  });

  it('appends a second, independent record on a second call, leaving the first untouched (Requirement 27)', () => {
    const first = saveAspiration(
      { title: 'First aspiration', description: '', reason: '' },
      window.localStorage,
    );
    const second = saveAspiration(
      { title: 'Second aspiration', description: '', reason: '' },
      window.localStorage,
    );

    const stored = readStored(window.localStorage) as { id: string; title: string }[];
    expect(stored).toHaveLength(2);
    expect(stored[0]!.title).toBe('First aspiration');
    expect(stored[1]!.title).toBe('Second aspiration');
    expect(first.id).not.toBe(second.id);
  });

  it('tolerates pre-existing malformed JSON at the storage key, treating it as empty rather than throwing', () => {
    window.localStorage.setItem(ASPIRATIONS_STORAGE_KEY, 'not valid json {{{');

    expect(() => {
      saveAspiration({ title: 'Title', description: '', reason: '' }, window.localStorage);
    }).not.toThrow();

    const stored = readStored(window.localStorage);
    expect(stored).toHaveLength(1);
  });

  it('writes to a distinct fake Storage object it is given, not falling back to window.localStorage (regression for issue #54)', () => {
    const fakeStorage = createFakeStorage();

    saveAspiration({ title: 'Fake storage title', description: '', reason: '' }, fakeStorage);

    expect(readStored(fakeStorage)).toHaveLength(1);
    expect(readStored(window.localStorage)).toHaveLength(0);
  });
});

describe('readAspirations (now exported)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns an empty array when nothing is stored', () => {
    expect(readAspirations(window.localStorage)).toEqual([]);
  });

  it('tolerates malformed JSON at the storage key, returning an empty array rather than throwing', () => {
    window.localStorage.setItem(ASPIRATIONS_STORAGE_KEY, 'not valid json {{{');

    expect(() => readAspirations(window.localStorage)).not.toThrow();
    expect(readAspirations(window.localStorage)).toEqual([]);
  });

  it('returns the stored array', () => {
    saveAspiration({ title: 'A', description: '', reason: '' }, window.localStorage);
    saveAspiration({ title: 'B', description: '', reason: '' }, window.localStorage);

    const result = readAspirations(window.localStorage);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.title)).toEqual(['A', 'B']);
  });

  it('writes to/reads from a distinct fake Storage object, not falling back to window.localStorage (regression for issue #54)', () => {
    const fakeStorage = createFakeStorage();
    saveAspiration({ title: 'Fake storage title', description: '', reason: '' }, fakeStorage);

    expect(readAspirations(fakeStorage)).toHaveLength(1);
    expect(readAspirations(window.localStorage)).toHaveLength(0);
  });
});

describe('updateAspiration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("updates the matching record's title/description/reason (trimmed), preserving id and createdAt", () => {
    const original = saveAspiration(
      { title: 'Original title', description: 'Original desc', reason: 'Original reason' },
      window.localStorage,
    );

    const updated = updateAspiration(
      original.id,
      { title: '  New title  ', description: '  New desc  ', reason: '  New reason  ' },
      window.localStorage,
    );

    expect(updated).toBeDefined();
    expect(updated!.id).toBe(original.id);
    expect(updated!.createdAt).toBe(original.createdAt);
    expect(updated!.title).toBe('New title');
    expect(updated!.description).toBe('New desc');
    expect(updated!.reason).toBe('New reason');
  });

  it('leaves other records untouched', () => {
    const first = saveAspiration(
      { title: 'First', description: '', reason: '' },
      window.localStorage,
    );
    const second = saveAspiration(
      { title: 'Second', description: '', reason: '' },
      window.localStorage,
    );

    updateAspiration(
      second.id,
      { title: 'Updated second', description: '', reason: '' },
      window.localStorage,
    );

    const stored = readAspirations(window.localStorage);
    const untouchedFirst = stored.find((a) => a.id === first.id);
    expect(untouchedFirst?.title).toBe('First');
  });

  it('returns the updated record', () => {
    const original = saveAspiration(
      { title: 'Title', description: '', reason: '' },
      window.localStorage,
    );

    const updated = updateAspiration(
      original.id,
      { title: 'Changed', description: '', reason: '' },
      window.localStorage,
    );

    expect(updated?.title).toBe('Changed');
  });

  it('returns undefined without throwing for an unknown id, and does not write a matching record', () => {
    saveAspiration({ title: 'Existing', description: '', reason: '' }, window.localStorage);

    let result: Aspiration | undefined;
    expect(() => {
      result = updateAspiration(
        'unknown-id',
        { title: 'X', description: '', reason: '' },
        window.localStorage,
      );
    }).not.toThrow();

    expect(result).toBeUndefined();
    expect(readAspirations(window.localStorage)).toHaveLength(1);
  });
});

describe('deleteAspiration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('removes only the matching record, leaving others untouched', () => {
    const first = saveAspiration(
      { title: 'First', description: '', reason: '' },
      window.localStorage,
    );
    const second = saveAspiration(
      { title: 'Second', description: '', reason: '' },
      window.localStorage,
    );

    deleteAspiration(first.id, window.localStorage);

    const stored = readAspirations(window.localStorage);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe(second.id);
  });

  it('is a no-throw no-op for an unknown id', () => {
    saveAspiration({ title: 'Only', description: '', reason: '' }, window.localStorage);

    expect(() => deleteAspiration('unknown-id', window.localStorage)).not.toThrow();
    expect(readAspirations(window.localStorage)).toHaveLength(1);
  });
});

describe('sortAspirationsAlphabetically', () => {
  function make(title: string, createdAt: string, id = `${title}-${createdAt}`): Aspiration {
    return { id, title, description: '', reason: '', createdAt };
  }

  it('orders titles case-insensitively (e.g. apple, banana, Cherry)', () => {
    const input = [
      make('banana', '2024-01-01T00:00:00.000Z'),
      make('Cherry', '2024-01-02T00:00:00.000Z'),
      make('apple', '2024-01-03T00:00:00.000Z'),
    ];

    const sorted = sortAspirationsAlphabetically(input);

    expect(sorted.map((a) => a.title)).toEqual(['apple', 'banana', 'Cherry']);
  });

  it('breaks ties for equal titles by ascending createdAt', () => {
    const later = make('Same title', '2024-06-01T00:00:00.000Z', 'later');
    const earlier = make('Same title', '2024-01-01T00:00:00.000Z', 'earlier');

    const sorted = sortAspirationsAlphabetically([later, earlier]);

    expect(sorted[0]!.id).toBe('earlier');
    expect(sorted[1]!.id).toBe('later');
  });

  it('returns an empty array for empty input', () => {
    expect(sortAspirationsAlphabetically([])).toEqual([]);
  });

  it('does not mutate its input array', () => {
    const input = [
      make('banana', '2024-01-01T00:00:00.000Z'),
      make('apple', '2024-01-02T00:00:00.000Z'),
    ];
    const inputCopy = [...input];

    sortAspirationsAlphabetically(input);

    expect(input).toEqual(inputCopy);
  });
});
