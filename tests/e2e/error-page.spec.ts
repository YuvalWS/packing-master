import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { resetTrips } from './_helpers.js';

test.beforeEach(resetTrips);

test('missing trip renders the Hebrew 404 page with a working home link', async ({ page }) => {
  await page.goto('/trips/999999');

  await expect(page.getByText(strings.error.title_404)).toBeVisible();
  await expect(page.getByText(strings.error.message_404)).toBeVisible();

  await page.getByRole('link', { name: strings.error.go_home }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(strings.trips_list.empty_title)).toBeVisible();
});
