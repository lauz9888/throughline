import { describe, it, expect, beforeEach, vi } from 'vitest';
import { axe } from 'jest-axe';
import { initAspirationGrid } from './aspiration-grid';
import { ASPIRATIONS_STORAGE_KEY, type Aspiration } from './aspiration-storage';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

type GridInstance = ReturnType<typeof initAspirationGrid>;

function seedAspirations(records: Aspiration[]): void {
  window.localStorage.setItem(ASPIRATIONS_STORAGE_KEY, JSON.stringify(records));
}

function makeAspiration(overrides: Partial<Aspiration> = {}): Aspiration {
  return {
    id: 'id-1',
    title: 'Untitled',
    description: '',
    reason: '',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function setup(onTileSelect = vi.fn()): {
  root: HTMLElement;
  grid: GridInstance;
  onTileSelect: typeof onTileSelect;
} {
  const root = document.createElement('div');
  root.id = 'app';
  document.body.append(root);

  const grid = initAspirationGrid({ root, storage: window.localStorage, onTileSelect });
  root.append(grid.section);

  return { root, grid, onTileSelect };
}

describe('initAspirationGrid', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('renders the empty-state message and zero tiles when storage has no aspirations (Requirement 8)', () => {
    const { grid } = setup();

    grid.render();

    expect(grid.section.querySelectorAll('.aspiration-tile')).toHaveLength(0);
    const empty = grid.section.querySelector('.aspiration-grid__empty');
    expect(empty?.textContent).toBe("You don't have any aspirations yet");
  });

  it('renders one real <button> tile per stored aspiration, alphabetically ordered (case-insensitive)', () => {
    seedAspirations([
      makeAspiration({ id: 'b', title: 'banana' }),
      makeAspiration({ id: 'c', title: 'Cherry' }),
      makeAspiration({ id: 'a', title: 'apple' }),
    ]);

    const { grid } = setup();
    grid.render();

    const tiles = Array.from(grid.section.querySelectorAll<HTMLButtonElement>('.aspiration-tile'));
    expect(tiles).toHaveLength(3);
    expect(tiles.map((t) => t.textContent)).toEqual(['apple', 'banana', 'Cherry']);
    tiles.forEach((tile) => expect(tile.tagName).toBe('BUTTON'));
  });

  it('orders same-titled aspirations by ascending createdAt (tiebreak)', () => {
    seedAspirations([
      makeAspiration({ id: 'later', title: 'Same title', createdAt: '2024-06-01T00:00:00.000Z' }),
      makeAspiration({
        id: 'earlier',
        title: 'Same title',
        createdAt: '2024-01-01T00:00:00.000Z',
      }),
    ]);

    const { grid } = setup();
    grid.render();

    const tiles = Array.from(grid.section.querySelectorAll<HTMLButtonElement>('.aspiration-tile'));
    expect(tiles.map((t) => t.dataset.aspirationId)).toEqual(['earlier', 'later']);
  });

  it("each tile's accessible name (text content) equals the full untruncated title", () => {
    const longTitle = 'A'.repeat(200);
    seedAspirations([makeAspiration({ id: 'long', title: longTitle })]);

    const { grid } = setup();
    grid.render();

    const tile = grid.section.querySelector<HTMLButtonElement>('.aspiration-tile')!;
    expect(tile.textContent).toBe(longTitle);

    const titleSpan = tile.querySelectorAll('.aspiration-tile__title');
    expect(titleSpan).toHaveLength(1);
    expect(titleSpan[0]!.textContent).toBe(longTitle);
  });

  it('clicking a tile invokes onTileSelect with the exact matching Aspiration record and the clicked button element', () => {
    const aspiration = makeAspiration({ id: 'clicked', title: 'Clicked aspiration' });
    seedAspirations([aspiration]);

    const { grid, onTileSelect } = setup();
    grid.render();

    const tile = grid.section.querySelector<HTMLButtonElement>('.aspiration-tile')!;
    tile.click();

    expect(onTileSelect).toHaveBeenCalledTimes(1);
    expect(onTileSelect).toHaveBeenCalledWith(aspiration, tile);
  });

  it('reflects new state after render() is called again following a direct storage mutation (add)', () => {
    const { grid } = setup();
    grid.render();
    expect(grid.section.querySelectorAll('.aspiration-tile')).toHaveLength(0);

    seedAspirations([makeAspiration({ id: 'new', title: 'New aspiration' })]);
    grid.render();

    const tiles = grid.section.querySelectorAll('.aspiration-tile');
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.textContent).toBe('New aspiration');
  });

  it('reflects new state after render() is called again following a direct storage mutation (update)', () => {
    seedAspirations([makeAspiration({ id: 'x', title: 'Old title' })]);
    const { grid } = setup();
    grid.render();

    seedAspirations([makeAspiration({ id: 'x', title: 'New title' })]);
    grid.render();

    const tiles = grid.section.querySelectorAll('.aspiration-tile');
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.textContent).toBe('New title');
  });

  it('reflects new state after render() is called again following a direct storage mutation (remove)', () => {
    seedAspirations([makeAspiration({ id: 'x', title: 'To remove' })]);
    const { grid } = setup();
    grid.render();
    expect(grid.section.querySelectorAll('.aspiration-tile')).toHaveLength(1);

    seedAspirations([]);
    grid.render();

    expect(grid.section.querySelectorAll('.aspiration-tile')).toHaveLength(0);
    expect(grid.section.querySelector('.aspiration-grid__empty')).not.toBeNull();
  });

  it('section carries tabindex="-1" in both the populated and empty states (Requirement 8/accessibility 8)', () => {
    const { grid } = setup();

    grid.render();
    expect(grid.section.getAttribute('tabindex')).toBe('-1');

    seedAspirations([makeAspiration()]);
    grid.render();
    expect(grid.section.getAttribute('tabindex')).toBe('-1');
  });

  it('has no automatically detectable WCAG violations with several tiles rendered', async () => {
    seedAspirations([
      makeAspiration({ id: 'a', title: 'First aspiration' }),
      makeAspiration({ id: 'b', title: 'Second aspiration' }),
    ]);

    const { root, grid } = setup();
    grid.render();

    try {
      const results = await axe(root, {
        runOnly: { type: 'tag', values: WCAG_TAGS },
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(results).toHaveNoViolations();
    } finally {
      root.remove();
    }
  });

  it('has no automatically detectable WCAG violations in the empty state', async () => {
    const { root, grid } = setup();
    grid.render();

    try {
      const results = await axe(root, {
        runOnly: { type: 'tag', values: WCAG_TAGS },
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(results).toHaveNoViolations();
    } finally {
      root.remove();
    }
  });
});
