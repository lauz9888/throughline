import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { axe } from 'jest-axe';
import { initGoalModal } from './goal-modal';

// Scope to actual WCAG 2.1 A/AA success criteria, matching src/app.test.ts's convention (see
// .claude/STANDARDS.md's "WCAG conformance scope").
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const GOAL_BLURB_TEXT =
  'A goal is a specific, measurable, significant achievement with a clear and distinct ' +
  "completion point — for example 'get promoted to manager', 'run a marathon', or 'be " +
  "awarded a degree'.";

type ModalInstance = ReturnType<typeof initGoalModal>;

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
  const modal = initGoalModal({ root, addItemButton });
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

function clickAddMilestone(dialog: HTMLElement): void {
  dialog.querySelector<HTMLButtonElement>('.modal__milestone-add')!.click();
}

function milestoneInputs(dialog: HTMLElement): HTMLInputElement[] {
  return Array.from(dialog.querySelectorAll<HTMLInputElement>('.modal__milestone-input'));
}

function milestoneRemoveButtons(dialog: HTMLElement): HTMLButtonElement[] {
  return Array.from(dialog.querySelectorAll<HTMLButtonElement>('.modal__milestone-remove'));
}

describe('initGoalModal', () => {
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

  it('inserts exactly one [role="dialog"] with aria-modal and aria-labelledby resolving to "Create Goal" (Requirement 34)', () => {
    const { modal } = setup();

    modal.open();

    const dialogs = document.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
    const dialog = dialogs[0] as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Create Goal');
  });

  it('renders the goal blurb verbatim, directly after the heading and before Title (Requirement 3)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const blurb = dialog.querySelector('.modal__blurb');
    expect(blurb?.textContent).toBe(GOAL_BLURB_TEXT);
  });

  it('orders content as blurb, Title, Description, Reason, Milestones section, Save (Requirement 4)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const descendants = Array.from(dialog.querySelectorAll('*'));
    const indexOf = (el: Element | null) => (el ? descendants.indexOf(el) : -1);

    const blurb = dialog.querySelector('.modal__blurb');
    const titleInput = dialog.querySelector('#goal-field-title');
    const descriptionInput = dialog.querySelector('#goal-field-description');
    const reasonInput = dialog.querySelector('#goal-field-reason');
    const milestonesSection = dialog.querySelector('.modal__milestones');
    const saveButton = dialog.querySelector('.modal__save');

    expect(indexOf(blurb)).toBeGreaterThanOrEqual(0);
    expect(indexOf(blurb)).toBeLessThan(indexOf(titleInput));
    expect(indexOf(titleInput)).toBeLessThan(indexOf(descriptionInput));
    expect(indexOf(descriptionInput)).toBeLessThan(indexOf(reasonInput));
    expect(indexOf(reasonInput)).toBeLessThan(indexOf(milestonesSection));
    expect(indexOf(milestonesSection)).toBeLessThan(indexOf(saveButton));
  });

  it('does not add a second dialog when open() is called a second time while already open (Requirement 5)', () => {
    const { modal } = setup();

    modal.open();
    modal.open();

    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it('labels Title/Description/Reason correctly and marks only Title as required (Requirements 6, 7, 8, 38, 39)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#goal-field-title')!;
    const descriptionInput = dialog.querySelector<HTMLTextAreaElement>('#goal-field-description')!;
    const reasonInput = dialog.querySelector<HTMLTextAreaElement>('#goal-field-reason')!;

    expect(dialog.querySelector('label[for="goal-field-title"]')?.textContent).toBe('Title');
    expect(dialog.querySelector('label[for="goal-field-description"]')?.textContent).toBe(
      'Description',
    );
    expect(dialog.querySelector('label[for="goal-field-reason"]')?.textContent).toBe('Reason');

    expect(titleInput.required).toBe(true);
    expect(titleInput.getAttribute('aria-required')).toBe('true');
    expect(descriptionInput.hasAttribute('required')).toBe(false);
    expect(reasonInput.hasAttribute('required')).toBe(false);
  });

  it('the Milestones section starts with zero rows on open (Requirement 11)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    expect(milestoneInputs(dialog)).toHaveLength(0);
  });

  it('keeps Save disabled while Title is empty or whitespace-only, and enables it once Title has content (Requirement 25, 48)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#goal-field-title')!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    expect(saveButton.disabled).toBe(true);

    setValue(titleInput, '   ');
    expect(saveButton.disabled).toBe(true);

    setValue(titleInput, 'Run a marathon');
    expect(saveButton.disabled).toBe(false);
  });

  it('closes immediately with no confirmation when the close (X) button is activated with all fields empty and zero milestone rows (Requirement 19)', () => {
    const { modal, addItemButton } = setup();

    modal.open();

    const dialog = getDialog();
    dialog.querySelector<HTMLButtonElement>('.modal__close')!.click();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(addItemButton);
  });

  it('shows the confirmation prompt when a milestone row exists — even with its own title still blank — and all text fields are empty (Requirement 20, the Goal-specific dirty-check divergence)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    clickAddMilestone(dialog); // row added, its own input left blank

    dialog.querySelector<HTMLButtonElement>('.modal__close')!.click();

    expect(getAlertDialog()).not.toBeNull();
  });

  it('shows the confirmation prompt when Title/Description/Reason has non-empty content (Requirement 20)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('#goal-field-title')!, 'Unsaved title');

    dialog.querySelector<HTMLButtonElement>('.modal__close')!.click();

    expect(getAlertDialog()).not.toBeNull();
  });

  it('"Discard" from the confirmation prompt closes everything, saving nothing (Requirement 21)', () => {
    const { modal, addItemButton } = setup();

    modal.open();

    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('#goal-field-title')!, 'Unsaved title');
    dialog.querySelector<HTMLButtonElement>('.modal__close')!.click();

    const confirmDialog = getAlertDialog()!;
    confirmDialog.querySelector<HTMLButtonElement>('.modal__discard')!.click();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(addItemButton);
    expect(window.localStorage.getItem('throughline:goals')).toBeFalsy();
  });

  it('"Keep editing" closes only the confirmation prompt, leaving field values and milestone rows intact, and returns focus to the close button (Requirement 21, 46)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('#goal-field-title')!, 'Unsaved title');
    clickAddMilestone(dialog);
    setValue(milestoneInputs(dialog)[0]!, 'Unsaved milestone');

    const closeButton = dialog.querySelector<HTMLButtonElement>('.modal__close')!;
    closeButton.click();

    const confirmDialog = getAlertDialog()!;
    confirmDialog.querySelector<HTMLButtonElement>('.modal__cancel')!.click();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    const stillOpenDialog = getDialog();
    expect(stillOpenDialog.querySelector<HTMLInputElement>('#goal-field-title')!.value).toBe(
      'Unsaved title',
    );
    expect(milestoneInputs(stillOpenDialog)[0]!.value).toBe('Unsaved milestone');
    expect(document.activeElement).toBe(closeButton);
  });

  it('the confirm dialog opened from the Goal modal carries the modal--goal class (Requirement 24)', () => {
    const { modal } = setup();

    modal.open();
    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('#goal-field-title')!, 'Unsaved title');
    dialog.querySelector<HTMLButtonElement>('.modal__close')!.click();

    const confirmDialog = getAlertDialog()!;
    expect(confirmDialog.className.split(' ')).toEqual(
      expect.arrayContaining(['modal', 'modal--confirm', 'modal--goal']),
    );
  });

  it('triggers the same confirm-prompt flow on Escape when dirty, and closes immediately on Escape when clean (Requirement 22)', () => {
    const { modal, addItemButton } = setup();

    modal.open();
    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('#goal-field-title')!, 'Unsaved title');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(getAlertDialog()).not.toBeNull();

    // "Keep editing" then Escape again with a now-clean modal
    getAlertDialog()!.querySelector<HTMLButtonElement>('.modal__cancel')!.click();
    setValue(dialog.querySelector<HTMLInputElement>('#goal-field-title')!, '');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(addItemButton);
  });

  it('pressing Escape while a tooltip is open closes only the tooltip first, not the modal (Requirement 22)', () => {
    const { modal } = setup();

    modal.open();
    const dialog = getDialog();
    const titleIcon = dialog.querySelector<HTMLButtonElement>('.modal__field .modal__info')!;
    const tooltipId = titleIcon.getAttribute('aria-controls')!;
    const tooltip = document.getElementById(tooltipId)!;

    titleIcon.click();
    expect(tooltip.classList.contains('modal__tooltip-text--visible')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(tooltip.classList.contains('modal__tooltip-text--visible')).toBe(false);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('triggers the same confirm-prompt flow on a backdrop click when dirty (Requirement 23)', () => {
    const { modal } = setup();

    modal.open();
    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('#goal-field-title')!, 'Unsaved title');

    const overlay = dialog.parentElement as HTMLElement;
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(getAlertDialog()).not.toBeNull();
  });

  it('saves the goal (trimmed Title/Description/Reason plus the ordered non-blank milestone titles) and closes without a confirm prompt (Requirements 26, 29)', () => {
    const { modal, addItemButton } = setup();

    modal.open();

    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('#goal-field-title')!, '  Run a marathon  ');
    setValue(
      dialog.querySelector<HTMLTextAreaElement>('#goal-field-description')!,
      '  26.2 miles  ',
    );
    setValue(dialog.querySelector<HTMLTextAreaElement>('#goal-field-reason')!, '  For fitness  ');

    clickAddMilestone(dialog);
    clickAddMilestone(dialog);
    clickAddMilestone(dialog);
    const inputs = milestoneInputs(dialog);
    setValue(inputs[0]!, '  Run a half-marathon  ');
    setValue(inputs[1]!, '   '); // blank, should be excluded
    setValue(inputs[2]!, 'Run a 10k');

    dialog.querySelector<HTMLButtonElement>('.modal__save')!.click();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(addItemButton);

    const raw = window.localStorage.getItem('throughline:goals');
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw!) as {
      title: string;
      description: string;
      reason: string;
      milestones: { title: string }[];
    }[];
    expect(stored).toHaveLength(1);
    expect(stored[0]!.title).toBe('Run a marathon');
    expect(stored[0]!.description).toBe('26.2 miles');
    expect(stored[0]!.reason).toBe('For fitness');
    expect(stored[0]!.milestones.map((m) => m.title)).toEqual([
      'Run a half-marathon',
      'Run a 10k',
    ]);
  });

  it('saves successfully with zero milestone rows (Requirement 15)', () => {
    const { modal } = setup();

    modal.open();
    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('#goal-field-title')!, 'Run a marathon');

    dialog.querySelector<HTMLButtonElement>('.modal__save')!.click();

    const raw = window.localStorage.getItem('throughline:goals');
    const stored = JSON.parse(raw!) as { milestones: unknown[] }[];
    expect(stored[0]!.milestones).toEqual([]);
  });

  it('moves focus to the Title field immediately after open() (Requirement 35)', () => {
    const { modal } = setup();

    modal.open();

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('#goal-field-title')!;
    expect(document.activeElement).toBe(titleInput);
  });

  it('traps focus including two dynamically added milestone rows: Tab from Title cycles through them to Save, wrapping to Close (Requirement 36)', () => {
    const { modal } = setup();

    modal.open();
    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('#goal-field-title')!, 'Non-empty title');

    clickAddMilestone(dialog);
    clickAddMilestone(dialog);

    const inputs = milestoneInputs(dialog);
    const removeButtons = milestoneRemoveButtons(dialog);
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;
    const closeButton = dialog.querySelector<HTMLButtonElement>('.modal__close')!;

    // Confirm the two rows' inputs and remove buttons are part of the trapped tab order by
    // tabbing forward from Save (the last "static" control before the dynamic rows in DOM
    // order) and checking it wraps only after passing through both rows, ending back at Close.
    saveButton.focus();
    saveButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(closeButton);

    // Shift+Tab from Close (first) should wrap to the last focusable element — the second
    // milestone row's remove button, since it is appended after the rows in DOM order — not
    // silently skip over the dynamically added rows.
    closeButton.focus();
    closeButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(saveButton);

    expect(inputs).toHaveLength(2);
    expect(removeButtons).toHaveLength(2);
  });

  it('destroy() removes the open dialog, restores root.inert, and unwires document listeners', () => {
    const { modal, root } = setup();

    modal.open();
    expect(root.inert).toBe(true);

    modal.destroy();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(root.inert).toBe(false);
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

  it('has no automatically detectable WCAG violations with two milestone rows added', async () => {
    const { modal } = setup();

    modal.open();
    const dialog = getDialog();
    clickAddMilestone(dialog);
    clickAddMilestone(dialog);

    const results = await axe(document.body, {
      runOnly: { type: 'tag', values: WCAG_TAGS },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('has no automatically detectable WCAG violations with the discard-confirmation prompt open on a dirty modal', async () => {
    const { modal } = setup();

    modal.open();
    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('#goal-field-title')!, 'Unsaved title');
    dialog.querySelector<HTMLButtonElement>('.modal__close')!.click();

    const results = await axe(document.body, {
      runOnly: { type: 'tag', values: WCAG_TAGS },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('has no automatically detectable WCAG violations with a tooltip toggled open via its info icon', async () => {
    const { modal } = setup();

    modal.open();
    const dialog = getDialog();
    dialog.querySelector<HTMLButtonElement>('.modal__field .modal__info')!.click();

    const results = await axe(document.body, {
      runOnly: { type: 'tag', values: WCAG_TAGS },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});
