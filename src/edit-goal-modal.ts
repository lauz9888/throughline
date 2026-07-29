import { createFocusTrap } from './focus-trap';
import { updateGoal, deleteGoal, type Goal } from './goal-storage';
import { BLURB_TEXT as GOAL_BLURB_TEXT, buildGoalFields, type GoalFieldsResult } from './goal-fields';
import { buildMilestoneRows, type MilestoneRowsResult } from './milestone-rows';
import { openConfirmDialog } from './confirm-dialog';

export interface EditGoalModalElements {
  root: HTMLElement; // #app; toggled `inert` while open
  gridContainer: HTMLElement; // the goal grid's `section` — tabindex="-1" focus target
  storage: Storage;
  onChange: () => void; // re-renders the goal grid; called before teardown on save/delete
}

function titlesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((title, index) => title === b[index]);
}

export function initEditGoalModal(elements: EditGoalModalElements): {
  open: (goal: Goal, triggerTile: HTMLButtonElement) => void;
  destroy: () => void;
} {
  const { root, gridContainer, storage, onChange } = elements;
  const doc = root.ownerDocument;

  let isOpen = false;

  let overlay: HTMLElement;
  let dialog: HTMLElement;
  let closeButton: HTMLButtonElement;
  let saveButton: HTMLButtonElement;
  let deleteButton: HTMLButtonElement;
  let focusTrapCleanup: (() => void) | undefined;
  let fields: GoalFieldsResult;
  let milestones: MilestoneRowsResult;

  let loadedGoal: Goal;
  let triggerTile: HTMLButtonElement;
  let activeConfirmHandle: { cancel: () => void } | undefined;

  function isDirty(): boolean {
    return (
      fields.titleInput.value.trim() !== loadedGoal.title ||
      fields.descriptionInput.value.trim() !== loadedGoal.description ||
      fields.reasonInput.value.trim() !== loadedGoal.reason ||
      !titlesEqual(
        milestones.getNonBlankTitles(),
        loadedGoal.milestones.map((m) => m.title),
      )
    );
  }

  function updateSaveButtonDisabled(): void {
    saveButton.disabled = !(isDirty() && fields.titleInput.value.trim().length > 0);
  }

  function handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (fields.isTooltipOpen()) {
      fields.hideOpenTooltip();
      return; // first Escape only closes the tooltip
    }
    if (activeConfirmHandle) {
      activeConfirmHandle.cancel();
      return;
    }
    requestClose();
  }

  function handleOverlayClick(event: MouseEvent): void {
    if (event.target === overlay) requestClose();
  }

  function requestClose(): void {
    if (!isDirty()) {
      closeAndTeardown('cancel');
      return;
    }
    activeConfirmHandle = openConfirmDialog(
      doc,
      dialog,
      {
        headingId: 'edit-goal-confirm-heading',
        headingText: 'Discard goal?',
        bodyId: 'edit-goal-confirm-body',
        bodyText:
          "You have unsaved changes. If you close now, everything you've entered will be lost.",
        cancelText: 'Keep editing',
        cancelClassName: 'modal__cancel',
        confirmText: 'Discard',
        confirmClassName: 'modal__discard',
        dialogClassName: 'modal--goal',
      },
      {
        onCancel: () => {
          activeConfirmHandle = undefined;
          closeButton.focus();
        },
        onConfirm: () => {
          activeConfirmHandle = undefined;
          closeAndTeardown('cancel'); // discarding edits, not deleting the record
        },
      },
    );
  }

  function handleDeleteClick(): void {
    activeConfirmHandle = openConfirmDialog(
      doc,
      dialog,
      {
        headingId: 'edit-goal-delete-confirm-heading',
        headingText: 'Delete goal?',
        bodyId: 'edit-goal-delete-confirm-body',
        bodyText: `Delete "${loadedGoal.title}"? This can't be undone.`,
        cancelText: 'Keep editing',
        cancelClassName: 'modal__cancel',
        confirmText: 'Delete',
        confirmClassName: 'modal__delete-confirm',
        dialogClassName: 'modal--goal',
      },
      {
        onCancel: () => {
          activeConfirmHandle = undefined;
          deleteButton.focus();
        },
        onConfirm: () => {
          activeConfirmHandle = undefined;
          deleteGoal(loadedGoal.id, storage);
          onChange();
          closeAndTeardown('delete');
        },
      },
    );
  }

  function handleSave(): void {
    updateGoal(
      loadedGoal.id,
      {
        title: fields.titleInput.value.trim(),
        description: fields.descriptionInput.value.trim(),
        reason: fields.reasonInput.value.trim(),
        milestones: milestones.getMilestonesForSave(),
      },
      storage,
    );
    onChange(); // re-render the grid BEFORE teardown
    closeAndTeardown('save');
  }

  function closeAndTeardown(reason: 'cancel' | 'save' | 'delete'): void {
    doc.removeEventListener('keydown', handleDocumentKeydown);
    doc.removeEventListener('click', fields.handleDocumentClickForTooltip);
    focusTrapCleanup?.();
    focusTrapCleanup = undefined;
    overlay.remove();
    root.inert = false; // must happen before any focus() call below
    isOpen = false;

    if (reason === 'delete') {
      gridContainer.focus();
      return;
    }
    if (reason === 'save') {
      const tiles = Array.from(gridContainer.querySelectorAll<HTMLButtonElement>('.goal-tile'));
      const refreshed = tiles.find((t) => t.dataset.goalId === loadedGoal.id);
      (refreshed ?? gridContainer).focus();
      return;
    }
    triggerTile.focus();
  }

  function buildModal(goal: Goal): void {
    overlay = doc.createElement('div');
    overlay.className = 'modal-overlay';

    dialog = doc.createElement('div');
    dialog.className = 'modal modal--goal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'edit-goal-modal-heading');

    closeButton = doc.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'modal__close';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.textContent = '×';

    const heading = doc.createElement('h2');
    heading.id = 'edit-goal-modal-heading';
    heading.className = 'modal__title';
    heading.textContent = 'Edit Goal';

    const blurb = doc.createElement('p');
    blurb.className = 'modal__blurb';
    blurb.textContent = GOAL_BLURB_TEXT;

    fields = buildGoalFields(doc, 'edit-goal', {
      title: goal.title,
      description: goal.description,
      reason: goal.reason,
    });

    milestones = buildMilestoneRows(doc, 'edit-goal', {
      initialMilestones: goal.milestones,
      onRowsChanged: updateSaveButtonDisabled,
    });

    saveButton = doc.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'modal__save';
    saveButton.disabled = true;
    saveButton.textContent = 'Save';

    deleteButton = doc.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'modal__delete';
    deleteButton.setAttribute('aria-label', 'Delete goal');
    deleteButton.textContent = 'Delete';

    dialog.append(
      closeButton,
      heading,
      blurb,
      fields.titleField,
      fields.descriptionField,
      fields.reasonField,
      milestones.section,
      saveButton,
      deleteButton,
    );
    overlay.append(dialog);

    fields.titleInput.addEventListener('input', updateSaveButtonDisabled);
    fields.descriptionInput.addEventListener('input', updateSaveButtonDisabled);
    fields.reasonInput.addEventListener('input', updateSaveButtonDisabled);

    closeButton.addEventListener('click', requestClose);
    overlay.addEventListener('click', handleOverlayClick);
    saveButton.addEventListener('click', handleSave);
    deleteButton.addEventListener('click', handleDeleteClick);

    // Delete is a new tab stop immediately after Save (mirrors edit-aspiration-modal.ts, Issue
    // #79), so a real browser's native Tab handling already moves focus from Save straight to
    // Delete — the shared `focus-trap.ts` only needs to intervene at the trap's *boundaries*
    // (Delete → wraps to Close, Close → Shift+Tab wraps to Delete), which it already does
    // unmodified. This single, narrowly-scoped listener exists only so that same adjacency is
    // deterministic in environments (like jsdom in unit tests) that don't implement native
    // keyboard-driven focus traversal for a plain, non-wrapping Tab press; `stopPropagation`
    // keeps the focus trap's own boundary check (which would otherwise see the just-updated
    // `document.activeElement` on the same event and immediately wrap it again) from re-firing on
    // this same keypress.
    saveButton.addEventListener('keydown', (event) => {
      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        deleteButton.focus();
      }
    });
  }

  function open(goal: Goal, tile: HTMLButtonElement): void {
    if (isOpen) return;
    isOpen = true;
    loadedGoal = goal;
    triggerTile = tile;
    activeConfirmHandle = undefined;

    buildModal(goal);
    doc.body.append(overlay);
    root.inert = true;

    focusTrapCleanup = createFocusTrap(dialog);
    doc.addEventListener('keydown', handleDocumentKeydown);
    doc.addEventListener('click', fields.handleDocumentClickForTooltip);

    fields.titleInput.focus();
  }

  function destroy(): void {
    doc.removeEventListener('keydown', handleDocumentKeydown);
    if (fields) doc.removeEventListener('click', fields.handleDocumentClickForTooltip);
    if (isOpen) {
      activeConfirmHandle = undefined;
      focusTrapCleanup?.();
      focusTrapCleanup = undefined;
      overlay.remove();
      root.inert = false;
      isOpen = false;
    }
  }

  return { open, destroy };
}
