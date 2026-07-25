import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initAddItemMenu } from './add-item-menu';

const ITEM_LABELS = ['Aspiration', 'Goal', 'Milestone', 'Task', 'Habit'];

function buildFixture() {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'add-item-button';
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'add-item-menu');
  button.setAttribute('aria-label', 'Add item');

  const menu = document.createElement('div');
  menu.id = 'add-item-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  ITEM_LABELS.forEach((label) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.textContent = label;
    menu.append(item);
  });

  document.body.append(button, menu);

  return {
    button,
    menu,
    items: Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')),
  };
}

describe('initAddItemMenu', () => {
  let fixture: ReturnType<typeof buildFixture>;

  beforeEach(() => {
    document.body.innerHTML = '';
    fixture = buildFixture();
  });

  it('leaves initial hidden/aria-expanded state untouched on call', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the menu when the button is clicked once', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();

    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('true');
  });

  it('toggles the menu closed on a second button click', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.button.click();

    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the menu and returns focus to the button when a menu item is clicked', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.items[0]!.click();

    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(fixture.button);
  });

  it('closes the menu when clicking an unrelated element outside the button and menu', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not close the menu when clicking the menu container itself (not a menuitem)', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.menu.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the menu and returns focus to the button on Escape', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(fixture.button);
  });

  it('is a no-op when Escape is dispatched while the menu is already closed', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    expect(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }).not.toThrow();

    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('false');
  });

  it('moves focus to the next menu item on ArrowDown, wrapping from the last to the first', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.items[4]!.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(document.activeElement).toBe(fixture.items[0]!);
  });

  it('moves focus to the previous menu item on ArrowUp, wrapping from the first to the last', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.items[0]!.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    expect(document.activeElement).toBe(fixture.items[4]!);
  });

  it('removes the document-level listeners when the returned destroy function is called', () => {
    const destroy = initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    destroy();

    // Manually leave the menu open, since destroy() itself does not close it.
    fixture.menu.hidden = false;
    fixture.button.setAttribute('aria-expanded', 'true');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('true');
  });

  it('invokes onItemSelect with the clicked item\'s label after the existing close/refocus behavior', () => {
    const onItemSelect = vi.fn();
    initAddItemMenu({ button: fixture.button, menu: fixture.menu, onItemSelect });

    fixture.button.click();
    fixture.items[0]!.click(); // "Aspiration"

    expect(onItemSelect).toHaveBeenCalledTimes(1);
    expect(onItemSelect).toHaveBeenCalledWith('Aspiration');
    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(fixture.button);
  });

  it('invokes onItemSelect with a different item\'s label, confirming the callback is generic and not hardcoded to Aspiration', () => {
    const onItemSelect = vi.fn();
    initAddItemMenu({ button: fixture.button, menu: fixture.menu, onItemSelect });

    fixture.button.click();
    fixture.items[1]!.click(); // "Goal"

    expect(onItemSelect).toHaveBeenCalledWith('Goal');
  });

  it('does not throw when onItemSelect is omitted (existing behavior preserved)', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();

    expect(() => fixture.items[0]!.click()).not.toThrow();
    expect(fixture.menu.hidden).toBe(true);
  });
});
