import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { goto } from './_helpers.js';

test('catalog list → item detail → back to list', async ({ page, request }) => {
  const res = await request.get('/api/items');
  const { items } = (await res.json()) as { items: { id: string; display_name: string }[] };
  expect(items.length).toBeGreaterThan(0);

  await goto(page, '/items');
  await expect(page.getByPlaceholder(strings.items_catalog.search_placeholder)).toBeVisible();

  const firstLink = page.getByRole('link', { name: items[0]!.display_name }).first();
  await firstLink.click();
  await expect(page).toHaveURL(`/items/${items[0]!.id}`);
  await expect(page.getByRole('heading', { name: items[0]!.display_name })).toBeVisible();

  await page.getByRole('link', { name: strings.items_catalog.back_to_list }).click();
  await expect(page).toHaveURL('/items');
});

test('catalog shows a count, filters, and per-row rule summaries', async ({ page, request }) => {
  const res = await request.get('/api/items');
  const { items } = (await res.json()) as {
    items: { id: string; display_name: string; category?: string }[];
  };

  await goto(page, '/items');

  // In-page count reflects the full catalog before filtering.
  await expect(page.getByText(`(${items.length})`)).toBeVisible();

  // Rows carry the Hebrew quantity summary; 'Always' is a fixed-1 item.
  const alwaysRow = page.getByRole('link', { name: 'Always' });
  await expect(alwaysRow.getByText(strings.quantity.fixed.replace('{n}', '1'))).toBeVisible();
  await expect(alwaysRow.getByText(strings.condition.always)).toBeVisible();

  // Category filter narrows to that category only.
  await page
    .getByLabel(strings.items_catalog.filter_category)
    .selectOption({ label: 'clothing' });
  await expect(page.getByRole('link', { name: 'Per-day' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Always' })).toHaveCount(0);
  await page
    .getByLabel(strings.items_catalog.filter_category)
    .selectOption({ label: strings.items_catalog.filter_all });

  // Parameter filter keeps only items whose condition references env_a.
  const paramsRes = await request.get('/api/parameters');
  const { parameters } = (await paramsRes.json()) as {
    parameters: { id: string; display_name: string }[];
  };
  const envA = parameters.find((p) => p.id === 'env_a');
  expect(envA).toBeDefined();
  await page
    .getByLabel(strings.items_catalog.filter_parameter)
    .selectOption({ label: envA!.display_name });
  await expect(page.getByRole('link', { name: 'When env_a OR env_b' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Always' })).toHaveCount(0);
});

test('item detail shows the seed source footer', async ({ page, request }) => {
  const res = await request.get('/api/items');
  const { items } = (await res.json()) as { items: { id: string }[] };
  await goto(page, `/items/${items[0]!.id}`);
  await expect(page.getByText(strings.items_catalog.source_note)).toBeVisible();
});
