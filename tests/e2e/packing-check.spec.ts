import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };

test('check toggle on a packing-list row persists across reload', async ({ page, request }) => {
  // Create a trip via API so we don't depend on the new-trip UI in this spec.
  const params = await request.get('/api/parameters');
  expect(params.ok()).toBeTruthy();
  const paramsBody = (await params.json()) as { parameters: { id: string; category: string }[] };
  const accommodation = paramsBody.parameters.find((p) => p.category === 'accommodation');
  expect(accommodation).toBeDefined();

  const created = await request.post('/api/trips', {
    data: {
      start_date: '2030-02-01',
      end_date: '2030-02-05',
      parameters: [accommodation!.id]
    }
  });
  expect(created.ok()).toBeTruthy();
  const { trip } = (await created.json()) as { trip: { id: number } };

  await page.goto(`/trips/${trip.id}`);

  const firstCheckbox = page.getByRole('checkbox').first();
  await expect(firstCheckbox).toHaveAttribute('aria-checked', 'false');
  await firstCheckbox.click();
  await expect(firstCheckbox).toHaveAttribute('aria-checked', 'true');

  await page.reload();
  await expect(page.getByRole('checkbox').first()).toHaveAttribute('aria-checked', 'true');

  // sanity: e2e helper imports strings without using them — placeholder for
  // future assertions that reference UI chrome by label.
  expect(strings.packing_list.empty_title).toBeTruthy();
});
