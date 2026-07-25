import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './coverage-fixture';

// Scope to actual WCAG 2.1 A/AA success criteria, not axe-core's broader
// "best-practice" rule set. Matches home.spec.ts / add-item-button.spec.ts /
// aspiration-modal.spec.ts.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const ASPIRATIONS_STORAGE_KEY = 'throughline:aspirations';

interface SeedAspiration {
  title: string;
  description?: string;
  reason?: string;
  createdAt?: string;
}

// Seeds localStorage with aspiration records the way a returning user's browser
// would already have them, then reloads so the grid renders from that state on
// load — mirrors the "seed via localStorage, reload" convention already used
// for the persistence-after-reload case in aspiration-modal.spec.ts.
async function seedAspirations(page: Page, records: SeedAspiration[]): Promise<void> {
  await page.goto('./');
  await page.evaluate(
    ({ key, records }) => {
      const full = records.map((r, i) => ({
        id: `seed-${i}`,
        title: r.title,
        description: r.description ?? '',
        reason: r.reason ?? '',
        createdAt: r.createdAt ?? new Date(2024, 0, i + 1).toISOString(),
      }));
      localStorage.setItem(key, JSON.stringify(full));
    },
    { key: ASPIRATIONS_STORAGE_KEY, records },
  );
  await page.reload();
}

async function readStoredAspirations(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }, ASPIRATIONS_STORAGE_KEY);
}

function editDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Edit Aspiration' });
}

test.describe('aspiration tile grid', () => {
  test('renders one tile per stored aspiration, alphabetically ordered, with an accessible name matching each title', async ({
    page,
  }) => {
    await seedAspirations(page, [
      { title: 'Zebra crossing safety' },
      { title: 'apple orchard visit' },
      { title: 'Banana bread recipe' },
    ]);

    const tiles = page.locator('.aspiration-tile');
    await expect(tiles).toHaveCount(3);

    const names = await tiles.evaluateAll((els) => els.map((el) => el.textContent?.trim()));
    expect(names).toEqual(['apple orchard visit', 'Banana bread recipe', 'Zebra crossing safety']);

    for (const title of names) {
      await expect(page.getByRole('button', { name: title!, exact: true })).toBeVisible();
    }
  });

  test('orders aspirations sharing the same title by createdAt ascending (tiebreak)', async ({
    page,
  }) => {
    await seedAspirations(page, [
      { title: 'Shared title', createdAt: '2024-03-01T00:00:00.000Z' },
      { title: 'Shared title', createdAt: '2024-01-01T00:00:00.000Z' },
    ]);

    const tiles = page.locator('.aspiration-tile');
    await expect(tiles).toHaveCount(2);

    const ids = await tiles.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-aspiration-id')),
    );
    // The record created 2024-01-01 (seed-1) must come before 2024-03-01 (seed-0).
    expect(ids).toEqual(['seed-1', 'seed-0']);
  });

  test('a tile with a very long title still renders as a perfect square', async ({ page }) => {
    const longTitle = 'A'.repeat(200);
    await seedAspirations(page, [{ title: longTitle }]);

    const tile = page.getByRole('button', { name: longTitle, exact: true });
    await expect(tile).toBeVisible();

    const box = await tile.boundingBox();
    expect(box).not.toBeNull();
    // Allow a small tolerance for sub-pixel rounding, per the design's own
    // "within a small pixel tolerance" note.
    expect(Math.abs(box!.width - box!.height)).toBeLessThanOrEqual(1);
  });

  test('shows an empty-state message when zero aspirations exist, and renders no tiles', async ({
    page,
  }) => {
    await page.goto('./');

    await expect(page.getByText("You don't have any aspirations yet")).toBeVisible();
    await expect(page.locator('.aspiration-tile')).toHaveCount(0);
  });

  test('clicking a tile opens Edit Aspiration pre-populated with that aspiration\'s data', async ({
    page,
  }) => {
    await seedAspirations(page, [
      {
        title: 'Learn watercolor painting',
        description: 'Weekly practice sessions',
        reason: 'Creative outlet',
      },
    ]);

    await page.getByRole('button', { name: 'Learn watercolor painting', exact: true }).click();

    const dialog = editDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(
      'Learn watercolor painting',
    );
    await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue(
      'Weekly practice sessions',
    );
    await expect(dialog.getByLabel('Reason', { exact: true })).toHaveValue('Creative outlet');
    await expect(dialog.getByRole('radio', { name: 'Goals' })).not.toBeChecked();
    await expect(dialog.getByRole('radio', { name: 'Habits' })).not.toBeChecked();
  });

  test('Save starts disabled, enables once Title is edited, and disables again once reverted to the loaded value', async ({
    page,
  }) => {
    await seedAspirations(page, [{ title: 'Read more books' }]);
    await page.getByRole('button', { name: 'Read more books', exact: true }).click();

    const dialog = editDialog(page);
    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeDisabled();

    const titleInput = dialog.getByLabel('Title', { exact: true });
    await titleInput.fill('Read many more books');
    await expect(saveButton).toBeEnabled();

    await titleInput.fill('Read more books');
    await expect(saveButton).toBeDisabled();
  });

  test('editing and saving updates the grid and closes the modal', async ({ page }) => {
    await seedAspirations(page, [{ title: 'Original title' }]);
    await page.getByRole('button', { name: 'Original title', exact: true }).click();

    const dialog = editDialog(page);
    await dialog.getByLabel('Title', { exact: true }).fill('Updated title');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(editDialog(page)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Updated title', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Original title', exact: true })).toHaveCount(0);

    const stored = await readStoredAspirations(page);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ title: 'Updated title' });
  });

  test('after a successful save that changes alphabetical position, focus lands on the re-sorted tile matching the edited id, not a stale node', async ({
    page,
  }) => {
    await seedAspirations(page, [{ title: 'Middle item' }, { title: 'Zebra' }]);

    await page.getByRole('button', { name: 'Zebra', exact: true }).click();
    const dialog = editDialog(page);
    await dialog.getByLabel('Title', { exact: true }).fill('Aardvark');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(editDialog(page)).toBeHidden();

    const tiles = page.locator('.aspiration-tile');
    await expect(tiles).toHaveCount(2);
    const names = await tiles.evaluateAll((els) => els.map((el) => el.textContent?.trim()));
    expect(names).toEqual(['Aardvark', 'Middle item']);

    const newTile = page.getByRole('button', { name: 'Aardvark', exact: true });
    await expect(newTile).toHaveCount(1);
    await expect(newTile).toBeFocused();
  });

  test('Delete button opens a delete-confirm dialog without deleting anything yet', async ({
    page,
  }) => {
    await seedAspirations(page, [{ title: 'Keep an eye on me' }]);
    await page.getByRole('button', { name: 'Keep an eye on me', exact: true }).click();

    const dialog = editDialog(page);
    await dialog.getByRole('button', { name: /delete/i }).click();

    await expect(page.getByRole('alertdialog')).toBeVisible();
    expect(await readStoredAspirations(page)).toHaveLength(1);
  });

  test('confirming the delete-confirm dialog removes the tile and closes both dialogs', async ({
    page,
  }) => {
    await seedAspirations(page, [{ title: 'To be deleted' }]);
    await page.getByRole('button', { name: 'To be deleted', exact: true }).click();

    const dialog = editDialog(page);
    await dialog.getByRole('button', { name: /delete/i }).click();

    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(editDialog(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'To be deleted', exact: true })).toHaveCount(0);

    expect(await readStoredAspirations(page)).toHaveLength(0);
  });

  test('canceling the delete-confirm dialog returns to the unchanged Edit modal', async ({
    page,
  }) => {
    await seedAspirations(page, [{ title: 'Keep me around' }]);
    await page.getByRole('button', { name: 'Keep me around', exact: true }).click();

    const dialog = editDialog(page);
    await dialog.getByRole('button', { name: /delete/i }).click();

    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Keep editing' }).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('Keep me around');

    expect(await readStoredAspirations(page)).toHaveLength(1);
  });

  test('after a confirmed delete, focus moves to the tile grid\'s section container', async ({
    page,
  }) => {
    await seedAspirations(page, [{ title: 'Delete focus target' }]);
    await page.getByRole('button', { name: 'Delete focus target', exact: true }).click();

    const dialog = editDialog(page);
    await dialog.getByRole('button', { name: /delete/i }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByRole('region', { name: 'Your aspirations' })).toBeFocused();
  });

  test('a tile is reachable via Tab and activatable via Enter', async ({ page }) => {
    await seedAspirations(page, [{ title: 'Keyboard reachable tile' }]);

    await page.keyboard.press('Tab'); // Add item button
    await page.keyboard.press('Tab'); // first (and only) tile

    const tile = page.getByRole('button', { name: 'Keyboard reachable tile', exact: true });
    await expect(tile).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(editDialog(page)).toBeVisible();
  });

  test('a tile is activatable via Space', async ({ page }) => {
    await seedAspirations(page, [{ title: 'Space activatable tile' }]);

    await page.keyboard.press('Tab'); // Add item button
    await page.keyboard.press('Tab'); // first (and only) tile

    const tile = page.getByRole('button', { name: 'Space activatable tile', exact: true });
    await expect(tile).toBeFocused();

    await page.keyboard.press('Space');
    await expect(editDialog(page)).toBeVisible();
  });
});

test.describe('aspiration tile grid accessibility scans', () => {
  test('populated grid has no automatically detectable WCAG violations', async ({ page }) => {
    await seedAspirations(page, [{ title: 'Aspiration one' }, { title: 'Aspiration two' }]);
    // Prove the grid actually rendered tiles before scanning it — otherwise this
    // scan would trivially pass against an empty page and prove nothing.
    await expect(page.locator('.aspiration-tile')).toHaveCount(2);

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('empty grid has no automatically detectable WCAG violations', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByText("You don't have any aspirations yet")).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('open Edit Aspiration modal has no automatically detectable WCAG violations', async ({
    page,
  }) => {
    await seedAspirations(page, [{ title: 'Aspiration one' }]);
    await page.getByRole('button', { name: 'Aspiration one', exact: true }).click();
    await expect(editDialog(page)).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('open delete-confirm dialog has no automatically detectable WCAG violations', async ({
    page,
  }) => {
    await seedAspirations(page, [{ title: 'Aspiration one' }]);
    await page.getByRole('button', { name: 'Aspiration one', exact: true }).click();
    await editDialog(page)
      .getByRole('button', { name: /delete/i })
      .click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('open unsaved-changes confirm dialog has no automatically detectable WCAG violations', async ({
    page,
  }) => {
    await seedAspirations(page, [{ title: 'Aspiration one' }]);
    await page.getByRole('button', { name: 'Aspiration one', exact: true }).click();
    const dialog = editDialog(page);
    await dialog.getByLabel('Title', { exact: true }).fill('Aspiration one changed');
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
