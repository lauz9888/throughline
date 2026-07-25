import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { World } from '../support/world';
import { ASPIRATIONS_STORAGE_KEY } from '../../src/aspiration-storage';

const EDIT_FIELD_IDS: Record<string, string> = {
  Title: 'edit-aspiration-field-title',
  Description: 'edit-aspiration-field-description',
  Reason: 'edit-aspiration-field-reason',
};

interface StoredAspirationRecord {
  id: string;
  title: string;
  description: string;
  reason: string;
  createdAt: string;
}

// Base timestamp used to derive deterministic, ascending `createdAt` values for rows that
// don't specify one explicitly.
const BASE_TIME = Date.UTC(2024, 0, 1);

// Captures the most recently seeded aspirations, so a later step can assert that a saved
// record's `id`/`createdAt` were preserved through an edit (title/description/reason may have
// since changed, so we can't just re-look-up by title).
let lastSeededAspirations: StoredAspirationRecord[] = [];

function dispatchClick(world: World, element: Element): void {
  element.dispatchEvent(new world.dom.window.MouseEvent('click', { bubbles: true }));
}

function readStoredAspirations(world: World): StoredAspirationRecord[] {
  const raw = world.dom.window.localStorage.getItem(ASPIRATIONS_STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as StoredAspirationRecord[]) : [];
}

function getGridSection(world: World): HTMLElement {
  const section = world.document.querySelector<HTMLElement>('.aspiration-grid-section');
  assert.ok(section, 'expected the aspiration grid section to exist in the rendered app');
  return section as HTMLElement;
}

function getTiles(world: World): HTMLButtonElement[] {
  return Array.from(getGridSection(world).querySelectorAll<HTMLButtonElement>('.aspiration-tile'));
}

function getTileByTitle(world: World, title: string): HTMLButtonElement {
  const tile = getTiles(world).find((candidate) => candidate.textContent === title);
  assert.ok(tile, `expected a tile titled "${title}" to exist`);
  return tile as HTMLButtonElement;
}

function findEditDialog(world: World): HTMLElement | null {
  return world.document.querySelector<HTMLElement>(
    '[role="dialog"][aria-labelledby="edit-aspiration-modal-heading"]',
  );
}

function getEditDialog(world: World): HTMLElement {
  const dialog = findEditDialog(world);
  assert.ok(dialog, 'expected the edit aspiration modal to be open');
  return dialog as HTMLElement;
}

function getEditField(world: World, fieldName: string): HTMLInputElement | HTMLTextAreaElement {
  const id = EDIT_FIELD_IDS[fieldName];
  assert.ok(id, `unknown field name "${fieldName}"`);
  const field = world.document.getElementById(id);
  assert.ok(field, `expected the edit aspiration modal's "${fieldName}" field to exist`);
  return field as HTMLInputElement | HTMLTextAreaElement;
}

function getEditLinkRadio(world: World, label: string): HTMLInputElement {
  const id = label === 'Goals' ? 'edit-aspiration-link-goals' : 'edit-aspiration-link-habits';
  const radio = world.document.getElementById(id);
  assert.ok(
    radio,
    `expected the "${label}" link radio button to exist in the edit aspiration modal`,
  );
  return radio as HTMLInputElement;
}

function getEditCloseButton(world: World): HTMLButtonElement {
  const dialog = getEditDialog(world);
  const button = dialog.querySelector('.modal__close');
  assert.ok(button, "expected the edit aspiration modal's close button to exist");
  return button as HTMLButtonElement;
}

function getEditSaveButton(world: World): HTMLButtonElement {
  const dialog = getEditDialog(world);
  const button = dialog.querySelector('.modal__save');
  assert.ok(button, "expected the edit aspiration modal's Save button to exist");
  return button as HTMLButtonElement;
}

function getEditDeleteButton(world: World): HTMLButtonElement {
  const dialog = getEditDialog(world);
  const button = dialog.querySelector('.modal__delete');
  assert.ok(button, "expected the edit aspiration modal's Delete button to exist");
  return button as HTMLButtonElement;
}

function findDeleteConfirmDialog(world: World): HTMLElement | null {
  return world.document.querySelector<HTMLElement>(
    '[role="alertdialog"][aria-labelledby="edit-aspiration-delete-confirm-heading"]',
  );
}

function getDeleteConfirmDialog(world: World): HTMLElement {
  const dialog = findDeleteConfirmDialog(world);
  assert.ok(dialog, 'expected the edit aspiration delete confirmation prompt to be open');
  return dialog as HTMLElement;
}

function findDiscardConfirmDialog(world: World): HTMLElement | null {
  return world.document.querySelector<HTMLElement>(
    '[role="alertdialog"][aria-labelledby="edit-aspiration-confirm-heading"]',
  );
}

function getDiscardConfirmDialog(world: World): HTMLElement {
  const dialog = findDiscardConfirmDialog(world);
  assert.ok(dialog, 'expected the edit aspiration discard confirmation prompt to be open');
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

// --- Seeding storage ---

Given('the following aspirations are stored:', function (this: World, dataTable: DataTable) {
  const rows = dataTable.hashes();
  const records: StoredAspirationRecord[] = rows.map((row, index) => ({
    id: `seeded-aspiration-${index + 1}`,
    title: row.title ?? '',
    description: row.description ?? '',
    reason: row.reason ?? '',
    createdAt:
      row.createdAt && row.createdAt.length > 0
        ? row.createdAt
        : new Date(BASE_TIME + index).toISOString(),
  }));
  lastSeededAspirations = records;
  this.dom.window.localStorage.setItem(ASPIRATIONS_STORAGE_KEY, JSON.stringify(records));
});

// --- Grid ---

Then(
  'the aspiration grid shows the empty-state message {string}',
  function (this: World, expected: string) {
    const section = getGridSection(this);
    const message = section.querySelector('.aspiration-grid__empty');
    assert.ok(message, 'expected the empty-state message element to exist');
    assert.equal(message!.textContent, expected);
  },
);

Then('the aspiration grid contains no tiles', function (this: World) {
  assert.equal(getTiles(this).length, 0);
});

Then(
  'the aspiration grid shows tiles with titles in this order:',
  function (this: World, dataTable: DataTable) {
    const expected = dataTable.raw().map((row) => row[0]);
    const actual = getTiles(this).map((tile) => tile.textContent);
    assert.deepEqual(actual, expected);
  },
);

Then(
  'the aspiration tile titled {string} has an accessible name of {string}',
  function (this: World, title: string, expectedName: string) {
    const tile = getTileByTitle(this, title);
    assert.equal(tile.textContent, expectedName);
  },
);

When('the aspiration tile titled {string} is selected', function (this: World, title: string) {
  const tile = getTileByTitle(this, title);
  dispatchClick(this, tile);
});

// --- Edit modal open/closed state ---

Then('the edit aspiration modal is open', function (this: World) {
  getEditDialog(this);
});

Then('the edit aspiration modal is closed', function (this: World) {
  assert.equal(findEditDialog(this), null, 'expected the edit aspiration modal to be closed');
});

Then("the edit aspiration modal's heading is {string}", function (this: World, expected: string) {
  const heading = this.document.getElementById('edit-aspiration-modal-heading');
  assert.ok(heading, 'expected the edit aspiration modal heading element to exist');
  assert.equal(heading!.textContent, expected);
});

// --- Fields ---

Then(
  "the edit aspiration modal's {string} field contains {string}",
  function (this: World, fieldName: string, expected: string) {
    const field = getEditField(this, fieldName);
    assert.equal(field.value, expected);
  },
);

When(
  "{string} is entered into the edit aspiration modal's {string} field",
  function (this: World, text: string, fieldName: string) {
    const field = getEditField(this, fieldName);
    field.value = text;
    field.dispatchEvent(new this.dom.window.Event('input', { bubbles: true }));
  },
);

Then(
  'neither the {string} nor the {string} link radio button is selected in the edit aspiration modal',
  function (this: World, first: string, second: string) {
    const firstRadio = getEditLinkRadio(this, first);
    const secondRadio = getEditLinkRadio(this, second);
    assert.equal(firstRadio.checked, false, `expected the "${first}" radio to be unselected`);
    assert.equal(secondRadio.checked, false, `expected the "${second}" radio to be unselected`);
  },
);

// --- Save button ---

Then("the edit aspiration modal's Save button is disabled", function (this: World) {
  assert.equal(getEditSaveButton(this).disabled, true);
});

Then("the edit aspiration modal's Save button is enabled", function (this: World) {
  assert.equal(getEditSaveButton(this).disabled, false);
});

When("the edit aspiration modal's Save button is clicked", function (this: World) {
  dispatchClick(this, getEditSaveButton(this));
});

// --- Close button ---

When("the edit aspiration modal's close button is clicked", function (this: World) {
  dispatchClick(this, getEditCloseButton(this));
});

// --- Delete button and its confirmation prompt ---

When("the edit aspiration modal's Delete button is clicked", function (this: World) {
  dispatchClick(this, getEditDeleteButton(this));
});

Then('the edit aspiration delete confirmation prompt is shown', function (this: World) {
  getDeleteConfirmDialog(this);
});

Then('the edit aspiration delete confirmation prompt is closed', function (this: World) {
  assert.equal(
    findDeleteConfirmDialog(this),
    null,
    'expected the edit aspiration delete confirmation prompt to be closed',
  );
});

When(
  '{string} is chosen in the edit aspiration delete confirmation prompt',
  function (this: World, choice: string) {
    dispatchClick(this, getDeleteConfirmButton(this, choice));
  },
);

// --- Discard (unsaved-changes) confirmation prompt ---

Then('the edit aspiration discard confirmation prompt is shown', function (this: World) {
  getDiscardConfirmDialog(this);
});

Then('the edit aspiration discard confirmation prompt is closed', function (this: World) {
  assert.equal(
    findDiscardConfirmDialog(this),
    null,
    'expected the edit aspiration discard confirmation prompt to be closed',
  );
});

When(
  '{string} is chosen in the edit aspiration discard confirmation prompt',
  function (this: World, choice: string) {
    dispatchClick(this, getDiscardConfirmButton(this, choice));
  },
);

// --- Persistence ---

Then(
  "the saved aspiration's id and createdAt are unchanged from when it was stored",
  function (this: World) {
    const stored = readStoredAspirations(this);
    assert.equal(stored.length, 1, 'expected exactly one stored aspiration');
    assert.equal(
      lastSeededAspirations.length,
      1,
      'expected exactly one previously-seeded aspiration',
    );
    assert.equal(stored[0]!.id, lastSeededAspirations[0]!.id);
    assert.equal(stored[0]!.createdAt, lastSeededAspirations[0]!.createdAt);
  },
);
