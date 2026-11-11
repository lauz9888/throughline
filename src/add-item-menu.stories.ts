import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { createAppRoot, removeOverlays } from '../.storybook/story-helpers';
import { initAddItemMenu } from './add-item-menu';

const ITEM_LABELS = ['Aspiration', 'Goal', 'Task', 'Habit'] as const;

let destroy: (() => void) | undefined;
let onItemSelect = fn();

function render(): HTMLElement {
  const root = createAppRoot();
  const doc = document;

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

  ITEM_LABELS.forEach((label) => {
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
  root.append(addItem);

  onItemSelect = fn();
  destroy = initAddItemMenu({ button, menu, onItemSelect });
  return root;
}

const meta = {
  title: 'AddItemMenu',
  render,
  beforeEach: () => {
    return () => {
      destroy?.();
      destroy = undefined;
      removeOverlays();
    };
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Add item' });
    await expect(button).toHaveAttribute('aria-haspopup', 'true');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    const menu = canvas.getByRole('menu', { hidden: true });
    await expect(menu).toHaveProperty('hidden', true);
  },
};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Add item' });
    await userEvent.click(button);

    await expect(button).toHaveAttribute('aria-expanded', 'true');
    const menu = canvas.getByRole('menu');
    await expect(menu).toBeVisible();
    const items = canvas.getAllByRole('menuitem');
    await expect(items.map((item) => item.textContent)).toEqual([...ITEM_LABELS]);
    await expect(items[0]).toHaveProperty('tabIndex', 0);
    await expect(items[1]).toHaveProperty('tabIndex', -1);
  },
};

export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Add item' });
    button.focus();

    await userEvent.keyboard('{ArrowDown}');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    const items = canvas.getAllByRole('menuitem');
    await waitFor(() => expect(document.activeElement).toBe(items[0]));

    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(document.activeElement).toBe(items[1]));
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
    await userEvent.keyboard('{End}');
    await waitFor(() => expect(document.activeElement).toBe(items[items.length - 1]));
    await userEvent.keyboard('{Home}');
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
  },
};

export const EscapeReturnsFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Add item' });
    button.focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{Escape}');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.getByRole('menu', { hidden: true })).toHaveProperty('hidden', true);
    await waitFor(() => expect(document.activeElement).toBe(button));
  },
};

export const ItemSelectReturnsFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Add item' });
    await userEvent.click(button);
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Goal' }));

    await expect(onItemSelect).toHaveBeenCalledTimes(1);
    await expect(onItemSelect).toHaveBeenCalledWith('Goal');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(document.activeElement).toBe(button));
  },
};

export const FocusIndicator: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Add item' });
    await userEvent.tab();
    await waitFor(() => expect(document.activeElement).toBe(button));
    // src/style.css defines `.add-item-button:focus-visible { outline: 2px solid ... }`.
    const style = getComputedStyle(button);
    await expect(style.outlineStyle).not.toBe('none');
    await expect(parseFloat(style.outlineWidth)).toBeGreaterThan(0);
  },
};
