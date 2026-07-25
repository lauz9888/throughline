import { describe, it, expect, beforeEach } from 'vitest';
import { createFocusTrap } from './focus-trap';

function buildFixture() {
  const container = document.createElement('div');

  const first = document.createElement('button');
  first.type = 'button';
  first.textContent = 'First';

  const middle = document.createElement('input');
  middle.type = 'text';

  const last = document.createElement('button');
  last.type = 'button';
  last.textContent = 'Last';

  container.append(first, middle, last);
  document.body.append(container);

  return { container, first, middle, last };
}

describe('createFocusTrap', () => {
  let fixture: ReturnType<typeof buildFixture>;

  beforeEach(() => {
    document.body.innerHTML = '';
    fixture = buildFixture();
  });

  it('wraps Tab on the last focusable element back to the first', () => {
    createFocusTrap(fixture.container);

    fixture.last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    fixture.container.dispatchEvent(event);

    expect(document.activeElement).toBe(fixture.first);
    expect(event.defaultPrevented).toBe(true);
  });

  it('wraps Shift+Tab on the first focusable element back to the last', () => {
    createFocusTrap(fixture.container);

    fixture.first.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    fixture.container.dispatchEvent(event);

    expect(document.activeElement).toBe(fixture.last);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores non-Tab keys (no preventDefault, no focus change)', () => {
    createFocusTrap(fixture.container);

    fixture.last.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    fixture.container.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(fixture.last);
  });

  it('does not wrap focus once the returned cleanup function has been called', () => {
    const cleanup = createFocusTrap(fixture.container);
    cleanup();

    fixture.last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    fixture.container.dispatchEvent(event);

    expect(document.activeElement).toBe(fixture.last);
    expect(event.defaultPrevented).toBe(false);
  });

  it("treats the checked radio in a same-name group as the group's tab stop, not the first one in DOM order", () => {
    document.body.innerHTML = '';
    const container = document.createElement('div');

    const radioA = document.createElement('input');
    radioA.type = 'radio';
    radioA.name = 'group';

    const radioB = document.createElement('input');
    radioB.type = 'radio';
    radioB.name = 'group';
    radioB.checked = true; // checked, but not first in DOM order

    const last = document.createElement('button');
    last.type = 'button';
    last.textContent = 'Last';

    container.append(radioA, radioB, last);
    document.body.append(container);

    createFocusTrap(container);

    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    container.dispatchEvent(event);

    // Tab from the last element should wrap to the group's one real tab
    // stop — the checked radio (radioB) — not radioA, which is unchecked
    // and therefore not a native tab stop despite being first in DOM order.
    expect(document.activeElement).toBe(radioB);
    expect(event.defaultPrevented).toBe(true);
  });
});
