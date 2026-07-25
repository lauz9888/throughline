import { describe, it, expect, beforeEach } from 'vitest';
import { saveAspiration, ASPIRATIONS_STORAGE_KEY } from './aspiration-storage';

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
