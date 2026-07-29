export const MILESTONES_BLURB_TEXT =
  'A milestone is a step on the way to this goal — for example ' +
  "'get promoted to supervisor', 'run a half-marathon', or 'pass my first year of university'.";

export interface MilestoneRowsResult {
  section: HTMLElement; // append this one element into the dialog, in place of "a field"
  addButton: HTMLButtonElement;
  rowCount: () => number;
  getNonBlankTitles: () => string[]; // trimmed, non-empty, DOM order
}

// Dynamic add/remove milestone-row logic (Requirements 10-17, 38-42): unlimited rows, a
// never-reused per-row counter for unique labels/accessible remove-control names, non-blank
// title extraction, order preservation, deterministic focus management on add/remove, and an
// aria-live status region — see `.workflow/add-goal/design.md`'s Key design decision 5 for the
// focus algorithm this implements.
export function buildMilestoneRows(doc: Document, idPrefix: string): MilestoneRowsResult {
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

  function makeRow(n: number): HTMLElement {
    const row = doc.createElement('div');
    row.className = 'modal__field modal__milestone-row';
    row.setAttribute('data-milestone-key', String(n));

    const label = doc.createElement('label');
    const inputId = `${idPrefix}-milestone-${n}-title`;
    label.setAttribute('for', inputId);
    label.textContent = `Milestone ${n}`;

    const input = doc.createElement('input');
    input.type = 'text';
    input.id = inputId;
    input.className = 'modal__milestone-input';

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
  }

  function rowCount(): number {
    return rowsList.children.length;
  }

  function getNonBlankTitles(): string[] {
    return Array.from(rowsList.querySelectorAll<HTMLInputElement>('.modal__milestone-input'))
      .map((input) => input.value.trim())
      .filter((value) => value !== '');
  }

  addButton.addEventListener('click', addRow);

  return { section, addButton, rowCount, getNonBlankTitles };
}
