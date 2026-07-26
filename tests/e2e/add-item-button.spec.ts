import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './coverage-fixture';

const VIEWPORTS = [
  { width: 375, height: 667 }, // mobile
  { width: 1280, height: 800 }, // desktop
];

// Scope to actual WCAG 2.1 A/AA success criteria, not axe-core's broader
// "best-practice" rule set.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.describe('add item button', () => {
  test('renders as a rounded 44x44 square near the top-right at mobile and desktop widths', async ({
    page,
  }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const button = page.getByRole('button', { name: 'Add item' });
      await expect(button).toBeVisible();

      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.round(box!.width)).toBe(44);
      expect(Math.round(box!.height)).toBe(44);
      expect(box!.x + box!.width).toBeGreaterThan(viewport.width - 100);
      expect(box!.y).toBeLessThan(100);

      const borderRadius = await button.evaluate((el) =>
        parseFloat(getComputedStyle(el).borderRadius),
      );
      expect(borderRadius).toBeGreaterThan(0);
      expect(borderRadius).toBeLessThan(22);
    }
  });

  test('is vertically centered with the wordmark at mobile and desktop widths', async ({
    page,
  }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const button = page.getByRole('button', { name: 'Add item' });
      const heading = page.getByRole('heading', { name: 'throughline' });

      const buttonBox = await button.boundingBox();
      const headingBox = await heading.boundingBox();
      expect(buttonBox).not.toBeNull();
      expect(headingBox).not.toBeNull();

      const buttonCenterY = buttonBox!.y + buttonBox!.height / 2;
      const headingCenterY = headingBox!.y + headingBox!.height / 2;
      expect(Math.abs(buttonCenterY - headingCenterY)).toBeLessThanOrEqual(2);
    }
  });

  test('uses the gold accent background and darkens on hover', async ({ page }) => {
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Add item' });
    await expect(button).toBeVisible();

    const backgroundBefore = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(backgroundBefore).toBe('rgb(138, 109, 59)');

    await button.hover();

    const backgroundAfter = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(backgroundAfter).toBe('rgb(111, 87, 48)');
  });

  test('shows a visible focus ring when reached via keyboard', async ({ page }) => {
    await page.goto('./');

    await page.keyboard.press('Tab');

    const button = page.getByRole('button', { name: 'Add item' });
    await expect(button).toBeFocused();

    const outline = await button.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { outlineStyle: computed.outlineStyle, outlineColor: computed.outlineColor };
    });
    expect(outline.outlineStyle).not.toBe('none');
    expect(outline.outlineColor).toBe('rgb(26, 26, 26)');
  });

  test('clicking opens a dropdown with the four item types in order', async ({ page }) => {
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Add item' });
    await button.click();

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    const items = menu.getByRole('menuitem');
    await expect(items).toHaveCount(4);
    expect(await items.allTextContents()).toEqual(['Aspiration', 'Goal', 'Task', 'Habit']);
  });

  test('clicking again closes the dropdown (toggle)', async ({ page }) => {
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Add item' });
    await button.click();
    await expect(page.getByRole('menu')).toBeVisible();

    await button.click();
    await expect(page.getByRole('menu')).toBeHidden();
  });

  test('clicking outside the dropdown closes it', async ({ page }) => {
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Add item' });
    await button.click();
    await expect(page.getByRole('menu')).toBeVisible();

    await page.getByRole('heading', { name: 'throughline' }).click();

    await expect(page.getByRole('menu')).toBeHidden();
  });

  test('pressing Escape closes the dropdown and returns focus to the button', async ({ page }) => {
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Add item' });
    await button.click();
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('menu')).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('the open dropdown is anchored below the button and clear of the wordmark at mobile and desktop widths', async ({
    page,
  }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const button = page.getByRole('button', { name: 'Add item' });
      await button.click();

      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible();

      const buttonBox = await button.boundingBox();
      const menuBox = await menu.boundingBox();
      const headingBox = await page.getByRole('heading', { name: 'throughline' }).boundingBox();
      expect(buttonBox).not.toBeNull();
      expect(menuBox).not.toBeNull();
      expect(headingBox).not.toBeNull();

      expect(menuBox!.y).toBeGreaterThanOrEqual(buttonBox!.y + buttonBox!.height);

      const intersectsWordmark =
        menuBox!.x < headingBox!.x + headingBox!.width &&
        menuBox!.x + menuBox!.width > headingBox!.x &&
        menuBox!.y < headingBox!.y + headingBox!.height &&
        menuBox!.y + menuBox!.height > headingBox!.y;
      expect(intersectsWordmark).toBe(false);
    }
  });

  test('keyboard-only flow: Enter opens the dropdown and focus can reach the first item', async ({
    page,
  }) => {
    await page.goto('./');

    await page.keyboard.press('Tab');
    const button = page.getByRole('button', { name: 'Add item' });
    await expect(button).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();

    const focusedName = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedName).toBe('Aspiration');
  });

  test('keyboard-only flow: Space opens the dropdown', async ({ page }) => {
    await page.goto('./');

    await page.keyboard.press('Tab');
    const button = page.getByRole('button', { name: 'Add item' });
    await expect(button).toBeFocused();

    await page.keyboard.press('Space');

    await expect(page.getByRole('menu')).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    const focusedName = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedName).toBe('Aspiration');
  });

  test('keyboard-only flow: ArrowDown from the trigger opens the dropdown and focuses the first item', async ({
    page,
  }) => {
    await page.goto('./');

    await page.keyboard.press('Tab');
    const button = page.getByRole('button', { name: 'Add item' });
    await expect(button).toBeFocused();

    await page.keyboard.press('ArrowDown');

    await expect(page.getByRole('menu')).toBeVisible();
    const focusedName = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedName).toBe('Aspiration');
  });

  test('keyboard-only flow: ArrowUp from the trigger opens the dropdown and focuses the last item (regression)', async ({
    page,
  }) => {
    await page.goto('./');

    await page.keyboard.press('Tab');
    const button = page.getByRole('button', { name: 'Add item' });
    await expect(button).toBeFocused();

    await page.keyboard.press('ArrowUp');

    await expect(page.getByRole('menu')).toBeVisible();
    const focusedName = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedName).toBe('Habit');
    expect(focusedName).not.toBe('Task');
  });

  test('keyboard-only flow: arrow-key navigation moves through middle items', async ({ page }) => {
    await page.goto('./');

    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    let focusedName = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedName).toBe('Task');

    await page.keyboard.press('ArrowUp');
    focusedName = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedName).toBe('Goal');
  });

  test('keyboard-only flow: Home and End jump to the first and last item', async ({ page }) => {
    await page.goto('./');

    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    let focusedName = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedName).toBe('Task');

    await page.keyboard.press('End');
    focusedName = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedName).toBe('Habit');

    await page.keyboard.press('Home');
    focusedName = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedName).toBe('Aspiration');
  });

  test('keyboard-only flow: Tab from the last-roving-focused item closes the dropdown and leaves the widget', async ({
    page,
  }) => {
    await page.goto('./');

    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    const focusedName = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedName).toBe('Aspiration');

    await page.keyboard.press('Tab');

    await expect(page.getByRole('menu')).toBeHidden();

    const activeElementInfo = await page.evaluate(() => ({
      isBody: document.activeElement === document.body,
      id: (document.activeElement as HTMLElement | null)?.id ?? null,
    }));
    expect(activeElementInfo.isBody).toBe(true);
    expect(activeElementInfo.id).not.toBe('add-item-button');
  });

  test('open dropdown has no automatically detectable WCAG violations', async ({ page }) => {
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Add item' });
    await button.click();
    await expect(page.getByRole('menu')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    expect(results.violations).toEqual([]);
  });

  test('dropdown after roving-tabindex arrow navigation has no automatically detectable WCAG violations', async ({
    page,
  }) => {
    await page.goto('./');

    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('ArrowDown');
    const focusedName = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedName).toBe('Goal');

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    expect(results.violations).toEqual([]);
  });
});
