import { Given, When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import { renderApp } from '../../src/app';
import { World } from '../support/world';

let renderedElement: HTMLElement | undefined;

Given('the app root element is empty', function (this: World) {
  const root = this.document.getElementById('app');
  assert.ok(root, 'expected #app root element to exist in the test DOM');
  assert.equal(root!.children.length, 0, 'expected #app to start empty');
});

When('the app is rendered', function (this: World) {
  const root = this.document.getElementById('app');
  assert.ok(root, 'expected #app root element to exist in the test DOM');
  renderedElement = renderApp(root as HTMLElement);
});

Then('the app root element contains exactly one top-level child', function (this: World) {
  const root = this.document.getElementById('app');
  assert.ok(root, 'expected #app root element to exist in the test DOM');
  assert.equal(root!.children.length, 1);
});

Then('the rendered content includes the text {string}', function (this: World, expectedText: string) {
  const root = this.document.getElementById('app');
  assert.ok(root, 'expected #app root element to exist in the test DOM');
  assert.ok(
    root!.textContent?.includes(expectedText),
    `expected rendered content to include "${expectedText}", got "${root!.textContent}"`
  );
});

Then("that element's accessible text is {string}", function (this: World, expectedText: string) {
  assert.ok(renderedElement, 'expected the app to have been rendered first');
  assert.equal(renderedElement!.textContent, expectedText);
});
