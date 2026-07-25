export interface Aspiration {
  id: string;
  title: string;
  description: string;
  reason: string;
  createdAt: string; // ISO 8601, via new Date().toISOString()
}

export const ASPIRATIONS_STORAGE_KEY = 'throughline:aspirations';

export function saveAspiration(
  input: { title: string; description: string; reason: string },
  storage: Storage,
): Aspiration {
  const existing = readAspirations(storage);
  const record: Aspiration = {
    id: generateId(),
    title: input.title.trim(),
    description: input.description.trim(),
    reason: input.reason.trim(),
    createdAt: new Date().toISOString(),
  };
  storage.setItem(ASPIRATIONS_STORAGE_KEY, JSON.stringify([...existing, record]));
  return record;
}

function readAspirations(storage: Storage): Aspiration[] {
  const raw = storage.getItem(ASPIRATIONS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Aspiration[]) : [];
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
