import { initAddItemMenu } from './add-item-menu';
import { initAspirationModal } from './aspiration-modal';
import { initAspirationGrid } from './aspiration-grid';
import { initEditAspirationModal } from './edit-aspiration-modal';
import { initGoalModal } from './goal-modal';
import { initGoalGrid } from './goal-grid';
import { initEditGoalModal } from './edit-goal-modal';
import type { Aspiration } from './aspiration-storage';
import type { Goal } from './goal-storage';

export const ADD_ITEM_TYPES = ['Aspiration', 'Goal', 'Task', 'Habit'] as const;

let cleanupAddItemMenu: (() => void) | undefined;
let cleanupAspirationModal: (() => void) | undefined;
let cleanupAspirationGrid: (() => void) | undefined;
let cleanupEditAspirationModal: (() => void) | undefined;
let cleanupGoalModal: (() => void) | undefined;
let cleanupGoalGrid: (() => void) | undefined;
let cleanupEditGoalModal: (() => void) | undefined;

export function renderApp(root: HTMLElement): HTMLElement {
  cleanupAddItemMenu?.();
  cleanupAspirationModal?.();
  cleanupAspirationGrid?.();
  cleanupEditAspirationModal?.();
  cleanupGoalModal?.();
  cleanupGoalGrid?.();
  cleanupEditGoalModal?.();

  const doc = root.ownerDocument;
  const win = doc.defaultView!;

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

  // Forward-reference resolves the circular need: the grid's `onTileSelect` must reference the
  // Edit modal's `open`, but the Edit modal needs the grid's `section` element as
  // `gridContainer` to be constructed first.
  let openEditModal: (aspiration: Aspiration, trigger: HTMLButtonElement) => void = () => {};

  const {
    section: gridSection,
    render: renderGrid,
    destroy: destroyGrid,
  } = initAspirationGrid({
    root,
    storage: win.localStorage,
    onTileSelect: (aspiration, tile) => openEditModal(aspiration, tile),
  });
  cleanupAspirationGrid = destroyGrid;

  // Forward-reference resolves the same circular need for the Goal grid/Edit Goal modal pair.
  let openEditGoalModal: (goal: Goal, trigger: HTMLButtonElement) => void = () => {};

  const {
    section: goalGridSection,
    render: renderGoalGrid,
    destroy: destroyGoalGrid,
  } = initGoalGrid({
    root,
    storage: win.localStorage,
    onTileSelect: (goal, tile) => openEditGoalModal(goal, tile),
  });
  cleanupGoalGrid = destroyGoalGrid;

  root.replaceChildren(topBar, gridSection, goalGridSection); // Goals below Aspirations, below .top-bar

  const { open: openAspirationModal, destroy: destroyAspirationModal } = initAspirationModal({
    root,
    addItemButton: button,
    onSave: renderGrid, // Create's own save also needs to refresh the grid
  });
  cleanupAspirationModal = destroyAspirationModal;

  const editModal = initEditAspirationModal({
    root,
    gridContainer: gridSection,
    storage: win.localStorage,
    onChange: renderGrid,
  });
  openEditModal = editModal.open;
  cleanupEditAspirationModal = editModal.destroy;

  const { open: openGoalModal, destroy: destroyGoalModal } = initGoalModal({
    root,
    addItemButton: button,
    onSave: renderGoalGrid,
  });
  cleanupGoalModal = destroyGoalModal;

  const editGoalModal = initEditGoalModal({
    root,
    gridContainer: goalGridSection,
    storage: win.localStorage,
    onChange: renderGoalGrid,
  });
  openEditGoalModal = editGoalModal.open;
  cleanupEditGoalModal = editGoalModal.destroy;

  renderGrid(); // initial population from storage
  renderGoalGrid();

  cleanupAddItemMenu = initAddItemMenu({
    button,
    menu,
    onItemSelect: (label) => {
      if (label === 'Aspiration') openAspirationModal();
      else if (label === 'Goal') openGoalModal();
    },
  });

  return wordmark;
}
