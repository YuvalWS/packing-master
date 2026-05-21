import { test, expect } from '@playwright/test';

test('empty trips list shows empty state and a FAB linking to /trips/new', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 2 })
  ).toBeVisible();

  const fab = page.getByRole('link', { name: /טיול|create_trip/i }).last();
  await expect(fab).toBeVisible();
  await expect(fab).toHaveAttribute('href', '/trips/new');
});
