// Generic tooltip/field-building mechanics, extracted from `src/aspiration-fields.ts` so both it
// and `src/goal-fields.ts` (and any future field-owning module) can share one implementation of
// the info-icon/tooltip state machine and the repeated "label + control + tooltip" field shape,
// instead of each reimplementing it with copy-pasted, independently-drifting logic.

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

export interface TooltipController {
  // Exposed directly rather than behind an opaque `wireTooltips()` wrapper, specifically so each
  // modal file's own `handleDocumentKeydown` can reproduce today's Escape precedence (an open
  // tooltip disclosure closes on the *first* Escape, and only that — the modal/confirm itself
  // must NOT also close on the same keypress; a *second* Escape, with nothing open, closes with
  // no confirmation).
  isTooltipOpen: () => boolean;
  // Idempotent: a no-op returning `false` if nothing was open. Closes whichever tooltip is
  // currently open (if any) and returns `true` if it actually closed one, `false` otherwise.
  hideOpenTooltip: () => boolean;
  // Wired/unwired by the caller on `document` exactly like today's
  // `handleDocumentClickForTooltip` (closes an open tooltip on an outside click).
  handleDocumentClickForTooltip: (event: MouseEvent) => void;
  // Wires click-to-toggle for an arbitrary icon/text pair, generalized so any number of
  // field/tooltip pairs can register with one controller instance, not hardcoded to exactly
  // three (as the old private `wireTooltipIcon` free function was).
  registerIcon: (icon: HTMLButtonElement, text: HTMLElement) => void;
}

export function createTooltipController(): TooltipController {
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
  // for Enter/Space, so no separate keydown handling is needed for that part of the tooltip
  // toggle contract.
  function registerIcon(icon: HTMLButtonElement, text: HTMLElement): void {
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

  return {
    isTooltipOpen,
    hideOpenTooltip,
    handleDocumentClickForTooltip,
    registerIcon,
  };
}

export interface TextFieldOptions {
  idPrefix: string;
  fieldKey: string; // e.g. 'title' — id becomes `${idPrefix}-field-${fieldKey}`
  labelText: string;
  controlType: 'input' | 'textarea';
  tooltipText: string;
  required?: boolean; // default false
  initialValue?: string;
}

export interface TextFieldResult {
  field: HTMLElement; // .modal__field wrapper — append this into the dialog
  input: HTMLInputElement | HTMLTextAreaElement;
  icon: HTMLButtonElement;
  tooltip: HTMLElement;
}

// Produces exactly the DOM shape `aspiration-fields.ts` built inline before this extraction
// (`.modal__field` > `.modal__field-label-row` [`<label for>` + info icon] then
// `<input>`/`<textarea>` then the tooltip `<span>`), with `type='text'`/`required`/
// `aria-required` set only when `controlType==='input'` and `required===true`.
export function buildTextField(
  doc: Document,
  opts: TextFieldOptions,
  tooltipController: TooltipController,
): TextFieldResult {
  const fieldId = `${opts.idPrefix}-field-${opts.fieldKey}`;
  const tooltipId = `${fieldId}-tooltip`;

  const field = doc.createElement('div');
  field.className = 'modal__field';

  const labelRow = doc.createElement('div');
  labelRow.className = 'modal__field-label-row';

  const label = doc.createElement('label');
  label.setAttribute('for', fieldId);
  label.textContent = opts.labelText;

  const icon = createInfoIcon(doc, opts.labelText, tooltipId);
  labelRow.append(label, icon);

  const input =
    opts.controlType === 'textarea' ? doc.createElement('textarea') : doc.createElement('input');
  input.id = fieldId;
  if (opts.controlType === 'input') {
    (input as HTMLInputElement).type = 'text';
    if (opts.required) {
      (input as HTMLInputElement).required = true;
      input.setAttribute('aria-required', 'true');
    }
  }
  input.setAttribute('aria-describedby', tooltipId);
  if (opts.initialValue !== undefined) input.value = opts.initialValue;

  const tooltip = createTooltipText(doc, tooltipId, opts.tooltipText);

  field.append(labelRow, input, tooltip);

  tooltipController.registerIcon(icon, tooltip);

  return { field, input, icon, tooltip };
}
