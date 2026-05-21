import { test, expect } from '@playwright/test';

test('expanding a kit row and checking a component persists across reload', async ({
  page,
  request
}) => {
  const params = await request.get('/api/parameters');
  const paramsBody = (await params.json()) as { parameters: { id: string; category: string }[] };
  const accommodation = paramsBody.parameters.find((p) => p.category === 'accommodation');
  expect(accommodation).toBeDefined();

  const created = await request.post('/api/trips', {
    data: {
      start_date: '2030-03-01',
      end_date: '2030-03-05',
      parameters: [accommodation!.id]
    }
  });
  const { trip } = (await created.json()) as { trip: { id: number } };

  await page.goto(`/trips/${trip.id}`);

  const expandButtons = page.locator('button[aria-expanded]');
  const expandCount = await expandButtons.count();
  if (expandCount === 0) {
    test.skip(true, 'fixture does not include kit items in this trip');
    return;
  }

  const firstExpand = expandButtons.first();
  await firstExpand.click();
  await expect(firstExpand).toHaveAttribute('aria-expanded', 'true');

  const kitCheckbox = page
    .locator('[data-component-id]')
    .first()
    .getByRole('checkbox');
  await kitCheckbox.click();
  await expect(kitCheckbox).toHaveAttribute('aria-checked', 'true');

  await page.reload();
  const expandAfter = page.locator('button[aria-expanded]').first();
  await expandAfter.click();
  await expect(page.locator('[data-component-id]').first().getByRole('checkbox')).toHaveAttribute(
    'aria-checked',
    'true'
  );
});
