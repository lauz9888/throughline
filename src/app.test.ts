import { describe, it, expect } from 'vitest';
import { renderApp } from './app';

describe('renderApp', () => {
  it('renders exactly one child element into an empty root', () => {
    const root = document.createElement('div');

    renderApp(root);

    expect(root.children.length).toBe(1);
  });

  it('renders an h1.wordmark with text "throughline"', () => {
    const root = document.createElement('div');

    renderApp(root);

    const child = root.firstElementChild;
    expect(child?.tagName).toBe('H1');
    expect(child?.classList.contains('wordmark')).toBe(true);
    expect(child?.textContent).toBe('throughline');
  });

  it('keeps exactly one child when called twice (idempotency guard)', () => {
    const root = document.createElement('div');

    renderApp(root);
    renderApp(root);

    expect(root.children.length).toBe(1);
  });
});
