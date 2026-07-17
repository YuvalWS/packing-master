import { test } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { resetTrips, goto } from './_helpers.js';

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(resetTrips);

test('capture all screens', async ({ page, request }) => {
  const dir = 'test-results/screenshots';

  // 1) empty trips list
  await goto(page, '/');
  await page.screenshot({ path: `${dir}/01-trips-empty.png`, fullPage: true });

  // 2) drawer open
  await page.getByRole('button', { name: strings.a11y.open_menu }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/02-drawer-open.png`, fullPage: true });
  await page.keyboard.press('Escape');

  // 3) new-trip step 1
  await goto(page, '/trips/new');
  await page.screenshot({ path: `${dir}/03-new-trip-templates.png`, fullPage: true });

  // 4) new-trip step 2
  await page.getByRole('button', { name: strings.new_trip.start_blank }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}/04-new-trip-details.png`, fullPage: true });

  // create a trip via API
  const paramsBody = (await (await request.get('/api/parameters')).json()) as {
    parameters: { id: string; category: string }[];
  };
  const accom = paramsBody.parameters.find((p) => p.category === 'accommodation')!;
  const env = paramsBody.parameters.find((p) => p.category === 'environment')!;
  const plan = paramsBody.parameters.find((p) => p.category === 'day_plans')!;
  const created = await request.post('/api/trips', {
    data: {
      name: 'My Test Trip',
      start_date: '2030-06-01',
      end_date: '2030-06-08',
      destination: 'Somewhere',
      parameters: [accom.id, env.id, plan.id]
    }
  });
  const { trip } = (await created.json()) as { trip: { id: number } };

  // 5) trips list with one trip
  await goto(page, '/');
  await page.screenshot({ path: `${dir}/05-trips-list.png`, fullPage: true });

  // 6) packing list
  await goto(page, `/trips/${trip.id}`);
  await page.screenshot({ path: `${dir}/06-packing-list.png`, fullPage: true });

  // 7) check one row
  const labelPrefix = strings.a11y_row.toggle_check.split('{name}')[0]!;
  await page.getByRole('checkbox', { name: new RegExp('^' + labelPrefix) }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/07-packing-checked.png`, fullPage: true });

  // 8) by-bag view
  await page.getByRole('tab', { name: strings.view.by_bag }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/08-packing-by-bag.png`, fullPage: true });

  // 9) open manual-add sheet
  await page.getByRole('tab', { name: strings.view.by_category }).click();
  await page.getByRole('button', { name: strings.manual_add.title }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/09-manual-add-catalog.png`, fullPage: true });

  await page.getByRole('tab', { name: strings.manual_add.tab_free_text }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}/10-manual-add-freetext.png`, fullPage: true });

  // 10) settings screen
  await goto(page, `/trips/${trip.id}/settings`);
  await page.screenshot({ path: `${dir}/11-trip-settings.png`, fullPage: true });

  // 11) items catalog
  await goto(page, '/items');
  await page.screenshot({ path: `${dir}/12-items-list.png`, fullPage: true });

  // 12) items detail
  const items = (await (await request.get('/api/items')).json()) as { items: { id: string }[] };
  await goto(page, `/items/${items.items[0]!.id}`);
  await page.screenshot({ path: `${dir}/13-item-detail.png`, fullPage: true });

  // 13) templates list
  await goto(page, '/templates');
  await page.screenshot({ path: `${dir}/14-templates-list.png`, fullPage: true });

  // 14) template detail
  const templates = (await (await request.get('/api/templates')).json()) as {
    templates: { id: string }[];
  };
  if (templates.templates.length > 0) {
    await goto(page, `/templates/${templates.templates[0]!.id}`);
    await page.screenshot({ path: `${dir}/15-template-detail.png`, fullPage: true });
  }

  // 15) row-actions sheet
  await goto(page, `/trips/${trip.id}`);
  await page.getByRole('button', { name: strings.a11y_row.row_menu }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/16-row-actions-sheet.png`, fullPage: true });
  await page.keyboard.press('Escape');

  // 16) error page
  await page.goto('/trips/999999');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}/17-error-page.png`, fullPage: true });

  // 17) desktop layout with permanent drawer
  await page.setViewportSize({ width: 1280, height: 800 });
  await goto(page, `/trips/${trip.id}`);
  await page.screenshot({ path: `${dir}/18-desktop-packing-list.png`, fullPage: true });
});
