export interface Milestone {
  id: string;
  title: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  reason: string;
  milestones: Milestone[];
  createdAt: string; // ISO 8601, via new Date().toISOString()
}

export const GOALS_STORAGE_KEY = 'throughline:goals';

export function saveGoal(
  input: { title: string; description: string; reason: string; milestoneTitles: string[] },
  storage: Storage,
): Goal {
  const existing = readGoals(storage);
  const record: Goal = {
    id: generateId(),
    title: input.title.trim(),
    description: input.description.trim(),
    reason: input.reason.trim(),
    createdAt: new Date().toISOString(),
    milestones: input.milestoneTitles.map((title) => ({
      id: generateId(),
      title: title.trim(),
    })),
  };
  storage.setItem(GOALS_STORAGE_KEY, JSON.stringify([...existing, record]));
  return record;
}

export function readGoals(storage: Storage): Goal[] {
  const raw = storage.getItem(GOALS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Goal[]) : [];
  } catch {
    return [];
  }
}

export function updateGoal(
  id: string,
  input: {
    title: string;
    description: string;
    reason: string;
    // Each entry's `id`, if present, is preserved (title updated in place); if absent, a fresh
    // id is generated — this is how milestone identity survives an edit (Requirement 18).
    milestones: Array<{ id?: string; title: string }>;
  },
  storage: Storage,
): Goal | undefined {
  const existing = readGoals(storage);
  const index = existing.findIndex((g) => g.id === id);
  if (index === -1) return undefined;
  const updated: Goal = {
    ...existing[index]!,
    title: input.title.trim(),
    description: input.description.trim(),
    reason: input.reason.trim(),
    milestones: input.milestones.map((m) => ({
      id: m.id ?? generateId(),
      title: m.title.trim(),
    })),
  };
  const next = [...existing];
  next[index] = updated;
  storage.setItem(GOALS_STORAGE_KEY, JSON.stringify(next));
  return updated;
}

export function deleteGoal(id: string, storage: Storage): void {
  const next = readGoals(storage).filter((g) => g.id !== id);
  storage.setItem(GOALS_STORAGE_KEY, JSON.stringify(next));
}

export function sortGoalsAlphabetically(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    if (byTitle !== 0) return byTitle;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
