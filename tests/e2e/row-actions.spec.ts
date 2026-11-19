import { test, expect, type APIRequestContext } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { resetTrips, goto } from './_helpers.js';

test.beforeEach(resetTrips);

async function createTrip(request: APIRequestContext) {
  const params = await request.get('/api/parameters');
  const paramsBody = (await params.json()) as { parameters: { id: string; category: string }[] };
  const accommodation = paramsBody.parameters.find((p) => p.category === 'accommodation');
  expect(accommodation).toBeDefined();

  const created = await request.post('/api/trips', {
    data: {
      start_date: '2030-08-01',
      end_date: '2030-08-05',
      parameters: [accommodation!.id]
    }
  });
  expect(created.ok()).toBeTruthy();
  return (await created.json()) as { trip: { id: number } };
}

test('manual item can be deleted from the row menu', async ({ page, request }) => {
  const { trip } = await createTrip(request);
  const added = await request.post(`/api/trips/${trip.id}/items`, {
    data: { display_name: 'Disposable Item' }
  });
  expect(added.ok()).toBeTruthy();

  await goto(page, `/trips/${trip.id}`);
  const row = page.locator('.row', { hasText: 'Disposable Item' });
  await row.getByRole('button', { name: strings.a11y_row.row_menu }).click();

  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: strings.row_menu.delete, exact: true }).click();

  await expect(page.getByRole('button', { name: strings.row_menu.undo })).toBeVisible();
  await expect(page.getByText('Disposable Item', { exact: true })).toHaveCount(0);
  // After the undo window the delete reaches the server.
  await expect
    .poll(async () => {
      const body = (await (await request.get(`/api/trips/${trip.id}`)).json()) as {
        items: { display_name: string }[];
      };
      return body.items.some((i) => i.display_name === 'Disposable Item');
    }, { timeout: 10_000 })
    .toBe(false);
});

test('minus at count 1 deletes a generated row, and Undo brings it back', async ({ page, request }) => {
  const { trip } = await createTrip(request);
  await goto(page, `/trips/${trip.id}`);

  const row = page.locator('.row', { hasText: 'Always' });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: strings.a11y_row.decrement }).click();
  await expect(page.locator('.row', { hasText: 'Always' })).toHaveCount(0);

  await page.getByRole('button', { name: strings.row_menu.undo }).click();
  await expect(page.locator('.row', { hasText: 'Always' })).toHaveCount(1);
  await page.waitForTimeout(5500);
  const body = (await (await request.get(`/api/trips/${trip.id}`)).json()) as {
    items: { item_id: string | null }[];
  };
  expect(body.items.some((i) => i.item_id === 'item_always')).toBe(true);
});

test('a note saved from the row menu shows an indicator and persists', async ({
  page,
  request
}) => {
  const { trip } = await createTrip(request);
  await goto(page, `/trips/${trip.id}`);

  const row = page.locator('.row', { hasText: 'Always' });
  await row.getByRole('button', { name: strings.a11y_row.row_menu }).click();

  const sheet = page.getByRole('dialog');
  await sheet.getByText(strings.row_menu.note, { exact: true }).click();
  await sheet.getByRole('textbox', { name: strings.row_menu.note }).fill('bring the blue one');
  await sheet.getByRole('button', { name: strings.common.save }).click();

  await expect(page.getByText(strings.row_menu.saved_toast)).toBeVisible();
  await expect(row.getByLabel(strings.a11y_row.has_note)).toBeVisible();

  const after = await request.get(`/api/trips/${trip.id}`);
  const afterBody = (await after.json()) as { items: { item_id: string | null; notes: string | null }[] };
  const always = afterBody.items.find((i) => i.item_id === 'item_always');
  expect(always?.notes).toBe('bring the blue one');
});

test('splitting an item across bags shows it in both by-bag groups', async ({ page, request }) => {
  const { trip } = await createTrip(request);
  await goto(page, `/trips/${trip.id}`);

  // Per-day over 5 days → count 5; split it 3/2 between the two bags.
  const row = page.locator('.row', { hasText: 'Per-day' });
  await row.getByRole('button', { name: strings.a11y_row.row_menu }).click();

  const sheet = page.getByRole('dialog');
  await sheet.getByText(strings.row_menu.split_bags).click();

  const mainBagRow = sheet.locator('.bag-row', { hasText: strings.view.bags.main_bag });
  const smallBagRow = sheet.locator('.bag-row', { hasText: strings.view.bags.small_bag });
  // Draft starts with the full count (5) on the default bag (small_bag).
  await smallBagRow.getByRole('button', { name: strings.a11y_row.decrement }).click();
  await smallBagRow.getByRole('button', { name: strings.a11y_row.decrement }).click();
  await smallBagRow.getByRole('button', { name: strings.a11y_row.decrement }).click();
  await mainBagRow.getByRole('button', { name: strings.a11y_row.increment }).click();
  await mainBagRow.getByRole('button', { name: strings.a11y_row.increment }).click();
  await mainBagRow.getByRole('button', { name: strings.a11y_row.increment }).click();
  await sheet.getByRole('button', { name: strings.common.save }).click();
  await expect(page.getByText(strings.row_menu.saved_toast)).toBeVisible();

  await page.getByRole('tab', { name: strings.view.by_bag }).click();

  const mainGroup = page.locator('section.group', {
    has: page.getByRole('heading', { name: strings.view.bags.main_bag })
  });
  const smallGroup = page.locator('section.group', {
    has: page.getByRole('heading', { name: strings.view.bags.small_bag })
  });
  await expect(mainGroup.locator('.row', { hasText: 'Per-day' })).toBeVisible();
  await expect(smallGroup.locator('.row', { hasText: 'Per-day' })).toBeVisible();
  await expect(mainGroup.locator('.row', { hasText: 'Per-day' }).getByText('3')).toBeVisible();
  await expect(smallGroup.locator('.row', { hasText: 'Per-day' }).getByText('2')).toBeVisible();
});
