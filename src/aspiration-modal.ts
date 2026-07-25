import { createFocusTrap } from './focus-trap';
import { saveAspiration } from './aspiration-storage';
import { BLURB_TEXT, buildAspirationFields, type AspirationFieldsResult } from './aspiration-fields';
import { openConfirmDialog } from './confirm-dialog';

export interface AspirationModalElements {
  root: HTMLElement; // the #app element; toggled `inert` while a dialog is open
  addItemButton: HTMLButtonElement; // focus-return target (Requirement 31)
  onSave?: () => void; // called once, immediately after a successful save, before
                        // `closeAndTeardown()` runs (Issue #74)
}

export function initAspirationModal(elements: AspirationModalElements): {
  open: () => void;
  destroy: () => void;
} {
  const { root, addItemButton } = elements;
  const doc = root.ownerDocument;
  const win = doc.defaultView!;

  let isOpen = false;
  let confirmOpen = false;

  let overlay: HTMLElement;
  let dialog: HTMLElement;
  let closeButton: HTMLButtonElement;
  let saveButton: HTMLButtonElement;
  let focusTrapCleanup: (() => void) | undefined;
  let confirmHandle: { cancel: () => void } | undefined;
  let fields: AspirationFieldsResult;

  function isDirty(): boolean {
    return (
      fields.titleInput.value.trim() !== '' ||
      fields.descriptionInput.value.trim() !== '' ||
      fields.reasonInput.value.trim() !== '' ||
      fields.getSelectedLinkType() !== null
    );
  }

  function updateSaveButtonDisabled(): void {
    saveButton.disabled = fields.titleInput.value.trim().length === 0;
  }

  function requestClose(): void {
    if (isDirty()) {
      openConfirm();
    } else {
      closeAndTeardown();
    }
  }

  function handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    // Escape closes the innermost open thing first: an open tooltip disclosure takes
    // precedence over the confirm prompt/modal itself, so it takes a second Escape (or a
    // click elsewhere) to progress to closing the confirm prompt/modal.
    if (fields.isTooltipOpen()) {
      fields.hideOpenTooltip();
      return;
    }
    if (confirmOpen) {
      confirmHandle?.cancel();
    } else {
      requestClose();
    }
  }

  function handleOverlayClick(event: MouseEvent): void {
    if (event.target === overlay) requestClose();
  }

  function openConfirm(): void {
    confirmOpen = true;
    confirmHandle = openConfirmDialog(
      doc,
      dialog,
      {
        headingId: 'aspiration-confirm-heading',
        headingText: 'Discard aspiration?',
        bodyId: 'aspiration-confirm-body',
        bodyText:
          "You have unsaved changes. If you close now, everything you've entered will be lost.",
        cancelText: 'Keep editing',
        cancelClassName: 'modal__cancel',
        confirmText: 'Discard',
        confirmClassName: 'modal__discard',
      },
      {
        onCancel: () => {
          confirmOpen = false;
          confirmHandle = undefined;
          closeButton.focus(); // back into the Aspiration modal (Requirement 39)
        },
        onConfirm: () => {
          confirmOpen = false;
          confirmHandle = undefined;
          closeAndTeardown();
        },
      },
    );
  }

  function handleSave(): void {
    saveAspiration(
      {
        title: fields.titleInput.value.trim(),
        description: fields.descriptionInput.value.trim(),
        reason: fields.reasonInput.value.trim(),
      },
      win.localStorage,
    );
    elements.onSave?.();
    closeAndTeardown();
  }

  function closeAndTeardown(): void {
    doc.removeEventListener('keydown', handleDocumentKeydown);
    doc.removeEventListener('click', fields.handleDocumentClickForTooltip);
    focusTrapCleanup?.();
    focusTrapCleanup = undefined;
    overlay.remove();
    root.inert = false;
    isOpen = false;
    addItemButton.focus(); // Requirement 31
  }

  function buildModal(): void {
    overlay = doc.createElement('div');
    overlay.className = 'modal-overlay';

    dialog = doc.createElement('div');
    dialog.className = 'modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'aspiration-modal-heading');

    closeButton = doc.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'modal__close';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.textContent = '×';

    const heading = doc.createElement('h2');
    heading.id = 'aspiration-modal-heading';
    heading.className = 'modal__title';
    heading.textContent = 'Create Aspiration';

    const blurb = doc.createElement('p');
    blurb.className = 'modal__blurb';
    blurb.textContent = BLURB_TEXT;

    fields = buildAspirationFields(doc, 'aspiration');

    saveButton = doc.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'modal__save';
    saveButton.disabled = true;
    saveButton.textContent = 'Save';

    dialog.append(
      closeButton,
      heading,
      blurb,
      fields.titleField,
      fields.descriptionField,
      fields.reasonField,
      fields.linksFieldset,
      saveButton,
    );
    overlay.append(dialog);

    // Wire listeners
    fields.titleInput.addEventListener('input', updateSaveButtonDisabled);
    updateSaveButtonDisabled();

    closeButton.addEventListener('click', requestClose);
    overlay.addEventListener('click', handleOverlayClick);
    saveButton.addEventListener('click', handleSave);
  }

  function open(): void {
    if (isOpen) return;
    isOpen = true;
    confirmOpen = false;
    confirmHandle = undefined;

    buildModal();
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
      confirmHandle = undefined;
      confirmOpen = false;
      focusTrapCleanup?.();
      focusTrapCleanup = undefined;
      overlay.remove();
      root.inert = false;
      isOpen = false;
    }
  }

  return { open, destroy };
}
