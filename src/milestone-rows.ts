import type { Milestone } from './goal-storage';

export const MILESTONES_BLURB_TEXT =
  'A milestone is a step on the way to this goal — for example ' +
  "'get promoted to supervisor', 'run a half-marathon', or 'pass my first year of university'.";

export interface BuildMilestoneRowsOptions {
  // Pre-populates one row per entry, in array order, on construction — used by
  // edit-goal-modal.ts to seed rows from the loaded goal's stored milestones (Requirement 11).
  // Omitted (or empty) by goal-modal.ts's Create-modal call, which always starts empty.
  initialMilestones?: Milestone[];
  // Called after any add, remove, or in-place title edit to a row — lets a caller keep its own
  // reactive state (e.g. edit-goal-modal.ts's Save-button-enabled state, Requirement 16) in sync
  // without polling. goal-modal.ts doesn't need this (its Save-enable logic is title-only) so
  // it's omitted there.
  onRowsChanged?: () => void;
}

export interface MilestoneRowsResult {
  section: HTMLElement; // append this one element into the dialog, in place of "a field"
  addButton: HTMLButtonElement;
  rowCount: () => number;
  getNonBlankTitles: () => string[]; // trimmed, non-empty, DOM order
  // Trimmed, non-blank rows in DOM order, each carrying the row's original milestone id (if it
  // was pre-populated and not removed) or `undefined` (if the row was added this session) —
  // Requirement 18. Blank rows are excluded, same rule as getNonBlankTitles/Create's save path.
  getMilestonesForSave: () => Array<{ id?: string; title: string }>;
}

// Dynamic add/remove milestone-row logic (Requirements 10-17, 38-42): unlimited rows, a
// never-reused per-row counter for unique labels/accessible remove-control names, non-blank
// title extraction, order preservation, deterministic focus management on add/remove, and an
// aria-live status region — see `.workflow/add-goal/design.md`'s Key design decision 5 for the
// focus algorithm this implements. Extended (edit-goal-modal.ts) with optional pre-population and
// change notification — see ADR 0004 for the row-numbering/focus mechanics (unchanged) and ADR
// 0005 for the id-preservation rationale behind `initialMilestones`/`getMilestonesForSave`.
export function buildMilestoneRows(
  doc: Document,
  idPrefix: string,
  options?: BuildMilestoneRowsOptions,
): MilestoneRowsResult {
  const section = doc.createElement('div');
  section.className = 'modal__milestones';

  const heading = doc.createElement('h3');
  heading.className = 'modal__milestones-heading';
  heading.textContent = 'Milestones';

  const blurb = doc.createElement('p');
  blurb.className = 'modal__blurb';
  blurb.textContent = MILESTONES_BLURB_TEXT;

  const rowsList = doc.createElement('div');
  rowsList.className = 'modal__milestones-list';

  const addButton = doc.createElement('button');
  addButton.type = 'button';
  addButton.className = 'modal__milestone-add';
  addButton.textContent = 'Add milestone';

  const liveRegion = doc.createElement('div');
  liveRegion.className = 'visually-hidden';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');

  section.append(heading, blurb, rowsList, addButton, liveRegion);

  // A permanently unique, never-reused, monotonically increasing counter (assigned once, at
  // creation, from this per-modal-open closure) used for both a row's visible label
  // ("Milestone N") and its remove control's accessible name ("Remove milestone N") — see Key
  // design decision 5 for why this is preferred over renumbering on every removal.
  let counter = 0;

  function makeRow(n: number, initialTitle?: string, milestoneId?: string): HTMLElement {
    const row = doc.createElement('div');
    row.className = 'modal__field modal__milestone-row';
    row.setAttribute('data-milestone-key', String(n));
    if (milestoneId !== undefined) row.dataset.milestoneId = milestoneId;

    const label = doc.createElement('label');
    const inputId = `${idPrefix}-milestone-${n}-title`;
    label.setAttribute('for', inputId);
    label.textContent = `Milestone ${n}`;

    const input = doc.createElement('input');
    input.type = 'text';
    input.id = inputId;
    input.className = 'modal__milestone-input';
    if (initialTitle !== undefined) input.value = initialTitle;
    input.addEventListener('input', () => options?.onRowsChanged?.());

    const removeButton = doc.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'modal__milestone-remove';
    removeButton.setAttribute('aria-label', `Remove milestone ${n}`);
    removeButton.textContent = '×';
    removeButton.addEventListener('click', () => removeRow(row));

    row.append(label, input, removeButton);
    return row;
  }

  function focusRowInput(row: Element | undefined): void {
    if (!row) return;
    const input = row.querySelector<HTMLInputElement>('.modal__milestone-input');
    input?.focus();
  }

  function addRow(): void {
    counter += 1;
    const n = counter;
    const row = makeRow(n);
    rowsList.append(row);
    liveRegion.textContent = `Milestone ${n} added.`;
    focusRowInput(row);
    options?.onRowsChanged?.();
  }

  function removeRow(row: HTMLElement): void {
    const key = row.getAttribute('data-milestone-key') ?? '';
    const index = Array.from(rowsList.children).indexOf(row);
    row.remove();
    liveRegion.textContent = `Milestone ${key} removed.`;

    const remaining = Array.from(rowsList.children);
    if (index < remaining.length) {
      // The row that visually now takes the removed row's place.
      focusRowInput(remaining[index]);
    } else if (remaining.length > 0) {
      // The new last remaining row.
      focusRowInput(remaining[remaining.length - 1]);
    } else {
      // The list is now empty.
      addButton.focus();
    }
    options?.onRowsChanged?.();
  }

  function rowCount(): number {
    return rowsList.children.length;
  }

  function getNonBlankTitles(): string[] {
    return Array.from(rowsList.querySelectorAll<HTMLInputElement>('.modal__milestone-input'))
      .map((input) => input.value.trim())
      .filter((value) => value !== '');
  }

  function getMilestonesForSave(): Array<{ id?: string; title: string }> {
    return Array.from(rowsList.children)
      .map((row) => {
        const element = row as HTMLElement;
        const input = element.querySelector<HTMLInputElement>('.modal__milestone-input');
        return { id: element.dataset.milestoneId, title: (input?.value ?? '').trim() };
      })
      .filter((entry) => entry.title !== '');
  }

  addButton.addEventListener('click', addRow);

  // Pre-population (edit-goal-modal.ts only): builds rows directly, deliberately bypassing
  // addRow() so it doesn't touch the live region or move focus — see BuildMilestoneRowsOptions'
  // `initialMilestones` doc comment above for the rationale.
  if (options?.initialMilestones && options.initialMilestones.length > 0) {
    for (const milestone of options.initialMilestones) {
      counter += 1;
      const row = makeRow(counter, milestone.title, milestone.id);
      rowsList.append(row);
    }
  }

  return { section, addButton, rowCount, getNonBlankTitles, getMilestonesForSave };
}
