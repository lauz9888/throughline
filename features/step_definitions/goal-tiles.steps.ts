import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { World } from '../support/world';
import { GOALS_STORAGE_KEY } from '../../src/goal-storage';

// This file is self-contained (not a reuse of `add-goal.steps.ts`), because that file's step
// text is scoped to "the goal modal" — i.e. the Create modal only. The Edit Goal modal opened
// from a tile is a different dialog (`aria-labelledby="edit-goal-modal-heading"`, plus a Delete
// control and pre-populated milestone rows), so it needs its own "the edit goal modal's ..."
// step text and its own DOM-scoping helpers, mirroring how `aspiration-tiles.steps.ts` is
// self-contained relative to `add-aspiration.steps.ts`.
//
// The persistence-checking steps below ARE reused unmodified from `add-goal.steps.ts` (loaded
// into the same Cucumber `World` regardless of which `.feature` file is targeted, since
// `cucumber.cjs`'s `require` glob loads every step definition file up front): `no goal has been
// saved`, `exactly {int} goal(s) is/are saved in local storage`, `the saved goal has title
// {string}, description {string}, and reason {string}`, and `the saved goal's milestones are:`.
// Redefining identical step text here would make those steps ambiguous rather than reusable.

const EDIT_FIELD_IDS: Record<string, string> = {
  Title: 'edit-goal-field-title',
  Description: 'edit-goal-field-description',
  Reason: 'edit-goal-field-reason',
};

interface StoredMilestoneRecord {
  id: string;
  title: string;
}

interface StoredGoalRecord {
  id: string;
  title: string;
  description: string;
  reason: string;
  milestones: StoredMilestoneRecord[];
  createdAt: string;
}

// Base timestamp used to derive deterministic, ascending `createdAt` values for rows that
// don't specify one explicitly.
const BASE_TIME = Date.UTC(2024, 0, 1);

// Captures the most recently seeded goals, so a later step can assert that a saved record's
// `id`/`createdAt` were preserved through an edit (title/description/reason/milestones may have
// since changed, so we can't just re-look-up by title).
let lastSeededGoals: StoredGoalRecord[] = [];

function dispatchClick(world: World, element: Element): void {
  element.dispatchEvent(new world.dom.window.MouseEvent('click', { bubbles: true }));
}

function readStoredGoals(world: World): StoredGoalRecord[] {
  const raw = world.dom.window.localStorage.getItem(GOALS_STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as StoredGoalRecord[]) : [];
}

function getGridSection(world: World): HTMLElement {
  const section = world.document.querySelector<HTMLElement>('.goal-grid-section');
  assert.ok(section, 'expected the goal grid section to exist in the rendered app');
  return section as HTMLElement;
}

function getTiles(world: World): HTMLButtonElement[] {
  return Array.from(getGridSection(world).querySelectorAll<HTMLButtonElement>('.goal-tile'));
}

function getTileByTitle(world: World, title: string): HTMLButtonElement {
  const tile = getTiles(world).find((candidate) => candidate.textContent === title);
  assert.ok(tile, `expected a tile titled "${title}" to exist`);
  return tile as HTMLButtonElement;
}

function findEditDialog(world: World): HTMLElement | null {
  return world.document.querySelector<HTMLElement>(
    '[role="dialog"][aria-labelledby="edit-goal-modal-heading"]',
  );
}

function getEditDialog(world: World): HTMLElement {
  const dialog = findEditDialog(world);
  assert.ok(dialog, 'expected the edit goal modal to be open');
  return dialog as HTMLElement;
}

function getEditField(world: World, fieldName: string): HTMLInputElement | HTMLTextAreaElement {
  const id = EDIT_FIELD_IDS[fieldName];
  assert.ok(id, `unknown field name "${fieldName}"`);
  const field = world.document.getElementById(id);
  assert.ok(field, `expected the edit goal modal's "${fieldName}" field to exist`);
  return field as HTMLInputElement | HTMLTextAreaElement;
}

function getEditCloseButton(world: World): HTMLButtonElement {
  const dialog = getEditDialog(world);
  const button = dialog.querySelector('.modal__close');
  assert.ok(button, "expected the edit goal modal's close button to exist");
  return button as HTMLButtonElement;
}

function getEditSaveButton(world: World): HTMLButtonElement {
  const dialog = getEditDialog(world);
  const button = dialog.querySelector('.modal__save');
  assert.ok(button, "expected the edit goal modal's Save button to exist");
  return button as HTMLButtonElement;
}

function getEditDeleteButton(world: World): HTMLButtonElement {
  const dialog = getEditDialog(world);
  const button = dialog.querySelector('.modal__delete');
  assert.ok(button, "expected the edit goal modal's Delete button to exist");
  return button as HTMLButtonElement;
}

function findDeleteConfirmDialog(world: World): HTMLElement | null {
  return world.document.querySelector<HTMLElement>(
    '[role="alertdialog"][aria-labelledby="edit-goal-delete-confirm-heading"]',
  );
}

function getDeleteConfirmDialog(world: World): HTMLElement {
  const dialog = findDeleteConfirmDialog(world);
  assert.ok(dialog, 'expected the edit goal delete confirmation prompt to be open');
  return dialog as HTMLElement;
}

function findDiscardConfirmDialog(world: World): HTMLElement | null {
  return world.document.querySelector<HTMLElement>(
    '[role="alertdialog"][aria-labelledby="edit-goal-confirm-heading"]',
  );
}

function getDiscardConfirmDialog(world: World): HTMLElement {
  const dialog = findDiscardConfirmDialog(world);
  assert.ok(dialog, 'expected the edit goal discard confirmation prompt to be open');
  return dialog as HTMLElement;
}

function getDeleteConfirmButton(world: World, choice: string): HTMLButtonElement {
  const dialog = getDeleteConfirmDialog(world);
  const selector = choice === 'Delete' ? '.modal__delete-confirm' : '.modal__cancel';
  const button = dialog.querySelector(selector);
  assert.ok(button, `expected the delete confirmation prompt's "${choice}" button to exist`);
  return button as HTMLButtonElement;
}

function getDiscardConfirmButton(world: World, choice: string): HTMLButtonElement {
  const dialog = getDiscardConfirmDialog(world);
  const selector = choice === 'Discard' ? '.modal__discard' : '.modal__cancel';
  const button = dialog.querySelector(selector);
  assert.ok(button, `expected the discard confirmation prompt's "${choice}" button to exist`);
  return button as HTMLButtonElement;
}

// --- Milestone row helpers (edit-modal scoped) ---

function getEditMilestoneRows(world: World): HTMLElement[] {
  const dialog = getEditDialog(world);
  const list = dialog.querySelector('.modal__milestones-list');
  assert.ok(list, "expected the edit goal modal's milestones list to exist");
  return Array.from(list!.children) as HTMLElement[];
}

function getEditMilestoneRow(world: World, position: number): HTMLElement {
  const rows = getEditMilestoneRows(world);
  const row = rows[position - 1];
  assert.ok(row, `expected a milestone row at position ${position}, found ${rows.length} row(s)`);
  return row;
}

function getEditMilestoneInput(row: HTMLElement): HTMLInputElement {
  const input = row.querySelector('.modal__milestone-input');
  assert.ok(input, "expected the milestone row's title input to exist");
  return input as HTMLInputElement;
}

function getEditMilestoneRemoveButton(row: HTMLElement): HTMLButtonElement {
  const button = row.querySelector('.modal__milestone-remove');
  assert.ok(button, "expected the milestone row's remove control to exist");
  return button as HTMLButtonElement;
}

function getEditMilestoneLabel(row: HTMLElement): HTMLLabelElement {
  const label = row.querySelector('label');
  assert.ok(label, "expected the milestone row's label to exist");
  return label as HTMLLabelElement;
}

function getEditAddMilestoneButton(world: World): HTMLButtonElement {
  const dialog = getEditDialog(world);
  const button = dialog.querySelector('.modal__milestone-add');
  assert.ok(button, 'expected the edit goal modal\'s "Add milestone" button to exist');
  return button as HTMLButtonElement;
}

// --- Seeding storage ---

Given('the following goals are stored:', function (this: World, dataTable: DataTable) {
  const rows = dataTable.hashes();
  const records: StoredGoalRecord[] = rows.map((row, index) => ({
    id: `seeded-goal-${index + 1}`,
    title: row.title ?? '',
    description: row.description ?? '',
    reason: row.reason ?? '',
    milestones: (row.milestones ?? '')
      .split(',')
      .map((title) => title.trim())
      .filter((title) => title.length > 0)
      .map((title, milestoneIndex) => ({
        id: `seeded-goal-${index + 1}-milestone-${milestoneIndex + 1}`,
        title,
      })),
    createdAt:
      row.createdAt && row.createdAt.length > 0
        ? row.createdAt
        : new Date(BASE_TIME + index).toISOString(),
  }));
  lastSeededGoals = records;
  this.dom.window.localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(records));
});

// --- Grid ---

Then(
  'the goal grid shows the empty-state message {string}',
  function (this: World, expected: string) {
    const section = getGridSection(this);
    const message = section.querySelector('.goal-grid__empty');
    assert.ok(message, 'expected the empty-state message element to exist');
    assert.equal(message!.textContent, expected);
  },
);

Then('the goal grid contains no tiles', function (this: World) {
  assert.equal(getTiles(this).length, 0);
});

Then(
  'the goal grid shows tiles with titles in this order:',
  function (this: World, dataTable: DataTable) {
    const expected = dataTable.raw().map((row) => row[0]);
    const actual = getTiles(this).map((tile) => tile.textContent);
    assert.deepEqual(actual, expected);
  },
);

Then(
  'the goal tile titled {string} has an accessible name of {string}',
  function (this: World, title: string, expectedName: string) {
    const tile = getTileByTitle(this, title);
    assert.equal(tile.textContent, expectedName);
  },
);

When('the goal tile titled {string} is selected', function (this: World, title: string) {
  const tile = getTileByTitle(this, title);
  dispatchClick(this, tile);
});

// --- Edit modal open/closed state ---

Then('the edit goal modal is open', function (this: World) {
  getEditDialog(this);
});

Then('the edit goal modal is closed', function (this: World) {
  assert.equal(findEditDialog(this), null, 'expected the edit goal modal to be closed');
});

Then("the edit goal modal's heading is {string}", function (this: World, expected: string) {
  const heading = this.document.getElementById('edit-goal-modal-heading');
  assert.ok(heading, 'expected the edit goal modal heading element to exist');
  assert.equal(heading!.textContent, expected);
});

// --- Fields ---

Then(
  "the edit goal modal's {string} field contains {string}",
  function (this: World, fieldName: string, expected: string) {
    const field = getEditField(this, fieldName);
    assert.equal(field.value, expected);
  },
);

When(
  "{string} is entered into the edit goal modal's {string} field",
  function (this: World, text: string, fieldName: string) {
    const field = getEditField(this, fieldName);
    field.value = text;
    field.dispatchEvent(new this.dom.window.Event('input', { bubbles: true }));
  },
);

// --- Save button ---

Then("the edit goal modal's Save button is disabled", function (this: World) {
  assert.equal(getEditSaveButton(this).disabled, true);
});

Then("the edit goal modal's Save button is enabled", function (this: World) {
  assert.equal(getEditSaveButton(this).disabled, false);
});

When("the edit goal modal's Save button is clicked", function (this: World) {
  dispatchClick(this, getEditSaveButton(this));
});

// --- Close button ---

When("the edit goal modal's close button is clicked", function (this: World) {
  dispatchClick(this, getEditCloseButton(this));
});

// --- Delete button and its confirmation prompt ---

When("the edit goal modal's Delete button is clicked", function (this: World) {
  dispatchClick(this, getEditDeleteButton(this));
});

Then('the edit goal delete confirmation prompt is shown', function (this: World) {
  getDeleteConfirmDialog(this);
});

Then('the edit goal delete confirmation prompt is closed', function (this: World) {
  assert.equal(
    findDeleteConfirmDialog(this),
    null,
    'expected the edit goal delete confirmation prompt to be closed',
  );
});

When(
  '{string} is chosen in the edit goal delete confirmation prompt',
  function (this: World, choice: string) {
    dispatchClick(this, getDeleteConfirmButton(this, choice));
  },
);

// --- Discard (unsaved-changes) confirmation prompt ---

Then('the edit goal discard confirmation prompt is shown', function (this: World) {
  getDiscardConfirmDialog(this);
});

Then('the edit goal discard confirmation prompt is closed', function (this: World) {
  assert.equal(
    findDiscardConfirmDialog(this),
    null,
    'expected the edit goal discard confirmation prompt to be closed',
  );
});

When(
  '{string} is chosen in the edit goal discard confirmation prompt',
  function (this: World, choice: string) {
    dispatchClick(this, getDiscardConfirmButton(this, choice));
  },
);

// --- Milestone rows (edit modal scoped) ---

When('the edit goal modal\'s "Add milestone" button is clicked', function (this: World) {
  dispatchClick(this, getEditAddMilestoneButton(this));
});

Then('the edit goal modal has {int} milestone row(s)', function (this: World, count: number) {
  assert.equal(getEditMilestoneRows(this).length, count);
});

Then(
  "the edit goal modal's milestone row {int} is labeled {string}",
  function (this: World, position: number, expectedLabel: string) {
    const row = getEditMilestoneRow(this, position);
    assert.equal(getEditMilestoneLabel(row).textContent, expectedLabel);
  },
);

When(
  "{string} is entered into the edit goal modal's milestone row {int}'s title field",
  function (this: World, text: string, position: number) {
    const row = getEditMilestoneRow(this, position);
    const input = getEditMilestoneInput(row);
    input.value = text;
    input.dispatchEvent(new this.dom.window.Event('input', { bubbles: true }));
  },
);

Then(
  "the edit goal modal's milestone row {int}'s title field contains {string}",
  function (this: World, position: number, expected: string) {
    const row = getEditMilestoneRow(this, position);
    assert.equal(getEditMilestoneInput(row).value, expected);
  },
);

When(
  "the edit goal modal's milestone row {int} is removed",
  function (this: World, position: number) {
    const row = getEditMilestoneRow(this, position);
    dispatchClick(this, getEditMilestoneRemoveButton(row));
  },
);

// --- Persistence ---

Then(
  "the saved goal's id and createdAt are unchanged from when it was stored",
  function (this: World) {
    const stored = readStoredGoals(this);
    assert.equal(stored.length, 1, 'expected exactly one stored goal');
    assert.equal(lastSeededGoals.length, 1, 'expected exactly one previously-seeded goal');
    assert.equal(stored[0]!.id, lastSeededGoals[0]!.id);
    assert.equal(stored[0]!.createdAt, lastSeededGoals[0]!.createdAt);
  },
);
