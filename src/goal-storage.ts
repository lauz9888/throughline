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

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
