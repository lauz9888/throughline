import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { axe } from 'jest-axe';
import { initEditGoalModal } from './edit-goal-modal';
import { readGoals, type Goal } from './goal-storage';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

type ModalInstance = ReturnType<typeof initEditGoalModal>;

let currentModal: ModalInstance | undefined;

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    title: 'Original title',
    description: 'Original description',
    reason: 'Original reason',
    milestones: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTriggerTile(goal: Goal): HTMLButtonElement {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'goal-tile';
  tile.dataset.goalId = goal.id;
  tile.textContent = goal.title;
  return tile;
}

function seedStorage(goal: Goal): void {
  window.localStorage.setItem('throughline:goals', JSON.stringify([goal]));
}

function buildFixture(): { root: HTMLElement; gridContainer: HTMLElement } {
  const root = document.createElement('div');
  root.id = 'app';

  const gridContainer = document.createElement('section');
  gridContainer.className = 'goal-grid-section';
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
  const modal = initEditGoalModal({
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
  goal: Goal,
): HTMLButtonElement {
  const tile = makeTriggerTile(goal);
  gridContainer.append(tile);
  modal.open(goal, tile);
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

function milestoneInputs(dialog: HTMLElement): HTMLInputElement[] {
  return Array.from(dialog.querySelectorAll<HTMLInputElement>('.modal__milestone-input'));
}

function milestoneRemoveButtons(dialog: HTMLElement): HTMLButtonElement[] {
  return Array.from(dialog.querySelectorAll<HTMLButtonElement>('.modal__milestone-remove'));
}

function clickAddMilestone(dialog: HTMLElement): void {
  dialog.querySelector<HTMLButtonElement>('.modal__milestone-add')!.click();
}

describe('initEditGoalModal', () => {
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

  it('inserts one [role="dialog"] with aria-modal and aria-labelledby resolving to "Edit Goal" (Requirement 10)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();

    openWithTile(modal, gridContainer, goal);

    const dialogs = document.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
    const dialog = dialogs[0] as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Edit Goal');
  });

  it('pre-fills Title/Description/Reason from the passed goal (Requirement 11)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();

    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!;
    const descriptionInput = dialog.querySelector<HTMLTextAreaElement>(
      'textarea[id$="field-description"]',
    )!;
    const reasonInput = dialog.querySelector<HTMLTextAreaElement>('textarea[id$="field-reason"]')!;

    expect(titleInput.value).toBe(goal.title);
    expect(descriptionInput.value).toBe(goal.description);
    expect(reasonInput.value).toBe(goal.reason);
  });

  it('pre-populates one milestone row per stored milestone, in stored order, each pre-filled (Requirement 11)', () => {
    const goal = makeGoal({
      milestones: [
        { id: 'm1', title: 'Run a half-marathon' },
        { id: 'm2', title: 'Run a 10k' },
      ],
    });
    seedStorage(goal);
    const { gridContainer, modal } = setup();

    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const inputs = milestoneInputs(dialog);
    expect(inputs.map((input) => input.value)).toEqual(['Run a half-marathon', 'Run a 10k']);

    const labels = Array.from(dialog.querySelectorAll('.modal__milestones label')).map(
      (label) => label.textContent,
    );
    expect(labels).toEqual(['Milestone 1', 'Milestone 2']);
  });

  it('Save starts disabled (Requirement 15)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();

    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;
    expect(saveButton.disabled).toBe(true);
  });

  it('Save enables when Title differs from the loaded value, and disables again when reverted (Requirement 16)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    setValue(titleInput, 'Changed title');
    expect(saveButton.disabled).toBe(false);

    setValue(titleInput, goal.title);
    expect(saveButton.disabled).toBe(true);
  });

  it('Save enables when Description differs from the loaded value, and disables again when reverted (Requirement 16)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const descriptionInput = dialog.querySelector<HTMLTextAreaElement>(
      'textarea[id$="field-description"]',
    )!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    setValue(descriptionInput, 'Changed description');
    expect(saveButton.disabled).toBe(false);

    setValue(descriptionInput, goal.description);
    expect(saveButton.disabled).toBe(true);
  });

  it('Save enables when Reason differs from the loaded value, and disables again when reverted (Requirement 16)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const reasonInput = dialog.querySelector<HTMLTextAreaElement>('textarea[id$="field-reason"]')!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    setValue(reasonInput, 'Changed reason');
    expect(saveButton.disabled).toBe(false);

    setValue(reasonInput, goal.reason);
    expect(saveButton.disabled).toBe(true);
  });

  it('Save enables when an existing milestone row title is edited, and disables again when reverted exactly (Requirement 16)', () => {
    const goal = makeGoal({ milestones: [{ id: 'm1', title: 'Run a half-marathon' }] });
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;
    const input = milestoneInputs(dialog)[0]!;

    setValue(input, 'Run a full marathon');
    expect(saveButton.disabled).toBe(false);

    setValue(input, 'Run a half-marathon');
    expect(saveButton.disabled).toBe(true);
  });

  it('Save enables when a new milestone row is added with a non-blank title, and disables again on removal (Requirement 16)', () => {
    const goal = makeGoal({ milestones: [{ id: 'm1', title: 'Run a half-marathon' }] });
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    clickAddMilestone(dialog);
    setValue(milestoneInputs(dialog)[1]!, 'Run a 10k');
    expect(saveButton.disabled).toBe(false);

    milestoneRemoveButtons(dialog)[1]!.click();
    expect(saveButton.disabled).toBe(true);
  });

  it('Save enables when an existing milestone row is removed, and disables again when it is effectively restored (Requirement 16)', () => {
    const goal = makeGoal({
      milestones: [
        { id: 'm1', title: 'Run a half-marathon' },
        { id: 'm2', title: 'Run a 10k' },
      ],
    });
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    milestoneRemoveButtons(dialog)[1]!.click(); // remove "Run a 10k"
    expect(saveButton.disabled).toBe(false);

    clickAddMilestone(dialog);
    setValue(milestoneInputs(dialog)[1]!, 'Run a 10k');
    expect(saveButton.disabled).toBe(true);
  });

  it('editing Title to whitespace-only keeps Save disabled even though it differs from the loaded Title (Requirement 13)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!;
    const saveButton = dialog.querySelector<HTMLButtonElement>('.modal__save')!;

    setValue(titleInput, '   ');

    expect(saveButton.disabled).toBe(true);
  });

  it('saving persists trimmed field values and non-blank milestones against the same id, preserves createdAt, calls onChange, and closes the dialog (Requirement 17, 19)', () => {
    const goal = makeGoal({ milestones: [{ id: 'm1', title: 'Run a half-marathon' }] });
    seedStorage(goal);
    const onChange = vi.fn();
    const { gridContainer, modal } = setup(onChange);
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    setValue(
      dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!,
      '  Updated title  ',
    );
    setValue(
      dialog.querySelector<HTMLTextAreaElement>('textarea[id$="field-description"]')!,
      '  Updated description  ',
    );
    setValue(
      dialog.querySelector<HTMLTextAreaElement>('textarea[id$="field-reason"]')!,
      '  Updated reason  ',
    );
    setValue(milestoneInputs(dialog)[0]!, '  Updated milestone  ');
    clickAddMilestone(dialog);
    setValue(milestoneInputs(dialog)[1]!, '   '); // blank, excluded from save
    dialog.querySelector<HTMLButtonElement>('.modal__save')!.click();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);

    const stored = readGoals(window.localStorage);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe(goal.id);
    expect(stored[0]!.createdAt).toBe(goal.createdAt);
    expect(stored[0]!.title).toBe('Updated title');
    expect(stored[0]!.description).toBe('Updated description');
    expect(stored[0]!.reason).toBe('Updated reason');
    expect(stored[0]!.milestones.map((m) => m.title)).toEqual(['Updated milestone']);
  });

  it('a milestone row left alone keeps its original stored id after save; a newly added row is saved with a new, different id (Requirement 18)', () => {
    const goal = makeGoal({ milestones: [{ id: 'milestone-1', title: 'Existing milestone' }] });
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    clickAddMilestone(dialog);
    setValue(milestoneInputs(dialog)[1]!, 'New milestone');
    dialog.querySelector<HTMLButtonElement>('.modal__save')!.click();

    const stored = readGoals(window.localStorage);
    expect(stored).toHaveLength(1);
    const savedMilestones = stored[0]!.milestones;
    expect(savedMilestones).toHaveLength(2);
    expect(savedMilestones[0]!.id).toBe('milestone-1');
    expect(savedMilestones[0]!.title).toBe('Existing milestone');
    expect(savedMilestones[1]!.id).toBeTruthy();
    expect(savedMilestones[1]!.id).not.toBe('milestone-1');
    expect(savedMilestones[1]!.title).toBe('New milestone');
  });

  it('the Delete button has an accessible name identifying its destructive purpose (Requirement 20)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const deleteButton = dialog.querySelector<HTMLButtonElement>('.modal__delete')!;
    expect(deleteButton.getAttribute('aria-label')).toBe('Delete goal');
  });

  it('clicking Delete opens a role="alertdialog" without deleting anything yet (Requirement 21)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    dialog.querySelector<HTMLButtonElement>('.modal__delete')!.click();

    const confirmDialog = getAlertDialog();
    expect(confirmDialog).not.toBeNull();
    expect(confirmDialog!.getAttribute('aria-modal')).toBe('true');

    const stored = readGoals(window.localStorage);
    expect(stored.find((g) => g.id === goal.id)).toBeDefined();
  });

  it('canceling the delete-confirm returns to the unchanged Edit modal, without deleting, and focuses the Delete button (Requirement 25)', () => {
    const goal = makeGoal({ milestones: [{ id: 'm1', title: 'Milestone' }] });
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const deleteButton = dialog.querySelector<HTMLButtonElement>('.modal__delete')!;
    deleteButton.click();

    const confirmDialog = getAlertDialog()!;
    confirmDialog.querySelector<HTMLButtonElement>('.modal__cancel')!.click();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(getDialog()).toBeTruthy();
    expect(readGoals(window.localStorage).find((g) => g.id === goal.id)).toBeDefined();
    expect(milestoneInputs(getDialog())).toHaveLength(1);
    expect(document.activeElement).toBe(deleteButton);
  });

  it('confirming deletion removes the record (including its milestones), calls onChange, closes both dialogs, and focuses the grid container (Requirement 22, 24, accessibility 8)', () => {
    const goal = makeGoal({ milestones: [{ id: 'm1', title: 'Milestone' }] });
    seedStorage(goal);
    const onChange = vi.fn();
    const { gridContainer, modal } = setup(onChange);
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    dialog.querySelector<HTMLButtonElement>('.modal__delete')!.click();
    const confirmDialog = getAlertDialog()!;
    confirmDialog.querySelector<HTMLButtonElement>('.modal__delete-confirm')!.click();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(readGoals(window.localStorage).find((g) => g.id === goal.id)).toBeUndefined();
    expect(document.activeElement).toBe(gridContainer);
  });

  it('closes immediately with no confirmation when the close (X) button is activated and fields are unchanged (Requirement 27)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    const tile = openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    dialog.querySelector<HTMLButtonElement>('.modal__close')!.click();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(tile);
  });

  it('opens the unsaved-changes confirm when closing while dirty, and "Discard" closes without saving (Requirement 26)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!, 'Changed title');
    dialog.querySelector<HTMLButtonElement>('.modal__close')!.click();

    const confirmDialog = getAlertDialog();
    expect(confirmDialog).not.toBeNull();

    confirmDialog!.querySelector<HTMLButtonElement>('.modal__discard')!.click();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(readGoals(window.localStorage).find((g) => g.id === goal.id)?.title).toBe(
      'Original title',
    );
  });

  it('opens the unsaved-changes confirm when only a milestone row has changed (Requirement 26)', () => {
    const goal = makeGoal({ milestones: [{ id: 'm1', title: 'Original milestone' }] });
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    setValue(milestoneInputs(dialog)[0]!, 'Changed milestone');
    dialog.querySelector<HTMLButtonElement>('.modal__close')!.click();

    expect(getAlertDialog()).not.toBeNull();
  });

  it('"Keep editing" closes only the unsaved-changes confirm, leaves fields and milestone rows intact, and focuses the close button (Requirement 25)', () => {
    const goal = makeGoal({ milestones: [{ id: 'm1', title: 'Original milestone' }] });
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const closeButton = dialog.querySelector<HTMLButtonElement>('.modal__close')!;
    setValue(dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!, 'Changed title');
    setValue(milestoneInputs(dialog)[0]!, 'Changed milestone');
    closeButton.click();

    const confirmDialog = getAlertDialog()!;
    confirmDialog.querySelector<HTMLButtonElement>('.modal__cancel')!.click();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    const stillOpen = getDialog();
    expect(stillOpen.querySelector<HTMLInputElement>('input[id$="field-title"]')!.value).toBe(
      'Changed title',
    );
    expect(milestoneInputs(stillOpen)[0]!.value).toBe('Changed milestone');
    expect(document.activeElement).toBe(closeButton);
  });

  it('Escape while the unsaved-changes confirm is open cancels only the confirm (mirrors Issue #78)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

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
    expect(readGoals(window.localStorage).find((g) => g.id === goal.id)?.title).toBe(
      'Original title',
    );
    expect(document.activeElement).toBe(closeButton);
  });

  it('Escape while the delete-confirm is open cancels only the confirm (mirrors Issue #78)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const deleteButton = dialog.querySelector<HTMLButtonElement>('.modal__delete')!;
    deleteButton.click();
    expect(getAlertDialog()).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(getAlertDialog()).toBeNull();
    expect(getDialog()).toBeTruthy();
    expect(readGoals(window.localStorage).find((g) => g.id === goal.id)).toBeDefined();
    expect(document.activeElement).toBe(deleteButton);
  });

  it('Escape while a tooltip is open closes only the tooltip, not the confirm or the modal (mirrors Issue #80)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

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

  it('traps focus through the Delete button: Tab from Save reaches Delete, then wraps to close; Shift+Tab from close wraps back to Delete (mirrors Issue #79)', () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

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
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    const titleInput = dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!;
    expect(document.activeElement).toBe(titleInput);
  });

  it('after Save, focus lands on the re-rendered tile matching the edited id, not the stale pre-save triggerTile node (mirrors Issue #68)', () => {
    const goal = makeGoal();
    seedStorage(goal);

    const { root, gridContainer } = buildFixture();
    const originalTile = makeTriggerTile(goal);
    let newTile!: HTMLButtonElement;

    const modal = initEditGoalModal({
      root,
      gridContainer,
      storage: window.localStorage,
      onChange: () => {
        newTile = document.createElement('button');
        newTile.type = 'button';
        newTile.className = 'goal-tile';
        newTile.dataset.goalId = goal.id;
        newTile.textContent = 'Updated title';
        originalTile.replaceWith(newTile);
      },
    });
    currentModal = modal;

    gridContainer.append(originalTile);
    modal.open(goal, originalTile);

    const dialog = getDialog();
    setValue(dialog.querySelector<HTMLInputElement>('input[id$="field-title"]')!, 'Updated title');
    dialog.querySelector<HTMLButtonElement>('.modal__save')!.click();

    const refreshedTile = gridContainer.querySelector<HTMLButtonElement>(
      `[data-goal-id="${goal.id}"]`,
    )!;
    expect(refreshedTile).not.toBe(originalTile);
    expect(refreshedTile).toBe(newTile);
    expect(document.activeElement).toBe(refreshedTile);
  });

  it('has no automatically detectable WCAG violations with the Edit modal open (populated fields and milestone rows)', async () => {
    const goal = makeGoal({ milestones: [{ id: 'm1', title: 'Run a half-marathon' }] });
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const results = await axe(document.body, {
      runOnly: { type: 'tag', values: WCAG_TAGS },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('has no automatically detectable WCAG violations with the unsaved-changes confirm open', async () => {
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

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
    const goal = makeGoal();
    seedStorage(goal);
    const { gridContainer, modal } = setup();
    openWithTile(modal, gridContainer, goal);

    const dialog = getDialog();
    dialog.querySelector<HTMLButtonElement>('.modal__delete')!.click();

    const results = await axe(document.body, {
      runOnly: { type: 'tag', values: WCAG_TAGS },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});
