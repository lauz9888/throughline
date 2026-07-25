import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './coverage-fixture';

// Scope to actual WCAG 2.1 A/AA success criteria, not axe-core's broader
// "best-practice" rule set. Matches home.spec.ts / add-item-button.spec.ts.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const ASPIRATIONS_STORAGE_KEY = 'throughline:aspirations';

async function readStoredAspirations(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }, ASPIRATIONS_STORAGE_KEY);
}

// Opens the modal exactly the way a real user would: click the add-item
// button, then click the "Aspiration" menu item.
async function openAspirationModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByRole('menuitem', { name: 'Aspiration' }).click();
  await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeVisible();
}

test.describe('create aspiration modal', () => {
  test('opens from the add-item menu with the header, blurb, and fields in the correct order', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    const dialog = page.getByRole('dialog', { name: 'Create Aspiration' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Create Aspiration' })).toBeVisible();
    await expect(
      dialog.getByText(/An aspiration is a long-term, potentially lifelong life direction/),
    ).toBeVisible();
    await expect(dialog.getByLabel('Title', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Description', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Reason', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('group', { name: 'Links' })).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'Goals' })).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'Habits' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeVisible();

    const order = await dialog.evaluate((el) => {
      const text = el.textContent ?? '';
      return {
        blurbBeforeTitle: text.indexOf('An aspiration is') < text.indexOf('Title'),
        titleBeforeDescription: text.indexOf('Title') < text.indexOf('Description'),
        descriptionBeforeReason: text.indexOf('Description') < text.indexOf('Reason'),
        reasonBeforeLinks: text.indexOf('Reason') < text.indexOf('Links'),
        linksBeforeSave: text.indexOf('Links') < text.indexOf('Save'),
      };
    });
    expect(order).toEqual({
      blurbBeforeTitle: true,
      titleBeforeDescription: true,
      descriptionBeforeReason: true,
      reasonBeforeLinks: true,
      linksBeforeSave: true,
    });
  });

  test('selecting "Aspiration" again while the modal is already open does not open a duplicate', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);
    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toHaveCount(1);

    // The add-item button is inert while the modal is open (see the
    // background-exclusion test below), so a real pointer click can't reach
    // it or the menu item behind the modal. Invoke the click handling
    // directly to simulate re-selecting "Aspiration" a second time.
    await page.evaluate(() => {
      document.getElementById('add-item-button')?.click();
    });
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('[role="menuitem"]')?.click();
    });

    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toHaveCount(1);
  });

  test('Save is disabled while Title is empty or whitespace-only, and enables once Title has non-whitespace content', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeDisabled();

    await page.getByLabel('Title', { exact: true }).fill('   ');
    await expect(saveButton).toBeDisabled();

    await page.getByLabel('Title', { exact: true }).fill('Live a healthy life');
    await expect(saveButton).toBeEnabled();
  });

  test('keyboard focus moves to the Title field as soon as the modal opens', async ({ page }) => {
    await page.goto('./');
    await openAspirationModal(page);

    await expect(page.getByLabel('Title', { exact: true })).toBeFocused();
  });

  test('Tab cycles through the modal’s own controls and wraps from Save back to Close, and Shift+Tab wraps the other way', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    // Save is natively `disabled` (Requirement 23/41) until Title has content, and a
    // disabled button is never a Tab stop in any browser — so it must be enabled here for
    // this test to be able to reach it via the keyboard at all, matching the same
    // enable-before-testing-the-trap-boundary pattern already used for this exact scenario
    // at the unit layer (see `src/aspiration-modal.test.ts`'s "traps focus" test).
    await page.getByLabel('Title', { exact: true }).fill('Non-empty title');

    // Focus starts on Title. Tab forward through Description, Reason, and
    // the Goals radio (the only tab stop in the Goals/Habits group while
    // neither is checked yet), landing on Save.
    await page.keyboard.press('Tab'); // Description
    await page.keyboard.press('Tab'); // Reason
    await page.keyboard.press('Tab'); // Goals radio
    await page.keyboard.press('Tab'); // Save
    await expect(page.getByRole('button', { name: 'Save' })).toBeFocused();

    await page.keyboard.press('Tab'); // wraps to Close (first focusable)
    await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();

    await page.keyboard.press('Shift+Tab'); // wraps back to Save (last focusable)
    await expect(page.getByRole('button', { name: 'Save' })).toBeFocused();
  });

  test('background elements are excluded from the tab order and cannot be programmatically focused while the modal is open', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    const focusedIdentifiers: Array<string | null> = [];
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press('Tab');
      focusedIdentifiers.push(
        await page.evaluate(
          () =>
            document.activeElement?.id ||
            document.activeElement?.getAttribute('aria-label') ||
            null,
        ),
      );
    }
    expect(focusedIdentifiers).not.toContain('add-item-button');
    expect(focusedIdentifiers).not.toContain('Add item');

    // A real browser also excludes an `inert` element from *programmatic*
    // focus, not just the tab order — jsdom doesn't implement `inert` at
    // all, so this half of Requirement 30 can only be proven here.
    await page.evaluate(() => {
      (document.getElementById('add-item-button') as HTMLElement | null)?.focus();
    });
    const activeIdAfterProgrammaticFocus = await page.evaluate(
      () => document.activeElement?.id ?? null,
    );
    expect(activeIdAfterProgrammaticFocus).not.toBe('add-item-button');
  });

  test('shows a visible focus ring on the Title field when reached via keyboard', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    await page.keyboard.press('Tab'); // move to Description
    await page.keyboard.press('Shift+Tab'); // back to Title, via keyboard

    const titleInput = page.getByLabel('Title', { exact: true });
    await expect(titleInput).toBeFocused();

    const outline = await titleInput.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { outlineStyle: computed.outlineStyle, outlineColor: computed.outlineColor };
    });
    expect(outline.outlineStyle).not.toBe('none');
    expect(outline.outlineColor).toBe('rgb(26, 26, 26)');
  });

  test('selecting Goals shows the empty-state message; selecting Habits swaps it and deselects Goals; re-selecting the checked radio deselects it', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    const goalsRadio = page.getByRole('radio', { name: 'Goals' });
    const habitsRadio = page.getByRole('radio', { name: 'Habits' });
    const emptyMessage = page.locator('.aspiration-modal__links-empty');

    await expect(goalsRadio).not.toBeChecked();
    await expect(habitsRadio).not.toBeChecked();
    await expect(emptyMessage).toBeHidden();

    await goalsRadio.click();
    await expect(goalsRadio).toBeChecked();
    await expect(emptyMessage).toBeVisible();
    await expect(emptyMessage).toContainText('Goals');

    await habitsRadio.click();
    await expect(habitsRadio).toBeChecked();
    await expect(goalsRadio).not.toBeChecked();
    await expect(emptyMessage).toContainText('Habits');

    await habitsRadio.click(); // re-click the already-selected radio
    await expect(habitsRadio).not.toBeChecked();
    await expect(emptyMessage).toBeHidden();
  });

  test('ArrowDown moves the Links radio-group selection from Goals to Habits, and ArrowUp moves it back (Requirement 34)', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    const goalsRadio = page.getByRole('radio', { name: 'Goals' });
    const habitsRadio = page.getByRole('radio', { name: 'Habits' });
    const emptyMessage = page.locator('.aspiration-modal__links-empty');

    await goalsRadio.focus();
    await expect(goalsRadio).not.toBeChecked();

    await page.keyboard.press('ArrowDown');
    await expect(habitsRadio).toBeChecked();
    await expect(goalsRadio).not.toBeChecked();
    await expect(habitsRadio).toBeFocused();
    await expect(emptyMessage).toContainText('Habits');

    await page.keyboard.press('ArrowUp');
    await expect(goalsRadio).toBeChecked();
    await expect(habitsRadio).not.toBeChecked();
    await expect(goalsRadio).toBeFocused();
    await expect(emptyMessage).toContainText('Goals');
  });

  test('ArrowRight moves the Links radio-group selection from Goals to Habits, and ArrowLeft moves it back (Requirement 34)', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    const goalsRadio = page.getByRole('radio', { name: 'Goals' });
    const habitsRadio = page.getByRole('radio', { name: 'Habits' });
    const emptyMessage = page.locator('.aspiration-modal__links-empty');

    await goalsRadio.focus();

    await page.keyboard.press('ArrowRight');
    await expect(habitsRadio).toBeChecked();
    await expect(goalsRadio).not.toBeChecked();
    await expect(emptyMessage).toContainText('Habits');

    await page.keyboard.press('ArrowLeft');
    await expect(goalsRadio).toBeChecked();
    await expect(habitsRadio).not.toBeChecked();
    await expect(emptyMessage).toContainText('Goals');
  });

  test('closing via the X control with all fields empty closes the modal immediately with no confirmation prompt', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add item' })).toBeFocused();
  });

  test('closing via the X control with a Title entered shows a confirmation prompt, and "Keep editing" returns to the modal with content intact', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    await page.getByLabel('Title', { exact: true }).fill('Draft aspiration');
    await page.getByRole('button', { name: 'Close' }).click();

    const confirmDialog = page.getByRole('alertdialog', { name: 'Discard aspiration?' });
    await expect(confirmDialog).toBeVisible();

    await page.getByRole('button', { name: 'Keep editing' }).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Draft aspiration');
    await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
  });

  test('closing via the X control with a Title entered shows a confirmation prompt, and "Discard" closes everything without saving', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    await page.getByLabel('Title', { exact: true }).fill('Draft aspiration');
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByRole('alertdialog', { name: 'Discard aspiration?' })).toBeVisible();
    await page.getByRole('button', { name: 'Discard' }).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add item' })).toBeFocused();

    expect(await readStoredAspirations(page)).toHaveLength(0);
  });

  test('pressing Escape with all fields empty closes the modal immediately with no confirmation prompt', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    await page.keyboard.press('Escape');

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add item' })).toBeFocused();
  });

  test('pressing Escape with unsaved content shows the confirmation prompt, and pressing Escape again returns to the modal instead of discarding', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    await page.getByLabel('Title', { exact: true }).fill('Draft aspiration');
    await page.keyboard.press('Escape');

    const confirmDialog = page.getByRole('alertdialog', { name: 'Discard aspiration?' });
    await expect(confirmDialog).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Draft aspiration');
  });

  test('clicking the backdrop with unsaved content shows the confirmation prompt, and Discard closes everything', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    await page.getByLabel('Title', { exact: true }).fill('Draft aspiration');

    // Click well clear of the dialog card itself (which is centered with a
    // max-width), i.e. on the overlay backdrop, not a bubbled click from a
    // descendant of it.
    await page.mouse.click(5, 5);

    const confirmDialog = page.getByRole('alertdialog', { name: 'Discard aspiration?' });
    await expect(confirmDialog).toBeVisible();

    await page.getByRole('button', { name: 'Discard' }).click();

    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeHidden();
    expect(await readStoredAspirations(page)).toHaveLength(0);
  });

  test('saving with a Title persists a new record to localStorage, closes the modal, and returns focus to the add-item button', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    await page.getByLabel('Title', { exact: true }).fill('Live a healthy life');
    await page.getByLabel('Description', { exact: true }).fill('Prioritise sleep, food, movement.');
    await page.getByLabel('Reason', { exact: true }).fill('Feeling good matters to me.');

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add item' })).toBeFocused();

    const records = await readStoredAspirations(page);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      title: 'Live a healthy life',
      description: 'Prioritise sleep, food, movement.',
      reason: 'Feeling good matters to me.',
    });
    expect(typeof records[0]!.id).toBe('string');
  });

  test('saving twice (two separate open/fill/save cycles) creates two independent records, neither overwriting the other', async ({
    page,
  }) => {
    await page.goto('./');

    await openAspirationModal(page);
    await page.getByLabel('Title', { exact: true }).fill('Aspiration one');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeHidden();

    await openAspirationModal(page);
    await page.getByLabel('Title', { exact: true }).fill('Aspiration two');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeHidden();

    const records = await readStoredAspirations(page);
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.title)).toEqual(['Aspiration one', 'Aspiration two']);
    expect(records[0]!.id).not.toBe(records[1]!.id);
  });

  test('a saved aspiration is still present in localStorage after a full page reload (Requirement 25)', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    await page.getByLabel('Title', { exact: true }).fill('Maintain healthy relationships');
    await page.getByLabel('Description', { exact: true }).fill('Stay close to friends and family.');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeHidden();

    const before = await readStoredAspirations(page);
    expect(before).toHaveLength(1);

    // A real browser navigation, not just re-reading localStorage within the
    // same page instance.
    await page.reload();

    const after = await readStoredAspirations(page);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      id: before[0]!.id,
      title: 'Maintain healthy relationships',
      description: 'Stay close to friends and family.',
    });
  });

  test('the open modal (empty state) has no automatically detectable WCAG violations', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('the open modal with the Goals radio selected (empty-state message visible) has no automatically detectable WCAG violations', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    await page.getByRole('radio', { name: 'Goals' }).click();
    await expect(page.locator('.aspiration-modal__links-empty')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('the unsaved-changes confirmation prompt has no automatically detectable WCAG violations', async ({
    page,
  }) => {
    await page.goto('./');
    await openAspirationModal(page);

    await page.getByLabel('Title', { exact: true }).fill('Draft aspiration');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Discard aspiration?' })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
