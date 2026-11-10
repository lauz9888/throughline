import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { createMemoryStorage } from '../.storybook/memory-storage';
import { createAppRoot, removeOverlays } from '../.storybook/story-helpers';
import { initAspirationGrid } from './aspiration-grid';
import { ASPIRATIONS_STORAGE_KEY, saveAspiration, type Aspiration } from './aspiration-storage';

const LONG_TITLE =
  'Climb every mountain in the national park, ford every stream, and follow every rainbow ' +
  'until I find the dream that I have been chasing for the whole of my adult life';

function makeAspiration(id: string, title: string, createdAt: string): Aspiration {
  return { id, title, description: '', reason: '', createdAt };
}

// Deliberately out of order and mixed case; sorted case-insensitively this is
// Apple, banana, Climb..., zebra.
const SEED_ASPIRATIONS: Aspiration[] = [
  makeAspiration('a-1', 'zebra crossing', '2026-01-01T00:00:00.000Z'),
  makeAspiration('a-2', 'Apple orchard', '2026-01-02T00:00:00.000Z'),
  makeAspiration('a-3', 'banana bread', '2026-01-03T00:00:00.000Z'),
  makeAspiration('a-4', LONG_TITLE, '2026-01-04T00:00:00.000Z'),
];

let destroy: (() => void) | undefined;
let storage: Storage = createMemoryStorage();
let onTileSelect = fn();
let renderGrid: (() => void) | undefined;

function build(seed: Aspiration[]): HTMLElement {
  const root = createAppRoot();
  storage = createMemoryStorage(
    seed.length > 0 ? { [ASPIRATIONS_STORAGE_KEY]: JSON.stringify(seed) } : {},
  );
  onTileSelect = fn();

  const grid = initAspirationGrid({ root, storage, onTileSelect });
  destroy = grid.destroy;
  renderGrid = grid.render;
  root.append(grid.section);
  grid.render();
  return root;
}

const meta = {
  title: 'AspirationGrid',
  beforeEach: () => {
    return () => {
      destroy?.();
      destroy = undefined;
      renderGrid = undefined;
      removeOverlays();
    };
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => build([]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const section = canvas.getByLabelText('Your aspirations');
    await expect(section).toHaveAttribute('tabindex', '-1');
    await expect(canvas.getByText("You don't have any aspirations yet")).toBeVisible();
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
  },
};

export const Populated: Story = {
  render: () => build(SEED_ASPIRATIONS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tiles = canvas.getAllByRole('button');
    await expect(tiles).toHaveLength(SEED_ASPIRATIONS.length);
    await expect(tiles.map((tile) => tile.textContent)).toEqual([
      'Apple orchard',
      'banana bread',
      LONG_TITLE,
      'zebra crossing',
    ]);
    // Accessible name is the full, untruncated title.
    await expect(canvas.getByRole('button', { name: LONG_TITLE })).toBeVisible();

    const apple = canvas.getByRole('button', { name: 'Apple orchard' });
    await userEvent.click(apple);
    await expect(onTileSelect).toHaveBeenCalledTimes(1);
    await expect(onTileSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a-2', title: 'Apple orchard' }),
      apple,
    );
  },
};

export const KeyboardActivation: Story = {
  render: () => build(SEED_ASPIRATIONS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole('button', { name: 'Apple orchard' });

    await userEvent.tab();
    await waitFor(() => expect(document.activeElement).toBe(first));

    await userEvent.keyboard('{Enter}');
    await expect(onTileSelect).toHaveBeenCalledTimes(1);
    await userEvent.keyboard(' ');
    await expect(onTileSelect).toHaveBeenCalledTimes(2);
  },
};

export const FocusIndicator: Story = {
  render: () => build(SEED_ASPIRATIONS),
  play: async ({ canvasElement }) => {
    const first = within(canvasElement).getByRole('button', { name: 'Apple orchard' });
    await userEvent.tab();
    await waitFor(() => expect(document.activeElement).toBe(first));
    // src/style.css gives .aspiration-tile:focus-visible a 2px solid outline.
    const style = getComputedStyle(first);
    await expect(style.outlineStyle).not.toBe('none');
    await expect(parseFloat(style.outlineWidth)).toBeGreaterThan(0);
  },
};

export const RerenderAfterStorageChange: Story = {
  render: () => build([]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("You don't have any aspirations yet")).toBeVisible();

    saveAspiration({ title: 'Brand new aspiration', description: '', reason: '' }, storage);
    renderGrid?.();

    await expect(canvas.getByRole('button', { name: 'Brand new aspiration' })).toBeVisible();
    await expect(canvas.queryByText("You don't have any aspirations yet")).toBeNull();
  },
};
