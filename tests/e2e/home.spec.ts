import { test, expect } from './coverage-fixture';

test.describe('home page', () => {
  test('has the title "throughline"', async ({ page }) => {
    await page.goto('./');

    await expect(page).toHaveTitle('throughline');
  });

  test('has a solid white background', async ({ page }) => {
    await page.goto('./');

    const backgroundColor = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor
    );

    expect(backgroundColor).toBe('rgb(255, 255, 255)');
  });

  test('renders the "throughline" wordmark near the top-left at mobile and desktop widths', async ({
    page,
  }) => {
    const viewports = [
      { width: 375, height: 667 }, // mobile
      { width: 1280, height: 800 }, // desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const heading = page.getByRole('heading', { name: 'throughline' });
      await expect(heading).toBeVisible();

      const box = await heading.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeLessThan(100);
      expect(box!.y).toBeLessThan(100);
    }
  });

  test('renders the wordmark with the deliberate serif/weight/letter-spacing/color treatment', async ({
    page,
  }) => {
    await page.goto('./');

    const heading = page.getByRole('heading', { name: 'throughline' });
    const styles = await heading.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        fontFamily: computed.fontFamily,
        fontWeight: computed.fontWeight,
        letterSpacing: computed.letterSpacing,
        color: computed.color,
      };
    });

    expect(styles.fontFamily).toContain('Playfair Display');
    expect(styles.fontWeight).toBe('700');
    expect(styles.letterSpacing).not.toBe('normal');
    expect(styles.color).toBe('rgb(26, 26, 26)');
  });

  test('strikes through the wordmark with a coloured line on hover', async ({ page }) => {
    await page.goto('./');

    const heading = page.getByRole('heading', { name: 'throughline' });

    const before = await heading.evaluate((el) => getComputedStyle(el).textDecorationLine);
    expect(before).toBe('none');

    await heading.hover();

    const styles = await heading.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        textDecorationLine: computed.textDecorationLine,
        textDecorationColor: computed.textDecorationColor,
      };
    });

    expect(styles.textDecorationLine).toContain('line-through');
    expect(styles.textDecorationColor).not.toBe('rgb(26, 26, 26)');
  });

  test('serves the PWA manifest and service worker at the expected paths', async ({ request }) => {
    const manifestResponse = await request.get('./manifest.webmanifest');
    expect(manifestResponse.status()).toBe(200);

    const swResponse = await request.get('./sw.js');
    expect(swResponse.status()).toBe(200);
  });

  test('serves a favicon/PWA icon derived from the wordmark, matching the manifest icon entry', async ({
    request,
  }) => {
    const iconResponse = await request.get('./icon.svg');
    expect(iconResponse.status()).toBe(200);
    expect(iconResponse.headers()['content-type']).toContain('image/svg+xml');

    const manifestResponse = await request.get('./manifest.webmanifest');
    const manifest = await manifestResponse.json();

    expect(manifest.icons[0].src).toContain('icon.svg');
    expect(manifest.icons[0].type).toBe('image/svg+xml');
  });

  test('loads with no console errors and no failed network requests', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('requestfailed', (req) => {
      failedRequests.push(req.url());
    });

    await page.goto('./');

    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});
