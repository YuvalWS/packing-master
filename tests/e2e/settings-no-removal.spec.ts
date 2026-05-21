import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };

test('renaming a trip from settings persists and returns to the packing list', async ({
  page,
  request
}) => {
  const params = await request.get('/api/parameters');
  const paramsBody = (await params.json()) as { parameters: { id: string; category: string }[] };
  const accommodation = paramsBody.parameters.find((p) => p.category === 'accommodation');
  expect(accommodation).toBeDefined();

  const created = await request.post('/api/trips', {
    data: {
      start_date: '2030-05-01',
      end_date: '2030-05-05',
      parameters: [accommodation!.id]
    }
  });
  const { trip } = (await created.json()) as { trip: { id: number } };

  await page.goto(`/trips/${trip.id}/settings`);

  await page.getByLabel(strings.new_trip.label_name).fill('Renamed Trip');
  await page.getByRole('button', { name: strings.common.save }).click();

  await expect(page).toHaveURL(new RegExp(`/trips/${trip.id}(/|$)`));
  await expect(page.getByRole('heading', { name: 'Renamed Trip' })).toBeVisible();
});
