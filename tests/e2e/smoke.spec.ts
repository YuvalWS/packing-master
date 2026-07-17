import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { resetTrips, goto } from './_helpers.js';

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(resetTrips);

test('home page loads with RTL Hebrew layout', async ({ page }) => {
  await goto(page, '/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(html).toHaveAttribute('lang', 'he');
});

test('top bar renders a title and the menu opens the drawer', async ({ page }) => {
  await goto(page, '/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const drawer = page.getByRole('complementary', { includeHidden: true });
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');

  await page.getByRole('button', { name: strings.a11y.open_menu }).click();
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
});

test('overlay drawer traps focus and restores it to the hamburger on Escape', async ({ page }) => {
  await goto(page, '/');
  const hamburger = page.getByRole('button', { name: strings.a11y.open_menu });
  await hamburger.click();

  const drawer = page.getByRole('complementary', { includeHidden: true });
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');

  // Focus lands inside the drawer and Tab stays within it.
  const focusInDrawer = () =>
    drawer.evaluate((el) => el.contains(document.activeElement));
  expect(await focusInDrawer()).toBe(true);
  await page.keyboard.press('Tab');
  expect(await focusInDrawer()).toBe(true);
  await page.keyboard.press('Tab');
  expect(await focusInDrawer()).toBe(true);

  await page.keyboard.press('Escape');
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  await expect(hamburger).toBeFocused();
});
