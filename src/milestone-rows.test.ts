import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildMilestoneRows, type MilestoneRowsResult } from './milestone-rows';

function setup(): MilestoneRowsResult {
  const result = buildMilestoneRows(document, 'goal');
  document.body.append(result.section);
  return result;
}

function rowInputs(result: MilestoneRowsResult): HTMLInputElement[] {
  return Array.from(result.section.querySelectorAll<HTMLInputElement>('.modal__milestone-input'));
}

function rowRemoveButtons(result: MilestoneRowsResult): HTMLButtonElement[] {
  return Array.from(result.section.querySelectorAll<HTMLButtonElement>('.modal__milestone-remove'));
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

  it("clicking addButton adds exactly one row with a uniquely-id'd input and an accessibly-named remove control (Requirement 14)", () => {
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

  it("each row label is distinct per row, referencing the row's number (Requirement 38)", () => {
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

  it("focus moves to the new row's title input immediately after clicking addButton (Requirement 40)", () => {
    const result = setup();

    result.addButton.click();

    const input = rowInputs(result)[0]!;
    expect(document.activeElement).toBe(input);
  });

  it("a second addButton click moves focus to the second (newest) row's input", () => {
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

// `initialMilestones`/`onRowsChanged`/`getMilestonesForSave` support edit-goal-modal.ts's
// pre-population and dirty-tracking needs (design.md "src/milestone-rows.ts (change)", ADR 0005).
describe('buildMilestoneRows — initialMilestones / onRowsChanged (edit-goal-modal support)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('pre-populates one row per entry in initialMilestones, in stored order, with correct labels and pre-filled values', () => {
    const result = buildMilestoneRows(document, 'edit-goal', {
      initialMilestones: [
        { id: 'm1', title: 'First milestone' },
        { id: 'm2', title: 'Second milestone' },
      ],
    });
    document.body.append(result.section);

    expect(result.rowCount()).toBe(2);
    const inputs = rowInputs(result);
    expect(inputs.map((input) => input.value)).toEqual(['First milestone', 'Second milestone']);

    const labels = Array.from(result.section.querySelectorAll('label')).map(
      (label) => label.textContent,
    );
    expect(labels).toEqual(['Milestone 1', 'Milestone 2']);

    const removeButtons = rowRemoveButtons(result);
    expect(removeButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Remove milestone 1',
      'Remove milestone 2',
    ]);
  });

  it('is a no-op producing zero rows when initialMilestones is omitted (existing Create-modal call site)', () => {
    const result = buildMilestoneRows(document, 'goal');
    document.body.append(result.section);

    expect(result.rowCount()).toBe(0);
  });

  it('pre-population does not write to the aria-live status region', () => {
    const result = buildMilestoneRows(document, 'edit-goal', {
      initialMilestones: [{ id: 'm1', title: 'First milestone' }],
    });
    document.body.append(result.section);

    expect(liveRegion(result).textContent).toBe('');
  });

  it('pre-population does not move focus to any pre-populated row or the addButton', () => {
    const result = buildMilestoneRows(document, 'edit-goal', {
      initialMilestones: [{ id: 'm1', title: 'First milestone' }],
    });
    document.body.append(result.section);

    const input = rowInputs(result)[0]!;
    expect(document.activeElement).not.toBe(input);
    expect(document.activeElement).not.toBe(result.addButton);
  });

  it('a user-triggered addRow() after pre-population continues numbering from N + 1, and announces + focuses the new row', () => {
    const result = buildMilestoneRows(document, 'edit-goal', {
      initialMilestones: [
        { id: 'm1', title: 'First milestone' },
        { id: 'm2', title: 'Second milestone' },
      ],
    });
    document.body.append(result.section);
    const region = liveRegion(result);

    result.addButton.click();

    expect(result.rowCount()).toBe(3);
    const removeButtons = rowRemoveButtons(result);
    expect(removeButtons[2]!.getAttribute('aria-label')).toBe('Remove milestone 3');
    expect(region.textContent).toBe('Milestone 3 added.');
    expect(document.activeElement).toBe(rowInputs(result)[2]);
  });

  it("getMilestonesForSave() returns each pre-populated row's original id, undefined for a newly added row, and excludes blank rows", () => {
    const result = buildMilestoneRows(document, 'edit-goal', {
      initialMilestones: [
        { id: 'm1', title: 'First milestone' },
        { id: 'm2', title: 'Second milestone' },
      ],
    });
    document.body.append(result.section);

    result.addButton.click();
    const inputs = rowInputs(result);
    setValue(inputs[2]!, '  Third (new) milestone  ');

    expect(result.getMilestonesForSave()).toEqual([
      { id: 'm1', title: 'First milestone' },
      { id: 'm2', title: 'Second milestone' },
      { id: undefined, title: 'Third (new) milestone' },
    ]);
  });

  it('getMilestonesForSave() excludes a blank pre-populated row and reflects removal of a row', () => {
    const result = buildMilestoneRows(document, 'edit-goal', {
      initialMilestones: [
        { id: 'm1', title: 'First milestone' },
        { id: 'm2', title: 'Second milestone' },
      ],
    });
    document.body.append(result.section);

    const inputs = rowInputs(result);
    setValue(inputs[1]!, '   '); // blank out the second pre-populated row

    expect(result.getMilestonesForSave()).toEqual([{ id: 'm1', title: 'First milestone' }]);

    rowRemoveButtons(result)[0]!.click(); // remove the (only remaining, non-blank) first row

    expect(result.getMilestonesForSave()).toEqual([]);
  });

  it('onRowsChanged fires after addRow()', () => {
    const onRowsChanged = vi.fn();
    const result = buildMilestoneRows(document, 'edit-goal', { onRowsChanged });
    document.body.append(result.section);

    result.addButton.click();

    expect(onRowsChanged).toHaveBeenCalledTimes(1);
  });

  it('onRowsChanged fires after removeRow()', () => {
    const onRowsChanged = vi.fn();
    const result = buildMilestoneRows(document, 'edit-goal', { onRowsChanged });
    document.body.append(result.section);
    result.addButton.click();
    onRowsChanged.mockClear();

    rowRemoveButtons(result)[0]!.click();

    expect(onRowsChanged).toHaveBeenCalledTimes(1);
  });

  it("onRowsChanged fires on a row's input event (in-place title edit)", () => {
    const onRowsChanged = vi.fn();
    const result = buildMilestoneRows(document, 'edit-goal', { onRowsChanged });
    document.body.append(result.section);
    result.addButton.click();
    onRowsChanged.mockClear();

    setValue(rowInputs(result)[0]!, 'Edited title');

    expect(onRowsChanged).toHaveBeenCalledTimes(1);
  });

  it('onRowsChanged is safely omittable — the existing Create-modal call site (no options argument) still works unchanged', () => {
    const result = buildMilestoneRows(document, 'goal');
    document.body.append(result.section);

    expect(() => result.addButton.click()).not.toThrow();
    expect(() => rowRemoveButtons(result)[0]!.click()).not.toThrow();
  });
});
