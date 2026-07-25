import { createFocusTrap } from './focus-trap';
import { saveAspiration } from './aspiration-storage';

export interface AspirationModalElements {
  root: HTMLElement; // the #app element; toggled `inert` while a dialog is open
  addItemButton: HTMLButtonElement; // focus-return target (Requirement 31)
}

const BLURB_TEXT =
  'An aspiration is a long-term, potentially lifelong life direction — not necessarily a ' +
  "measurable, checkable goal. It's a guiding principle that shapes and motivates your more " +
  "concrete goals, for example 'live a healthy life', 'have a successful and fulfilling " +
  "career', or 'maintain healthy and loving relationships'.";

const TITLE_TOOLTIP_TEXT =
  "A short, memorable name for this aspiration — for example 'Live a healthy life'.";
const DESCRIPTION_TOOLTIP_TEXT =
  'Optional. Add more detail about what this aspiration means to you day to day.';
const REASON_TOOLTIP_TEXT =
  'Optional. Explain why this aspiration matters to you — this can help keep you motivated.';
const LINKS_TOOLTIP_TEXT =
  'Optional. Link this aspiration to one of your existing Goals or Habits so they stay connected.';

// A real, focusable, keyboard-operable "info" control shown next to a field's label. It has its
// own accessible name (e.g. "More information about Title") and reflects its disclosure state
// via `aria-expanded`, since clicking it (or pressing Enter/Space while it's focused) toggles the
// visibility of its associated tooltip text — see `wireTooltipIcon` below. The glyph itself is
// still drawn via CSS `::before` and is purely decorative. Regardless of this toggle's visual
// state, the actual accessible description lives in the `<span>` created by `createTooltipText`
// below and is wired up via `aria-describedby` on the associated form control at all times —
// satisfying WCAG 2.1 AA without depending on the native `title` attribute (which isn't reliably
// reachable via keyboard/screen reader).
function createInfoIcon(doc: Document, fieldLabel: string, tooltipId: string): HTMLButtonElement {
  const icon = doc.createElement('button');
  icon.type = 'button';
  icon.className = 'modal__info';
  icon.setAttribute('aria-label', `More information about ${fieldLabel}`);
  icon.setAttribute('aria-expanded', 'false');
  icon.setAttribute('aria-controls', tooltipId);
  return icon;
}

// The accessible description text for a field/group. Visually hidden (off-screen, not
// `display: none`/`visibility: hidden`) until its info icon button is toggled on — see
// `.modal__tooltip-text`/`.modal__tooltip-text--visible` in `src/style.css` — but always present
// in the accessibility tree via the `aria-describedby` reference set on the corresponding
// control(s), regardless of visibility.
function createTooltipText(doc: Document, id: string, text: string): HTMLSpanElement {
  const tooltip = doc.createElement('span');
  tooltip.id = id;
  tooltip.className = 'modal__tooltip-text';
  tooltip.textContent = text;
  return tooltip;
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

  // Tracks whichever single tooltip (info-icon disclosure) is currently toggled open, so that
  // opening a new one closes any previously-open one, and so document-level click/Escape
  // handling knows whether there's anything to close.
  let openTooltip: { icon: HTMLButtonElement; text: HTMLElement } | undefined;

  function showTooltip(icon: HTMLButtonElement, text: HTMLElement): void {
    if (openTooltip && openTooltip.icon !== icon) hideTooltip();
    text.classList.add('modal__tooltip-text--visible');
    icon.setAttribute('aria-expanded', 'true');
    openTooltip = { icon, text };
  }

  function hideTooltip(): void {
    if (!openTooltip) return;
    openTooltip.text.classList.remove('modal__tooltip-text--visible');
    openTooltip.icon.setAttribute('aria-expanded', 'false');
    openTooltip = undefined;
  }

  function toggleTooltip(icon: HTMLButtonElement, text: HTMLElement): void {
    if (openTooltip && openTooltip.icon === icon) {
      hideTooltip();
    } else {
      showTooltip(icon, text);
    }
  }

  // Click-to-toggle: activating an info icon shows/hides its own tooltip text (closing any
  // other open tooltip first). Native `<button>` semantics already fire this same `click` event
  // for Enter/Space, so no separate keydown handling is needed for that part of Requirement 2.
  function wireTooltipIcon(icon: HTMLButtonElement, text: HTMLElement): void {
    icon.addEventListener('click', () => toggleTooltip(icon, text));
  }

  // Closes the currently-open tooltip when the user clicks anywhere outside its icon/text.
  function handleDocumentClickForTooltip(event: MouseEvent): void {
    if (!openTooltip) return;
    const target = event.target as Node | null;
    if (target && (openTooltip.icon.contains(target) || openTooltip.text.contains(target))) {
      return;
    }
    hideTooltip();
  }

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
    // Escape closes the innermost open thing first: an open tooltip disclosure takes
    // precedence over the confirm prompt/modal itself, so it takes a second Escape (or a
    // click elsewhere) to progress to closing the confirm prompt/modal.
    if (openTooltip) {
      hideTooltip();
      return;
    }
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
    doc.removeEventListener('click', handleDocumentClickForTooltip);
    openTooltip = undefined;
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
    const titleLabelRow = doc.createElement('div');
    titleLabelRow.className = 'modal__field-label-row';
    const titleLabel = doc.createElement('label');
    titleLabel.setAttribute('for', 'aspiration-field-title');
    titleLabel.textContent = 'Title';
    const titleIcon = createInfoIcon(doc, 'Title', 'aspiration-field-title-tooltip');
    titleLabelRow.append(titleLabel, titleIcon);
    titleInput = doc.createElement('input');
    titleInput.id = 'aspiration-field-title';
    titleInput.type = 'text';
    titleInput.required = true;
    titleInput.setAttribute('aria-required', 'true');
    titleInput.setAttribute('aria-describedby', 'aspiration-field-title-tooltip');
    const titleTooltip = createTooltipText(
      doc,
      'aspiration-field-title-tooltip',
      TITLE_TOOLTIP_TEXT,
    );
    titleField.append(titleLabelRow, titleInput, titleTooltip);

    const descriptionField = doc.createElement('div');
    descriptionField.className = 'modal__field';
    const descriptionLabelRow = doc.createElement('div');
    descriptionLabelRow.className = 'modal__field-label-row';
    const descriptionLabel = doc.createElement('label');
    descriptionLabel.setAttribute('for', 'aspiration-field-description');
    descriptionLabel.textContent = 'Description';
    const descriptionIcon = createInfoIcon(
      doc,
      'Description',
      'aspiration-field-description-tooltip',
    );
    descriptionLabelRow.append(descriptionLabel, descriptionIcon);
    descriptionInput = doc.createElement('textarea');
    descriptionInput.id = 'aspiration-field-description';
    descriptionInput.setAttribute('aria-describedby', 'aspiration-field-description-tooltip');
    const descriptionTooltip = createTooltipText(
      doc,
      'aspiration-field-description-tooltip',
      DESCRIPTION_TOOLTIP_TEXT,
    );
    descriptionField.append(descriptionLabelRow, descriptionInput, descriptionTooltip);

    const reasonField = doc.createElement('div');
    reasonField.className = 'modal__field';
    const reasonLabelRow = doc.createElement('div');
    reasonLabelRow.className = 'modal__field-label-row';
    const reasonLabel = doc.createElement('label');
    reasonLabel.setAttribute('for', 'aspiration-field-reason');
    reasonLabel.textContent = 'Reason';
    const reasonIcon = createInfoIcon(doc, 'Reason', 'aspiration-field-reason-tooltip');
    reasonLabelRow.append(reasonLabel, reasonIcon);
    reasonInput = doc.createElement('textarea');
    reasonInput.id = 'aspiration-field-reason';
    reasonInput.setAttribute('aria-describedby', 'aspiration-field-reason-tooltip');
    const reasonTooltip = createTooltipText(
      doc,
      'aspiration-field-reason-tooltip',
      REASON_TOOLTIP_TEXT,
    );
    reasonField.append(reasonLabelRow, reasonInput, reasonTooltip);

    const linksFieldset = doc.createElement('fieldset');
    linksFieldset.className = 'aspiration-modal__links';
    const linksLegend = doc.createElement('legend');
    const linksInfoWrapper = doc.createElement('span');
    linksInfoWrapper.className = 'modal__info-wrapper';
    const linksTooltip = createTooltipText(doc, 'aspiration-links-tooltip', LINKS_TOOLTIP_TEXT);
    const linksIcon = createInfoIcon(doc, 'Links', 'aspiration-links-tooltip');
    linksInfoWrapper.append(linksIcon, linksTooltip);
    linksLegend.append('Links', linksInfoWrapper);
    linksFieldset.setAttribute('aria-describedby', 'aspiration-links-tooltip');

    const goalsOption = doc.createElement('div');
    goalsOption.className = 'aspiration-modal__link-option';
    const goalsRadio = doc.createElement('input');
    goalsRadio.type = 'radio';
    goalsRadio.id = 'aspiration-link-goals';
    goalsRadio.name = 'aspiration-link-type';
    goalsRadio.value = 'Goals';
    goalsRadio.setAttribute('aria-describedby', 'aspiration-links-tooltip');
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
    habitsRadio.setAttribute('aria-describedby', 'aspiration-links-tooltip');
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

    wireTooltipIcon(titleIcon, titleTooltip);
    wireTooltipIcon(descriptionIcon, descriptionTooltip);
    wireTooltipIcon(reasonIcon, reasonTooltip);
    wireTooltipIcon(linksIcon, linksTooltip);

    closeButton.addEventListener('click', requestClose);
    overlay.addEventListener('click', handleOverlayClick);
    saveButton.addEventListener('click', handleSave);
  }

  function open(): void {
    if (isOpen) return;
    isOpen = true;
    confirmOpen = false;
    selectedLinkType = null;
    openTooltip = undefined;

    buildModal();
    doc.body.append(overlay);
    root.inert = true;

    focusTrapCleanup = createFocusTrap(dialog);
    doc.addEventListener('keydown', handleDocumentKeydown);
    doc.addEventListener('click', handleDocumentClickForTooltip);

    titleInput.focus();
  }

  function destroy(): void {
    doc.removeEventListener('keydown', handleDocumentKeydown);
    doc.removeEventListener('click', handleDocumentClickForTooltip);
    openTooltip = undefined;
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
