import { describe, it, expect, beforeEach, vi } from 'vitest';
import { axe } from 'jest-axe';
import { initGoalGrid } from './goal-grid';
import { GOALS_STORAGE_KEY, type Goal } from './goal-storage';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

type GridInstance = ReturnType<typeof initGoalGrid>;

function seedGoals(records: Goal[]): void {
  window.localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(records));
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'id-1',
    title: 'Untitled',
    description: '',
    reason: '',
    milestones: [],
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

  const grid = initGoalGrid({ root, storage: window.localStorage, onTileSelect });
  root.append(grid.section);

  return { root, grid, onTileSelect };
}

describe('initGoalGrid', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('renders the empty-state message and zero tiles when storage has no goals (Requirement 8)', () => {
    const { grid } = setup();

    grid.render();

    expect(grid.section.querySelectorAll('.goal-tile')).toHaveLength(0);
    const empty = grid.section.querySelector('.goal-grid__empty');
    expect(empty?.textContent).toBe("You don't have any goals yet");
  });

  it('renders one real <button> tile per stored goal, alphabetically ordered (case-insensitive)', () => {
    seedGoals([
      makeGoal({ id: 'b', title: 'banana' }),
      makeGoal({ id: 'c', title: 'Cherry' }),
      makeGoal({ id: 'a', title: 'apple' }),
    ]);

    const { grid } = setup();
    grid.render();

    const tiles = Array.from(grid.section.querySelectorAll<HTMLButtonElement>('.goal-tile'));
    expect(tiles).toHaveLength(3);
    expect(tiles.map((t) => t.textContent)).toEqual(['apple', 'banana', 'Cherry']);
    tiles.forEach((tile) => expect(tile.tagName).toBe('BUTTON'));
  });

  it('orders same-titled goals by ascending createdAt (tiebreak)', () => {
    seedGoals([
      makeGoal({ id: 'later', title: 'Same title', createdAt: '2024-06-01T00:00:00.000Z' }),
      makeGoal({
        id: 'earlier',
        title: 'Same title',
        createdAt: '2024-01-01T00:00:00.000Z',
      }),
    ]);

    const { grid } = setup();
    grid.render();

    const tiles = Array.from(grid.section.querySelectorAll<HTMLButtonElement>('.goal-tile'));
    expect(tiles.map((t) => t.dataset.goalId)).toEqual(['earlier', 'later']);
  });

  it("each tile's accessible name (text content) equals the full untruncated title", () => {
    const longTitle = 'A'.repeat(200);
    seedGoals([makeGoal({ id: 'long', title: longTitle })]);

    const { grid } = setup();
    grid.render();

    const tile = grid.section.querySelector<HTMLButtonElement>('.goal-tile')!;
    expect(tile.textContent).toBe(longTitle);

    const titleSpan = tile.querySelectorAll('.goal-tile__title');
    expect(titleSpan).toHaveLength(1);
    expect(titleSpan[0]!.textContent).toBe(longTitle);
  });

  it('clicking a tile invokes onTileSelect with the exact matching Goal record and the clicked button element', () => {
    const goal = makeGoal({ id: 'clicked', title: 'Clicked goal' });
    seedGoals([goal]);

    const { grid, onTileSelect } = setup();
    grid.render();

    const tile = grid.section.querySelector<HTMLButtonElement>('.goal-tile')!;
    tile.click();

    expect(onTileSelect).toHaveBeenCalledTimes(1);
    expect(onTileSelect).toHaveBeenCalledWith(goal, tile);
  });

  it('reflects new state after render() is called again following a direct storage mutation (add)', () => {
    const { grid } = setup();
    grid.render();
    expect(grid.section.querySelectorAll('.goal-tile')).toHaveLength(0);

    seedGoals([makeGoal({ id: 'new', title: 'New goal' })]);
    grid.render();

    const tiles = grid.section.querySelectorAll('.goal-tile');
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.textContent).toBe('New goal');
  });

  it('reflects new state after render() is called again following a direct storage mutation (update)', () => {
    seedGoals([makeGoal({ id: 'x', title: 'Old title' })]);
    const { grid } = setup();
    grid.render();

    seedGoals([makeGoal({ id: 'x', title: 'New title' })]);
    grid.render();

    const tiles = grid.section.querySelectorAll('.goal-tile');
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.textContent).toBe('New title');
  });

  it('reflects new state after render() is called again following a direct storage mutation (remove)', () => {
    seedGoals([makeGoal({ id: 'x', title: 'To remove' })]);
    const { grid } = setup();
    grid.render();
    expect(grid.section.querySelectorAll('.goal-tile')).toHaveLength(1);

    seedGoals([]);
    grid.render();

    expect(grid.section.querySelectorAll('.goal-tile')).toHaveLength(0);
    expect(grid.section.querySelector('.goal-grid__empty')).not.toBeNull();
  });

  it('section carries aria-label="Your goals" and tabindex="-1" in both the populated and empty states (Requirement 8/accessibility 8)', () => {
    const { grid } = setup();

    grid.render();
    expect(grid.section.getAttribute('aria-label')).toBe('Your goals');
    expect(grid.section.getAttribute('tabindex')).toBe('-1');

    seedGoals([makeGoal()]);
    grid.render();
    expect(grid.section.getAttribute('aria-label')).toBe('Your goals');
    expect(grid.section.getAttribute('tabindex')).toBe('-1');
  });

  it('has no automatically detectable WCAG violations with several tiles rendered', async () => {
    seedGoals([
      makeGoal({ id: 'a', title: 'First goal' }),
      makeGoal({ id: 'b', title: 'Second goal' }),
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
