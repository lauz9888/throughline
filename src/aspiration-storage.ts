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

export function readAspirations(storage: Storage): Aspiration[] {
  const raw = storage.getItem(ASPIRATIONS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Aspiration[]) : [];
  } catch {
    return [];
  }
}

export function updateAspiration(
  id: string,
  input: { title: string; description: string; reason: string },
  storage: Storage,
): Aspiration | undefined {
  const existing = readAspirations(storage);
  const index = existing.findIndex((a) => a.id === id);
  if (index === -1) return undefined;
  const updated: Aspiration = {
    ...existing[index]!,
    title: input.title.trim(),
    description: input.description.trim(),
    reason: input.reason.trim(),
  };
  const next = [...existing];
  next[index] = updated;
  storage.setItem(ASPIRATIONS_STORAGE_KEY, JSON.stringify(next));
  return updated;
}

export function deleteAspiration(id: string, storage: Storage): void {
  const next = readAspirations(storage).filter((a) => a.id !== id);
  storage.setItem(ASPIRATIONS_STORAGE_KEY, JSON.stringify(next));
}

export function sortAspirationsAlphabetically(aspirations: Aspiration[]): Aspiration[] {
  return [...aspirations].sort((a, b) => {
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
