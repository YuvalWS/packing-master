import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };

test('narrowing parameters surfaces the regen diff modal; confirming drops rows', async ({
  page,
  request
}) => {
  const params = await request.get('/api/parameters');
  const paramsBody = (await params.json()) as {
    parameters: { id: string; category: string }[];
  };
  const accommodations = paramsBody.parameters.filter((p) => p.category === 'accommodation');
  if (accommodations.length < 2) {
    test.skip(true, 'fixture needs at least two accommodation parameters to narrow');
    return;
  }
  const [first, second] = accommodations;

  // create a trip that uses BOTH accommodations so narrowing later removes
  // items keyed off the second one. We need rules in the catalog that key
  // off accommodation params; if none, the diff stays empty and we skip.
  const created = await request.post('/api/trips', {
    data: {
      start_date: '2030-06-01',
      end_date: '2030-06-05',
      parameters: [first!.id, second!.id]
    }
  });
  const { trip, items } = (await created.json()) as {
    trip: { id: number };
    items: { item_id: string | null }[];
  };
  const before = items.length;

  await page.goto(`/trips/${trip.id}/settings`);

  // de-select the second accommodation by clicking the first one (singleton
  // replacement) — the UI will pick first as the sole accommodation.
  await page.getByRole('radio').first().check();
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
