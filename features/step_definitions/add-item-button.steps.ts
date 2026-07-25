import { When, Then, DataTable } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { World } from '../support/world';

function getButton(world: World): HTMLButtonElement {
  const button = world.document.getElementById('add-item-button');
  assert.ok(button, 'expected #add-item-button to exist in the rendered app');
  return button as HTMLButtonElement;
}

function getMenu(world: World): HTMLElement {
  const menu = world.document.getElementById('add-item-menu');
  assert.ok(menu, 'expected #add-item-menu to exist in the rendered app');
  return menu as HTMLElement;
}

When('the add-item button is clicked', function (this: World) {
  const button = getButton(this);
  button.dispatchEvent(new this.dom.window.MouseEvent('click', { bubbles: true }));
});

When('the Escape key is pressed', function (this: World) {
  this.document.dispatchEvent(
    new this.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
});

Then('the add-item menu is hidden', function (this: World) {
  const menu = getMenu(this);
  assert.equal(menu.hidden, true, 'expected the add-item menu to be hidden');
});

Then('the add-item menu is visible', function (this: World) {
  const menu = getMenu(this);
  assert.equal(menu.hidden, false, 'expected the add-item menu to be visible');
});

Then("the add-item button's expanded state is {string}", function (this: World, expected: string) {
  const button = getButton(this);
  assert.equal(button.getAttribute('aria-expanded'), expected);
});

Then("the add-item button's accessible name is {string}", function (this: World, expected: string) {
  const button = getButton(this);
  assert.equal(button.getAttribute('aria-label'), expected);
});

Then(
  'the add-item button has attribute {string} with value {string}',
  function (this: World, attribute: string, expected: string) {
    const button = getButton(this);
    assert.equal(button.getAttribute(attribute), expected);
  },
);

Then(
  'the add-item menu contains the following menu items in order:',
  function (this: World, dataTable: DataTable) {
    const menu = getMenu(this);
    const expectedLabels = dataTable.raw().map((row) => row[0]);
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
    assert.equal(
      items.length,
      expectedLabels.length,
      `expected exactly ${expectedLabels.length} menu items, got ${items.length}`,
    );
    const actualLabels = items.map((item) => item.textContent);
    assert.deepEqual(actualLabels, expectedLabels);
  },
);

Then('focus is on the add-item button', function (this: World) {
  const button = getButton(this);
  assert.equal(this.document.activeElement, button);
});
