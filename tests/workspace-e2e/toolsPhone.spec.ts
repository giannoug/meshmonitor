/**
 * Task 8.5 fix round 1 (review I2): on a 390×844 phone the device tools'
 * controls are phone targets (≥ 44 px), including those in sheets, which
 * portal outside the page: q3's Copy JSON / Show sender, the Send a DM
 * buttons in Security's list sheets, the 16-05 digest's fields and segments,
 * and 16-01's group headings.
 */
import { expect, test, type Locator } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';
import { captureOn } from '../../src/workspace/__fixtures__/packets';
import { toolsFixtures } from '../../src/workspace/__fixtures__/tools';

test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

const G2 = '/source/src-g2';
const fixtures = () => ({ ...captureOn, ...toolsFixtures() });

async function heightsOf(targets: Locator): Promise<number[]> {
  return targets.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
}

async function expectTall(targets: Locator, min = 44): Promise<void> {
  const hs = await heightsOf(targets);
  expect(hs.length).toBeGreaterThan(0);
  for (const h of hs) expect(h).toBeGreaterThanOrEqual(min - 0.5);
}

test('q3: the packet sheet\'s Copy JSON and Show sender are phone targets', async ({ page }) => {
  await routeFixtures(page, fixtures());
  await page.goto(`${G2}/packetmonitor`);
  await page.getByTestId('packet-row').first().click();
  const sheet = page.getByRole('dialog', { name: 'Raw packet #4821' });
  await expectTall(sheet.getByRole('button', { name: /^(Copy JSON|Show sender)$/ }));
});

test('Security: Send a DM in a list sheet is a phone target', async ({ page }) => {
  await routeFixtures(page, fixtures());
  await page.goto(`${G2}/security`);
  await page.getByRole('button', { name: /^Key problems/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Key problems' });
  await expectTall(sheet.getByRole('button', { name: 'Send a DM' }));
});

test('16-05: the digest\'s fields and segments are phone targets', async ({ page }) => {
  await routeFixtures(page, fixtures());
  await page.goto(`${G2}/security`);
  await page.getByText('Shared public key').waitFor();
  await expectTall(page.locator('input[type="text"], input[type="time"]'));
  await expectTall(page.getByRole('group', { name: 'Report type' }).getByRole('button'));
  await expectTall(page.getByRole('group', { name: 'Format' }).getByRole('button'));
});

test('16-01: the group headings are phone targets', async ({ page }) => {
  await routeFixtures(page, fixtures());
  await page.goto(`${G2}/info`);
  await page.getByText('EU_868 · LongFast').waitFor();
  await expectTall(page.getByRole('link', { name: /: all of it$/ }));
});
