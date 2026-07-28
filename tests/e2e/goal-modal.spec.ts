import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './coverage-fixture';

// Scope to actual WCAG 2.1 A/AA success criteria, not axe-core's broader
// "best-practice" rule set. Matches home.spec.ts / add-item-button.spec.ts /
// aspiration-modal.spec.ts.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const GOALS_STORAGE_KEY = 'throughline:goals';

async function readStoredGoals(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }, GOALS_STORAGE_KEY);
}

// Opens the modal exactly the way a real user would: click the add-item
// button, then click the "Goal" menu item.
async function openGoalModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByRole('menuitem', { name: 'Goal' }).click();
  await expect(page.getByRole('dialog', { name: 'Create Goal' })).toBeVisible();
}

test.describe('create goal modal', () => {
  test('opens from the add-item menu with the header, blurb, fields, Milestones section, and Save in the correct order', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    const dialog = page.getByRole('dialog', { name: 'Create Goal' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Create Goal' })).toBeVisible();
    await expect(
      dialog.getByText(/A goal is a specific, measurable, significant achievement/),
    ).toBeVisible();
    await expect(dialog.getByLabel('Title', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Description', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Reason', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Milestones' })).toBeVisible();
    await expect(
      dialog.getByText(/A milestone is a step on the way to this goal/),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Add milestone' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeVisible();

    const order = await dialog.evaluate((el) => {
      const text = el.textContent ?? '';
      return {
        blurbBeforeTitle: text.indexOf('A goal is') < text.indexOf('Title'),
        titleBeforeDescription: text.indexOf('Title') < text.indexOf('Description'),
        descriptionBeforeReason: text.indexOf('Description') < text.indexOf('Reason'),
        reasonBeforeMilestones: text.indexOf('Reason') < text.indexOf('Milestones'),
        milestonesBeforeSave: text.indexOf('Milestones') < text.indexOf('Save'),
      };
    });
    expect(order).toEqual({
      blurbBeforeTitle: true,
      titleBeforeDescription: true,
      descriptionBeforeReason: true,
      reasonBeforeMilestones: true,
      milestonesBeforeSave: true,
    });
  });

  test('the modal has correct dialog semantics: role="dialog", aria-modal="true", accessible name "Create Goal"', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    const dialog = page.getByRole('dialog', { name: 'Create Goal' });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByRole('heading', { name: 'Create Goal' })).toBeVisible();
  });

  test('selecting "Goal" again while the modal is already open does not open a duplicate', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);
    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toHaveCount(1);

    // The add-item button is inert while the modal is open (see the mutual-exclusion and
    // background-exclusion tests below), so a real pointer click can't reach it or the menu
    // item behind it. Invoke the click handling directly to simulate re-selecting "Goal" a
    // second time — mirrors aspiration-modal.spec.ts's own equivalent self-exclusion test.
    await page.evaluate(() => {
      document.getElementById('add-item-button')?.click();
    });
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      items.find((el) => el.textContent === 'Goal')?.click();
    });

    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toHaveCount(1);
  });

  test('Save is disabled while Title is empty or whitespace-only, and enables once Title has non-whitespace content', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeDisabled();

    await page.getByLabel('Title', { exact: true }).fill('   ');
    await expect(saveButton).toBeDisabled();

    await page.getByLabel('Title', { exact: true }).fill('Get promoted to manager');
    await expect(saveButton).toBeEnabled();
  });

  test('keyboard focus moves to the Title field as soon as the modal opens', async ({ page }) => {
    await page.goto('./');
    await openGoalModal(page);

    await expect(page.getByLabel('Title', { exact: true })).toBeFocused();
  });

  test('Tab cycles through the modal’s own controls — including dynamically added milestone rows — and wraps from Save back to Close; Shift+Tab wraps the other way', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    // Save is natively `disabled` until Title has content, and a disabled button is never a
    // Tab stop in any browser — so it must be enabled here for this test to be able to reach
    // it via the keyboard at all.
    await page.getByLabel('Title', { exact: true }).fill('Get promoted to manager');

    const addButton = page.getByRole('button', { name: 'Add milestone' });
    await addButton.click();
    await addButton.click();
    // Adding rows moves focus into them; return focus to Title to start the tab-order
    // assertion from a known point.
    await page.getByLabel('Title', { exact: true }).focus();

    await page.keyboard.press('Tab'); // Description info icon
    await page.keyboard.press('Tab'); // Description
    await page.keyboard.press('Tab'); // Reason info icon
    await page.keyboard.press('Tab'); // Reason
    await page.keyboard.press('Tab'); // Milestone 1 input
    await expect(page.getByLabel('Milestone 1', { exact: true })).toBeFocused();
    await page.keyboard.press('Tab'); // Remove milestone 1
    await expect(page.getByRole('button', { name: 'Remove milestone 1' })).toBeFocused();
    await page.keyboard.press('Tab'); // Milestone 2 input
    await expect(page.getByLabel('Milestone 2', { exact: true })).toBeFocused();
    await page.keyboard.press('Tab'); // Remove milestone 2
    await expect(page.getByRole('button', { name: 'Remove milestone 2' })).toBeFocused();
    await page.keyboard.press('Tab'); // Add milestone
    await expect(addButton).toBeFocused();
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
    await openGoalModal(page);

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

    // A real browser also excludes an `inert` element from *programmatic* focus, not just the
    // tab order — jsdom doesn't implement `inert` at all, so this half of Requirement 36 can
    // only be proven here.
    await page.evaluate(() => {
      (document.getElementById('add-item-button') as HTMLElement | null)?.focus();
    });
    const activeIdAfterProgrammaticFocus = await page.evaluate(
      () => document.activeElement?.id ?? null,
    );
    expect(activeIdAfterProgrammaticFocus).not.toBe('add-item-button');
  });

  test('shows a visible focus ring on the Title field, and on a milestone row’s remove control, when reached via keyboard', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    await page.keyboard.press('Tab'); // move to Description
    await page.keyboard.press('Shift+Tab'); // back to Title, via keyboard

    const titleInput = page.getByLabel('Title', { exact: true });
    await expect(titleInput).toBeFocused();
    const titleOutline = await titleInput.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { outlineStyle: computed.outlineStyle, outlineColor: computed.outlineColor };
    });
    expect(titleOutline.outlineStyle).not.toBe('none');
    expect(titleOutline.outlineColor).toBe('rgb(26, 26, 26)');

    await page.getByRole('button', { name: 'Add milestone' }).click();
    await page.keyboard.press('Tab'); // from the new row's (focused) input to its remove control

    const removeButton = page.getByRole('button', { name: 'Remove milestone 1' });
    await expect(removeButton).toBeFocused();
    const removeOutline = await removeButton.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { outlineStyle: computed.outlineStyle, outlineColor: computed.outlineColor };
    });
    expect(removeOutline.outlineStyle).not.toBe('none');
  });

  test('the Title tooltip is revealed only via its info icon, uses goal-specific copy, and a first Escape closes only the tooltip (not the modal)', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    // See aspiration-modal.spec.ts's equivalent test for why the `--visible` class is
    // asserted directly rather than via toBeVisible/toBeHidden.
    const titleTooltipText = page.locator('#goal-field-title-tooltip');
    const titleIcon = page.getByRole('button', { name: 'More information about Title' });

    await page.getByLabel('Title', { exact: true }).hover();
    await page.getByLabel('Title', { exact: true }).focus();
    await expect(titleTooltipText).not.toHaveClass(/modal__tooltip-text--visible/);

    await titleIcon.click();
    await expect(titleTooltipText).toHaveClass(/modal__tooltip-text--visible/);
    // Goal-specific copy, not the aspiration modal's tooltip text verbatim.
    await expect(titleTooltipText).toHaveText(/A short, memorable name for this goal/);

    await page.keyboard.press('Escape');
    await expect(titleTooltipText).not.toHaveClass(/modal__tooltip-text--visible/);
    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toBeVisible();
  });

  test('activating "Add milestone" adds rows and focuses each new row’s input; removing a middle row focuses the row that takes its place and leaves the other rows/values intact', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    const addButton = page.getByRole('button', { name: 'Add milestone' });

    await addButton.focus();
    await page.keyboard.press('Enter'); // keyboard activation, not a click
    await expect(page.getByLabel('Milestone 1', { exact: true })).toBeFocused();
    await page.getByLabel('Milestone 1', { exact: true }).fill('Get promoted to supervisor');

    await addButton.click();
    await expect(page.getByLabel('Milestone 2', { exact: true })).toBeFocused();
    await page.getByLabel('Milestone 2', { exact: true }).fill('Run a half-marathon');

    await addButton.click();
    await expect(page.getByLabel('Milestone 3', { exact: true })).toBeFocused();
    await page.getByLabel('Milestone 3', { exact: true }).fill('Pass my first year of university');

    // Each remove control has its own unique accessible name.
    await expect(page.getByRole('button', { name: 'Remove milestone 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove milestone 2' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove milestone 3' })).toBeVisible();

    await page.getByRole('button', { name: 'Remove milestone 2' }).click();

    await expect(page.getByRole('button', { name: 'Remove milestone 2' })).toHaveCount(0);
    await expect(page.getByLabel('Milestone 1', { exact: true })).toHaveValue(
      'Get promoted to supervisor',
    );
    await expect(page.getByLabel('Milestone 3', { exact: true })).toHaveValue(
      'Pass my first year of university',
    );
    // Focus lands on the row that now visually takes the removed row's place.
    await expect(page.getByLabel('Milestone 3', { exact: true })).toBeFocused();
  });

  test('removing the only milestone row moves focus to "Add milestone"', async ({ page }) => {
    await page.goto('./');
    await openGoalModal(page);

    const addButton = page.getByRole('button', { name: 'Add milestone' });
    await addButton.click();
    await expect(page.getByLabel('Milestone 1', { exact: true })).toBeFocused();

    await page.getByRole('button', { name: 'Remove milestone 1' }).click();

    await expect(addButton).toBeFocused();
    await expect(page.getByLabel('Milestone 1', { exact: true })).toHaveCount(0);
  });

  test('closing via the X control with everything empty closes the modal immediately with no confirmation prompt', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add item' })).toBeFocused();
  });

  test('closing via the X control with only a blank milestone row present (all text fields empty) shows the Goal-specific confirmation prompt (Requirement 20)', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    await page.getByRole('button', { name: 'Add milestone' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByRole('alertdialog', { name: 'Discard goal?' })).toBeVisible();
  });

  test('closing via the X control with content shows a confirmation prompt, and "Keep editing" returns to the modal with Title/Description/Reason and milestone rows (with values) intact', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    await page.getByLabel('Title', { exact: true }).fill('Get promoted to manager');
    await page.getByLabel('Description', { exact: true }).fill('Move from IC to manager role');
    await page.getByLabel('Reason', { exact: true }).fill('Growth and greater impact');

    const addButton = page.getByRole('button', { name: 'Add milestone' });
    await addButton.click();
    await page.getByLabel('Milestone 1', { exact: true }).fill('Get promoted to supervisor');
    await addButton.click(); // Milestone 2 left blank

    await page.getByRole('button', { name: 'Close' }).click();

    const confirmDialog = page.getByRole('alertdialog', { name: 'Discard goal?' });
    await expect(confirmDialog).toBeVisible();

    await page.getByRole('button', { name: 'Keep editing' }).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      'Get promoted to manager',
    );
    await expect(page.getByLabel('Description', { exact: true })).toHaveValue(
      'Move from IC to manager role',
    );
    await expect(page.getByLabel('Reason', { exact: true })).toHaveValue(
      'Growth and greater impact',
    );
    await expect(page.getByLabel('Milestone 1', { exact: true })).toHaveValue(
      'Get promoted to supervisor',
    );
    await expect(page.getByLabel('Milestone 2', { exact: true })).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
  });

  test('closing via the X control with content shows a confirmation prompt, and "Discard" closes everything without saving', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    await page.getByLabel('Title', { exact: true }).fill('Draft goal');
    await page.getByRole('button', { name: 'Add milestone' }).click();
    await page.getByLabel('Milestone 1', { exact: true }).fill('Draft milestone');

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Discard goal?' })).toBeVisible();
    await page.getByRole('button', { name: 'Discard' }).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add item' })).toBeFocused();

    expect(await readStoredGoals(page)).toHaveLength(0);
  });

  test('pressing Escape with everything empty closes the modal immediately with no confirmation prompt', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    await page.keyboard.press('Escape');

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add item' })).toBeFocused();
  });

  test('pressing Escape with a milestone row present (Goal-specific dirty check) shows the confirmation prompt, and Escape again returns to the modal instead of discarding', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    // All three text fields stay empty — only a (blank) milestone row exists.
    await page.getByRole('button', { name: 'Add milestone' }).click();
    await page.keyboard.press('Escape');

    const confirmDialog = page.getByRole('alertdialog', { name: 'Discard goal?' });
    await expect(confirmDialog).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toBeVisible();
    await expect(page.getByLabel('Milestone 1', { exact: true })).toBeVisible();
  });

  test('clicking the backdrop with a milestone row present shows the confirmation prompt, and Discard closes everything, nothing saved', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    await page.getByRole('button', { name: 'Add milestone' }).click();

    // Click well clear of the dialog card itself (which is centered with a max-width), i.e.
    // on the overlay backdrop, not a bubbled click from a descendant of it.
    await page.mouse.click(5, 5);

    const confirmDialog = page.getByRole('alertdialog', { name: 'Discard goal?' });
    await expect(confirmDialog).toBeVisible();

    await page.getByRole('button', { name: 'Discard' }).click();

    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toBeHidden();
    expect(await readStoredGoals(page)).toHaveLength(0);
  });

  test('saving persists trimmed Title/Description/Reason plus only the non-blank milestones to localStorage, closes the modal, returns focus to the add-item button, and survives a full page reload', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    await page.getByLabel('Title', { exact: true }).fill('  Get promoted to manager  ');
    await page.getByLabel('Description', { exact: true }).fill('Move from IC to manager role');
    await page.getByLabel('Reason', { exact: true }).fill('Growth and greater impact');

    const addButton = page.getByRole('button', { name: 'Add milestone' });
    await addButton.click();
    await page.getByLabel('Milestone 1', { exact: true }).fill('Get promoted to supervisor');
    await addButton.click();
    await page.getByLabel('Milestone 2', { exact: true }).fill('   '); // whitespace-only — excluded
    await addButton.click();
    await page.getByLabel('Milestone 3', { exact: true }).fill('Lead a cross-team project');

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add item' })).toBeFocused();

    const records = await readStoredGoals(page);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      title: 'Get promoted to manager',
      description: 'Move from IC to manager role',
      reason: 'Growth and greater impact',
    });
    expect(typeof records[0]!.id).toBe('string');
    const milestones = records[0]!.milestones as Array<{ id: string; title: string }>;
    expect(milestones.map((m) => m.title)).toEqual([
      'Get promoted to supervisor',
      'Lead a cross-team project',
    ]);
    expect(milestones.every((m) => typeof m.id === 'string' && m.id.length > 0)).toBe(true);

    // A real browser navigation, not just re-reading localStorage within the same page
    // instance.
    await page.reload();

    const after = await readStoredGoals(page);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: records[0]!.id, title: 'Get promoted to manager' });
    expect((after[0]!.milestones as Array<{ title: string }>).map((m) => m.title)).toEqual([
      'Get promoted to supervisor',
      'Lead a cross-team project',
    ]);
  });

  test('saving twice (two separate open/fill/save cycles) creates two independent records, neither overwriting the other', async ({
    page,
  }) => {
    await page.goto('./');

    await openGoalModal(page);
    await page.getByLabel('Title', { exact: true }).fill('Goal one');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toBeHidden();

    await openGoalModal(page);
    await page.getByLabel('Title', { exact: true }).fill('Goal two');
    await page.getByRole('button', { name: 'Add milestone' }).click();
    await page.getByLabel('Milestone 1', { exact: true }).fill('Milestone for goal two');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toBeHidden();

    const records = await readStoredGoals(page);
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.title)).toEqual(['Goal one', 'Goal two']);
    expect(records[0]!.id).not.toBe(records[1]!.id);
    expect(records[0]!.milestones).toEqual([]);
    expect((records[1]!.milestones as Array<{ title: string }>).map((m) => m.title)).toEqual([
      'Milestone for goal two',
    ]);
  });

  test('the modal uses the green color scheme: computed background-color of the modal and the Save button match the design’s chosen hex values (Requirements 31-32)', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    const dialog = page.getByRole('dialog', { name: 'Create Goal' });
    const dialogBackground = await dialog.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(dialogBackground).toBe('rgb(224, 242, 228)'); // #e0f2e4

    await page.getByLabel('Title', { exact: true }).fill('Get promoted to manager');
    const saveButton = page.getByRole('button', { name: 'Save' });
    const saveBackground = await saveButton.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(saveBackground).toBe('rgb(30, 122, 66)'); // #1e7a42
  });

  test('the freshly opened, empty Create Goal modal has no automatically detectable WCAG violations', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('the Create Goal modal with two milestone rows added and a tooltip toggled open simultaneously has no automatically detectable WCAG violations', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    const addButton = page.getByRole('button', { name: 'Add milestone' });
    await addButton.click();
    await addButton.click();

    await page.getByRole('button', { name: 'More information about Title' }).click();
    await expect(page.locator('#goal-field-title-tooltip')).toHaveClass(
      /modal__tooltip-text--visible/,
    );

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('the discard-confirmation prompt (green scheme) has no automatically detectable WCAG violations', async ({
    page,
  }) => {
    await page.goto('./');
    await openGoalModal(page);

    await page.getByLabel('Title', { exact: true }).fill('Draft goal');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Discard goal?' })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('opening the Aspiration modal prevents reaching the add-item button (and therefore the Goal menu item) via real interaction, and vice versa (Requirement 5)', async ({
    page,
  }) => {
    await page.goto('./');

    await page.getByRole('button', { name: 'Add item' }).click();
    await page.getByRole('menuitem', { name: 'Aspiration' }).click();
    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeVisible();

    const addItemButton = page.getByRole('button', { name: 'Add item' });
    // A real user cannot reach the add-item button while the Aspiration modal is open —
    // root.inert = true makes it non-actionable (not merely obscured), so a Playwright
    // "trial" click — which runs only the actionability checks a real click would need to
    // pass, without performing it — times out rather than succeeding.
    await expect(addItemButton.click({ trial: true, timeout: 2000 })).rejects.toThrow();

    // ...and so there is no way to reach the (hidden) "Goal" menu item without first closing
    // the open Aspiration modal.
    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click(); // empty — closes immediately
    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toBeHidden();

    // Now the Goal modal can be reached.
    await openGoalModal(page);
    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toBeVisible();

    // Symmetrically, the Aspiration modal is equally unreachable while the Goal modal is open.
    await expect(addItemButton.click({ trial: true, timeout: 2000 })).rejects.toThrow();
    await expect(page.getByRole('dialog', { name: 'Create Aspiration' })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Create Goal' })).toBeVisible();
  });
});
