import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { createAppRoot, removeOverlays } from '../.storybook/story-helpers';
import { openConfirmDialog } from './confirm-dialog';

let onCancel = fn();
let onConfirm = fn();
let parentDialog: HTMLElement | undefined;
let handle: { cancel: () => void } | undefined;

function render(): HTMLElement {
  const root = createAppRoot();

  const parent = document.createElement('div');
  parent.className = 'modal';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.textContent = 'Delete';
  parent.append(trigger);
  root.append(parent);
  parentDialog = parent;

  onCancel = fn();
  onConfirm = fn();

  trigger.addEventListener('click', () => {
    handle = openConfirmDialog(
      document,
      parent,
      {
        headingId: 'story-confirm-heading',
        headingText: 'Delete item?',
        bodyId: 'story-confirm-body',
        bodyText: "This can't be undone.",
        cancelText: 'Keep editing',
        cancelClassName: 'modal__cancel',
        confirmText: 'Confirm delete',
        confirmClassName: 'modal__delete-confirm',
      },
      { onCancel, onConfirm },
    );
  });

  return root;
}

const meta = {
  title: 'ConfirmDialog',
  render,
  // Overlays attach to document.body, outside #storybook-root, so the axe scan must cover body.
  parameters: { a11y: { context: 'body' } },
  beforeEach: () => {
    return () => {
      handle?.cancel();
      handle = undefined;
      parentDialog = undefined;
      removeOverlays();
    };
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

async function openDialog(canvasElement: HTMLElement): Promise<HTMLElement> {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Delete' }));
  return within(document.body).findByRole('alertdialog');
}

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Delete' })).toBeVisible();
    await expect(document.querySelector('.modal-overlay')).toBeNull();
    await expect(parentDialog?.inert).toBe(false);
  },
};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const body = within(document.body);

    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAccessibleName('Delete item?');
    await expect(dialog).toHaveAccessibleDescription("This can't be undone.");
    await expect(parentDialog?.inert).toBe(true);

    const cancel = body.getByRole('button', { name: 'Keep editing' });
    const confirm = body.getByRole('button', { name: 'Confirm delete' });
    await expect(document.activeElement).toBe(cancel);

    // Focus trap: Shift+Tab from the first control wraps to the last, Tab wraps back.
    await userEvent.tab({ shift: true });
    await waitFor(() => expect(document.activeElement).toBe(confirm));
    await userEvent.tab();
    await waitFor(() => expect(document.activeElement).toBe(cancel));
  },
};

export const Cancel: Story = {
  play: async ({ canvasElement }) => {
    await openDialog(canvasElement);
    await userEvent.click(within(document.body).getByRole('button', { name: 'Keep editing' }));

    await expect(onCancel).toHaveBeenCalledTimes(1);
    await expect(onConfirm).not.toHaveBeenCalled();
    await expect(document.querySelector('.modal-overlay')).toBeNull();
    await expect(parentDialog?.inert).toBe(false);
  },
};

export const Confirm: Story = {
  play: async ({ canvasElement }) => {
    await openDialog(canvasElement);
    await userEvent.click(within(document.body).getByRole('button', { name: 'Confirm delete' }));

    await expect(onConfirm).toHaveBeenCalledTimes(1);
    await expect(onCancel).not.toHaveBeenCalled();
    await expect(document.querySelector('.modal-overlay')).toBeNull();
    await expect(parentDialog?.inert).toBe(false);
  },
};

export const OverlayClickCancels: Story = {
  play: async ({ canvasElement }) => {
    await openDialog(canvasElement);
    const overlay = document.querySelector<HTMLElement>('.modal-overlay');
    await expect(overlay).not.toBeNull();
    // element.click() targets the overlay itself (a pointer click would land on the dialog).
    overlay!.click();

    await expect(onCancel).toHaveBeenCalledTimes(1);
    await expect(onConfirm).not.toHaveBeenCalled();
    await expect(document.querySelector('.modal-overlay')).toBeNull();
    await expect(parentDialog?.inert).toBe(false);
  },
};
