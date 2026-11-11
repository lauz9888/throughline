import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { createMemoryStorage } from '../.storybook/memory-storage';
import { createAppRoot, removeOverlays } from '../.storybook/story-helpers';
import { initEditGoalModal } from './edit-goal-modal';
import { GOALS_STORAGE_KEY, type Goal } from './goal-storage';

function makeGoal(): Goal {
  return {
    id: 'goal-1',
    title: 'Learn piano',
    description: 'Play a full piece from memory',
    reason: 'Music makes me happy',
    milestones: [
      { id: 'm-1', title: 'Learn scales' },
      { id: 'm-2', title: 'Play a duet' },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

let destroy: (() => void) | undefined;
let storage: Storage = createMemoryStorage();
let onChange = fn();
let gridContainer: HTMLElement | undefined;
let appRoot: HTMLElement | undefined;
let goal: Goal = makeGoal();

function render(): HTMLElement {
  const root = createAppRoot();
  goal = makeGoal();
  storage = createMemoryStorage({ [GOALS_STORAGE_KEY]: JSON.stringify([goal]) });
  onChange = fn();

  // The grid container is the tabindex=-1 focus target after save/delete. The trigger tile sits
  // outside it so the save path (which prefers a refreshed tile inside the container) falls back
  // to the container itself, matching a grid that has been re-rendered.
  const container = document.createElement('section');
  container.setAttribute('aria-label', 'Your goals');
  container.tabIndex = -1;

  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'goal-tile';
  tile.textContent = goal.title;

  root.append(tile, container);

  const modal = initEditGoalModal({ root, gridContainer: container, storage, onChange });
  destroy = modal.destroy;
  gridContainer = container;
  appRoot = root;
  tile.addEventListener('click', () => modal.open(goal, tile));
  return root;
}

const meta = {
  title: 'EditGoalModal',
  render,
  // Overlays attach to document.body, outside #storybook-root, so the axe scan must cover body.
  parameters: { a11y: { context: 'body' } },
  beforeEach: () => {
    return () => {
      destroy?.();
      destroy = undefined;
      gridContainer = undefined;
      appRoot = undefined;
      removeOverlays();
    };
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function storedGoals(): Goal[] {
  return JSON.parse(storage.getItem(GOALS_STORAGE_KEY) ?? '[]') as Goal[];
}

async function openModal(canvasElement: HTMLElement): Promise<HTMLElement> {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Learn piano' }));
  return within(document.body).findByRole('dialog', { name: 'Edit Goal' });
}

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Learn piano' })).toBeVisible();
    await expect(document.querySelector('.modal-overlay')).toBeNull();
  },
};

export const OpenPrefilled: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openModal(canvasElement);
    const body = within(document.body);

    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(appRoot?.inert).toBe(true);

    const title = body.getByRole('textbox', { name: 'Title' });
    await expect(title).toHaveValue('Learn piano');
    await expect(body.getByRole('textbox', { name: 'Description' })).toHaveValue(
      'Play a full piece from memory',
    );
    await expect(body.getByRole('textbox', { name: 'Reason' })).toHaveValue('Music makes me happy');
    await expect(document.activeElement).toBe(title);

    await expect(body.getByRole('textbox', { name: 'Milestone 1' })).toHaveValue('Learn scales');
    await expect(body.getByRole('textbox', { name: 'Milestone 2' })).toHaveValue('Play a duet');

    await expect(body.getByRole('button', { name: 'Delete goal' })).toBeVisible();

    const save = body.getByRole('button', { name: 'Save' });
    await expect(save).toBeDisabled();
    await userEvent.type(title, '!');
    await expect(save).toBeEnabled();
  },
};

export const SaveUpdatesRecord: Story = {
  play: async ({ canvasElement }) => {
    await openModal(canvasElement);
    const body = within(document.body);

    const title = body.getByRole('textbox', { name: 'Title' });
    await userEvent.clear(title);
    await userEvent.type(title, 'Learn guitar');
    await userEvent.click(body.getByRole('button', { name: 'Save' }));

    await expect(onChange).toHaveBeenCalledTimes(1);
    const goals = storedGoals();
    await expect(goals).toHaveLength(1);
    await expect(goals[0]?.title).toBe('Learn guitar');
    await expect(goals[0]?.id).toBe('goal-1');
    await expect(goals[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    await expect(goals[0]?.milestones.map((m) => m.id)).toEqual(['m-1', 'm-2']);

    await expect(document.querySelector('.modal-overlay')).toBeNull();
    await expect(appRoot?.inert).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(gridContainer));
  },
};

export const UnsavedChangesConfirmOpen: Story = {
  play: async ({ canvasElement }) => {
    await openModal(canvasElement);
    const body = within(document.body);

    await userEvent.type(body.getByRole('textbox', { name: 'Title' }), ' edited');
    await userEvent.keyboard('{Escape}');

    const confirm = await body.findByRole('alertdialog', { name: 'Discard goal?' });
    await expect(confirm).toBeVisible();
    await expect(body.getByRole('button', { name: 'Keep editing' })).toHaveFocus();
  },
};

export const DiscardReturnsFocusToTile: Story = {
  play: async ({ canvasElement }) => {
    const tile = within(canvasElement).getByRole('button', { name: 'Learn piano' });
    await openModal(canvasElement);
    const body = within(document.body);

    await userEvent.type(body.getByRole('textbox', { name: 'Title' }), ' edited');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(await body.findByRole('button', { name: 'Discard' }));

    await expect(document.querySelector('.modal-overlay')).toBeNull();
    await expect(storedGoals()[0]?.title).toBe('Learn piano');
    await expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(tile));
  },
};

export const DeleteConfirmOpen: Story = {
  play: async ({ canvasElement }) => {
    await openModal(canvasElement);
    const body = within(document.body);

    await userEvent.click(body.getByRole('button', { name: 'Delete goal' }));

    const confirm = await body.findByRole('alertdialog', { name: 'Delete goal?' });
    await expect(confirm).toBeVisible();
    await expect(within(confirm).getByRole('button', { name: 'Keep editing' })).toHaveFocus();
  },
};

export const DeleteCancelKeepsRecord: Story = {
  play: async ({ canvasElement }) => {
    await openModal(canvasElement);
    const body = within(document.body);
    const deleteButton = body.getByRole('button', { name: 'Delete goal' });

    await userEvent.click(deleteButton);
    const confirm = await body.findByRole('alertdialog', { name: 'Delete goal?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Keep editing' }));

    await expect(storedGoals()).toHaveLength(1);
    await expect(onChange).not.toHaveBeenCalled();
    await expect(body.queryByRole('alertdialog')).toBeNull();
    await expect(body.getByRole('dialog', { name: 'Edit Goal' })).toBeVisible();
    await waitFor(() => expect(document.activeElement).toBe(deleteButton));
  },
};

export const DeleteConfirmRemovesRecord: Story = {
  play: async ({ canvasElement }) => {
    await openModal(canvasElement);
    const body = within(document.body);

    await userEvent.click(body.getByRole('button', { name: 'Delete goal' }));
    const confirm = await body.findByRole('alertdialog', { name: 'Delete goal?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));

    await expect(storedGoals()).toHaveLength(0);
    await expect(onChange).toHaveBeenCalledTimes(1);
    await expect(document.querySelector('.modal-overlay')).toBeNull();
    await expect(appRoot?.inert).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(gridContainer));
  },
};

export const DeleteFocusIndicator: Story = {
  play: async ({ canvasElement }) => {
    await openModal(canvasElement);
    const deleteButton = within(document.body).getByRole('button', { name: 'Delete goal' });

    // Save is disabled, so Delete is reachable by Tab; walk the focus trap until we get there.
    for (let i = 0; i < 12 && document.activeElement !== deleteButton; i += 1) {
      await userEvent.tab();
    }
    await expect(document.activeElement).toBe(deleteButton);
    // src/style.css gives .modal__delete:focus-visible a 2px solid outline.
    const style = getComputedStyle(deleteButton);
    await expect(style.outlineStyle).not.toBe('none');
    await expect(parseFloat(style.outlineWidth)).toBeGreaterThan(0);
  },
};
