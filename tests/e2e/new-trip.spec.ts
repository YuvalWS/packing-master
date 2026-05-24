import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { resetTrips, goto } from './_helpers.js';

test.beforeEach(resetTrips);

test('new trip flow: pick a template, fill details, submit, land on packing list', async ({
  page
}) => {
  await goto(page, '/trips/new');

  await expect(page.getByRole('heading', { name: strings.new_trip.step_template_title })).toBeVisible();
  await page.getByRole('button', { name: strings.new_trip.no_template }).click();

  await expect(page.getByRole('heading', { name: strings.new_trip.step_details_title })).toBeVisible();
  await page.getByLabel(strings.new_trip.label_start).fill('2030-01-10');
  await page.getByLabel(strings.new_trip.label_end).fill('2030-01-15');

  const firstAccommodation = page.getByRole('radio').first();
  await firstAccommodation.check();

  await page.getByRole('button', { name: strings.new_trip.submit }).click();

  await expect(page).toHaveURL(/\/trips\/\d+/);
});
