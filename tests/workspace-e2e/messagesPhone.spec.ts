/**
 * Task 4.6: on a 390×844 phone, Overview › Messages (7-06) and Export
 * messages (7-09) are phone targets: header links, chips, Refresh, "heard by",
 * the export fields and Download CSV at least 44 px tall, feed rows and the
 * receptions sheet's cards at least 52 px, and nothing scrolls sideways.
 */
import { expect, test, type Locator } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';

test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

/** Visible links, buttons, selects, labels and non-checkbox inputs under `root` shorter than `min` px. */
async function shortTargets(root: Locator, min = 44): Promise<string[]> {
  return root.evaluate((el, m) => {
    const out: string[] = [];
    for (const c of el.querySelectorAll<HTMLElement>("a, button, select, label, input:not([type='checkbox']):not([type='radio']):not([type='hidden'])")) {
      const r = c.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < m - 0.5) out.push(`${c.tagName} "${(c.textContent ?? '').trim().slice(0, 30)}" ${r.height}`);
    }
    return out;
  }, min);
}

const heights = (loc: Locator) => loc.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));

test('Messages: header, chips, rows and the receptions sheet are phone targets', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/overview/messages');
  await page.getByRole('combobox', { name: 'Channel' }).selectOption('__all__');
  const rows = page.getByTestId('feed-row');
  await rows.filter({ hasText: 'Heading to the beach' }).waitFor();
  expect(await shortTargets(page.locator('body'))).toEqual([]);
  expect((await heights(rows)).filter((h) => h < 52)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await rows.filter({ hasText: 'Anyone hearing the Hymettus relay' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Reception details' });
  await sheet.getByText('Athens MQTT').waitFor();
  expect(await shortTargets(sheet)).toEqual([]);
  expect((await heights(sheet.getByRole('listitem'))).filter((h) => h < 52)).toEqual([]);
});

test('Export messages: every field and Download CSV are phone targets', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/overview/messages/export');
  await page.getByRole('checkbox', { name: /Station G2/ }).waitFor();
  await page.getByRole('radio', { name: 'Only these channels' }).check({ force: true });
  await page.getByRole('checkbox', { name: 'LongFast' }).waitFor();
  expect(await shortTargets(page.locator('body'))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
