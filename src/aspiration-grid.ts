import {
  readAspirations,
  sortAspirationsAlphabetically,
  type Aspiration,
} from './aspiration-storage';

export interface AspirationGridElements {
  root: HTMLElement; // used only to derive `doc`
  storage: Storage;
  onTileSelect: (aspiration: Aspiration, tile: HTMLButtonElement) => void;
}

export function initAspirationGrid(elements: AspirationGridElements): {
  section: HTMLElement;
  render: () => void;
  destroy: () => void;
} {
  const { root, storage, onTileSelect } = elements;
  const doc = root.ownerDocument;

  const section = doc.createElement('section');
  section.className = 'aspiration-grid-section';
  section.setAttribute('aria-label', 'Your aspirations');
  section.tabIndex = -1;

  function buildTile(aspiration: Aspiration): HTMLButtonElement {
    const tile = doc.createElement('button');
    tile.type = 'button';
    tile.className = 'aspiration-tile';
    tile.dataset.aspirationId = aspiration.id;

    const title = doc.createElement('span');
    title.className = 'aspiration-tile__title';
    title.textContent = aspiration.title;

    tile.append(title);
    tile.addEventListener('click', () => {
      onTileSelect(aspiration, tile);
    });

    return tile;
  }

  function render(): void {
    const sorted = sortAspirationsAlphabetically(readAspirations(storage));

    if (sorted.length === 0) {
      const empty = doc.createElement('p');
      empty.className = 'aspiration-grid__empty';
      empty.textContent = "You don't have any aspirations yet";
      section.replaceChildren(empty);
      return;
    }

    const grid = doc.createElement('div');
    grid.className = 'aspiration-grid';
    sorted.forEach((aspiration) => {
      grid.append(buildTile(aspiration));
    });
    section.replaceChildren(grid);
  }

  function destroy(): void {
    // No persistent listeners exist at the section level; kept for interface symmetry with
    // the other init* modules and idempotent cleanup.
  }

  return { section, render, destroy };
}
