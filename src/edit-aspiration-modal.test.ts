import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { axe } from 'jest-axe';
import { initEditAspirationModal } from './edit-aspiration-modal';
import { readAspirations, type Aspiration } from './aspiration-storage';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

type ModalInstance = ReturnType<typeof initEditAspirationModal>;

let currentModal: ModalInstance | undefined;

function makeAspiration(overrides: Partial<Aspiration> = {}): Aspiration {
  return {
    id: 'aspiration-1',
    title: 'Original title',
    description: 'Original description',
    reason: 'Original reason',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTriggerTile(aspiration: Aspiration): HTMLButtonElement {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'aspiration-tile';
  tile.dataset.aspirationId = aspiration.id;
  tile.textContent = aspiration.title;
  return tile;
}

function seedStorage(aspiration: Aspiration): void {
  window.localStorage.setItem('throughline:aspirations', JSON.stringify([aspiration]));
}

function buildFixture(): { root: HTMLElement; gridContainer: HTMLElement } {
  const root = document.createElement('div');
  root.id = 'app';

  const gridContainer = document.createElement('section');
  gridContainer.className = 'aspiration-grid-section';
  gridContainer.tabIndex = -1;

  root.append(gridContainer);
  document.body.append(root);

  return { root, gridContainer };
}

function setup(onChange: () => void = vi.fn()): {
  root: HTMLElement;
  gridContainer: HTMLElement;
  modal: ModalInstance;
} {
  const { root, gridContainer } = buildFixture();
  const modal = initEditAspirationModal({
    root,
    gridContainer,
    storage: window.localStorage,
    onChange,
  });
  currentModal = modal;
  return { root, gridContainer, modal };
}

function openWithTile(
  modal: ModalInstance,
  gridContainer: HTMLElement,
  aspiration: Aspiration,
): HTMLButtonElement {
  const tile = makeTriggerTile(aspiration);
  gridContainer.append(tile);
  modal.open(aspiration, tile);
  return tile;
}

function getDialog(): HTMLElement {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error('Expected an open [role="dialog"] in document.body');
  return dialog;
}

function getAlertDialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="alertdialog"]');
}

function setValue(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('initEditAspirationModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  afterEach(() => {
    currentModal?.destroy();
    currentModal = undefined;
    document.body.innerHTML = '';
    document.body.inert = false;
    window.localStorage.clear();
  });

  it('inserts one [role="dialog"] with aria-modal and aria-labelledby resolving to "Edit Aspiration" (Requirement 9)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();

    openWithTile(modal, gridContainer, aspiration);

    const dialogs = document.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
    const dialog = dialogs[0] as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Edit Aspiration');
  });

  it('pre-fills Title/Description/Reason from the passed aspiration; Links radios start unchecked (Requirement 10)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();

    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!;
    const descriptionInput = dialog.querySelector<HTMLTextAreaElement>(
      'textarea[id$="field-description"]',
    )!;
    const reasonInput = dialog.querySelector<HTMLTextAreaElement>(
      'textarea[id$="field-reason"]',
    )!;
    const goalsRadio = dialog.querySelector<HTMLInputElement>('input[id$="link-goals"]')!;
    const habitsRadio = dialog.querySelector<HTMLInputElement>('input[id$="link-habits"]')!;

    expect(titleInput.value).toBe(aspiration.title);
    expect(descriptionInput.value).toBe(aspiration.description);
    expect(reasonInput.value).toBe(aspiration.reason);
    expect(goalsRadio.checked).toBe(false);
    expect(habitsRadio.checked).toBe(false);
  });

  it('Save starts disabled (Requirement 13)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();

    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;
    expect(saveButton.disabled).toBe(true);
  });

  it('Save enables when Title differs from the loaded value, and disables again when reverted (Requirement 14)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    setValue(titleInput, 'Changed title');
    expect(saveButton.disabled).toBe(false);

    setValue(titleInput, aspiration.title);
    expect(saveButton.disabled).toBe(true);
  });

  it('Save enables when Description differs from the loaded value, and disables again when reverted (Requirement 14)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const descriptionInput = dialog.querySelector<HTMLTextAreaElement>(
      'textarea[id$="field-description"]',
    )!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    setValue(descriptionInput, 'Changed description');
    expect(saveButton.disabled).toBe(false);

    setValue(descriptionInput, aspiration.description);
    expect(saveButton.disabled).toBe(true);
  });

  it('Save enables when Reason differs from the loaded value, and disables again when reverted (Requirement 14)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const reasonInput = dialog.querySelector<HTMLTextAreaElement>('textarea[id$="field-reason"]')!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    setValue(reasonInput, 'Changed reason');
    expect(saveButton.disabled).toBe(false);

    setValue(reasonInput, aspiration.reason);
    expect(saveButton.disabled).toBe(true);
  });

  it('Save enables when a Links radio is selected, and disables again when deselected (Requirement 14)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const goalsRadio = dialog.querySelector<HTMLInputElement>('input[id$="link-goals"]')!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    goalsRadio.click();
    expect(saveButton.disabled).toBe(false);

    goalsRadio.click(); // re-click deselects
    expect(saveButton.disabled).toBe(true);
  });

  it('editing Title to whitespace-only keeps Save disabled even though it differs from the loaded Title (Requirement 12)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    setValue(titleInput, '   ');

    expect(saveButton.disabled).toBe(true);
  });

  it('saving persists trimmed field values against the same id, preserving createdAt, calls onChange, and closes the dialog (Requirement 15, 16)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const onChange = vi.fn();
    const { gridContainer, modal } = setup(onChange);
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!, '  Updated title  ');
    setValue(
      dialog.querySelector<HTMLTextAreaElement>('textarea[id$="field-description"]')!,
      '  Updated description  ',
    );
    setValue(
      dialog.querySelector<HTMLTextAreaElement>('textarea[id$="field-reason"]')!,
      '  Updated reason  ',
    );
    dialog.querySelector<HTMLButtonElement>('.modal__save')!.click();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);

    const stored = readAspirations(window.localStorage);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe(aspiration.id);
    expect(stored[0]!.createdAt).toBe(aspiration.createdAt);
    expect(stored[0]!.title).toBe('Updated title');
    expect(stored[0]!.description).toBe('Updated description');
    expect(stored[0]!.reason).toBe('Updated reason');
  });

  it('the Delete button has an accessible name identifying its destructive purpose (Requirement 17)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const deleteButton = dialog.querySelector<HTMLButtonElement>('.modal__delete')!;
    expect(deleteButton.getAttribute('aria-label')).toBe('Delete aspiration');
  });

  it('clicking Delete opens a role="alertdialog" without deleting anything yet (Requirement 18)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    dialog.querySelector<HTMLButtonElement>('.modal__delete')!.click();

    const confirmDialog = getAlertDialog();
    expect(confirmDialog).not.toBeNull();
    expect(confirmDialog!.getAttribute('aria-modal')).toBe('true');

    const stored = readAspirations(window.localStorage);
    expect(stored.find((a) => a.id === aspiration.id)).toBeDefined();
  });

  it('canceling the delete-confirm returns to the unchanged Edit modal, without deleting, and focuses the Delete button (Requirement 19, 21, Issue #76)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const deleteButton = dialog.querySelector<HTMLButtonElement>('.modal__delete')!;
    deleteButton.click();

    const confirmDialog = getAlertDialog()!;
    confirmDialog.querySelector<HTMLButtonElement>('.modal__cancel')!.click();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(getDialog()).toBeTruthy();
    expect(readAspirations(window.localStorage).find((a) => a.id === aspiration.id)).toBeDefined();
    expect(document.activeElement).toBe(deleteButton);
  });

  it('confirming deletion removes the record, calls onChange, closes both dialogs, and focuses the grid container (Requirement 20, accessibility 8)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const onChange = vi.fn();
    const { gridContainer, modal } = setup(onChange);
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    dialog.querySelector<HTMLButtonElement>('.modal__delete')!.click();
    const confirmDialog = getAlertDialog()!;
    confirmDialog.querySelector<HTMLButtonElement>('.modal__delete-confirm')!.click();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(readAspirations(window.localStorage).find((a) => a.id === aspiration.id)).toBeUndefined();
    expect(document.activeElement).toBe(gridContainer);
  });

  it('closes immediately with no confirmation when the close (X) button is activated and fields are unchanged (Requirement 23)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    const tile = openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    dialog.querySelector<HTMLButtonElement>('.modal__close')!.click();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(tile);
  });

  it('opens the unsaved-changes confirm when closing while dirty, and "Discard" closes without saving (Requirement 22)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!, 'Changed title');
    dialog.querySelector<HTMLButtonElement>('.modal__close')!.click();

    const confirmDialog = getAlertDialog();
    expect(confirmDialog).not.toBeNull();

    confirmDialog!.querySelector<HTMLButtonElement>('.modal__discard')!.click();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(readAspirations(window.localStorage).find((a) => a.id === aspiration.id)?.title).toBe(
      'Original title',
    );
  });

  it('"Keep editing" closes only the unsaved-changes confirm, leaves fields intact, and focuses the close button (Requirement 21, Issue #76)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const closeButton = dialog.querySelector<HTMLButtonElement>('.modal__close')!;
    setValue(dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!, 'Changed title');
    closeButton.click();

    const confirmDialog = getAlertDialog()!;
    confirmDialog.querySelector<HTMLButtonElement>('.modal__cancel')!.click();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    const stillOpen = getDialog();
    expect(stillOpen.querySelector<HTMLInputElement>('input[id$="field-title"]')!.value).toBe(
      'Changed title',
    );
    expect(document.activeElement).toBe(closeButton);
  });

  it('Escape while the unsaved-changes confirm is open cancels only the confirm (Issue #78)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const closeButton = dialog.querySelector<HTMLButtonElement>('.modal__close')!;
    setValue(dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!, 'Changed title');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(getAlertDialog()).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(getAlertDialog()).toBeNull();
    const stillOpen = getDialog();
    expect(stillOpen.querySelector<HTMLInputElement>('input[id$="field-title"]')!.value).toBe(
      'Changed title',
    );
    expect(readAspirations(window.localStorage).find((a) => a.id === aspiration.id)?.title).toBe(
      'Original title',
    );
    expect(document.activeElement).toBe(closeButton);
  });

  it('Escape while the delete-confirm is open cancels only the confirm (Issue #78)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const deleteButton = dialog.querySelector<HTMLButtonElement>('.modal__delete')!;
    deleteButton.click();
    expect(getAlertDialog()).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(getAlertDialog()).toBeNull();
    expect(getDialog()).toBeTruthy();
    expect(readAspirations(window.localStorage).find((a) => a.id === aspiration.id)).toBeDefined();
    expect(document.activeElement).toBe(deleteButton);
  });

  it('Escape while a tooltip is open closes only the tooltip, not the confirm or the modal (Issue #80)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const titleIcon = dialog.querySelector<HTMLButtonElement>('.modal__field .modal__info')!;
    const tooltipId = titleIcon.getAttribute('aria-controls')!;
    const tooltipText = document.getElementById(tooltipId)!;

    titleIcon.click();
    expect(tooltipText.classList.contains('modal__tooltip-text--visible')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(tooltipText.classList.contains('modal__tooltip-text--visible')).toBe(false);
    expect(titleIcon.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("traps focus through the new Delete button: Tab from Save reaches Delete, then wraps to close; Shift+Tab from close wraps back to Delete (Issue #79)", () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!, 'Changed title'); // enables Save

    const closeButton = dialog.querySelector<HTMLButtonElement>('.modal__close')!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;
    const deleteButton = dialog.querySelector<HTMLButtonElement>('.modal__delete')!;

    saveButton.focus();
    saveButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(deleteButton);

    deleteButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(closeButton);

    closeButton.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(document.activeElement).toBe(deleteButton);
  });

  it('moves focus to the Title field immediately after open() (accessibility 6)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!;
    expect(document.activeElement).toBe(titleInput);
  });

  it('after Save, focus lands on the re-rendered tile matching the edited id, not the stale pre-save triggerTile node (Issue #68)', () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);

    const { root, gridContainer } = buildFixture();
    let originalTile!: HTMLButtonElement;
    let newTile!: HTMLButtonElement;

    const modal = initEditAspirationModal({
      root,
      gridContainer,
      storage: window.localStorage,
      onChange: () => {
        newTile = document.createElement('button');
        newTile.type = 'button';
        newTile.className = 'aspiration-tile';
        newTile.dataset.aspirationId = aspiration.id;
        newTile.textContent = 'Updated title';
        originalTile.replaceWith(newTile);
      },
    });
    currentModal = modal;

    originalTile = makeTriggerTile(aspiration);
    gridContainer.append(originalTile);
    modal.open(aspiration, originalTile);

    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!, 'Updated title');
    dialog.querySelector<HTMLButtonElement>('.modal__save')!.click();

    const refreshedTile = gridContainer.querySelector<HTMLButtonElement>(
      `[data-aspiration-id="${aspiration.id}"]`,
    )!;
    expect(refreshedTile).not.toBe(originalTile);
    expect(refreshedTile).toBe(newTile);
    expect(document.activeElement).toBe(refreshedTile);
  });

  it('has no automatically detectable WCAG violations with the Edit modal open (populated fields)', async () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const results = await axe(document.body, {
      runOnly: { type: 'tag', values: WCAG_TAGS },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('has no automatically detectable WCAG violations with the unsaved-changes confirm open', async () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!, 'Changed title');
    dialog.querySelector<HTMLButtonElement>('.modal__close')!.click();

    const results = await axe(document.body, {
      runOnly: { type: 'tag', values: WCAG_TAGS },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('has no automatically detectable WCAG violations with the delete-confirm open', async () => {
    const aspiration = makeAspiration();
    seedStorage(aspiration);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, aspiration);

    const dialog = getDialog();
    dialog.querySelector<HTMLButtonElement>('.modal__delete')!.click();

    const results = await axe(document.body, {
      runOnly: { type: 'tag', values: WCAG_TAGS },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});
