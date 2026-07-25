import { initAddItemMenu } from './add-item-menu';

export const ADD_ITEM_TYPES = ['Aspiration', 'Goal', 'Milestone', 'Task', 'Habit'] as const;

let cleanupAddItemMenu: (() => void) | undefined;

export function renderApp(root: HTMLElement): HTMLElement {
  cleanupAddItemMenu?.();

  const doc = root.ownerDocument;

  const wordmark = doc.createElement('h1');
  wordmark.className = 'wordmark';
  wordmark.textContent = 'throughline';

  const button = doc.createElement('button');
  button.type = 'button';
  button.id = 'add-item-button';
  button.className = 'add-item-button';
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'add-item-menu');
  button.setAttribute('aria-label', 'Add item');

  const menu = doc.createElement('div');
  menu.id = 'add-item-menu';
  menu.className = 'add-item-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-labelledby', 'add-item-button');
  menu.hidden = true;

  ADD_ITEM_TYPES.forEach((label) => {
    const item = doc.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.className = 'add-item-menu__item';
    item.textContent = label;
    menu.append(item);
  });

  const addItem = doc.createElement('div');
  addItem.className = 'add-item';
  addItem.append(button, menu);

  const topBar = doc.createElement('header');
  topBar.className = 'top-bar';
  topBar.append(wordmark, addItem);

  root.replaceChildren(topBar);

  cleanupAddItemMenu = initAddItemMenu({ button, menu });

  return wordmark;
}
