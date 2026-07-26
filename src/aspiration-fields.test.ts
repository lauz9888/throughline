import { describe, it, expect, beforeEach } from 'vitest';
import { buildAspirationFields, type AspirationFieldsResult } from './aspiration-fields';

function appendFields(result: AspirationFieldsResult): void {
  document.body.append(result.titleField, result.descriptionField, result.reasonField);
}

describe('buildAspirationFields', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('produces ids prefixed with the given idPrefix, so two calls with different prefixes never collide', () => {
    const create = buildAspirationFields(document, 'aspiration');
    const edit = buildAspirationFields(document, 'edit-aspiration');

    expect(create.titleInput.id).toBe('aspiration-field-title');
    expect(edit.titleInput.id).toBe('edit-aspiration-field-title');
    expect(create.titleInput.id).not.toBe(edit.titleInput.id);
  });

  it('pre-fills titleInput/descriptionInput/reasonInput from initialValues', () => {
    const result = buildAspirationFields(document, 'edit-aspiration', {
      title: 'My title',
      description: 'My description',
      reason: 'My reason',
    });

    expect(result.titleInput.value).toBe('My title');
    expect(result.descriptionInput.value).toBe('My description');
    expect(result.reasonInput.value).toBe('My reason');
  });

  it('leaves fields empty when initialValues is omitted (Create usage)', () => {
    const result = buildAspirationFields(document, 'aspiration');

    expect(result.titleInput.value).toBe('');
    expect(result.descriptionInput.value).toBe('');
    expect(result.reasonInput.value).toBe('');
  });

  it('does not build or return any Links-related fields (Requirement 6)', () => {
    const result = buildAspirationFields(document, 'aspiration') as unknown as Record<
      string,
      unknown
    >;

    expect(result.linksFieldset).toBeUndefined();
    expect(result.goalsRadio).toBeUndefined();
    expect(result.habitsRadio).toBeUndefined();
    expect(result.linksEmptyMessage).toBeUndefined();
    expect(result.linksIcon).toBeUndefined();
    expect(result.linksTooltip).toBeUndefined();
    expect(result.getSelectedLinkType).toBeUndefined();
    expect(result.updateLinksState).toBeUndefined();
  });

  it('isTooltipOpen() starts false, and toggling an icon opens its tooltip', () => {
    const result = buildAspirationFields(document, 'aspiration');
    appendFields(result);

    expect(result.isTooltipOpen()).toBe(false);

    result.titleIcon.click();

    expect(result.isTooltipOpen()).toBe(true);
    expect(result.titleTooltip.classList.contains('modal__tooltip-text--visible')).toBe(true);
  });

  it('toggling a different icon closes the first tooltip and opens the second (only one open at a time)', () => {
    const result = buildAspirationFields(document, 'aspiration');
    appendFields(result);

    result.titleIcon.click();
    result.descriptionIcon.click();

    expect(result.titleTooltip.classList.contains('modal__tooltip-text--visible')).toBe(false);
    expect(result.descriptionTooltip.classList.contains('modal__tooltip-text--visible')).toBe(true);
    expect(result.isTooltipOpen()).toBe(true);
  });

  it('hideOpenTooltip() closes whichever tooltip is open and returns true (Issue #66 regression)', () => {
    const result = buildAspirationFields(document, 'aspiration');
    appendFields(result);

    result.titleIcon.click();

    const closed = result.hideOpenTooltip();

    expect(closed).toBe(true);
    expect(result.isTooltipOpen()).toBe(false);
    expect(result.titleTooltip.classList.contains('modal__tooltip-text--visible')).toBe(false);
    expect(result.titleIcon.getAttribute('aria-expanded')).toBe('false');
  });

  it('hideOpenTooltip() is a no-op returning false when nothing is open (Issue #66 regression)', () => {
    const result = buildAspirationFields(document, 'aspiration');
    appendFields(result);

    const closed = result.hideOpenTooltip();

    expect(closed).toBe(false);
    expect(result.isTooltipOpen()).toBe(false);
  });

  it('handleDocumentClickForTooltip closes an open tooltip on a click outside both its icon and its text', () => {
    const result = buildAspirationFields(document, 'aspiration');
    appendFields(result);
    document.addEventListener('click', result.handleDocumentClickForTooltip);

    try {
      result.titleIcon.click();
      expect(result.isTooltipOpen()).toBe(true);

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(result.isTooltipOpen()).toBe(false);
    } finally {
      document.removeEventListener('click', result.handleDocumentClickForTooltip);
    }
  });

  // Note: this deliberately does not also assert "a second click on the icon leaves the tooltip
  // open" — re-clicking `titleIcon` itself hits its own toggle-click listener (a separate code
  // path from `handleDocumentClickForTooltip`), and toggling the same icon a second time is
  // legitimately supposed to *close* the tooltip (see the required, must-not-break coverage at
  // `src/aspiration-modal.test.ts:455-479`, "...toggles on click"). Clicking the tooltip text
  // itself has no such toggle listener, so it's the case that actually isolates and exercises
  // `handleDocumentClickForTooltip`'s "click inside the tooltip content" branch.
  it('handleDocumentClickForTooltip does nothing on a click inside the tooltip text itself', () => {
    const result = buildAspirationFields(document, 'aspiration');
    appendFields(result);
    document.addEventListener('click', result.handleDocumentClickForTooltip);

    try {
      result.titleIcon.click();
      expect(result.isTooltipOpen()).toBe(true);

      result.titleTooltip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(result.isTooltipOpen()).toBe(true);
    } finally {
      document.removeEventListener('click', result.handleDocumentClickForTooltip);
    }
  });
});
