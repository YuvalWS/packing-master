import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { resetTrips, goto } from './_helpers.js';

test.beforeEach(resetTrips);

test('trips list splits upcoming and past, with a completed badge on fully-checked past trips', async ({
  page,
  request
}) => {
  const params = await request.get('/api/parameters');
  const paramsBody = (await params.json()) as { parameters: { id: string; category: string }[] };
  const accommodation = paramsBody.parameters.find((p) => p.category === 'accommodation');
  expect(accommodation).toBeDefined();

  const future = await request.post('/api/trips', {
    data: {
      name: 'Future Trip',
      start_date: '2035-01-01',
      end_date: '2035-01-05',
      parameters: [accommodation!.id]
    }
  });
  expect(future.ok()).toBeTruthy();

  const pastRes = await request.post('/api/trips', {
    data: {
      name: 'Past Trip',
      start_date: '2020-01-01',
      end_date: '2020-01-05',
      parameters: [accommodation!.id]
    }
  });
  expect(pastRes.ok()).toBeTruthy();
  const pastBody = (await pastRes.json()) as {
    trip: { id: number };
    items: { id: number }[];
  };
  for (const item of pastBody.items) {
    const res = await request.patch(`/api/trips/${pastBody.trip.id}/items/${item.id}`, {
      data: { is_checked: true }
    });
    expect(res.ok()).toBeTruthy();
  }

  await goto(page, '/');

  await expect(
    page.getByRole('heading', { name: strings.trips_list.upcoming })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: strings.trips_list.past })).toBeVisible();

  const upcomingSection = page.locator('section.section', {
    has: page.getByRole('heading', { name: strings.trips_list.upcoming })
  });
  const pastSection = page.locator('section.section', {
    has: page.getByRole('heading', { name: strings.trips_list.past })
  });

  await expect(upcomingSection.getByText('Future Trip')).toBeVisible();
  await expect(pastSection.getByText('Past Trip')).toBeVisible();
  await expect(pastSection.getByText(strings.trips_list.completed)).toBeVisible();
});
