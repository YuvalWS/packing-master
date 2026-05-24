import { test, expect } from '@playwright/test';
import strings from '../../src/lib/strings.json' with { type: 'json' };

test('templates list → detail → back to list', async ({ page, request }) => {
  const res = await request.get('/api/templates');
  const { templates } = (await res.json()) as {
    templates: { id: string; display_name: string }[];
  };
  if (templates.length === 0) {
    test.skip(true, 'no templates seeded');
    return;
  }

  await page.goto('/templates');
  await expect(page.getByRole('heading', { name: templates[0]!.display_name })).toBeVisible();

  await page.getByRole('link', { name: new RegExp(templates[0]!.display_name) }).first().click();
  await expect(page).toHaveURL(`/templates/${templates[0]!.id}`);
  await expect(page.getByRole('heading', { name: templates[0]!.display_name })).toBeVisible();

  await page.getByRole('link', { name: strings.templates_catalog.back_to_list }).click();
  await expect(page).toHaveURL('/templates');
});
