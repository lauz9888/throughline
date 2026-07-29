import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './coverage-fixture';

// Scope to actual WCAG 2.1 A/AA success criteria, not axe-core's broader
// "best-practice" rule set. Matches home.spec.ts / add-item-button.spec.ts /
// aspiration-tiles.spec.ts.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const GOALS_STORAGE_KEY = 'throughline:goals';

interface SeedMilestone {
  id?: string;
  title: string;
}

interface SeedGoal {
  title: string;
  description?: string;
  reason?: string;
  createdAt?: string;
  milestones?: SeedMilestone[];
}

// Seeds localStorage with goal records the way a returning user's browser
// would already have them, then reloads so the grid renders from that state
// on load — mirrors aspiration-tiles.spec.ts's seedAspirations convention,
// extended for the Goal/Milestone shape.
async function seedGoals(page: Page, records: SeedGoal[]): Promise<void> {
  await page.goto('./');
  await page.evaluate(
    ({ key, records }) => {
      const full = records.map((r, i) => ({
        id: `seed-${i}`,
        title: r.title,
        description: r.description ?? '',
        reason: r.reason ?? '',
        milestones: (r.milestones ?? []).map((m, j) => ({
          id: m.id ?? `seed-${i}-milestone-${j}`,
          title: m.title,
        })),
        createdAt: r.createdAt ?? new Date(2024, 0, i + 1).toISOString(),
      }));
      localStorage.setItem(key, JSON.stringify(full));
    },
    { key: GOALS_STORAGE_KEY, records },
  );
  await page.reload();
}

async function readStoredGoals(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }, GOALS_STORAGE_KEY);
}

function editDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Edit Goal' });
}

test.describe('goal tile grid', () => {
  test('renders one tile per stored goal, alphabetically ordered, with an accessible name matching each title', async ({
    page,
  }) => {
    await seedGoals(page, [
      { title: 'Zebra crossing safety' },
      { title: 'apple orchard visit' },
      { title: 'Banana bread recipe' },
    ]);

    const tiles = page.locator('.goal-tile');
    await expect(tiles).toHaveCount(3);

    const names = await tiles.evaluateAll((els) => els.map((el) => el.textContent?.trim()));
    expect(names).toEqual(['apple orchard visit', 'Banana bread recipe', 'Zebra crossing safety']);

    for (const title of names) {
      await expect(page.getByRole('button', { name: title!, exact: true })).toBeVisible();
    }
  });

  test('orders goals sharing the same title by createdAt ascending (tiebreak)', async ({ page }) => {
    await seedGoals(page, [
      { title: 'Shared title', createdAt: '2024-03-01T00:00:00.000Z' },
      { title: 'Shared title', createdAt: '2024-01-01T00:00:00.000Z' },
    ]);

    const tiles = page.locator('.goal-tile');
    await expect(tiles).toHaveCount(2);

    const ids = await tiles.evaluateAll((els) => els.map((el) => el.getAttribute('data-goal-id')));
    // The record created 2024-01-01 (seed-1) must come before 2024-03-01 (seed-0).
    expect(ids).toEqual(['seed-1', 'seed-0']);
  });

  test('a tile with a very long title still renders as a perfect square', async ({ page }) => {
    const longTitle = 'A'.repeat(200);
    await seedGoals(page, [{ title: longTitle }]);

    const tile = page.getByRole('button', { name: longTitle, exact: true });
    await expect(tile).toBeVisible();

    const box = await tile.boundingBox();
    expect(box).not.toBeNull();
    // Allow a small tolerance for sub-pixel rounding, per the design's own
    // "within a small pixel tolerance" note.
    expect(Math.abs(box!.width - box!.height)).toBeLessThanOrEqual(1);
  });

  test('shows an empty-state message when zero goals exist, and renders no tiles', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByText("You don't have any goals yet")).toBeVisible();
    await expect(page.locator('.goal-tile')).toHaveCount(0);
  });

  test("clicking a tile opens Edit Goal pre-populated with that goal's fields and milestone rows", async ({
    page,
  }) => {
    await seedGoals(page, [
      {
        title: 'Run a marathon',
        description: 'Train consistently for six months',
        reason: 'Personal challenge',
        milestones: [{ title: 'Run a 10k' }, { title: 'Run a half-marathon' }],
      },
    ]);

    await page.getByRole('button', { name: 'Run a marathon', exact: true }).click();

    const dialog = editDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('Run a marathon');
    await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue(
      'Train consistently for six months',
    );
    await expect(dialog.getByLabel('Reason', { exact: true })).toHaveValue('Personal challenge');

    await expect(dialog.getByLabel('Milestone 1', { exact: true })).toHaveValue('Run a 10k');
    await expect(dialog.getByLabel('Milestone 2', { exact: true })).toHaveValue(
      'Run a half-marathon',
    );
  });

  test('Save starts disabled, enables once Title is edited, and disables again once reverted to the loaded value', async ({
    page,
  }) => {
    await seedGoals(page, [{ title: 'Read more books' }]);
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

  test('Save enables when a milestone row is added, edited, or removed, and disables again when reverted to the loaded set/order (Requirement 16)', async ({
    page,
  }) => {
    await seedGoals(page, [
      { title: 'Read more books', milestones: [{ title: 'Finish one book' }] },
    ]);
    await page.getByRole('button', { name: 'Read more books', exact: true }).click();

    const dialog = editDialog(page);
    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeDisabled();

    // Adding a non-blank milestone row enables Save.
    await dialog.getByRole('button', { name: 'Add milestone' }).click();
    await dialog.getByLabel('Milestone 2', { exact: true }).fill('Finish two books');
    await expect(saveButton).toBeEnabled();

    // Removing that same row returns to the loaded state — disabled again.
    await dialog.getByRole('button', { name: 'Remove milestone 2' }).click();
    await expect(saveButton).toBeDisabled();

    // Editing the existing (pre-populated) row's title enables Save.
    await dialog.getByLabel('Milestone 1', { exact: true }).fill('Finish two books');
    await expect(saveButton).toBeEnabled();

    // Reverting that edit exactly disables Save again.
    await dialog.getByLabel('Milestone 1', { exact: true }).fill('Finish one book');
    await expect(saveButton).toBeDisabled();

    // Removing the only (pre-populated) milestone row enables Save.
    await dialog.getByRole('button', { name: 'Remove milestone 1' }).click();
    await expect(saveButton).toBeEnabled();
  });

  test('editing and saving updates the grid and closes the modal', async ({ page }) => {
    await seedGoals(page, [{ title: 'Original title' }]);
    await page.getByRole('button', { name: 'Original title', exact: true }).click();

    const dialog = editDialog(page);
    await dialog.getByLabel('Title', { exact: true }).fill('Updated title');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(editDialog(page)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Updated title', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Original title', exact: true })).toHaveCount(0);

    const stored = await readStoredGoals(page);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ title: 'Updated title' });
  });

  test('after a successful save that changes alphabetical position, focus lands on the re-sorted tile matching the edited id, not a stale node', async ({
    page,
  }) => {
    await seedGoals(page, [{ title: 'Middle item' }, { title: 'Zebra' }]);

    await page.getByRole('button', { name: 'Zebra', exact: true }).click();
    const dialog = editDialog(page);
    await dialog.getByLabel('Title', { exact: true }).fill('Aardvark');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(editDialog(page)).toBeHidden();

    const tiles = page.locator('.goal-tile');
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
    await seedGoals(page, [{ title: 'Keep an eye on me' }]);
    await page.getByRole('button', { name: 'Keep an eye on me', exact: true }).click();

    const dialog = editDialog(page);
    await dialog.getByRole('button', { name: /delete/i }).click();

    await expect(page.getByRole('alertdialog')).toBeVisible();
    expect(await readStoredGoals(page)).toHaveLength(1);
  });

  test('confirming the delete-confirm dialog removes the tile and closes both dialogs', async ({
    page,
  }) => {
    await seedGoals(page, [{ title: 'To be deleted' }]);
    await page.getByRole('button', { name: 'To be deleted', exact: true }).click();

    const dialog = editDialog(page);
    await dialog.getByRole('button', { name: /delete/i }).click();

    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(editDialog(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'To be deleted', exact: true })).toHaveCount(0);

    expect(await readStoredGoals(page)).toHaveLength(0);
  });

  test('canceling the delete-confirm dialog returns to the unchanged Edit modal', async ({
    page,
  }) => {
    await seedGoals(page, [{ title: 'Keep me around' }]);
    await page.getByRole('button', { name: 'Keep me around', exact: true }).click();

    const dialog = editDialog(page);
    await dialog.getByRole('button', { name: /delete/i }).click();

    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Keep editing' }).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('Keep me around');

    expect(await readStoredGoals(page)).toHaveLength(1);
  });

  test("after a confirmed delete, focus moves to the tile grid's section container", async ({
    page,
  }) => {
    await seedGoals(page, [{ title: 'Delete focus target' }]);
    await page.getByRole('button', { name: 'Delete focus target', exact: true }).click();

    const dialog = editDialog(page);
    await dialog.getByRole('button', { name: /delete/i }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();

    await expect(page.getByRole('region', { name: 'Your goals' })).toBeFocused();
  });

  test('a tile is reachable via Tab and activatable via Enter', async ({ page }) => {
    await seedGoals(page, [{ title: 'Keyboard reachable tile' }]);

    await page.keyboard.press('Tab'); // Add item button
    await page.keyboard.press('Tab'); // first (and only) tile

    const tile = page.getByRole('button', { name: 'Keyboard reachable tile', exact: true });
    await expect(tile).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(editDialog(page)).toBeVisible();
  });

  test('a tile is activatable via Space', async ({ page }) => {
    await seedGoals(page, [{ title: 'Space activatable tile' }]);

    await page.keyboard.press('Tab'); // Add item button
    await page.keyboard.press('Tab'); // first (and only) tile

    const tile = page.getByRole('button', { name: 'Space activatable tile', exact: true });
    await expect(tile).toBeFocused();

    await page.keyboard.press('Space');
    await expect(editDialog(page)).toBeVisible();
  });
});

test.describe('goal tile grid accessibility scans', () => {
  test('populated grid has no automatically detectable WCAG violations', async ({ page }) => {
    await seedGoals(page, [{ title: 'Goal one' }, { title: 'Goal two' }]);
    // Prove the grid actually rendered tiles before scanning it — otherwise this
    // scan would trivially pass against an empty page and prove nothing.
    await expect(page.locator('.goal-tile')).toHaveCount(2);

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('empty grid has no automatically detectable WCAG violations', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByText("You don't have any goals yet")).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('open Edit Goal modal (with a pre-populated milestone row) has no automatically detectable WCAG violations', async ({
    page,
  }) => {
    await seedGoals(page, [
      { title: 'Goal one', milestones: [{ title: 'First milestone' }] },
    ]);
    await page.getByRole('button', { name: 'Goal one', exact: true }).click();
    const dialog = editDialog(page);
    await expect(dialog).toBeVisible();
    // Prove the milestone DOM actually rendered before scanning it — otherwise
    // this scan would prove nothing about the milestone rows.
    await expect(dialog.getByLabel('Milestone 1', { exact: true })).toHaveValue(
      'First milestone',
    );

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('open delete-confirm dialog has no automatically detectable WCAG violations', async ({
    page,
  }) => {
    await seedGoals(page, [{ title: 'Goal one' }]);
    await page.getByRole('button', { name: 'Goal one', exact: true }).click();
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
    await seedGoals(page, [{ title: 'Goal one' }]);
    await page.getByRole('button', { name: 'Goal one', exact: true }).click();
    const dialog = editDialog(page);
    await dialog.getByLabel('Title', { exact: true }).fill('Goal one changed');
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
