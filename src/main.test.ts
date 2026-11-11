import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Importing ./main runs its top-level bootstrap and pulls in style.css (handled by Vite/Vitest).
describe('main bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.resetModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.resetModules();
  });

  it('[#133:REQ-003,REQ-004] renders the app into #app when the host element exists', async () => {
    const host = document.createElement('div');
    host.id = 'app';
    document.body.append(host);

    await import('./main');

    expect(host.children.length).toBeGreaterThan(0);
    expect(host.querySelector('#add-item-button')).not.toBeNull();
    expect(host.querySelector('#add-item-menu')).not.toBeNull();
  });

  it('[#133:REQ-003] does nothing, without throwing, when there is no #app element', async () => {
    await expect(import('./main')).resolves.toBeDefined();

    expect(document.body.innerHTML).toBe('');
  });
});
