import { describe, it, expect } from 'vitest';
import { renderApp, ADD_ITEM_TYPES } from './app';

describe('renderApp', () => {
  it('renders exactly one top-level child (the top bar) into an empty root', () => {
    const root = document.createElement('div');

    renderApp(root);

    expect(root.children.length).toBe(1);
  });

  it('renders an h1.wordmark with text "throughline" inside the top bar', () => {
    const root = document.createElement('div');

    renderApp(root);

    const wordmark = root.querySelector('h1.wordmark');
    expect(wordmark).not.toBeNull();
    expect(wordmark?.textContent).toBe('throughline');
  });

  it('keeps exactly one child when called twice (idempotency guard)', () => {
    const root = document.createElement('div');

    renderApp(root);
    renderApp(root);

    expect(root.children.length).toBe(1);
  });

  it('renders an add-item button with the required accessibility attributes', () => {
    const root = document.createElement('div');

    renderApp(root);

    const button = root.querySelector('.add-item-button');
    expect(button).not.toBeNull();
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('aria-label')).toBe('Add item');
    expect(button?.getAttribute('aria-haspopup')).toBe('true');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(button?.getAttribute('aria-controls')).toBe('add-item-menu');
  });

  it('renders a hidden add-item menu with role="menu" on initial render', () => {
    const root = document.createElement('div');

    renderApp(root);

    const menu = root.querySelector('#add-item-menu');
    expect(menu).not.toBeNull();
    expect(menu?.getAttribute('role')).toBe('menu');
    expect((menu as HTMLElement).hidden).toBe(true);
  });

  it('renders exactly 5 menu items with the exact labels and order from ADD_ITEM_TYPES', () => {
    const root = document.createElement('div');

    renderApp(root);

    const items = Array.from(root.querySelectorAll('[role="menuitem"]'));
    expect(items).toHaveLength(5);
    expect(items.map((item) => item.textContent)).toEqual([...ADD_ITEM_TYPES]);
  });

  it('does not leak the previous render\'s document-level listeners when called again (listener-leak regression)', () => {
    const root = document.createElement('div');

    renderApp(root);
    const staleButton = root.querySelector('#add-item-button') as HTMLButtonElement;

    renderApp(root);

    staleButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(staleButton.getAttribute('aria-expanded')).toBe('false');
  });
});
