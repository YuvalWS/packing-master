import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { derive } from '../../src/lib/rules/derived.js';
import { resetTrips, goto } from './_helpers.js';

test.beforeEach(resetTrips);

const START = '2030-06-01';
const END = '2030-06-08';

async function createTrip(request: import('@playwright/test').APIRequestContext) {
  const params = await request.get('/api/parameters');
  const paramsBody = (await params.json()) as { parameters: { id: string; category: string }[] };
  const accommodation = paramsBody.parameters.find((p) => p.category === 'accommodation');
  const envB = paramsBody.parameters.find((p) => p.id === 'env_b');
  expect(accommodation).toBeDefined();
  expect(envB).toBeDefined();

  const created = await request.post('/api/trips', {
    data: {
      start_date: START,
      end_date: END,
      parameters: [accommodation!.id, envB!.id]
    }
  });
  expect(created.ok()).toBeTruthy();
  return (await created.json()) as {
    trip: { id: number };
    items: { id: number; item_id: string | null }[];
  };
}

test('header meta shows the day count and shabbat info', async ({ page, request }) => {
  const { trip } = await createTrip(request);
  await goto(page, `/trips/${trip.id}`);

  const derived = derive(START, END);
  const daysSegment = `${derived.days} ${strings.common.day_many}`;
  await expect(page.getByText(daysSegment).first()).toBeVisible();

  expect(derived.hasShabbat).toBe(true);
  // Yom Tov counts as Shabbat (DESIGN.md 14.1); these dates include Shavuot.
  const [one, many] =
    derived.yomTovCount > 0
      ? [strings.trip_header.holy_one, strings.trip_header.holy_many]
      : [strings.trip_header.shabbat_one, strings.trip_header.shabbat_many];
  const shabbatSegment =
    derived.shabbatCount === 1 ? one : many.replace('{count}', String(derived.shabbatCount));
  await expect(page.getByText(shabbatSegment)).toBeVisible();
  for (const h of derived.holidays) {
    await expect(page.getByText(strings.holidays[h], { exact: true })).toBeVisible();
  }
});

test('tapping the progress counter cycles required/optional/all filters', async ({
  page,
  request
}) => {
  const { trip, items } = await createTrip(request);

  const always = items.find((i) => i.item_id === 'item_always');
  expect(always).toBeDefined();
  const checked = await request.patch(`/api/trips/${trip.id}/items/${always!.id}`, {
    data: { is_checked: true }
  });
  expect(checked.ok()).toBeTruthy();

  await goto(page, `/trips/${trip.id}`);

  await expect(page.getByText('Always')).toBeVisible();
  await expect(page.getByText('Optional')).toBeVisible();

  const counter = page.getByRole('button', {
    name: new RegExp(`^${strings.packing_list.filter_hint}`)
  });

  // → required-unchecked: checked and optional rows disappear.
  await counter.click();
  await expect(page.getByText('Always')).toHaveCount(0);
  await expect(page.getByText('Optional')).toHaveCount(0);
  await expect(page.getByText('Per-day')).toBeVisible();

  // → optional-unchecked: only the optional item remains.
  await counter.click();
  await expect(page.getByText('Optional')).toBeVisible();
  await expect(page.getByText('Per-day')).toHaveCount(0);

  // → all: everything returns.
  await counter.click();
  await expect(page.getByText('Always')).toBeVisible();
  await expect(page.getByText('Per-day')).toBeVisible();
});

test('inline search filters rows by name', async ({ page, request }) => {
  const { trip } = await createTrip(request);
  await goto(page, `/trips/${trip.id}`);

  await page.getByRole('button', { name: strings.packing_list.search_open }).click();
  await page.getByPlaceholder(strings.packing_list.search_placeholder).fill('Per-day');

  await expect(page.getByText('Per-day')).toBeVisible();
  await expect(page.getByText('Always')).toHaveCount(0);

  // Closing the search resets the filter.
  await page.getByRole('button', { name: strings.packing_list.search_open }).click();
  await expect(page.getByText('Always')).toBeVisible();
});
