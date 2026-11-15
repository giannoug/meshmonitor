/**
 * Task 4.7: on a 390×844 phone, Overview › Telemetry (7-07) and Packets
 * (7-08), the pop-out window (18-02) and an MQTT device's receptions (18-04)
 * are phone targets: every link, button, select, label and field at least
 * 44 px tall (today's controls inside the sheets included), rows and cards at
 * least 52 px, and nothing scrolls sideways. Each test first waits for the
 * controls it measures.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';
import { captureOn } from '../../src/workspace/__fixtures__/packets';

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
const noSideways = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

test('Telemetry: header, segmented views, chips, chart actions, readings and the filter sheet', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/overview/telemetry');
  await page.getByRole('heading', { name: /^Battery Level/ }).waitFor();
  await page.getByRole('button', { name: 'Split by source' }).first().waitFor();
  expect(await shortTargets(page.locator('body'))).toEqual([]);
  await noSideways(page);

  await page.getByRole('button', { name: 'Filters' }).click();
  const graphsSheet = page.getByRole('dialog', { name: 'Filters' });
  await graphsSheet.getByRole('group', { name: 'Time range' }).waitFor();
  expect(await shortTargets(graphsSheet)).toEqual([]);
  await graphsSheet.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('tab', { name: 'Latest' }).click();
  await page.getByRole('region', { name: 'Station G2' }).waitFor();
  await page.getByRole('button', { name: /favorites/ }).first().waitFor();
  expect(await shortTargets(page.locator('body'))).toEqual([]);
  await noSideways(page);
  await page.getByRole('button', { name: 'Filters' }).click();
  const latestSheet = page.getByRole('dialog', { name: 'Filters' });
  await latestSheet.getByRole('group', { name: 'Jump to' }).waitFor();
  expect(await shortTargets(latestSheet)).toEqual([]);
});

test('Packets: header, Capture, rows, and the filter, charts and raw packet sheets', async ({ page }) => {
  await routeFixtures(page, captureOn);
  await page.goto('/overview/packets');
  const rows = page.getByTestId('packet-row');
  await rows.first().waitFor();
  await page.getByRole('button', { name: 'Stop capturing' }).waitFor();
  expect(await shortTargets(page.locator('body'))).toEqual([]);
  expect((await heights(rows)).filter((h) => h < 52)).toEqual([]);
  await noSideways(page);

  await page.getByRole('button', { name: 'Filters' }).click();
  const filters = page.getByRole('dialog', { name: 'Filters' });
  await filters.getByRole('combobox', { name: 'MeshCore route type' }).waitFor();
  expect(await shortTargets(filters)).toEqual([]);
  await filters.getByRole('button', { name: /^Show \d+ packets$/ }).click();

  await page.getByRole('button', { name: 'Charts' }).click();
  const charts = page.getByRole('dialog', { name: 'Charts' });
  await charts.getByRole('region', { name: 'By Type' }).waitFor();
  expect(await shortTargets(charts)).toEqual([]);
  await charts.getByRole('button', { name: 'Close' }).click();

  await rows.first().click();
  const raw = page.getByRole('dialog', { name: /Raw packet/ });
  await raw.waitFor();
  expect(await shortTargets(raw)).toEqual([]);
});

test('Pop-out window: header, controls, rows and the filter sheet with today\'s controls', async ({ page }) => {
  await routeFixtures(page, captureOn);
  await page.goto('/packet-monitor');
  const rows = page.getByTestId('packet-row');
  await rows.first().waitFor();
  await page.getByRole('button', { name: 'Close window' }).waitFor();
  expect(await shortTargets(page.locator('body'))).toEqual([]);
  expect((await heights(rows)).filter((h) => h < 52)).toEqual([]);
  await noSideways(page);

  await page.getByRole('button', { name: 'Filters' }).click();
  const sheet = page.getByRole('dialog', { name: 'Filters' });
  await sheet.getByRole('checkbox', { name: 'Hide Own Packets' }).waitFor();
  expect(await shortTargets(sheet)).toEqual([]);
});

test('MQTT receptions: header, rows, Packet Detail cards and the filter sheet', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/source/src-mqtt/packetmonitor');
  const rows = page.getByTestId('packet-row');
  await rows.first().waitFor();
  await page.getByRole('button', { name: 'Stop capturing' }).waitFor();
  expect(await shortTargets(page.locator('body'))).toEqual([]);
  expect((await heights(rows)).filter((h) => h < 52)).toEqual([]);
  await noSideways(page);

  await rows.filter({ hasText: 'Marousi Mobile' }).click();
  const detail = page.getByRole('dialog', { name: 'Packet Detail' });
  const cards = detail.getByRole('list', { name: 'Per-gateway receptions' }).getByRole('listitem');
  await cards.first().waitFor();
  expect(await shortTargets(detail)).toEqual([]);
  expect((await heights(cards)).filter((h) => h < 52)).toEqual([]);
  await detail.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Filters' }).click();
  const filters = page.getByRole('dialog', { name: 'Filters' });
  await filters.getByRole('spinbutton').first().waitFor();
  await filters.getByLabel('Max count').waitFor();
  expect(await shortTargets(filters)).toEqual([]);
});
