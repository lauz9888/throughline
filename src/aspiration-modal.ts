import { createFocusTrap } from './focus-trap';
import { saveAspiration } from './aspiration-storage';

export interface AspirationModalElements {
  root: HTMLElement; // the #app element; toggled `inert` while a dialog is open
  addItemButton: HTMLButtonElement; // focus-return target (Requirement 31)
}

const BLURB_TEXT =
  "An aspiration is a long-term, potentially lifelong life direction — not necessarily a " +
  "measurable, checkable goal. It's a guiding principle that shapes and motivates your more " +
  "concrete goals, for example 'live a healthy life', 'have a successful and fulfilling " +
  "career', or 'maintain healthy and loving relationships'.";

export function initAspirationModal(elements: AspirationModalElements): {
  open: () => void;
  destroy: () => void;
} {
  const { root, addItemButton } = elements;
  const doc = root.ownerDocument;
  const win = doc.defaultView!;

  let isOpen = false;
  let confirmOpen = false;
  let selectedLinkType: 'Goals' | 'Habits' | null = null;

  let overlay: HTMLElement;
  let dialog: HTMLElement;
  let closeButton: HTMLButtonElement;
  let titleInput: HTMLInputElement;
  let descriptionInput: HTMLTextAreaElement;
  let reasonInput: HTMLTextAreaElement;
  let saveButton: HTMLButtonElement;
  let linksEmptyMessage: HTMLElement;
  let focusTrapCleanup: (() => void) | undefined;

  let confirmOverlay: HTMLElement | undefined;
  let confirmDialog: HTMLElement | undefined;
  let confirmFocusTrapCleanup: (() => void) | undefined;

  function isDirty(): boolean {
    return (
      titleInput.value.trim() !== '' ||
      descriptionInput.value.trim() !== '' ||
      reasonInput.value.trim() !== '' ||
      selectedLinkType !== null
    );
  }

  function updateSaveButtonDisabled(): void {
    saveButton.disabled = titleInput.value.trim().length === 0;
  }

  function updateLinksState(): void {
    if (selectedLinkType === null) {
      linksEmptyMessage.hidden = true;
      linksEmptyMessage.textContent = '';
    } else {
      linksEmptyMessage.hidden = false;
      linksEmptyMessage.textContent = `You don't have any ${selectedLinkType} yet, so there's nothing to link.`;
    }
  }

  function handleLinkRadioClick(event: MouseEvent): void {
    const radio = event.currentTarget as HTMLInputElement;
    if (selectedLinkType === radio.value) {
      radio.checked = false;
      selectedLinkType = null;
      updateLinksState();
    }
  }

  function handleLinkRadioChange(event: Event): void {
    const radio = event.target as HTMLInputElement;
    selectedLinkType = radio.checked ? (radio.value as 'Goals' | 'Habits') : null;
    updateLinksState();
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
    if (confirmOpen) {
      closeConfirmReturn();
    } else {
      requestClose();
    }
  }

  function handleOverlayClick(event: MouseEvent): void {
    if (event.target === overlay) requestClose();
  }

  function openConfirm(): void {
    confirmOpen = true;

    confirmOverlay = doc.createElement('div');
    confirmOverlay.className = 'modal-overlay';

    confirmDialog = doc.createElement('div');
    confirmDialog.className = 'modal modal--confirm';
    confirmDialog.setAttribute('role', 'alertdialog');
    confirmDialog.setAttribute('aria-modal', 'true');
    confirmDialog.setAttribute('aria-labelledby', 'aspiration-confirm-heading');
    confirmDialog.setAttribute('aria-describedby', 'aspiration-confirm-body');

    const heading = doc.createElement('h2');
    heading.id = 'aspiration-confirm-heading';
    heading.className = 'modal__title';
    heading.textContent = 'Discard aspiration?';

    const body = doc.createElement('p');
    body.id = 'aspiration-confirm-body';
    body.textContent =
      "You have unsaved changes. If you close now, everything you've entered will be lost.";

    const actions = doc.createElement('div');
    actions.className = 'modal__actions';

    const cancelButton = doc.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'modal__cancel';
    cancelButton.textContent = 'Keep editing';

    const discardButton = doc.createElement('button');
    discardButton.type = 'button';
    discardButton.className = 'modal__discard';
    discardButton.textContent = 'Discard';

    actions.append(cancelButton, discardButton);
    confirmDialog.append(heading, body, actions);
    confirmOverlay.append(confirmDialog);
    doc.body.append(confirmOverlay);

    dialog.inert = true; // Aspiration modal's own dialog, not `root` (already inert)
    confirmFocusTrapCleanup = createFocusTrap(confirmDialog);
    cancelButton.focus(); // "Keep editing" — the non-destructive default action

    confirmOverlay.addEventListener('click', (event) => {
      if (event.target === confirmOverlay) closeConfirmReturn();
    });
    cancelButton.addEventListener('click', closeConfirmReturn);
    discardButton.addEventListener('click', closeConfirmDiscard);
  }

  function closeConfirmReturn(): void {
    confirmFocusTrapCleanup?.();
    confirmFocusTrapCleanup = undefined;
    confirmOverlay?.remove();
    confirmOverlay = undefined;
    confirmDialog = undefined;
    confirmOpen = false;
    dialog.inert = false;
    closeButton.focus(); // back into the Aspiration modal (Requirement 39)
  }

  function closeConfirmDiscard(): void {
    confirmFocusTrapCleanup?.();
    confirmFocusTrapCleanup = undefined;
    confirmOverlay?.remove();
    confirmOverlay = undefined;
    confirmDialog = undefined;
    confirmOpen = false;
    closeAndTeardown();
  }

  function handleSave(): void {
    saveAspiration(
      {
        title: titleInput.value.trim(),
        description: descriptionInput.value.trim(),
        reason: reasonInput.value.trim(),
      },
      win.localStorage,
    );
    closeAndTeardown();
  }

  function closeAndTeardown(): void {
    doc.removeEventListener('keydown', handleDocumentKeydown);
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

    const titleField = doc.createElement('div');
    titleField.className = 'modal__field';
    const titleLabel = doc.createElement('label');
    titleLabel.setAttribute('for', 'aspiration-field-title');
    titleLabel.textContent = 'Title';
    titleInput = doc.createElement('input');
    titleInput.id = 'aspiration-field-title';
    titleInput.type = 'text';
    titleInput.required = true;
    titleInput.setAttribute('aria-required', 'true');
    titleField.append(titleLabel, titleInput);

    const descriptionField = doc.createElement('div');
    descriptionField.className = 'modal__field';
    const descriptionLabel = doc.createElement('label');
    descriptionLabel.setAttribute('for', 'aspiration-field-description');
    descriptionLabel.textContent = 'Description';
    descriptionInput = doc.createElement('textarea');
    descriptionInput.id = 'aspiration-field-description';
    descriptionField.append(descriptionLabel, descriptionInput);

    const reasonField = doc.createElement('div');
    reasonField.className = 'modal__field';
    const reasonLabel = doc.createElement('label');
    reasonLabel.setAttribute('for', 'aspiration-field-reason');
    reasonLabel.textContent = 'Reason';
    reasonInput = doc.createElement('textarea');
    reasonInput.id = 'aspiration-field-reason';
    reasonField.append(reasonLabel, reasonInput);

    const linksFieldset = doc.createElement('fieldset');
    linksFieldset.className = 'aspiration-modal__links';
    const linksLegend = doc.createElement('legend');
    linksLegend.textContent = 'Links';

    const goalsOption = doc.createElement('div');
    goalsOption.className = 'aspiration-modal__link-option';
    const goalsRadio = doc.createElement('input');
    goalsRadio.type = 'radio';
    goalsRadio.id = 'aspiration-link-goals';
    goalsRadio.name = 'aspiration-link-type';
    goalsRadio.value = 'Goals';
    const goalsLabel = doc.createElement('label');
    goalsLabel.setAttribute('for', 'aspiration-link-goals');
    goalsLabel.textContent = 'Goals';
    goalsOption.append(goalsRadio, goalsLabel);

    const habitsOption = doc.createElement('div');
    habitsOption.className = 'aspiration-modal__link-option';
    const habitsRadio = doc.createElement('input');
    habitsRadio.type = 'radio';
    habitsRadio.id = 'aspiration-link-habits';
    habitsRadio.name = 'aspiration-link-type';
    habitsRadio.value = 'Habits';
    const habitsLabel = doc.createElement('label');
    habitsLabel.setAttribute('for', 'aspiration-link-habits');
    habitsLabel.textContent = 'Habits';
    habitsOption.append(habitsRadio, habitsLabel);

    linksEmptyMessage = doc.createElement('p');
    linksEmptyMessage.className = 'aspiration-modal__links-empty';
    linksEmptyMessage.setAttribute('aria-live', 'polite');
    linksEmptyMessage.hidden = true;

    linksFieldset.append(linksLegend, goalsOption, habitsOption, linksEmptyMessage);

    saveButton = doc.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'modal__save';
    saveButton.disabled = true;
    saveButton.textContent = 'Save';

    dialog.append(
      closeButton,
      heading,
      blurb,
      titleField,
      descriptionField,
      reasonField,
      linksFieldset,
      saveButton,
    );
    overlay.append(dialog);

    // Wire listeners
    titleInput.addEventListener('input', updateSaveButtonDisabled);
    updateSaveButtonDisabled();

    [goalsRadio, habitsRadio].forEach((radio) => {
      radio.addEventListener('click', handleLinkRadioClick);
      radio.addEventListener('change', handleLinkRadioChange);
    });

    closeButton.addEventListener('click', requestClose);
    overlay.addEventListener('click', handleOverlayClick);
    saveButton.addEventListener('click', handleSave);
  }

  function open(): void {
    if (isOpen) return;
    isOpen = true;
    confirmOpen = false;
    selectedLinkType = null;

    buildModal();
    doc.body.append(overlay);
    root.inert = true;

    focusTrapCleanup = createFocusTrap(dialog);
    doc.addEventListener('keydown', handleDocumentKeydown);

    titleInput.focus();
  }

  function destroy(): void {
    doc.removeEventListener('keydown', handleDocumentKeydown);
    if (isOpen) {
      confirmFocusTrapCleanup?.();
      confirmFocusTrapCleanup = undefined;
      confirmOverlay?.remove();
      confirmOverlay = undefined;
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
