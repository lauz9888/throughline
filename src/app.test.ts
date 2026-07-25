import { describe, it, expect } from 'vitest';
import { axe } from 'jest-axe';
import { renderApp, ADD_ITEM_TYPES } from './app';

// Scope to actual WCAG 2.1 A/AA success criteria (not axe-core's broader
// "best-practice" rules like landmark coverage) since renderApp mounts a
// fragment, not a full document.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

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

  it("does not leak the previous render's document-level listeners when called again (listener-leak regression)", () => {
    const root = document.createElement('div');

    renderApp(root);
    const staleButton = root.querySelector('#add-item-button') as HTMLButtonElement;

    renderApp(root);

    staleButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(staleButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('has no automatically detectable WCAG violations with the menu closed', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    try {
      renderApp(root);
      const results = await axe(root, {
        runOnly: { type: 'tag', values: WCAG_TAGS },
        // jsdom has no real layout/rendering engine, so color-contrast checks
        // throw rather than evaluate; the e2e axe scans cover contrast in a
        // real browser instead.
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(results).toHaveNoViolations();
    } finally {
      root.remove();
    }
  });

  it('has no automatically detectable WCAG violations with the menu open', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    try {
      renderApp(root);
      root.querySelector<HTMLButtonElement>('.add-item-button')!.click();

      const results = await axe(root, {
        runOnly: { type: 'tag', values: WCAG_TAGS },
        // jsdom has no real layout/rendering engine, so color-contrast checks
        // throw rather than evaluate; the e2e axe scans cover contrast in a
        // real browser instead.
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(results).toHaveNoViolations();
    } finally {
      root.remove();
    }
  });
});
