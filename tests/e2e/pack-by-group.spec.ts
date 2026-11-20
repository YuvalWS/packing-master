import { test, expect, type APIRequestContext } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { resetTrips, goto, reload } from './_helpers.js';

test.beforeEach(resetTrips);

interface TripBody {
  trip: { id: number; travelers: string[] | null };
  items: {
    row_id: number;
    item_id: string | null;
    category: string | null;
    is_checked: boolean;
    person_id: string;
  }[];
}

async function createTrip(
  request: APIRequestContext,
  extra: Record<string, unknown> = {}
): Promise<TripBody> {
  const params = await request.get('/api/parameters');
  const paramsBody = (await params.json()) as { parameters: { id: string; category: string }[] };
  const accommodation = paramsBody.parameters.find((p) => p.category === 'accommodation');
  const created = await request.post('/api/trips', {
    data: {
      start_date: '2030-08-01',
      end_date: '2030-08-05',
      parameters: [accommodation!.id],
      ...extra
    }
  });
  expect(created.ok()).toBeTruthy();
  return (await created.json()) as TripBody;
}

async function getTrip(request: APIRequestContext, id: number): Promise<TripBody> {
  return (await (await request.get(`/api/trips/${id}`)).json()) as TripBody;
}

test('check a whole category, then undo', async ({ page, request }) => {
  const { trip } = await createTrip(request);
  const before = await getTrip(request, trip.id);
  const category = before.items.find((i) => i.item_id === 'item_always')!.category!;
  const inCategory = before.items.filter((i) => i.category === category).length;

  await goto(page, `/trips/${trip.id}`);
  const group = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: category, exact: true }) });
  await expect(group.getByText(`0/${inCategory}`, { exact: true })).toBeVisible();
  await group
    .getByRole('button', { name: strings.packing_list.check_group.replace('{name}', category) })
    .click();

  await expect(group.getByText(`${inCategory}/${inCategory}`, { exact: true })).toBeVisible();
  await expect
    .poll(
      async () =>
        (await getTrip(request, trip.id)).items.filter(
          (i) => i.category === category && i.is_checked
        ).length
    )
    .toBe(inCategory);

  await page.getByRole('button', { name: strings.row_menu.undo, exact: true }).click();
  await expect(group.getByText(`0/${inCategory}`, { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await getTrip(request, trip.id)).items.some((i) => i.is_checked))
    .toBe(false);
});

test('hiding a person keeps their rows unchecked and survives a reload', async ({
  page,
  request
}) => {
  // The test catalog has no people; add one for this test only and remove it at the end.
  const person = 'e2e_parent';
  const made = await request.post('/api/people', {
    data: { id: person, display_name: 'Parent', kind: 'adult' }
  });
  expect([201, 409]).toContain(made.status());
  const { trip } = await createTrip(request, { travelers: [person] });
  try {
    await hideAndShow(page, request, trip.id, person);
  } finally {
    await request.delete(`/api/trips/${trip.id}`);
    await request.delete(`/api/people/${person}`);
  }
});

async function hideAndShow(
  page: import('@playwright/test').Page,
  request: APIRequestContext,
  tripId: number,
  person: string
) {
  const trip = { id: tripId };
  const added = await request.post(`/api/trips/${trip.id}/items`, {
    data: { item_id: 'item_always', person_id: person }
  });
  expect(added.ok()).toBeTruthy();

  await goto(page, `/trips/${trip.id}`);
  const rows = page.locator('.row', { hasText: 'Always' });
  await expect(rows).toHaveCount(2);

  const owners = page.getByRole('group', { name: strings.owners.label });
  const chip = owners.locator(`[data-owner="${person}"]`);
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await expect(rows).toHaveCount(1);
  expect((await getTrip(request, trip.id)).items.some((i) => i.is_checked)).toBe(false);

  await reload(page);
  await expect(page.locator('.row', { hasText: 'Always' })).toHaveCount(1);
  await owners.locator(`[data-owner="${person}"]`).click();
  await expect(page.locator('.row', { hasText: 'Always' })).toHaveCount(2);
}
