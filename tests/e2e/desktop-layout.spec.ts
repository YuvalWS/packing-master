import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };
import { resetTrips, goto } from './_helpers.js';

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(resetTrips);

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function intersects(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

function withinViewport(a: Box, width: number, height: number): boolean {
  return a.x >= 0 && a.y >= 0 && a.x + a.width <= width && a.y + a.height <= height;
}

test('overlays clear the permanent drawer on desktop viewports', async ({ page, request }) => {
  const params = await request.get('/api/parameters');
  const paramsBody = (await params.json()) as { parameters: { id: string; category: string }[] };
  const accommodation = paramsBody.parameters.find((p) => p.category === 'accommodation');
  expect(accommodation).toBeDefined();

  const created = await request.post('/api/trips', {
    data: {
      start_date: '2030-07-01',
      end_date: '2030-07-05',
      parameters: [accommodation!.id]
    }
  });
  const { trip } = (await created.json()) as { trip: { id: number } };

  await goto(page, `/trips/${trip.id}`);

  const drawerBox = await page.locator('aside').boundingBox();
  expect(drawerBox).not.toBeNull();

  await page.getByRole('button', { name: strings.manual_add.title }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const sheetBox = await sheet.boundingBox();
  expect(sheetBox).not.toBeNull();
  expect(intersects(sheetBox!, drawerBox!)).toBe(false);
  expect(withinViewport(sheetBox!, 1280, 800)).toBe(true);

  await sheet.getByRole('tab', { name: strings.manual_add.tab_free_text }).click();
  await sheet.getByLabel(strings.manual_add.free_text_placeholder).fill('Desktop Layout Item');
  await sheet.getByRole('button', { name: strings.manual_add.submit, exact: true }).click();

  const toast = page.getByRole('status').filter({ hasText: strings.manual_add.added_toast });
  await expect(toast).toBeVisible();
  const toastBox = await toast.boundingBox();
  expect(toastBox).not.toBeNull();
  expect(intersects(toastBox!, drawerBox!)).toBe(false);
  expect(withinViewport(toastBox!, 1280, 800)).toBe(true);
});
