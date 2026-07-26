import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { axe } from 'jest-axe';
import { renderApp, ADD_ITEM_TYPES } from './app';

// Scope to actual WCAG 2.1 A/AA success criteria (not axe-core's broader
// "best-practice" rules like landmark coverage) since renderApp mounts a
// fragment, not a full document.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

describe('renderApp', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders exactly two top-level children (the top bar and the aspiration grid section) into an empty root', () => {
    const root = document.createElement('div');

    renderApp(root);

    expect(root.children.length).toBe(2);
  });

  it('renders an h1.wordmark with text "throughline" inside the top bar', () => {
    const root = document.createElement('div');

    renderApp(root);

    const wordmark = root.querySelector('h1.wordmark');
    expect(wordmark).not.toBeNull();
    expect(wordmark?.textContent).toBe('throughline');
  });

  it('keeps exactly two children when called twice (idempotency guard)', () => {
    const root = document.createElement('div');

    renderApp(root);
    renderApp(root);

    expect(root.children.length).toBe(2);
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

  it('renders exactly 4 menu items with the exact labels and order from ADD_ITEM_TYPES', () => {
    const root = document.createElement('div');

    renderApp(root);

    const items = Array.from(root.querySelectorAll('[role="menuitem"]'));
    expect(items).toHaveLength(4);
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

  it('has no automatically detectable WCAG violations with the grid populated with tiles', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    try {
      window.localStorage.setItem(
        'throughline:aspirations',
        JSON.stringify([
          {
            id: '1',
            title: 'Live a healthy life',
            description: '',
            reason: '',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ]),
      );
      renderApp(root);

      // Guard: this scan is only meaningful for the "grid populated" state it claims to cover.
      expect(root.querySelectorAll('.aspiration-tile')).toHaveLength(1);

      const results = await axe(root, {
        runOnly: { type: 'tag', values: WCAG_TAGS },
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(results).toHaveNoViolations();
    } finally {
      root.remove();
    }
  });

  it('has no automatically detectable WCAG violations with the grid in the empty state', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    try {
      renderApp(root);

      // Guard: this scan is only meaningful for the "grid empty state" it claims to cover.
      expect(root.querySelector('.aspiration-grid__empty')).not.toBeNull();

      const results = await axe(root, {
        runOnly: { type: 'tag', values: WCAG_TAGS },
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(results).toHaveNoViolations();
    } finally {
      root.remove();
    }
  });

  it('has no automatically detectable WCAG violations with the Edit Aspiration modal open', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    try {
      window.localStorage.setItem(
        'throughline:aspirations',
        JSON.stringify([
          {
            id: '1',
            title: 'Live a healthy life',
            description: '',
            reason: '',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ]),
      );
      renderApp(root);
      root.querySelector<HTMLButtonElement>('.aspiration-tile')!.click();

      const results = await axe(document.body, {
        runOnly: { type: 'tag', values: WCAG_TAGS },
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(results).toHaveNoViolations();
    } finally {
      document.body.innerHTML = '';
      document.body.inert = false;
    }
  });
});

describe('renderApp — aspiration grid wiring', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.body.inert = false;
    window.localStorage.clear();
  });

  it('renders tiles for aspirations already present in localStorage before any interaction', () => {
    window.localStorage.setItem(
      'throughline:aspirations',
      JSON.stringify([
        {
          id: '1',
          title: 'Live a healthy life',
          description: '',
          reason: '',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]),
    );

    const root = document.createElement('div');
    renderApp(root);

    const tiles = root.querySelectorAll('.aspiration-tile');
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.textContent).toBe('Live a healthy life');
  });

  it('clicking a tile opens a dialog labelled "Edit Aspiration" pre-filled with that record\'s data', () => {
    window.localStorage.setItem(
      'throughline:aspirations',
      JSON.stringify([
        {
          id: '1',
          title: 'Live a healthy life',
          description: 'A description',
          reason: 'A reason',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]),
    );

    const root = document.createElement('div');
    document.body.append(root);
    renderApp(root);

    root.querySelector<HTMLButtonElement>('.aspiration-tile')!.click();

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const labelledBy = dialog!.getAttribute('aria-labelledby');
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Edit Aspiration');

    const titleInput = dialog!.querySelector<HTMLInputElement>('input[id$="field-title"]')!;
    expect(titleInput.value).toBe('Live a healthy life');
  });

  it("saving an edit updates the grid's DOM without a fresh renderApp() call", () => {
    window.localStorage.setItem(
      'throughline:aspirations',
      JSON.stringify([
        {
          id: '1',
          title: 'Original title',
          description: '',
          reason: '',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]),
    );

    const root = document.createElement('div');
    document.body.append(root);
    renderApp(root);

    root.querySelector<HTMLButtonElement>('.aspiration-tile')!.click();
    const dialog = document.querySelector('[role="dialog"]')!;
    const titleInput = dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!;
    titleInput.value = 'Updated title';
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    dialog.querySelector<HTMLButtonElement>('.modal__save')!.click();

    const tiles = root.querySelectorAll('.aspiration-tile');
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.textContent).toBe('Updated title');
  });

  it("confirming a delete updates the grid's DOM without a fresh renderApp() call", () => {
    window.localStorage.setItem(
      'throughline:aspirations',
      JSON.stringify([
        {
          id: '1',
          title: 'To delete',
          description: '',
          reason: '',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]),
    );

    const root = document.createElement('div');
    document.body.append(root);
    renderApp(root);

    root.querySelector<HTMLButtonElement>('.aspiration-tile')!.click();
    const dialog = document.querySelector('[role="dialog"]')!;
    dialog.querySelector<HTMLButtonElement>('.modal__delete')!.click();
    const confirmDialog = document.querySelector('[role="alertdialog"]')!;
    confirmDialog.querySelector<HTMLButtonElement>('.modal__delete-confirm')!.click();

    expect(root.querySelectorAll('.aspiration-tile')).toHaveLength(0);
    expect(root.querySelector('.aspiration-grid__empty')).not.toBeNull();
  });

  it('creating an aspiration via the Create modal adds its tile to the grid immediately, with no fresh renderApp() call (Issue #74)', () => {
    const root = document.createElement('div');
    document.body.append(root);
    renderApp(root);

    root.querySelector<HTMLButtonElement>('.add-item-button')!.click();
    const items = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const aspirationItem = items.find((item) => item.textContent === 'Aspiration');
    if (!aspirationItem) throw new Error('Expected an "Aspiration" menu item');
    aspirationItem.click();

    const dialog = document.querySelector('[role="dialog"]')!;
    const titleInput = dialog.querySelector<HTMLInputElement>('#aspiration-field-title')!;
    titleInput.value = 'Newly created aspiration';
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    dialog.querySelector<HTMLButtonElement>('.modal__save')!.click();

    const tiles = Array.from(root.querySelectorAll('.aspiration-tile'));
    expect(tiles.some((tile) => tile.textContent === 'Newly created aspiration')).toBe(true);
  });
});

describe('renderApp — Aspiration modal wiring', () => {
  afterEach(() => {
    // The modal portals to document.body (a sibling of root, not a descendant), so its DOM
    // must be cleaned up here explicitly rather than by removing root alone.
    document.body.innerHTML = '';
    document.body.inert = false;
  });

  function openMenuAndClickItem(root: HTMLElement, label: string): void {
    root.querySelector<HTMLButtonElement>('.add-item-button')!.click();
    const items = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const item = items.find((menuItem) => menuItem.textContent === label);
    if (!item) throw new Error(`No menu item found with label "${label}"`);
    item.click();
  }

  it('opens the Aspiration modal (portaled into document.body) when "Aspiration" is selected from the add-item menu', () => {
    const root = document.createElement('div');
    document.body.append(root);

    renderApp(root);
    openMenuAndClickItem(root, 'Aspiration');

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const labelledBy = dialog!.getAttribute('aria-labelledby');
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Create Aspiration');
  });

  it('does not open a second dialog when "Aspiration" is selected twice in a row (menu re-opened between clicks)', () => {
    const root = document.createElement('div');
    document.body.append(root);

    renderApp(root);
    openMenuAndClickItem(root, 'Aspiration');
    openMenuAndClickItem(root, 'Aspiration');

    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it.each(['Goal', 'Task', 'Habit'])(
    'does not open any dialog when "%s" is selected (still unwired)',
    (label) => {
      const root = document.createElement('div');
      document.body.append(root);

      renderApp(root);
      openMenuAndClickItem(root, label);

      expect(document.querySelector('[role="dialog"]')).toBeNull();
    },
  );
});
