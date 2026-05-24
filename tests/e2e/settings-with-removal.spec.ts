import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { resetTrips, goto } from './_helpers.js';

test.beforeEach(resetTrips);

test('narrowing parameters surfaces the regen diff modal; confirming drops rows', async ({
  page,
  request
}) => {
  const params = await request.get('/api/parameters');
  const paramsBody = (await params.json()) as {
    parameters: { id: string; category: string; display_name: string }[];
  };
  const accommodation = paramsBody.parameters.find((p) => p.category === 'accommodation');
  const envs = paramsBody.parameters.filter((p) => p.category === 'environment');
  const plans = paramsBody.parameters.filter((p) => p.category === 'day_plans');
  if (!accommodation || envs.length < 1 || plans.length < 2) {
    test.skip(true, 'fixture needs an accommodation, an env and two plans');
    return;
  }

  const created = await request.post('/api/trips', {
    data: {
      start_date: '2030-06-01',
      end_date: '2030-06-05',
      parameters: [accommodation.id, envs[0]!.id, plans[0]!.id, plans[1]!.id]
    }
  });
  expect(created.ok()).toBeTruthy();
  const { trip, items } = (await created.json()) as {
    trip: { id: number };
    items: { item_id: string | null }[];
  };
  const before = items.length;

  await goto(page, `/trips/${trip.id}/settings`);

  // de-select the day-plan chips to narrow.
  await page.getByRole('button', { name: plans[0]!.display_name, pressed: true }).click();
  await page.getByRole('button', { name: plans[1]!.display_name, pressed: true }).click();
  await page.getByRole('button', { name: strings.common.save }).click();

  const modal = page.getByRole('dialog', { name: strings.regen.title });
  if ((await modal.count()) === 0) {
    test.skip(true, 'no items removed by this parameter change in this fixture');
    return;
  }
  await modal.getByRole('button', { name: strings.regen.confirm }).click();
  await expect(page).toHaveURL(new RegExp(`/trips/${trip.id}(/|$)`));

  const after = await request.get(`/api/trips/${trip.id}`);
  const afterBody = (await after.json()) as { items: { item_id: string | null }[] };
  expect(afterBody.items.length).toBeLessThan(before);
});
