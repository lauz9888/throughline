import { When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { World } from '../support/world';

// Matches `src/aspiration-storage.ts`'s `ASPIRATIONS_STORAGE_KEY` (that module doesn't exist
// yet, so the constant is duplicated here rather than imported — importing a nonexistent module
// at require-time would abort the whole Cucumber run, including unrelated feature files).
const ASPIRATIONS_STORAGE_KEY = 'throughline:aspirations';

const FIELD_IDS: Record<string, string> = {
  Title: 'aspiration-field-title',
  Description: 'aspiration-field-description',
  Reason: 'aspiration-field-reason',
};

interface StoredAspiration {
  title: string;
  description: string;
  reason: string;
}

function getAddItemMenu(world: World): HTMLElement {
  const menu = world.document.getElementById('add-item-menu');
  assert.ok(menu, 'expected #add-item-menu to exist in the rendered app');
  return menu as HTMLElement;
}

function findMainDialog(world: World): HTMLElement | null {
  return world.document.querySelector<HTMLElement>(
    '[role="dialog"][aria-labelledby="aspiration-modal-heading"]',
  );
}

function getMainDialog(world: World): HTMLElement {
  const dialog = findMainDialog(world);
  assert.ok(dialog, 'expected the aspiration modal to be open');
  return dialog as HTMLElement;
}

function findConfirmDialog(world: World): HTMLElement | null {
  return world.document.querySelector<HTMLElement>('[role="alertdialog"]');
}

function getConfirmDialog(world: World): HTMLElement {
  const dialog = findConfirmDialog(world);
  assert.ok(dialog, 'expected the confirmation prompt to be open');
  return dialog as HTMLElement;
}

function getField(world: World, fieldName: string): HTMLInputElement | HTMLTextAreaElement {
  const id = FIELD_IDS[fieldName];
  assert.ok(id, `unknown field name "${fieldName}"`);
  const field = world.document.getElementById(id);
  assert.ok(field, `expected the aspiration modal's "${fieldName}" field to exist`);
  return field as HTMLInputElement | HTMLTextAreaElement;
}

function getLinkRadio(world: World, label: string): HTMLInputElement {
  const id = label === 'Goals' ? 'aspiration-link-goals' : 'aspiration-link-habits';
  const radio = world.document.getElementById(id);
  assert.ok(radio, `expected the "${label}" link radio button to exist`);
  return radio as HTMLInputElement;
}

function getLinksEmptyMessage(world: World): HTMLElement {
  const dialog = getMainDialog(world);
  const message = dialog.querySelector('.aspiration-modal__links-empty');
  assert.ok(message, 'expected the links empty-state message element to exist');
  return message as HTMLElement;
}

function getCloseButton(world: World): HTMLButtonElement {
  const dialog = getMainDialog(world);
  const button = dialog.querySelector('.modal__close');
  assert.ok(button, "expected the aspiration modal's close button to exist");
  return button as HTMLButtonElement;
}

function getSaveButton(world: World): HTMLButtonElement {
  const dialog = getMainDialog(world);
  const button = dialog.querySelector('.modal__save');
  assert.ok(button, "expected the aspiration modal's Save button to exist");
  return button as HTMLButtonElement;
}

function getBackdrop(world: World): HTMLElement {
  const dialog = getMainDialog(world);
  const overlay = dialog.parentElement;
  assert.ok(overlay, "expected the aspiration modal's backdrop overlay to exist");
  return overlay as HTMLElement;
}

function getConfirmButton(world: World, choice: string): HTMLButtonElement {
  const dialog = getConfirmDialog(world);
  const selector = choice === 'Discard' ? '.modal__discard' : '.modal__cancel';
  const button = dialog.querySelector(selector);
  assert.ok(button, `expected the confirmation prompt's "${choice}" button to exist`);
  return button as HTMLButtonElement;
}

function dispatchClick(world: World, element: Element): void {
  element.dispatchEvent(new world.dom.window.MouseEvent('click', { bubbles: true }));
}

function readAspirations(world: World): StoredAspiration[] {
  const raw = world.dom.window.localStorage.getItem(ASPIRATIONS_STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as StoredAspiration[]) : [];
}

// --- Navigation ---

When('the {string} item is selected from the add-item menu', function (this: World, label: string) {
  const menu = getAddItemMenu(this);
  const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  const item = items.find((candidate) => candidate.textContent === label);
  assert.ok(item, `expected an add-item menu item labeled "${label}" to exist`);
  dispatchClick(this, item as HTMLButtonElement);
});

// --- Modal open/closed state ---

Then('the aspiration modal is open', function (this: World) {
  getMainDialog(this);
});

Then('the aspiration modal is closed', function (this: World) {
  assert.equal(findMainDialog(this), null, 'expected the aspiration modal to be closed');
});

Then('exactly {int} aspiration modal is open', function (this: World, count: number) {
  const dialogs = this.document.querySelectorAll(
    '[role="dialog"][aria-labelledby="aspiration-modal-heading"]',
  );
  assert.equal(dialogs.length, count);
});

// --- Header / blurb / content order ---

Then("the aspiration modal's heading is {string}", function (this: World, expected: string) {
  const heading = this.document.getElementById('aspiration-modal-heading');
  assert.ok(heading, 'expected the aspiration modal heading element to exist');
  assert.equal(heading!.textContent, expected);
});

Then("the aspiration modal's blurb text is {string}", function (this: World, expected: string) {
  const dialog = getMainDialog(this);
  const blurb = dialog.querySelector('.modal__blurb');
  assert.ok(blurb, 'expected the aspiration modal blurb element to exist');
  assert.equal(blurb!.textContent, expected);
});

Then('the blurb appears before the Title field in the modal', function (this: World) {
  const dialog = getMainDialog(this);
  const blurb = dialog.querySelector('.modal__blurb');
  assert.ok(blurb, 'expected the aspiration modal blurb element to exist');
  const title = getField(this, 'Title');
  const position = blurb!.compareDocumentPosition(title);
  assert.ok(
    (position & this.dom.window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    'expected the blurb to appear before the Title field',
  );
});

// --- Fields ---

Then("the aspiration modal has a required field labeled {string}", function (
  this: World,
  label: string,
) {
  const field = getField(this, label);
  const associatedLabel = this.document.querySelector(`label[for="${field.id}"]`);
  assert.ok(associatedLabel, `expected a <label for="${field.id}"> element to exist`);
  assert.equal(associatedLabel!.textContent, label);
  assert.notEqual(
    field.getAttribute('required'),
    null,
    `expected the "${label}" field to have the required attribute`,
  );
  assert.equal(field.getAttribute('aria-required'), 'true');
});

Then("the aspiration modal has an optional field labeled {string}", function (
  this: World,
  label: string,
) {
  const field = getField(this, label);
  const associatedLabel = this.document.querySelector(`label[for="${field.id}"]`);
  assert.ok(associatedLabel, `expected a <label for="${field.id}"> element to exist`);
  assert.equal(associatedLabel!.textContent, label);
  assert.equal(
    field.getAttribute('required'),
    null,
    `expected the "${label}" field not to be required`,
  );
});

When("{string} is entered into the aspiration modal's {string} field", function (
  this: World,
  text: string,
  fieldName: string,
) {
  const field = getField(this, fieldName);
  field.value = text;
  field.dispatchEvent(new this.dom.window.Event('input', { bubbles: true }));
});

When("the aspiration modal's {string} field is cleared", function (this: World, fieldName: string) {
  const field = getField(this, fieldName);
  field.value = '';
  field.dispatchEvent(new this.dom.window.Event('input', { bubbles: true }));
});

Then("the aspiration modal's {string} field contains {string}", function (
  this: World,
  fieldName: string,
  expected: string,
) {
  const field = getField(this, fieldName);
  assert.equal(field.value, expected);
});

// --- Save button ---

Then("the aspiration modal's Save button is disabled", function (this: World) {
  const button = getSaveButton(this);
  assert.equal(button.disabled, true);
});

Then("the aspiration modal's Save button is enabled", function (this: World) {
  const button = getSaveButton(this);
  assert.equal(button.disabled, false);
});

When("the aspiration modal's Save button is clicked", function (this: World) {
  dispatchClick(this, getSaveButton(this));
});

// --- Links section ---

Then('neither the {string} nor the {string} link radio button is selected', function (
  this: World,
  first: string,
  second: string,
) {
  const firstRadio = getLinkRadio(this, first);
  const secondRadio = getLinkRadio(this, second);
  assert.equal(firstRadio.checked, false, `expected the "${first}" radio to be unselected`);
  assert.equal(secondRadio.checked, false, `expected the "${second}" radio to be unselected`);
});

When('the {string} link radio button is clicked', function (this: World, label: string) {
  const radio = getLinkRadio(this, label);
  dispatchClick(this, radio);
});

Then('the {string} link radio button is selected', function (this: World, label: string) {
  const radio = getLinkRadio(this, label);
  assert.equal(radio.checked, true);
});

Then('the {string} link radio button is not selected', function (this: World, label: string) {
  const radio = getLinkRadio(this, label);
  assert.equal(radio.checked, false);
});

Then('the links empty-state message is hidden', function (this: World) {
  const message = getLinksEmptyMessage(this);
  assert.equal(message.hidden, true);
});

Then('the links empty-state message is visible with text {string}', function (
  this: World,
  expected: string,
) {
  const message = getLinksEmptyMessage(this);
  assert.equal(message.hidden, false);
  assert.equal(message.textContent, expected);
});

// --- Close / Escape / backdrop / confirmation prompt ---

When("the aspiration modal's close button is clicked", function (this: World) {
  dispatchClick(this, getCloseButton(this));
});

When("the aspiration modal's backdrop is clicked", function (this: World) {
  dispatchClick(this, getBackdrop(this));
});

Then('the confirmation prompt is shown', function (this: World) {
  getConfirmDialog(this);
});

Then('the confirmation prompt is closed', function (this: World) {
  assert.equal(findConfirmDialog(this), null, 'expected the confirmation prompt to be closed');
});

Then('no confirmation prompt is shown', function (this: World) {
  assert.equal(findConfirmDialog(this), null, 'expected no confirmation prompt to be shown');
});

When('{string} is chosen in the confirmation prompt', function (this: World, choice: string) {
  dispatchClick(this, getConfirmButton(this, choice));
});

// --- Persistence ---

Then('no aspiration has been saved', function (this: World) {
  assert.equal(readAspirations(this).length, 0);
});

Then('exactly {int} aspiration is saved in local storage', function (this: World, count: number) {
  assert.equal(readAspirations(this).length, count);
});

Then('exactly {int} aspirations are saved in local storage', function (this: World, count: number) {
  assert.equal(readAspirations(this).length, count);
});

Then(
  'the saved aspiration has title {string}, description {string}, and reason {string}',
  function (this: World, title: string, description: string, reason: string) {
    const records = readAspirations(this);
    assert.equal(records.length, 1, 'expected exactly one saved aspiration');
    assert.equal(records[0]!.title, title);
    assert.equal(records[0]!.description, description);
    assert.equal(records[0]!.reason, reason);
  },
);

Then("the saved aspirations' titles are {string} and {string} in order", function (
  this: World,
  first: string,
  second: string,
) {
  const records = readAspirations(this);
  assert.deepEqual(
    records.map((record) => record.title),
    [first, second],
  );
});
