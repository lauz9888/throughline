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
    fixture.items[4]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(document.activeElement).toBe(fixture.items[0]!);
  });

  it('moves focus to the previous menu item on ArrowUp, wrapping from the first to the last', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.items[0]!.focus();
    fixture.items[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    expect(document.activeElement).toBe(fixture.items[4]!);
  });

  it('opens the closed menu and focuses "Aspiration" on Enter from the trigger', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.focus();
    fixture.button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(fixture.items[0]!);
  });

  it('opens the closed menu and focuses "Aspiration" on Space from the trigger', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.focus();
    fixture.button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(fixture.items[0]!);
  });

  it('opens the closed menu and focuses "Aspiration" on ArrowDown from the trigger', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.focus();
    fixture.button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(fixture.items[0]!);
  });

  it('opens the closed menu and focuses "Habit" (not "Task") on ArrowUp from the trigger — regression test for the confirmed indexOf(-1) bug', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.focus();
    fixture.button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement!.textContent).toBe('Habit');
    expect(document.activeElement!.textContent).not.toBe('Task');
  });

  it('moves focus to "Aspiration" on ArrowDown from the trigger when the menu is already open and focus is still on the button', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.button.focus();
    fixture.button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(document.activeElement).toBe(fixture.items[0]!);
  });

  it('moves focus to "Habit" on ArrowUp from the trigger when the menu is already open and focus is still on the button — regression test', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.button.focus();
    fixture.button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    expect(document.activeElement!.textContent).toBe('Habit');
    expect(document.activeElement!.textContent).not.toBe('Task');
  });

  it('moves focus from "Goal" to "Milestone" on ArrowDown between two middle items', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.items[1]!.focus(); // "Goal"
    fixture.items[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(document.activeElement).toBe(fixture.items[2]!); // "Milestone"
  });

  it('moves focus from "Milestone" to "Goal" on ArrowUp between two middle items', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.items[2]!.focus(); // "Milestone"
    fixture.items[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    expect(document.activeElement).toBe(fixture.items[1]!); // "Goal"
  });

  it('moves focus to "Aspiration" on Home from a non-boundary item', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.items[3]!.focus(); // "Task"
    fixture.items[3]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));

    expect(document.activeElement).toBe(fixture.items[0]!);
  });

  it('moves focus to "Habit" on End from a non-boundary item', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.items[1]!.focus(); // "Goal"
    fixture.items[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));

    expect(document.activeElement).toBe(fixture.items[4]!);
  });

  it('maintains a roving tabindex that tracks the focused item and resets to the first item on every closed→open transition', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();

    expect(fixture.items[0]!.tabIndex).toBe(0);
    expect(fixture.items[1]!.tabIndex).toBe(-1);
    expect(fixture.items[2]!.tabIndex).toBe(-1);
    expect(fixture.items[3]!.tabIndex).toBe(-1);
    expect(fixture.items[4]!.tabIndex).toBe(-1);

    fixture.items[0]!.focus();
    fixture.items[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(fixture.items[0]!.tabIndex).toBe(-1);
    expect(fixture.items[1]!.tabIndex).toBe(0);
    expect(fixture.items[2]!.tabIndex).toBe(-1);
    expect(fixture.items[3]!.tabIndex).toBe(-1);
    expect(fixture.items[4]!.tabIndex).toBe(-1);

    // Close and reopen: the roving position must reset to the first item, not remain on
    // whichever item held it before the close.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.button.click();

    expect(fixture.items[0]!.tabIndex).toBe(0);
    expect(fixture.items[1]!.tabIndex).toBe(-1);
  });

  it('does not close the menu synchronously on a Tab keydown alone (Issue #60 regression guard: closing is deferred to focusout)', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.items[2]!.focus(); // "Milestone"
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    fixture.items[2]!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the menu without refocusing the button when focusout fires with a relatedTarget outside the menu (Tab exit)', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.items[2]!.focus(); // "Milestone"
    fixture.items[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    fixture.items[2]!.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
    );

    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).not.toBe(fixture.button);
  });

  it('closes the menu the same way on Shift+Tab exit (no preventDefault on keydown, close deferred to focusout)', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.items[2]!.focus(); // "Milestone"
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    fixture.items[2]!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(fixture.menu.hidden).toBe(false);

    fixture.items[2]!.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
    );

    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).not.toBe(fixture.button);
  });

  it('does not close the menu when focusout fires with a relatedTarget still inside the menu (ordinary arrow-key navigation)', () => {
    initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    fixture.button.click();
    fixture.items[1]!.focus(); // "Goal"
    fixture.items[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(document.activeElement).toBe(fixture.items[2]!); // "Milestone"
    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.button.getAttribute('aria-expanded')).toBe('true');
  });

  it('removes the button-level and item-level keydown listeners (and the menu focusout listener) when destroy() is called', () => {
    const destroy = initAddItemMenu({ button: fixture.button, menu: fixture.menu });

    destroy();

    // ArrowDown on the trigger (menu closed) no longer opens the menu or moves focus.
    fixture.button.focus();
    fixture.button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(fixture.menu.hidden).toBe(true);
    expect(document.activeElement).not.toBe(fixture.items[0]!);

    // Manually leave the menu open, mirroring the existing Escape cleanup test's pattern,
    // since destroy() itself does not close the menu.
    fixture.menu.hidden = false;
    fixture.button.setAttribute('aria-expanded', 'true');
    fixture.items[2]!.focus();

    // ArrowDown on an item no longer moves focus to the next item.
    fixture.items[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(document.activeElement).toBe(fixture.items[2]!);

    // A focusout with an out-of-menu relatedTarget no longer closes the menu.
    fixture.items[2]!.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
    );

    expect(fixture.menu.hidden).toBe(false);
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

  it("invokes onItemSelect with the clicked item's label after the existing close/refocus behavior", () => {
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

  it("invokes onItemSelect with a different item's label, confirming the callback is generic and not hardcoded to Aspiration", () => {
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
