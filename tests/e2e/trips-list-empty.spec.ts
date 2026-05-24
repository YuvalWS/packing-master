import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { resetTrips, goto } from './_helpers.js';

test.beforeEach(resetTrips);

test('empty trips list shows empty state and a FAB linking to /trips/new', async ({ page }) => {
  await goto(page, '/');

  await expect(
    page.getByRole('heading', { name: strings.trips_list.empty_title })
  ).toBeVisible();

  const fab = page.getByRole('link', { name: strings.a11y.create_trip });
  await expect(fab).toBeVisible();
  await expect(fab).toHaveAttribute('href', '/trips/new');
});
