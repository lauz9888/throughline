import { When, Then, DataTable } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { World } from '../support/world';

// `src/goal-storage.ts` (which will export `GOALS_STORAGE_KEY`) does not exist yet — this
// feature is being written test-first. The key's value is fixed by the approved design
// (`.workflow/add-goal/design.md`: `GOALS_STORAGE_KEY = 'throughline:goals'`), so it's
// inlined here rather than imported, so that this file's own missing-implementation redness
// is expressed as real per-scenario assertion failures (e.g. "expected the goal modal to be
// open") instead of a module-resolution error that would abort the whole `cucumber-js`
// process — which would collaterally fail every other, unrelated `.feature` file's steps too,
// since Cucumber's `require` config loads every step definition file up front regardless of
// which `.feature` paths are passed on the command line. Once `src/goal-storage.ts` exists,
// this can be swapped back to `import { GOALS_STORAGE_KEY } from '../../src/goal-storage';`.
const GOALS_STORAGE_KEY = 'throughline:goals';

const FIELD_IDS: Record<string, string> = {
  Title: 'goal-field-title',
  Description: 'goal-field-description',
  Reason: 'goal-field-reason',
};

interface StoredMilestone {
  id: string;
  title: string;
}

interface StoredGoal {
  title: string;
  description: string;
  reason: string;
  milestones: StoredMilestone[];
}

function findMainDialog(world: World): HTMLElement | null {
  return world.document.querySelector<HTMLElement>(
    '[role="dialog"][aria-labelledby="goal-modal-heading"]',
  );
}

function getMainDialog(world: World): HTMLElement {
  const dialog = findMainDialog(world);
  assert.ok(dialog, 'expected the goal modal to be open');
  return dialog as HTMLElement;
}

function getField(world: World, fieldName: string): HTMLInputElement | HTMLTextAreaElement {
  const id = FIELD_IDS[fieldName];
  assert.ok(id, `unknown field name "${fieldName}"`);
  const field = world.document.getElementById(id);
  assert.ok(field, `expected the goal modal's "${fieldName}" field to exist`);
  return field as HTMLInputElement | HTMLTextAreaElement;
}

function getCloseButton(world: World): HTMLButtonElement {
  const dialog = getMainDialog(world);
  const button = dialog.querySelector('.modal__close');
  assert.ok(button, "expected the goal modal's close button to exist");
  return button as HTMLButtonElement;
}

function getSaveButton(world: World): HTMLButtonElement {
  const dialog = getMainDialog(world);
  const button = dialog.querySelector('.modal__save');
  assert.ok(button, "expected the goal modal's Save button to exist");
  return button as HTMLButtonElement;
}

function getBackdrop(world: World): HTMLElement {
  const dialog = getMainDialog(world);
  const overlay = dialog.parentElement;
  assert.ok(overlay, "expected the goal modal's backdrop overlay to exist");
  return overlay as HTMLElement;
}

function getAddMilestoneButton(world: World): HTMLButtonElement {
  const dialog = getMainDialog(world);
  const button = dialog.querySelector('.modal__milestone-add');
  assert.ok(button, 'expected the goal modal\'s "Add milestone" button to exist');
  return button as HTMLButtonElement;
}

function getMilestoneRows(world: World): HTMLElement[] {
  const dialog = getMainDialog(world);
  const list = dialog.querySelector('.modal__milestones-list');
  assert.ok(list, "expected the goal modal's milestones list to exist");
  return Array.from(list!.children) as HTMLElement[];
}

function getMilestoneRow(world: World, position: number): HTMLElement {
  const rows = getMilestoneRows(world);
  const row = rows[position - 1];
  assert.ok(row, `expected a milestone row at position ${position}, found ${rows.length} row(s)`);
  return row;
}

function getMilestoneInput(row: HTMLElement): HTMLInputElement {
  const input = row.querySelector('.modal__milestone-input');
  assert.ok(input, "expected the milestone row's title input to exist");
  return input as HTMLInputElement;
}

function getMilestoneRemoveButton(row: HTMLElement): HTMLButtonElement {
  const button = row.querySelector('.modal__milestone-remove');
  assert.ok(button, "expected the milestone row's remove control to exist");
  return button as HTMLButtonElement;
}

function getMilestoneLabel(row: HTMLElement): HTMLLabelElement {
  const label = row.querySelector('label');
  assert.ok(label, "expected the milestone row's label to exist");
  return label as HTMLLabelElement;
}

function dispatchClick(world: World, element: Element): void {
  element.dispatchEvent(new world.dom.window.MouseEvent('click', { bubbles: true }));
}

function readGoals(world: World): StoredGoal[] {
  const raw = world.dom.window.localStorage.getItem(GOALS_STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as StoredGoal[]) : [];
}

function dataTableSingleColumn(dataTable: DataTable): string[] {
  return dataTable.raw().map((row) => row[0]!);
}

// --- Modal open/closed state ---

Then('the goal modal is open', function (this: World) {
  getMainDialog(this);
});

Then('the goal modal is closed', function (this: World) {
  assert.equal(findMainDialog(this), null, 'expected the goal modal to be closed');
});

Then('exactly {int} goal modal is open', function (this: World, count: number) {
  const dialogs = this.document.querySelectorAll(
    '[role="dialog"][aria-labelledby="goal-modal-heading"]',
  );
  assert.equal(dialogs.length, count);
});

// --- Header / blurb / content order ---

Then("the goal modal's heading is {string}", function (this: World, expected: string) {
  const heading = this.document.getElementById('goal-modal-heading');
  assert.ok(heading, 'expected the goal modal heading element to exist');
  assert.equal(heading!.textContent, expected);
});

Then("the goal modal's blurb text is {string}", function (this: World, expected: string) {
  const dialog = getMainDialog(this);
  const blurb = dialog.querySelector('.modal__blurb');
  assert.ok(blurb, 'expected the goal modal blurb element to exist');
  assert.equal(blurb!.textContent, expected);
});

Then('the blurb appears before the Title field in the goal modal', function (this: World) {
  const dialog = getMainDialog(this);
  const blurb = dialog.querySelector('.modal__blurb');
  assert.ok(blurb, 'expected the goal modal blurb element to exist');
  const title = getField(this, 'Title');
  const position = blurb!.compareDocumentPosition(title);
  assert.ok(
    (position & this.dom.window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    'expected the blurb to appear before the Title field',
  );
});

// --- Fields ---

Then('the goal modal has a required field labeled {string}', function (this: World, label: string) {
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

Then(
  'the goal modal has an optional field labeled {string}',
  function (this: World, label: string) {
    const field = getField(this, label);
    const associatedLabel = this.document.querySelector(`label[for="${field.id}"]`);
    assert.ok(associatedLabel, `expected a <label for="${field.id}"> element to exist`);
    assert.equal(associatedLabel!.textContent, label);
    assert.equal(
      field.getAttribute('required'),
      null,
      `expected the "${label}" field not to be required`,
    );
  },
);

When(
  "{string} is entered into the goal modal's {string} field",
  function (this: World, text: string, fieldName: string) {
    const field = getField(this, fieldName);
    field.value = text;
    field.dispatchEvent(new this.dom.window.Event('input', { bubbles: true }));
  },
);

When("the goal modal's {string} field is cleared", function (this: World, fieldName: string) {
  const field = getField(this, fieldName);
  field.value = '';
  field.dispatchEvent(new this.dom.window.Event('input', { bubbles: true }));
});

Then(
  "the goal modal's {string} field contains {string}",
  function (this: World, fieldName: string, expected: string) {
    const field = getField(this, fieldName);
    assert.equal(field.value, expected);
  },
);

// --- Save button ---

Then("the goal modal's Save button is disabled", function (this: World) {
  const button = getSaveButton(this);
  assert.equal(button.disabled, true);
});

Then("the goal modal's Save button is enabled", function (this: World) {
  const button = getSaveButton(this);
  assert.equal(button.disabled, false);
});

When("the goal modal's Save button is clicked", function (this: World) {
  dispatchClick(this, getSaveButton(this));
});

// --- Close / Escape / backdrop / confirmation prompt ---

When("the goal modal's close button is clicked", function (this: World) {
  dispatchClick(this, getCloseButton(this));
});

When("the goal modal's backdrop is clicked", function (this: World) {
  dispatchClick(this, getBackdrop(this));
});

// "the confirmation prompt is shown" / "is closed" / "no confirmation prompt is shown" / "{string}
// is chosen in the confirmation prompt" are intentionally not redefined here: they're already
// defined, modal-agnostic (they query the shared `[role="alertdialog"]`/`.modal__discard`/
// `.modal__cancel` shapes that `openConfirmDialog()` produces for every caller), in
// `add-aspiration.steps.ts`. Since Cucumber's `require` config loads every step definition file
// for every run regardless of which `.feature` is targeted, redefining identical step text here
// would make those steps ambiguous rather than reusable.

// --- Milestones ---

When('the goal modal\'s "Add milestone" button is clicked', function (this: World) {
  dispatchClick(this, getAddMilestoneButton(this));
});

Then('the goal modal has {int} milestone row(s)', function (this: World, count: number) {
  assert.equal(getMilestoneRows(this).length, count);
});

Then(
  "the goal modal's milestone row {int} is labeled {string}",
  function (this: World, position: number, expectedLabel: string) {
    const row = getMilestoneRow(this, position);
    assert.equal(getMilestoneLabel(row).textContent, expectedLabel);
  },
);

When(
  "{string} is entered into the goal modal's milestone row {int}'s title field",
  function (this: World, text: string, position: number) {
    const row = getMilestoneRow(this, position);
    const input = getMilestoneInput(row);
    input.value = text;
    input.dispatchEvent(new this.dom.window.Event('input', { bubbles: true }));
  },
);

Then(
  "the goal modal's milestone row {int}'s title field contains {string}",
  function (this: World, position: number, expected: string) {
    const row = getMilestoneRow(this, position);
    assert.equal(getMilestoneInput(row).value, expected);
  },
);

When("the goal modal's milestone row {int} is removed", function (this: World, position: number) {
  const row = getMilestoneRow(this, position);
  dispatchClick(this, getMilestoneRemoveButton(row));
});

Then("the goal modal's milestone row titles are:", function (this: World, dataTable: DataTable) {
  const expected = dataTableSingleColumn(dataTable);
  const actual = getMilestoneRows(this).map((row) => getMilestoneInput(row).value);
  assert.deepEqual(actual, expected);
});

// --- Persistence ---

Then('no goal has been saved', function (this: World) {
  assert.equal(readGoals(this).length, 0);
});

Then('exactly {int} goal is saved in local storage', function (this: World, count: number) {
  assert.equal(readGoals(this).length, count);
});

Then('exactly {int} goals are saved in local storage', function (this: World, count: number) {
  assert.equal(readGoals(this).length, count);
});

Then(
  'the saved goal has title {string}, description {string}, and reason {string}',
  function (this: World, title: string, description: string, reason: string) {
    const records = readGoals(this);
    assert.equal(records.length, 1, 'expected exactly one saved goal');
    assert.equal(records[0]!.title, title);
    assert.equal(records[0]!.description, description);
    assert.equal(records[0]!.reason, reason);
  },
);

Then('the saved goal has {int} milestone(s)', function (this: World, count: number) {
  const records = readGoals(this);
  assert.equal(records.length, 1, 'expected exactly one saved goal');
  assert.equal(records[0]!.milestones.length, count);
});

Then("the saved goal's milestones are:", function (this: World, dataTable: DataTable) {
  const records = readGoals(this);
  assert.equal(records.length, 1, 'expected exactly one saved goal');
  const expected = dataTableSingleColumn(dataTable);
  const actual = records[0]!.milestones.map((milestone) => milestone.title);
  assert.deepEqual(actual, expected);
});

Then(
  "the saved goals' titles are {string} and {string} in order",
  function (this: World, first: string, second: string) {
    const records = readGoals(this);
    assert.deepEqual(
      records.map((record) => record.title),
      [first, second],
    );
  },
);

Then(
  'the saved goal titled {string} has milestones:',
  function (this: World, title: string, dataTable: DataTable) {
    const records = readGoals(this);
    const record = records.find((candidate) => candidate.title === title);
    assert.ok(record, `expected a saved goal titled "${title}"`);
    const expected = dataTableSingleColumn(dataTable);
    const actual = record!.milestones.map((milestone) => milestone.title);
    assert.deepEqual(actual, expected);
  },
);

Then(
  'the saved goal titled {string} has {int} milestone(s)',
  function (this: World, title: string, count: number) {
    const records = readGoals(this);
    const record = records.find((candidate) => candidate.title === title);
    assert.ok(record, `expected a saved goal titled "${title}"`);
    assert.equal(record!.milestones.length, count);
  },
);

// --- Cross-modal exclusion (Requirement 5) ---

Then('the app root element is inert', function (this: World) {
  const root = this.document.getElementById('app');
  assert.ok(root, 'expected #app root element to exist in the test DOM');
  assert.equal(
    (root as HTMLElement & { inert: boolean }).inert,
    true,
    'expected the app root to be inert while the goal modal is open',
  );
});
