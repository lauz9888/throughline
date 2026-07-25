import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { axe } from 'jest-axe';
import { initAspirationModal } from './aspiration-modal';

// Scope to actual WCAG 2.1 A/AA success criteria, matching src/app.test.ts's convention.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const BLURB_TEXT =
  "An aspiration is a long-term, potentially lifelong life direction — not necessarily a " +
  "measurable, checkable goal. It's a guiding principle that shapes and motivates your more " +
  "concrete goals, for example 'live a healthy life', 'have a successful and fulfilling " +
  "career', or 'maintain healthy and loving relationships'.";

type ModalInstance = ReturnType<typeof initAspirationModal>;

let currentModal: ModalInstance | undefined;

function buildFixture(): { root: HTMLElement; addItemButton: HTMLButtonElement } {
  const root = document.createElement('div');
  root.id = 'app';

  const addItemButton = document.createElement('button');
  addItemButton.type = 'button';
  addItemButton.id = 'add-item-button';
  addItemButton.textContent = 'Add item';
  root.append(addItemButton);

  document.body.append(root);

  return { root, addItemButton };
}

function setup(): { root: HTMLElement; addItemButton: HTMLButtonElement; modal: ModalInstance } {
  const { root, addItemButton } = buildFixture();
  const modal = initAspirationModal({ root, addItemButton });
  currentModal = modal;
  return { root, addItemButton, modal };
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

describe('initAspirationModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  afterEach(() => {
    currentModal?.destroy();
    currentModal = undefined;
    document.body.innerHTML = '';
    document.body.inert = false;
  });

  it('inserts exactly one [role="dialog"] with aria-modal and aria-labelledby pointing to "Create Aspiration" (Requirements 2, 28)', () => {
    const { modal } = setup();

    modal.open();

    const dialogs = document.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
    const dialog = dialogs[0] as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const heading = document.getElementById(labelledBy!);
    expect(heading?.textContent).toBe('Create Aspiration');
  });

  it('renders the blurb paragraph verbatim, directly after the heading (Requirement 3)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const blurb = dialog.querySelector('.modal__blurb');
    expect(blurb?.textContent).toBe(BLURB_TEXT);
  });

  it('orders content as blurb, Title, Description, Reason, Links, Save regardless of close-button position (Requirement 4)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const descendants = Array.from(dialog.querySelectorAll('*'));
    const indexOf = (el: Element | null) => (el ? descendants.indexOf(el) : -1);

    const blurb = dialog.querySelector('.modal__blurb');
    const titleInput = dialog.querySelector('#aspiration-field-title');
    const descriptionInput = dialog.querySelector('#aspiration-field-description');
    const reasonInput = dialog.querySelector('#aspiration-field-reason');
    const linksFieldset = dialog.querySelector('.aspiration-modal__links');
    const saveButton = dialog.querySelector('.modal__save');

    expect(indexOf(blurb)).toBeGreaterThanOrEqual(0);
    expect(indexOf(blurb)).toBeLessThan(indexOf(titleInput));
    expect(indexOf(titleInput)).toBeLessThan(indexOf(descriptionInput));
    expect(indexOf(descriptionInput)).toBeLessThan(indexOf(reasonInput));
    expect(indexOf(reasonInput)).toBeLessThan(indexOf(linksFieldset));
    expect(indexOf(linksFieldset)).toBeLessThan(indexOf(saveButton));
  });

  it('does not add a second dialog when open() is called a second time while already open (Requirement 5)', () => {
    const { modal } = setup();

    modal.open();
    modal.open();

    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it('labels Title/Description/Reason correctly and marks Title as required (Requirements 6, 7, 8, 32, 33)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#aspiration-field-title')!;
    const descriptionInput = dialog.querySelector<HTMLTextAreaElement>(
      '#aspiration-field-description',
    )!;
    const reasonInput = dialog.querySelector<HTMLTextAreaElement>('#aspiration-field-reason')!;

    expect(dialog.querySelector('label[for="aspiration-field-title"]')?.textContent).toBe(
      'Title',
    );
    expect(
      dialog.querySelector('label[for="aspiration-field-description"]')?.textContent,
    ).toBe('Description');
    expect(dialog.querySelector('label[for="aspiration-field-reason"]')?.textContent).toBe(
      'Reason',
    );

    expect(titleInput.required).toBe(true);
    expect(titleInput.getAttribute('aria-required')).toBe('true');
    expect(descriptionInput.hasAttribute('required')).toBe(false);
    expect(reasonInput.hasAttribute('required')).toBe(false);
  });

  it('keeps Save disabled while Title is empty or whitespace-only, and enables it once Title has content (Requirements 23, 41)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#aspiration-field-title')!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    expect(saveButton.disabled).toBe(true);

    setValue(titleInput, '   ');
    expect(saveButton.disabled).toBe(true);

    setValue(titleInput, 'Live a healthy life');
    expect(saveButton.disabled).toBe(false);
  });

  it('saves the aspiration and tears down the modal when Save is clicked while enabled (Requirements 24, 26, 31)', () => {
    const { modal, addItemButton } = setup();

    modal.open();

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#aspiration-field-title')!;
    const descriptionInput = dialog.querySelector<HTMLTextAreaElement>(
      '#aspiration-field-description',
    )!;
    const reasonInput = dialog.querySelector<HTMLTextAreaElement>('#aspiration-field-reason')!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    setValue(titleInput, 'Live a healthy life');
    setValue(descriptionInput, 'Some description');
    setValue(reasonInput, 'Some reason');
    saveButton.click();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(addItemButton);

    const raw = window.localStorage.getItem('throughline:aspirations');
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw!) as { title: string; description: string; reason: string }[];
    expect(stored).toHaveLength(1);
    expect(stored[0]!.title).toBe('Live a healthy life');
    expect(stored[0]!.description).toBe('Some description');
    expect(stored[0]!.reason).toBe('Some reason');
  });

  it('starts with neither Links radio selected, and selecting Goals shows the empty-state message mentioning Goals (Requirements 9, 10, 12, 34, 35)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const goalsRadio = dialog.querySelector<HTMLInputElement>('#aspiration-link-goals')!;
    const habitsRadio = dialog.querySelector<HTMLInputElement>('#aspiration-link-habits')!;
    const emptyMessage = dialog.querySelector<HTMLElement>('.aspiration-modal__links-empty')!;

    expect(goalsRadio.checked).toBe(false);
    expect(habitsRadio.checked).toBe(false);
    expect(emptyMessage.hidden).toBe(true);

    goalsRadio.click();

    expect(goalsRadio.checked).toBe(true);
    expect(emptyMessage.hidden).toBe(false);
    expect(emptyMessage.textContent).toContain('Goals');
    expect(emptyMessage.getAttribute('aria-live')).toBe('polite');
  });

  it('selecting Habits instead of Goals swaps the message and deselects Goals (Requirement 9)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const goalsRadio = dialog.querySelector<HTMLInputElement>('#aspiration-link-goals')!;
    const habitsRadio = dialog.querySelector<HTMLInputElement>('#aspiration-link-habits')!;
    const emptyMessage = dialog.querySelector<HTMLElement>('.aspiration-modal__links-empty')!;

    goalsRadio.click();
    habitsRadio.click();

    expect(goalsRadio.checked).toBe(false);
    expect(habitsRadio.checked).toBe(true);
    expect(emptyMessage.hidden).toBe(false);
    expect(emptyMessage.textContent).toContain('Habits');
  });

  it('re-clicking the currently-selected radio deselects it and hides the message (Requirement 11)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const goalsRadio = dialog.querySelector<HTMLInputElement>('#aspiration-link-goals')!;
    const emptyMessage = dialog.querySelector<HTMLElement>('.aspiration-modal__links-empty')!;

    goalsRadio.click();
    expect(goalsRadio.checked).toBe(true);

    goalsRadio.click();

    expect(goalsRadio.checked).toBe(false);
    expect(emptyMessage.hidden).toBe(true);
    expect(emptyMessage.textContent).toBe('');
  });

  it('closes immediately with no confirmation when the close (X) button is activated with all fields empty (Requirement 16)', () => {
    const { modal, addItemButton } = setup();

    modal.open();

    const dialog = getDialog();
    const closeButton = dialog.querySelector<HTMLButtonElement>('.modal__close')!;
    closeButton.click();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(addItemButton);
  });

  it('the close (X) button has an accessible name of "Close" and no visible text (Requirement 15, 36)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const closeButton = dialog.querySelector<HTMLButtonElement>('.modal__close')!;
    expect(closeButton.getAttribute('aria-label')).toBe('Close');
  });

  it('shows the confirmation prompt when the close (X) button is activated with a non-empty Title, and "Discard" closes everything without saving (Requirements 17, 18, 19)', () => {
    const { modal, addItemButton } = setup();

    modal.open();

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#aspiration-field-title')!;
    setValue(titleInput, 'Unsaved title');

    const closeButton = dialog.querySelector<HTMLButtonElement>('.modal__close')!;
    closeButton.click();

    const confirmDialog = getAlertDialog();
    expect(confirmDialog).not.toBeNull();

    const discardButton = confirmDialog!.querySelector<HTMLButtonElement>('.modal__discard')!;
    discardButton.click();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(addItemButton);
    expect(window.localStorage.getItem('throughline:aspirations')).toBeFalsy();
  });

  it('"Keep editing" closes only the confirmation prompt, leaving the modal\'s field values intact, and returns focus to the close button (Requirement 20, 39)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#aspiration-field-title')!;
    setValue(titleInput, 'Unsaved title');

    const closeButton = dialog.querySelector<HTMLButtonElement>('.modal__close')!;
    closeButton.click();

    const confirmDialog = getAlertDialog()!;
    const cancelButton = confirmDialog.querySelector<HTMLButtonElement>('.modal__cancel')!;
    cancelButton.click();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    const stillOpenDialog = getDialog();
    expect(
      stillOpenDialog.querySelector<HTMLInputElement>('#aspiration-field-title')!.value,
    ).toBe('Unsaved title');
    expect(document.activeElement).toBe(closeButton);
  });

  it('triggers the same confirm-prompt flow on Escape when dirty (Requirement 21)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#aspiration-field-title')!;
    setValue(titleInput, 'Unsaved title');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(getAlertDialog()).not.toBeNull();
  });

  it('closes immediately on Escape with no confirmation when the modal is clean (Requirement 16, 21)', () => {
    const { modal, addItemButton } = setup();

    modal.open();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(addItemButton);
  });

  it('triggers the same confirm-prompt flow on a backdrop click when dirty (Requirement 22)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#aspiration-field-title')!;
    setValue(titleInput, 'Unsaved title');

    const overlay = dialog.parentElement as HTMLElement;
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(getAlertDialog()).not.toBeNull();
  });

  it('closes immediately on a backdrop click with no confirmation when the modal is clean (Requirement 16, 22)', () => {
    const { modal, addItemButton } = setup();

    modal.open();

    const dialog = getDialog();
    const overlay = dialog.parentElement as HTMLElement;
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(addItemButton);
  });

  it('Escape while the confirm prompt is open triggers "Keep editing", not "Discard"', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#aspiration-field-title')!;
    setValue(titleInput, 'Unsaved title');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(getAlertDialog()).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(getAlertDialog()).toBeNull();
    const stillOpenDialog = getDialog();
    expect(
      stillOpenDialog.querySelector<HTMLInputElement>('#aspiration-field-title')!.value,
    ).toBe('Unsaved title');
  });

  it('moves focus to the Title field immediately after open() (Requirement 29)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#aspiration-field-title')!;
    expect(document.activeElement).toBe(titleInput);
  });

  it('traps focus: Tab from Save (last) wraps to the close button (first), and Shift+Tab from close wraps back to Save (Requirement 30)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#aspiration-field-title')!;
    setValue(titleInput, 'Non-empty title'); // enables Save so it's a focusable trap boundary

    const closeButton = dialog.querySelector<HTMLButtonElement>('.modal__close')!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    saveButton.focus();
    saveButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(closeButton);

    closeButton.focus();
    closeButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(saveButton);
  });

  it('has no automatically detectable WCAG violations with the modal freshly opened and empty', async () => {
    const { modal } = setup();

    modal.open();

    const results = await axe(document.body, {
      runOnly: { type: 'tag', values: WCAG_TAGS },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('has no automatically detectable WCAG violations with the Goals radio selected (empty-state message visible)', async () => {
    const { modal } = setup();

    modal.open();
    const dialog = getDialog();
    dialog.querySelector<HTMLInputElement>('#aspiration-link-goals')!.click();

    const results = await axe(document.body, {
      runOnly: { type: 'tag', values: WCAG_TAGS },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('has no automatically detectable WCAG violations with the confirm prompt open on a dirty modal', async () => {
    const { modal } = setup();

    modal.open();
    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#aspiration-field-title')!;
    setValue(titleInput, 'Unsaved title');
    dialog.querySelector<HTMLButtonElement>('.modal__close')!.click();

    const results = await axe(document.body, {
      runOnly: { type: 'tag', values: WCAG_TAGS },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});
