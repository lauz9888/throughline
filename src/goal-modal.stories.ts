import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  clearThroughlineStorage,
  createAppRoot,
  removeOverlays,
} from '../.storybook/story-helpers';
import { TITLE_TOOLTIP_TEXT } from './goal-fields';
import { initGoalModal } from './goal-modal';
import { GOALS_STORAGE_KEY, type Goal } from './goal-storage';

let destroy: (() => void) | undefined;
let onSave = fn();
let appRoot: HTMLElement | undefined;

function render(): HTMLElement {
  const root = createAppRoot();
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = 'add-item-button';
  trigger.setAttribute('aria-label', 'Add item');
  trigger.textContent = '+';
  root.append(trigger);

  onSave = fn();
  const modal = initGoalModal({ root, addItemButton: trigger, onSave });
  destroy = modal.destroy;
  appRoot = root;
  trigger.addEventListener('click', () => modal.open());
  return root;
}

const meta = {
  title: 'GoalModal',
  render,
  // Overlays attach to document.body, outside #storybook-root, so the axe scan must cover body.
  parameters: { a11y: { context: 'body' } },
  // The create modal reads window.localStorage directly (no storage option), so each story
  // clears its own keys before and after it runs.
  beforeEach: () => {
    clearThroughlineStorage();
    return () => {
      destroy?.();
      destroy = undefined;
      appRoot = undefined;
      removeOverlays();
      clearThroughlineStorage();
    };
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function storedGoals(): Goal[] {
  return JSON.parse(window.localStorage.getItem(GOALS_STORAGE_KEY) ?? '[]') as Goal[];
}

async function openModal(canvasElement: HTMLElement): Promise<HTMLElement> {
  const trigger = within(canvasElement).getByRole('button', { name: 'Add item' });
  await userEvent.click(trigger);
  return within(document.body).findByRole('dialog', { name: 'Create Goal' });
}

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Add item' })).toBeVisible();
    await expect(document.querySelector('.modal-overlay')).toBeNull();
  },
};

export const OpenBlank: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openModal(canvasElement);
    const body = within(document.body);

    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(appRoot?.inert).toBe(true);

    const title = body.getByRole('textbox', { name: 'Title' });
    await expect(document.activeElement).toBe(title);

    const save = body.getByRole('button', { name: 'Save' });
    await expect(save).toBeDisabled();
    // Invalid submit does not save: clicking the disabled Save changes nothing.
    await userEvent.click(save);
    await expect(onSave).not.toHaveBeenCalled();
    await expect(window.localStorage.getItem(GOALS_STORAGE_KEY)).toBeNull();

    await userEvent.type(title, 'Run a marathon');
    await expect(save).toBeEnabled();
  },
};

export const SaveClosesAndReturnsFocus: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Add item' });
    await openModal(canvasElement);
    const body = within(document.body);

    await userEvent.type(body.getByRole('textbox', { name: 'Title' }), 'Run a marathon');
    await userEvent.click(body.getByRole('button', { name: 'Save' }));

    await expect(onSave).toHaveBeenCalledTimes(1);
    const goals = storedGoals();
    await expect(goals).toHaveLength(1);
    await expect(goals[0]?.title).toBe('Run a marathon');
    await expect(document.querySelector('.modal-overlay')).toBeNull();
    await expect(appRoot?.inert).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  },
};

export const EscapeClosesCleanModal: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Add item' });
    await openModal(canvasElement);

    await userEvent.keyboard('{Escape}');

    await expect(document.querySelector('.modal-overlay')).toBeNull();
    await expect(appRoot?.inert).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  },
};

export const FocusTrap: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openModal(canvasElement);

    for (let i = 0; i < 12; i += 1) {
      await userEvent.tab();
      await expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 12; i += 1) {
      await userEvent.tab({ shift: true });
      await expect(dialog.contains(document.activeElement)).toBe(true);
    }
  },
};

export const FocusIndicator: Story = {
  play: async ({ canvasElement }) => {
    await openModal(canvasElement);
    const close = within(document.body).getByRole('button', { name: 'Close' });

    // Title is focused on open; the field info icon sits between it and the Close
    // button in tab order, so Shift+Tab until Close is reached (bounded by the trap).
    for (let i = 0; i < 6 && document.activeElement !== close; i += 1) {
      await userEvent.tab({ shift: true });
    }
    await waitFor(() => expect(document.activeElement).toBe(close));
    // src/style.css gives .modal__close:focus-visible a 2px solid outline.
    const style = getComputedStyle(close);
    await expect(style.outlineStyle).not.toBe('none');
    await expect(parseFloat(style.outlineWidth)).toBeGreaterThan(0);
  },
};

export const MilestonesAdded: Story = {
  play: async ({ canvasElement }) => {
    await openModal(canvasElement);
    const body = within(document.body);

    const add = body.getByRole('button', { name: 'Add milestone' });
    await userEvent.click(add);
    await userEvent.click(add);

    await expect(body.getByRole('textbox', { name: 'Milestone 1' })).toBeVisible();
    await expect(body.getByRole('textbox', { name: 'Milestone 2' })).toBeVisible();
    await expect(body.getByRole('button', { name: 'Remove milestone 1' })).toBeVisible();
    await expect(body.getByRole('button', { name: 'Remove milestone 2' })).toBeVisible();
  },
};

export const DiscardConfirmOpen: Story = {
  play: async ({ canvasElement }) => {
    await openModal(canvasElement);
    const body = within(document.body);

    await userEvent.type(body.getByRole('textbox', { name: 'Title' }), 'Unsaved goal');
    await userEvent.keyboard('{Escape}');

    const confirm = await body.findByRole('alertdialog');
    await expect(confirm).toBeVisible();
    await expect(body.getByRole('button', { name: 'Keep editing' })).toHaveFocus();
  },
};

export const KeepEditingReturnsToModal: Story = {
  play: async ({ canvasElement }) => {
    await openModal(canvasElement);
    const body = within(document.body);

    await userEvent.type(body.getByRole('textbox', { name: 'Title' }), 'Unsaved goal');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(await body.findByRole('button', { name: 'Keep editing' }));

    await expect(body.queryByRole('alertdialog')).toBeNull();
    await expect(body.getByRole('dialog', { name: 'Create Goal' })).toBeVisible();
    await waitFor(() =>
      expect(document.activeElement).toBe(body.getByRole('button', { name: 'Close' })),
    );
  },
};

export const DiscardReturnsFocusToTrigger: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Add item' });
    await openModal(canvasElement);
    const body = within(document.body);

    await userEvent.type(body.getByRole('textbox', { name: 'Title' }), 'Unsaved goal');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(await body.findByRole('button', { name: 'Discard' }));

    await expect(document.querySelector('.modal-overlay')).toBeNull();
    await expect(window.localStorage.getItem(GOALS_STORAGE_KEY)).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  },
};

export const TooltipOpen: Story = {
  play: async ({ canvasElement }) => {
    await openModal(canvasElement);
    const body = within(document.body);

    const info = body.getByRole('button', { name: 'More information about Title' });
    await expect(info).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(info);

    await expect(info).toHaveAttribute('aria-expanded', 'true');
    const tooltip = body.getByText(TITLE_TOOLTIP_TEXT);
    await expect(tooltip.classList.contains('modal__tooltip-text--visible')).toBe(true);
    await expect(tooltip).toBeVisible();
  },
};
