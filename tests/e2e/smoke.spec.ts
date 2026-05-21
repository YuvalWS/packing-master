import { test, expect } from '@playwright/test';

test('home page loads with RTL Hebrew layout', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(html).toHaveAttribute('lang', 'he');
});

test('top bar renders a title and the menu opens the drawer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const drawer = page.getByRole('complementary');
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');

  await page.getByRole('button', { name: /תפריט|menu/i }).first().click();
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
});
