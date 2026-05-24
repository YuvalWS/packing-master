import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { resetTrips, goto, reload } from './_helpers.js';

test.beforeEach(resetTrips);

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

  await goto(page, `/trips/${trip.id}`);

  const labelPrefix = strings.a11y_row.toggle_check.split('{name}')[0]!;
  const rowCheckboxes = page.getByRole('checkbox', { name: new RegExp('^' + labelPrefix) });
  const firstCheckbox = rowCheckboxes.first();
  await expect(firstCheckbox).toHaveAttribute('aria-checked', 'false');
  await Promise.all([
    page.waitForResponse(
      (r) =>
        /\/api\/trips\/\d+\/items\//.test(r.url()) && r.request().method() === 'PATCH' && r.ok()
    ),
    firstCheckbox.click()
  ]);
  await expect(firstCheckbox).toHaveAttribute('aria-checked', 'true');

  await reload(page);
  await expect(rowCheckboxes.first()).toHaveAttribute('aria-checked', 'true');
});
