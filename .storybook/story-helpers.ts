// Test-layer helpers consumed only by stories (not toolchain config).
import { ASPIRATIONS_STORAGE_KEY } from '../src/aspiration-storage';
import { GOALS_STORAGE_KEY } from '../src/goal-storage';

// A `div#app` so `src/style.css` selectors and `root.inert` behave like the real app.
export function createAppRoot(): HTMLDivElement {
  const root = document.createElement('div');
  root.id = 'app';
  return root;
}

// Removes any modal/confirm overlay a story left on `document.body`.
export function removeOverlays(): void {
  document.querySelectorAll('.modal-overlay').forEach((overlay) => overlay.remove());
}

// Used only by the create-modal stories, which read `window.localStorage` directly.
export function clearThroughlineStorage(): void {
  window.localStorage.removeItem(GOALS_STORAGE_KEY);
  window.localStorage.removeItem(ASPIRATIONS_STORAGE_KEY);
}
