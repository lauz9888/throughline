import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveGoal,
  updateGoal,
  deleteGoal,
  readGoals,
  sortGoalsAlphabetically,
  GOALS_STORAGE_KEY,
  type Goal,
} from './goal-storage';
import { ASPIRATIONS_STORAGE_KEY } from './aspiration-storage';

function readStored(storage: Storage): unknown[] {
  const raw = storage.getItem(GOALS_STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

describe('saveGoal', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses a storage key distinct from ASPIRATIONS_STORAGE_KEY (Requirement 27)', () => {
    expect(GOALS_STORAGE_KEY).not.toBe(ASPIRATIONS_STORAGE_KEY);
    expect(GOALS_STORAGE_KEY).toBe('throughline:goals');
  });

  it('writes an array containing the new record under GOALS_STORAGE_KEY', () => {
    saveGoal(
      { title: 'Run a marathon', description: '', reason: '', milestoneTitles: [] },
      window.localStorage,
    );

    const stored = readStored(window.localStorage);
    expect(stored).toHaveLength(1);
    expect((stored[0] as { title: string }).title).toBe('Run a marathon');
    expect(window.localStorage.getItem(ASPIRATIONS_STORAGE_KEY)).toBeFalsy();
  });

  it('returns a record with id/title/description/reason (trimmed)/createdAt/milestones[] (Requirement 28)', () => {
    const record = saveGoal(
      {
        title: '  Run a marathon  ',
        description: '  Complete a full 26.2 miles  ',
        reason: '  For my health  ',
        milestoneTitles: [],
      },
      window.localStorage,
    );

    expect(record.id).toBeTruthy();
    expect(record.title).toBe('Run a marathon');
    expect(record.description).toBe('Complete a full 26.2 miles');
    expect(record.reason).toBe('For my health');
    expect(record.createdAt).toBeTruthy();
    expect(Array.isArray(record.milestones)).toBe(true);
  });

  it('builds a milestones array with its own generated id and trimmed title per entry (Requirement 28)', () => {
    const record = saveGoal(
      {
        title: 'Run a marathon',
        description: '',
        reason: '',
        milestoneTitles: ['  Run a half-marathon  ', 'Run a 10k'],
      },
      window.localStorage,
    );

    expect(record.milestones).toHaveLength(2);
    expect(record.milestones[0]!.title).toBe('Run a half-marathon');
    expect(record.milestones[1]!.title).toBe('Run a 10k');
    expect(record.milestones[0]!.id).toBeTruthy();
    expect(record.milestones[1]!.id).toBeTruthy();
    expect(record.milestones[0]!.id).not.toBe(record.milestones[1]!.id);
  });

  it('produces an empty milestones array when milestoneTitles is empty (Requirement 15)', () => {
    const record = saveGoal(
      { title: 'Run a marathon', description: '', reason: '', milestoneTitles: [] },
      window.localStorage,
    );

    expect(record.milestones).toEqual([]);
  });

  it('appends a second, independent record on a second call, leaving the first untouched (Requirement 30)', () => {
    const first = saveGoal(
      { title: 'First goal', description: '', reason: '', milestoneTitles: ['A'] },
      window.localStorage,
    );
    const second = saveGoal(
      { title: 'Second goal', description: '', reason: '', milestoneTitles: ['B', 'C'] },
      window.localStorage,
    );

    const stored = readStored(window.localStorage) as Goal[];
    expect(stored).toHaveLength(2);
    expect(stored[0]!.title).toBe('First goal');
    expect(stored[1]!.title).toBe('Second goal');
    expect(first.id).not.toBe(second.id);
    expect(stored[0]!.milestones.map((m) => m.title)).toEqual(['A']);
    expect(stored[1]!.milestones.map((m) => m.title)).toEqual(['B', 'C']);
  });

  it('tolerates pre-existing malformed JSON at the storage key, treating it as empty rather than throwing', () => {
    window.localStorage.setItem(GOALS_STORAGE_KEY, 'not valid json {{{');

    expect(() => {
      saveGoal(
        { title: 'A goal', description: '', reason: '', milestoneTitles: [] },
        window.localStorage,
      );
    }).not.toThrow();

    expect(readStored(window.localStorage)).toHaveLength(1);
  });
});

describe('readGoals', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns an empty array when nothing is stored', () => {
    expect(readGoals(window.localStorage)).toEqual([]);
  });

  it('tolerates malformed JSON at the storage key, returning an empty array rather than throwing', () => {
    window.localStorage.setItem(GOALS_STORAGE_KEY, 'not valid json {{{');

    expect(() => readGoals(window.localStorage)).not.toThrow();
    expect(readGoals(window.localStorage)).toEqual([]);
  });

  it('round-trips a saved goal, including its milestones, via readGoals (Requirement 27)', () => {
    saveGoal(
      {
        title: 'Run a marathon',
        description: 'Complete a full marathon',
        reason: 'Health',
        milestoneTitles: ['Run a half-marathon', 'Run a 10k'],
      },
      window.localStorage,
    );

    const result = readGoals(window.localStorage);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Run a marathon');
    expect(result[0]!.milestones.map((m) => m.title)).toEqual(['Run a half-marathon', 'Run a 10k']);
  });

  it('reads two independently saved goals, each with their own milestone list (Requirements 27, 30)', () => {
    saveGoal(
      { title: 'Goal one', description: '', reason: '', milestoneTitles: ['Step 1'] },
      window.localStorage,
    );
    saveGoal(
      { title: 'Goal two', description: '', reason: '', milestoneTitles: ['Step A', 'Step B'] },
      window.localStorage,
    );

    const result = readGoals(window.localStorage);

    expect(result).toHaveLength(2);
    expect(result[0]!.milestones).toHaveLength(1);
    expect(result[1]!.milestones).toHaveLength(2);
  });
});

describe('updateGoal', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("updates the matching record's title/description/reason (trimmed), preserving id and createdAt", () => {
    const original = saveGoal(
      {
        title: 'Original title',
        description: 'Original desc',
        reason: 'Original reason',
        milestoneTitles: [],
      },
      window.localStorage,
    );

    const updated = updateGoal(
      original.id,
      {
        title: '  New title  ',
        description: '  New desc  ',
        reason: '  New reason  ',
        milestones: [],
      },
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
    const first = saveGoal(
      { title: 'First', description: '', reason: '', milestoneTitles: [] },
      window.localStorage,
    );
    const second = saveGoal(
      { title: 'Second', description: '', reason: '', milestoneTitles: [] },
      window.localStorage,
    );

    updateGoal(
      second.id,
      { title: 'Updated second', description: '', reason: '', milestones: [] },
      window.localStorage,
    );

    const stored = readGoals(window.localStorage);
    const untouchedFirst = stored.find((g) => g.id === first.id);
    expect(untouchedFirst?.title).toBe('First');
  });

  it('returns the updated record', () => {
    const original = saveGoal(
      { title: 'Title', description: '', reason: '', milestoneTitles: [] },
      window.localStorage,
    );

    const updated = updateGoal(
      original.id,
      { title: 'Changed', description: '', reason: '', milestones: [] },
      window.localStorage,
    );

    expect(updated?.title).toBe('Changed');
  });

  it('returns undefined without throwing for an unknown id, and does not write a matching record', () => {
    saveGoal(
      { title: 'Existing', description: '', reason: '', milestoneTitles: [] },
      window.localStorage,
    );

    let result: Goal | undefined;
    expect(() => {
      result = updateGoal(
        'unknown-id',
        { title: 'X', description: '', reason: '', milestones: [] },
        window.localStorage,
      );
    }).not.toThrow();

    expect(result).toBeUndefined();
    expect(readGoals(window.localStorage)).toHaveLength(1);
  });

  it('preserves a supplied milestone id (title updated in place) and generates a fresh id for a milestone entry without one (Requirement 18)', () => {
    const original = saveGoal(
      {
        title: 'Run a marathon',
        description: '',
        reason: '',
        milestoneTitles: ['Run a half-marathon', 'Run a 10k'],
      },
      window.localStorage,
    );
    const [first, second] = original.milestones;

    const updated = updateGoal(
      original.id,
      {
        title: original.title,
        description: original.description,
        reason: original.reason,
        milestones: [
          { id: first!.id, title: '  Updated half-marathon  ' },
          { title: 'Brand new milestone' }, // no id supplied — must get a fresh one
        ],
      },
      window.localStorage,
    );

    expect(updated).toBeDefined();
    expect(updated!.milestones).toHaveLength(2);
    expect(updated!.milestones[0]!.id).toBe(first!.id);
    expect(updated!.milestones[0]!.title).toBe('Updated half-marathon');
    expect(updated!.milestones[1]!.id).toBeTruthy();
    expect(updated!.milestones[1]!.id).not.toBe(first!.id);
    expect(updated!.milestones[1]!.id).not.toBe(second!.id);
    expect(updated!.milestones[1]!.title).toBe('Brand new milestone');
  });

  it('persists the milestones exactly as returned, in the same order supplied', () => {
    const original = saveGoal(
      { title: 'Goal', description: '', reason: '', milestoneTitles: ['A', 'B'] },
      window.localStorage,
    );

    updateGoal(
      original.id,
      {
        title: original.title,
        description: original.description,
        reason: original.reason,
        milestones: [{ title: 'Only remaining milestone' }],
      },
      window.localStorage,
    );

    const stored = readGoals(window.localStorage);
    expect(stored[0]!.milestones).toHaveLength(1);
    expect(stored[0]!.milestones[0]!.title).toBe('Only remaining milestone');
  });
});

describe('deleteGoal', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('removes only the matching record, including its milestones, leaving others untouched', () => {
    const first = saveGoal(
      { title: 'First', description: '', reason: '', milestoneTitles: ['Step 1'] },
      window.localStorage,
    );
    const second = saveGoal(
      { title: 'Second', description: '', reason: '', milestoneTitles: [] },
      window.localStorage,
    );

    deleteGoal(first.id, window.localStorage);

    const stored = readGoals(window.localStorage);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe(second.id);
  });

  it('is a no-throw no-op for an unknown id', () => {
    saveGoal(
      { title: 'Only', description: '', reason: '', milestoneTitles: [] },
      window.localStorage,
    );

    expect(() => deleteGoal('unknown-id', window.localStorage)).not.toThrow();
    expect(readGoals(window.localStorage)).toHaveLength(1);
  });
});

describe('sortGoalsAlphabetically', () => {
  function make(title: string, createdAt: string, id = `${title}-${createdAt}`): Goal {
    return { id, title, description: '', reason: '', milestones: [], createdAt };
  }

  it('orders titles case-insensitively (e.g. apple, banana, Cherry)', () => {
    const input = [
      make('banana', '2024-01-01T00:00:00.000Z'),
      make('Cherry', '2024-01-02T00:00:00.000Z'),
      make('apple', '2024-01-03T00:00:00.000Z'),
    ];

    const sorted = sortGoalsAlphabetically(input);

    expect(sorted.map((g) => g.title)).toEqual(['apple', 'banana', 'Cherry']);
  });

  it('breaks ties for equal titles by ascending createdAt', () => {
    const later = make('Same title', '2024-06-01T00:00:00.000Z', 'later');
    const earlier = make('Same title', '2024-01-01T00:00:00.000Z', 'earlier');

    const sorted = sortGoalsAlphabetically([later, earlier]);

    expect(sorted[0]!.id).toBe('earlier');
    expect(sorted[1]!.id).toBe('later');
  });

  it('returns an empty array for empty input', () => {
    expect(sortGoalsAlphabetically([])).toEqual([]);
  });

  it('does not mutate its input array', () => {
    const input = [
      make('banana', '2024-01-01T00:00:00.000Z'),
      make('apple', '2024-01-02T00:00:00.000Z'),
    ];
    const inputCopy = [...input];

    sortGoalsAlphabetically(input);

    expect(input).toEqual(inputCopy);
  });
});
