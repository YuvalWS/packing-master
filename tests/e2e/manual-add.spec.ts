import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };

test('free-text manual add inserts a row visible in the list', async ({ page, request }) => {
  const params = await request.get('/api/parameters');
  const paramsBody = (await params.json()) as { parameters: { id: string; category: string }[] };
  const accommodation = paramsBody.parameters.find((p) => p.category === 'accommodation');
  expect(accommodation).toBeDefined();

  const created = await request.post('/api/trips', {
    data: {
      start_date: '2030-07-01',
      end_date: '2030-07-05',
      parameters: [accommodation!.id]
    }
  });
  const { trip } = (await created.json()) as { trip: { id: number } };

  await page.goto(`/trips/${trip.id}`);

  await page.getByRole('button', { name: strings.manual_add.title }).first().click();
  await page.getByRole('tab', { name: strings.manual_add.tab_free_text }).click();
  await page.getByLabel(strings.manual_add.free_text_placeholder).fill('My Custom Item');
  await page.getByRole('button', { name: strings.manual_add.submit }).click();

  await expect(page.getByText('My Custom Item')).toBeVisible();
  await expect(page.getByText(strings.packing_list.manual_tag).first()).toBeVisible();
});
