import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { resetTrips, goto } from './_helpers.js';

test.beforeEach(resetTrips);

test('deleting a trip from the trip menu returns to an empty trips list', async ({
  page,
  request
}) => {
  const params = await request.get('/api/parameters');
  const paramsBody = (await params.json()) as { parameters: { id: string; category: string }[] };
  const accommodation = paramsBody.parameters.find((p) => p.category === 'accommodation');
  expect(accommodation).toBeDefined();

  const created = await request.post('/api/trips', {
    data: {
      name: 'Trip To Delete',
      start_date: '2030-09-01',
      end_date: '2030-09-03',
      parameters: [accommodation!.id]
    }
  });
  const { trip } = (await created.json()) as { trip: { id: number } };

  await goto(page, `/trips/${trip.id}`);

  await page.getByRole('button', { name: strings.trip_menu.open }).click();
  const sheet = page.getByRole('dialog', { name: strings.trip_menu.title });
  await sheet.getByRole('button', { name: strings.settings.delete_trip }).click();
  await expect(sheet.getByText(strings.settings.delete_confirm)).toBeVisible();
  await sheet.getByRole('button', { name: strings.settings.delete_trip }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(strings.trips_list.empty_title)).toBeVisible();
});
