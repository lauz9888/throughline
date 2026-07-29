import { readGoals, sortGoalsAlphabetically, type Goal } from './goal-storage';

export interface GoalGridElements {
  root: HTMLElement; // used only to derive `doc`
  storage: Storage;
  onTileSelect: (goal: Goal, tile: HTMLButtonElement) => void;
}

export function initGoalGrid(elements: GoalGridElements): {
  section: HTMLElement;
  render: () => void;
  destroy: () => void;
} {
  const { root, storage, onTileSelect } = elements;
  const doc = root.ownerDocument;

  const section = doc.createElement('section');
  section.className = 'goal-grid-section';
  section.setAttribute('aria-label', 'Your goals');
  section.tabIndex = -1;

  function buildTile(goal: Goal): HTMLButtonElement {
    const tile = doc.createElement('button');
    tile.type = 'button';
    tile.className = 'goal-tile';
    tile.dataset.goalId = goal.id;

    const title = doc.createElement('span');
    title.className = 'goal-tile__title';
    title.textContent = goal.title;

    tile.append(title);
    tile.addEventListener('click', () => {
      onTileSelect(goal, tile);
    });

    return tile;
  }

  function render(): void {
    const sorted = sortGoalsAlphabetically(readGoals(storage));

    if (sorted.length === 0) {
      const empty = doc.createElement('p');
      empty.className = 'goal-grid__empty';
      empty.textContent = "You don't have any goals yet";
      section.replaceChildren(empty);
      return;
    }

    const grid = doc.createElement('div');
    grid.className = 'goal-grid';
    sorted.forEach((goal) => {
      grid.append(buildTile(goal));
    });
    section.replaceChildren(grid);
  }

  function destroy(): void {
    // No persistent listeners exist at the section level; kept for interface symmetry with
    // the other init* modules and idempotent cleanup.
  }

  return { section, render, destroy };
}
