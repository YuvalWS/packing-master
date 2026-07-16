import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { resetTrips, goto, reload } from './_helpers.js';

test.beforeEach(resetTrips);

test('switching to by-bag persists across reload', async ({ page, request }) => {
  const params = await request.get('/api/parameters');
  const paramsBody = (await params.json()) as { parameters: { id: string; category: string }[] };
  const accommodation = paramsBody.parameters.find((p) => p.category === 'accommodation');
  expect(accommodation).toBeDefined();

  const created = await request.post('/api/trips', {
    data: {
      start_date: '2030-04-01',
      end_date: '2030-04-05',
      parameters: [accommodation!.id]
    }
  });
  const { trip } = (await created.json()) as { trip: { id: number } };

  await goto(page, `/trips/${trip.id}`);

  const byBagTab = page.getByRole('tab', { name: strings.view.by_bag });
  const byCategoryTab = page.getByRole('tab', { name: strings.view.by_category });

  await expect(byCategoryTab).toHaveAttribute('aria-selected', 'true');
  await byBagTab.click();
  await expect(byBagTab).toHaveAttribute('aria-selected', 'true');

  // Bag ids render via the Hebrew labels map, not raw ids.
  await expect(page.getByText(strings.view.bags.main_bag)).toBeVisible();
  await expect(page.getByText(strings.view.bags.small_bag)).toBeVisible();
  await expect(page.getByText(strings.view.no_bag)).toBeVisible();

  await reload(page);
  await expect(page.getByRole('tab', { name: strings.view.by_bag })).toHaveAttribute(
    'aria-selected',
    'true'
  );
});
