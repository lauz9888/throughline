import { describe, it, expect, beforeEach } from 'vitest';
import { buildMilestoneRows, type MilestoneRowsResult } from './milestone-rows';

function setup(): MilestoneRowsResult {
  const result = buildMilestoneRows(document, 'goal');
  document.body.append(result.section);
  return result;
}

function rowInputs(result: MilestoneRowsResult): HTMLInputElement[] {
  return Array.from(
    result.section.querySelectorAll<HTMLInputElement>('.modal__milestone-input'),
  );
}

function rowRemoveButtons(result: MilestoneRowsResult): HTMLButtonElement[] {
  return Array.from(
    result.section.querySelectorAll<HTMLButtonElement>('.modal__milestone-remove'),
  );
}

function liveRegion(result: MilestoneRowsResult): HTMLElement {
  const region = result.section.querySelector<HTMLElement>('[aria-live]');
  if (!region) throw new Error('Expected an aria-live region inside the Milestones section');
  return region;
}

function setValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('buildMilestoneRows', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('starts with zero rows on build (Requirement 11)', () => {
    const result = setup();

    expect(result.rowCount()).toBe(0);
    expect(rowInputs(result)).toHaveLength(0);
  });

  it('provides a single, always-present addButton control (Requirement 12)', () => {
    const result = setup();

    expect(result.addButton.tagName).toBe('BUTTON');
    expect(result.addButton.textContent).toBe('Add milestone');
    expect(result.section.querySelectorAll('.modal__milestone-add')).toHaveLength(1);
  });

  it('clicking addButton adds exactly one row with a uniquely-id\'d input and an accessibly-named remove control (Requirement 14)', () => {
    const result = setup();

    result.addButton.click();

    expect(result.rowCount()).toBe(1);
    const inputs = rowInputs(result);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.id).toBeTruthy();

    const removeButtons = rowRemoveButtons(result);
    expect(removeButtons).toHaveLength(1);
    expect(removeButtons[0]!.getAttribute('aria-label')).toBe('Remove milestone 1');
  });

  it('each row label is distinct per row, referencing the row\'s number (Requirement 38)', () => {
    const result = setup();

    result.addButton.click();
    result.addButton.click();

    const labels = Array.from(result.section.querySelectorAll('label')).map(
      (label) => label.textContent,
    );
    expect(labels).toEqual(['Milestone 1', 'Milestone 2']);
  });

  it('milestone-row inputs are never marked required/aria-required (Requirement 39)', () => {
    const result = setup();

    result.addButton.click();

    const input = rowInputs(result)[0]!;
    expect(input.hasAttribute('required')).toBe(false);
    expect(input.hasAttribute('aria-required')).toBe(false);
  });

  it('has no upper limit — repeated clicks add an unbounded number of independent rows (Requirement 13)', () => {
    const result = setup();

    for (let i = 0; i < 7; i += 1) result.addButton.click();

    expect(result.rowCount()).toBe(7);
    const removeButtons = rowRemoveButtons(result);
    expect(removeButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Remove milestone 1',
      'Remove milestone 2',
      'Remove milestone 3',
      'Remove milestone 4',
      'Remove milestone 5',
      'Remove milestone 6',
      'Remove milestone 7',
    ]);
  });

  it('the row numbering counter is never reused, even after a remove-then-add sequence', () => {
    const result = setup();

    result.addButton.click(); // Milestone 1
    result.addButton.click(); // Milestone 2
    rowRemoveButtons(result)[1]!.click(); // remove Milestone 2
    result.addButton.click(); // should be Milestone 3, not a re-used Milestone 2

    const removeButtons = rowRemoveButtons(result);
    expect(removeButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Remove milestone 1',
      'Remove milestone 3',
    ]);
  });

  it('removing a specific (middle) row leaves the other rows, their entered values, and their order intact (Requirements 14, 17)', () => {
    const result = setup();

    result.addButton.click();
    result.addButton.click();
    result.addButton.click();

    const inputs = rowInputs(result);
    setValue(inputs[0]!, 'First milestone');
    setValue(inputs[1]!, 'Second milestone');
    setValue(inputs[2]!, 'Third milestone');

    rowRemoveButtons(result)[1]!.click(); // remove the middle row

    expect(result.rowCount()).toBe(2);
    const remainingInputs = rowInputs(result);
    expect(remainingInputs.map((input) => input.value)).toEqual([
      'First milestone',
      'Third milestone',
    ]);
  });

  it('getNonBlankTitles() trims values, excludes blank/whitespace-only rows, and preserves DOM order (Requirements 16, 17)', () => {
    const result = setup();

    result.addButton.click();
    result.addButton.click();
    result.addButton.click();
    result.addButton.click();

    const inputs = rowInputs(result);
    setValue(inputs[0]!, '  First milestone  ');
    setValue(inputs[1]!, '   ');
    setValue(inputs[2]!, '');
    setValue(inputs[3]!, 'Fourth milestone');

    expect(result.getNonBlankTitles()).toEqual(['First milestone', 'Fourth milestone']);
  });

  it('getNonBlankTitles() still preserves order after a row is removed', () => {
    const result = setup();

    result.addButton.click();
    result.addButton.click();
    result.addButton.click();

    const inputs = rowInputs(result);
    setValue(inputs[0]!, 'A');
    setValue(inputs[1]!, 'B');
    setValue(inputs[2]!, 'C');

    rowRemoveButtons(result)[0]!.click(); // remove first ("A")

    expect(result.getNonBlankTitles()).toEqual(['B', 'C']);
  });

  it('focus moves to the new row\'s title input immediately after clicking addButton (Requirement 40)', () => {
    const result = setup();

    result.addButton.click();

    const input = rowInputs(result)[0]!;
    expect(document.activeElement).toBe(input);
  });

  it('a second addButton click moves focus to the second (newest) row\'s input', () => {
    const result = setup();

    result.addButton.click();
    result.addButton.click();

    const inputs = rowInputs(result);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('removing a middle row (of three) moves focus to what is now in its place (Requirement 40)', () => {
    const result = setup();

    result.addButton.click();
    result.addButton.click();
    result.addButton.click();

    rowRemoveButtons(result)[1]!.click(); // remove middle row

    const remainingInputs = rowInputs(result);
    expect(document.activeElement).toBe(remainingInputs[1]); // the row that took its place
  });

  it('removing the last row moves focus to the new last row (Requirement 40)', () => {
    const result = setup();

    result.addButton.click();
    result.addButton.click();

    rowRemoveButtons(result)[1]!.click(); // remove the last row

    const remainingInputs = rowInputs(result);
    expect(document.activeElement).toBe(remainingInputs[0]);
  });

  it('removing the only row moves focus to the "Add milestone" button (Requirement 40)', () => {
    const result = setup();

    result.addButton.click();
    rowRemoveButtons(result)[0]!.click();

    expect(result.rowCount()).toBe(0);
    expect(document.activeElement).toBe(result.addButton);
  });

  it('updates the aria-live region with "Milestone {n} added." on add, and "Milestone {n} removed." on remove (Requirement 42)', () => {
    const result = setup();
    const region = liveRegion(result);

    result.addButton.click();
    expect(region.textContent).toBe('Milestone 1 added.');

    result.addButton.click();
    expect(region.textContent).toBe('Milestone 2 added.');

    rowRemoveButtons(result)[1]!.click();
    expect(region.textContent).toBe('Milestone 2 removed.');
  });

  it('the aria-live region is polite and atomic', () => {
    const result = setup();
    const region = liveRegion(result);

    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
  });

  it('includes a Milestones-section blurb (Requirement 10)', () => {
    const result = setup();

    const blurb = result.section.querySelector('.modal__blurb');
    expect(blurb).not.toBeNull();
    expect(blurb?.textContent).toContain('milestone');
  });
});
