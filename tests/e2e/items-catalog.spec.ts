import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };

test('catalog list → item detail → back to list', async ({ page, request }) => {
  const res = await request.get('/api/items');
  const { items } = (await res.json()) as { items: { id: string; display_name: string }[] };
  expect(items.length).toBeGreaterThan(0);

  await page.goto('/items');
  await expect(page.getByPlaceholder(strings.items_catalog.search_placeholder)).toBeVisible();

  const firstLink = page.getByRole('link', { name: items[0]!.display_name }).first();
  await firstLink.click();
  await expect(page).toHaveURL(`/items/${items[0]!.id}`);
  await expect(page.getByRole('heading', { name: items[0]!.display_name })).toBeVisible();

  await page.getByRole('link', { name: strings.items_catalog.back_to_list }).click();
  await expect(page).toHaveURL('/items');
});
