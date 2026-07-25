export const BLURB_TEXT =
  'An aspiration is a long-term, potentially lifelong life direction — not necessarily a ' +
  "measurable, checkable goal. It's a guiding principle that shapes and motivates your more " +
  "concrete goals, for example 'live a healthy life', 'have a successful and fulfilling " +
  "career', or 'maintain healthy and loving relationships'.";

export const TITLE_TOOLTIP_TEXT =
  "A short, memorable name for this aspiration — for example 'Live a healthy life'.";
export const DESCRIPTION_TOOLTIP_TEXT =
  'Optional. Add more detail about what this aspiration means to you day to day.';
export const REASON_TOOLTIP_TEXT =
  'Optional. Explain why this aspiration matters to you — this can help keep you motivated.';
export const LINKS_TOOLTIP_TEXT =
  'Optional. Link this aspiration to one of your existing Goals or Habits so they stay connected.';

// A real, focusable, keyboard-operable "info" control shown next to a field's label. It has its
// own accessible name (e.g. "More information about Title") and reflects its disclosure state
// via `aria-expanded`, since clicking it (or pressing Enter/Space while it's focused) toggles the
// visibility of its associated tooltip text — see the tooltip state machine below. The glyph
// itself is still drawn via CSS `::before` and is purely decorative. Regardless of this toggle's
// visual state, the actual accessible description lives in the `<span>` created by
// `createTooltipText` below and is wired up via `aria-describedby` on the associated form control
// at all times — satisfying WCAG 2.1 AA without depending on the native `title` attribute (which
// isn't reliably reachable via keyboard/screen reader).
export function createInfoIcon(
  doc: Document,
  fieldLabel: string,
  tooltipId: string,
): HTMLButtonElement {
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
export function createTooltipText(doc: Document, id: string, text: string): HTMLSpanElement {
  const tooltip = doc.createElement('span');
  tooltip.id = id;
  tooltip.className = 'modal__tooltip-text';
  tooltip.textContent = text;
  return tooltip;
}

export interface AspirationFieldsResult {
  titleField: HTMLElement;
  descriptionField: HTMLElement;
  reasonField: HTMLElement;
  linksFieldset: HTMLFieldSetElement;
  titleInput: HTMLInputElement;
  descriptionInput: HTMLTextAreaElement;
  reasonInput: HTMLTextAreaElement;
  goalsRadio: HTMLInputElement;
  habitsRadio: HTMLInputElement;
  linksEmptyMessage: HTMLElement;
  titleIcon: HTMLButtonElement;
  titleTooltip: HTMLElement;
  descriptionIcon: HTMLButtonElement;
  descriptionTooltip: HTMLElement;
  reasonIcon: HTMLButtonElement;
  reasonTooltip: HTMLElement;
  linksIcon: HTMLButtonElement;
  linksTooltip: HTMLElement;
  getSelectedLinkType: () => 'Goals' | 'Habits' | null;
  updateLinksState: () => void;
  // Tooltip state (Issue #66): exposed directly rather than behind an opaque `wireTooltips()`
  // wrapper, specifically so each modal file's own `handleDocumentKeydown` can reproduce today's
  // Escape precedence (an open tooltip disclosure closes on the *first* Escape, and only that —
  // the modal/confirm itself must NOT also close on the same keypress; a *second* Escape, with
  // nothing open, closes with no confirmation).
  isTooltipOpen: () => boolean;
  // Idempotent: a no-op returning `false` if nothing was open. Closes whichever tooltip is
  // currently open (if any) and returns `true` if it actually closed one, `false` otherwise.
  hideOpenTooltip: () => boolean;
  // Wired/unwired by the caller on `document` exactly like today's
  // `handleDocumentClickForTooltip` (closes an open tooltip on an outside click).
  handleDocumentClickForTooltip: (event: MouseEvent) => void;
}

export function buildAspirationFields(
  doc: Document,
  idPrefix: string,
  initialValues?: { title?: string; description?: string; reason?: string },
): AspirationFieldsResult {
  let selectedLinkType: 'Goals' | 'Habits' | null = null;

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

  function isTooltipOpen(): boolean {
    return openTooltip !== undefined;
  }

  function hideOpenTooltip(): boolean {
    if (!openTooltip) return false;
    hideTooltip();
    return true;
  }

  function getSelectedLinkType(): 'Goals' | 'Habits' | null {
    return selectedLinkType;
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

  const titleField = doc.createElement('div');
  titleField.className = 'modal__field';
  const titleLabelRow = doc.createElement('div');
  titleLabelRow.className = 'modal__field-label-row';
  const titleLabel = doc.createElement('label');
  titleLabel.setAttribute('for', `${idPrefix}-field-title`);
  titleLabel.textContent = 'Title';
  const titleIcon = createInfoIcon(doc, 'Title', `${idPrefix}-field-title-tooltip`);
  titleLabelRow.append(titleLabel, titleIcon);
  const titleInput = doc.createElement('input');
  titleInput.id = `${idPrefix}-field-title`;
  titleInput.type = 'text';
  titleInput.required = true;
  titleInput.setAttribute('aria-required', 'true');
  titleInput.setAttribute('aria-describedby', `${idPrefix}-field-title-tooltip`);
  if (initialValues?.title !== undefined) titleInput.value = initialValues.title;
  const titleTooltip = createTooltipText(
    doc,
    `${idPrefix}-field-title-tooltip`,
    TITLE_TOOLTIP_TEXT,
  );
  titleField.append(titleLabelRow, titleInput, titleTooltip);

  const descriptionField = doc.createElement('div');
  descriptionField.className = 'modal__field';
  const descriptionLabelRow = doc.createElement('div');
  descriptionLabelRow.className = 'modal__field-label-row';
  const descriptionLabel = doc.createElement('label');
  descriptionLabel.setAttribute('for', `${idPrefix}-field-description`);
  descriptionLabel.textContent = 'Description';
  const descriptionIcon = createInfoIcon(
    doc,
    'Description',
    `${idPrefix}-field-description-tooltip`,
  );
  descriptionLabelRow.append(descriptionLabel, descriptionIcon);
  const descriptionInput = doc.createElement('textarea');
  descriptionInput.id = `${idPrefix}-field-description`;
  descriptionInput.setAttribute('aria-describedby', `${idPrefix}-field-description-tooltip`);
  if (initialValues?.description !== undefined) descriptionInput.value = initialValues.description;
  const descriptionTooltip = createTooltipText(
    doc,
    `${idPrefix}-field-description-tooltip`,
    DESCRIPTION_TOOLTIP_TEXT,
  );
  descriptionField.append(descriptionLabelRow, descriptionInput, descriptionTooltip);

  const reasonField = doc.createElement('div');
  reasonField.className = 'modal__field';
  const reasonLabelRow = doc.createElement('div');
  reasonLabelRow.className = 'modal__field-label-row';
  const reasonLabel = doc.createElement('label');
  reasonLabel.setAttribute('for', `${idPrefix}-field-reason`);
  reasonLabel.textContent = 'Reason';
  const reasonIcon = createInfoIcon(doc, 'Reason', `${idPrefix}-field-reason-tooltip`);
  reasonLabelRow.append(reasonLabel, reasonIcon);
  const reasonInput = doc.createElement('textarea');
  reasonInput.id = `${idPrefix}-field-reason`;
  reasonInput.setAttribute('aria-describedby', `${idPrefix}-field-reason-tooltip`);
  if (initialValues?.reason !== undefined) reasonInput.value = initialValues.reason;
  const reasonTooltip = createTooltipText(
    doc,
    `${idPrefix}-field-reason-tooltip`,
    REASON_TOOLTIP_TEXT,
  );
  reasonField.append(reasonLabelRow, reasonInput, reasonTooltip);

  const linksFieldset = doc.createElement('fieldset');
  linksFieldset.className = 'aspiration-modal__links';
  const linksLegend = doc.createElement('legend');
  const linksInfoWrapper = doc.createElement('span');
  linksInfoWrapper.className = 'modal__info-wrapper';
  const linksTooltip = createTooltipText(doc, `${idPrefix}-links-tooltip`, LINKS_TOOLTIP_TEXT);
  const linksIcon = createInfoIcon(doc, 'Links', `${idPrefix}-links-tooltip`);
  linksInfoWrapper.append(linksIcon, linksTooltip);
  linksLegend.append('Links', linksInfoWrapper);
  linksFieldset.setAttribute('aria-describedby', `${idPrefix}-links-tooltip`);

  const goalsOption = doc.createElement('div');
  goalsOption.className = 'aspiration-modal__link-option';
  const goalsRadio = doc.createElement('input');
  goalsRadio.type = 'radio';
  goalsRadio.id = `${idPrefix}-link-goals`;
  goalsRadio.name = `${idPrefix}-link-type`;
  goalsRadio.value = 'Goals';
  goalsRadio.setAttribute('aria-describedby', `${idPrefix}-links-tooltip`);
  const goalsLabel = doc.createElement('label');
  goalsLabel.setAttribute('for', `${idPrefix}-link-goals`);
  goalsLabel.textContent = 'Goals';
  goalsOption.append(goalsRadio, goalsLabel);

  const habitsOption = doc.createElement('div');
  habitsOption.className = 'aspiration-modal__link-option';
  const habitsRadio = doc.createElement('input');
  habitsRadio.type = 'radio';
  habitsRadio.id = `${idPrefix}-link-habits`;
  habitsRadio.name = `${idPrefix}-link-type`;
  habitsRadio.value = 'Habits';
  habitsRadio.setAttribute('aria-describedby', `${idPrefix}-links-tooltip`);
  const habitsLabel = doc.createElement('label');
  habitsLabel.setAttribute('for', `${idPrefix}-link-habits`);
  habitsLabel.textContent = 'Habits';
  habitsOption.append(habitsRadio, habitsLabel);

  const linksEmptyMessage = doc.createElement('p');
  linksEmptyMessage.className = 'aspiration-modal__links-empty';
  linksEmptyMessage.setAttribute('aria-live', 'polite');
  linksEmptyMessage.hidden = true;

  linksFieldset.append(linksLegend, goalsOption, habitsOption, linksEmptyMessage);

  [goalsRadio, habitsRadio].forEach((radio) => {
    radio.addEventListener('click', handleLinkRadioClick);
    radio.addEventListener('change', handleLinkRadioChange);
  });

  wireTooltipIcon(titleIcon, titleTooltip);
  wireTooltipIcon(descriptionIcon, descriptionTooltip);
  wireTooltipIcon(reasonIcon, reasonTooltip);
  wireTooltipIcon(linksIcon, linksTooltip);

  return {
    titleField,
    descriptionField,
    reasonField,
    linksFieldset,
    titleInput,
    descriptionInput,
    reasonInput,
    goalsRadio,
    habitsRadio,
    linksEmptyMessage,
    titleIcon,
    titleTooltip,
    descriptionIcon,
    descriptionTooltip,
    reasonIcon,
    reasonTooltip,
    linksIcon,
    linksTooltip,
    getSelectedLinkType,
    updateLinksState,
    isTooltipOpen,
    hideOpenTooltip,
    handleDocumentClickForTooltip,
  };
}
