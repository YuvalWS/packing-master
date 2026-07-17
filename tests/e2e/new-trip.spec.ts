import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { derive } from '../../src/lib/rules/derived.js';
import { resetTrips, goto } from './_helpers.js';

test.beforeEach(resetTrips);

const START = '2030-01-10';
const END = '2030-01-17';

test('new trip flow: blank start, derived hints, live placeholder, submit', async ({
  page,
  request
}) => {
  await goto(page, '/trips/new');

  const step1Indicator = `${strings.new_trip.step_indicator.replace('{n}', '1')} · ${strings.new_trip.step_template_title}`;
  await expect(page.getByText(step1Indicator)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: strings.new_trip.step_template_title })
  ).toBeVisible();

  // Blank start lives below an "or" separator as a standalone button.
  await expect(page.getByText(strings.new_trip.or_separator, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: strings.new_trip.start_blank }).click();

  const step2Indicator = `${strings.new_trip.step_indicator.replace('{n}', '2')} · ${strings.new_trip.step_details_title}`;
  await expect(page.getByText(step2Indicator)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: strings.new_trip.step_details_title })
  ).toBeVisible();

  const nameInput = page.getByLabel(strings.new_trip.label_name);
  await expect(nameInput).toHaveAttribute(
    'placeholder',
    strings.new_trip.name_fallback_placeholder
  );

  await page.getByLabel(strings.new_trip.label_start).fill(START);
  await page.getByLabel(strings.new_trip.label_end).fill(END);

  // Derived date hint: N days + shabbat info computed from the same engine.
  const derived = derive(START, END);
  await expect(
    page.getByText(`${derived.days} ${strings.common.day_many}`)
  ).toBeVisible();
  expect(derived.hasShabbat).toBe(true);
  const shabbatHint =
    derived.shabbatCount === 1
      ? strings.new_trip.includes_shabbat_one
      : strings.new_trip.includes_shabbat_many.replace('{count}', String(derived.shabbatCount));
  await expect(page.getByText(shabbatHint)).toBeVisible();

  // Detected derived params surface in the read-only automatic section.
  await expect(
    page.getByText(strings.parameter_category.derived, { exact: true })
  ).toBeVisible();
  await expect(page.getByText(strings.new_trip.derived_hint)).toBeVisible();

  // Picking an accommodation switches the name placeholder to the auto default.
  const params = await request.get('/api/parameters');
  const paramsBody = (await params.json()) as {
    parameters: { id: string; category: string; display_name: string; sort_order: number }[];
  };
  const accommodation = paramsBody.parameters
    .filter((p) => p.category === 'accommodation')
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  expect(accommodation).toBeDefined();

  await page.getByRole('radio', { name: accommodation!.display_name }).check();
  await expect(nameInput).toHaveAttribute(
    'placeholder',
    strings.new_trip.name_auto_placeholder
      .replace('{days}', String(derived.days))
      .replace('{accommodation}', accommodation!.display_name)
  );

  await page.getByRole('button', { name: strings.new_trip.submit }).click();
  await expect(page).toHaveURL(/\/trips\/\d+/);
});

test('picking a template pre-seeds its parameters', async ({ page, request }) => {
  await goto(page, '/trips/new');

  const templatesRes = await request.get('/api/templates');
  const { templates } = (await templatesRes.json()) as {
    templates: { id: string; display_name: string; default_parameters: string[] }[];
  };
  const withParams = templates.find((t) => t.default_parameters.length > 0);
  expect(withParams).toBeDefined();

  await page.getByRole('button', { name: withParams!.display_name }).click();

  const paramsRes = await request.get('/api/parameters');
  const { parameters } = (await paramsRes.json()) as {
    parameters: { id: string; category: string; display_name: string }[];
  };
  for (const pid of withParams!.default_parameters) {
    const param = parameters.find((p) => p.id === pid);
    if (!param) continue;
    if (param.category === 'accommodation') {
      await expect(page.getByRole('radio', { name: param.display_name })).toBeChecked();
    } else {
      await expect(
        page.getByRole('button', { name: param.display_name })
      ).toHaveAttribute('aria-pressed', 'true');
    }
  }
});
