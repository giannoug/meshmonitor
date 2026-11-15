/**
 * Task 4.7: opening the raw packet panel narrows the packet table; the reader
 * keeps their place (rows keep their height, the scroll position holds) and
 * the opened row stays in view. Overview › Packets gets a long stream; the
 * pop-out window already has 200 rows.
 */
import { expect, test, type Page } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';
import { captureOn, unifiedPackets, unifiedPacketSources } from '../../src/workspace/__fixtures__/packets';

test.use({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });

const longStream = () => ({
  packets: Array.from({ length: 150 }, (_, i) => ({ ...unifiedPackets[i % unifiedPackets.length], id: 9000 - i, timestamp: unifiedPackets[0].timestamp - i * 5000 })),
  hasMore: false,
  nextCursor: null,
  sources: unifiedPacketSources,
});

const scroller = (page: Page) => page.getByTestId('packet-table-scroll');

async function scrollAndOpen(page: Page, index: number) {
  await scroller(page).evaluate((el) => { el.scrollTop = 1200; });
  const before = await scroller(page).evaluate((el) => el.scrollTop);
  expect(before).toBeGreaterThan(0);
  const row = page.locator('tr', { has: page.locator('td:first-child', { hasText: new RegExp(`^${index}$`) }) });
  await row.click();
  await page.getByRole('complementary', { name: /Raw packet/ }).waitFor();
  expect(await scroller(page).evaluate((el) => el.scrollTop)).toBe(before);
  // The row is wider than the narrowed table (it scrolls sideways); its height sits inside the scroller's view.
  const [r, box] = await Promise.all([row.boundingBox(), scroller(page).boundingBox()]);
  expect(r!.y).toBeGreaterThanOrEqual(box!.y);
  expect(r!.y + r!.height).toBeLessThanOrEqual(box!.y + box!.height);
}

test('Overview › Packets: the panel keeps the reader\'s place in the table', async ({ page }) => {
  await routeFixtures(page, { ...captureOn, 'GET /api/unified/packets': longStream });
  await page.goto('/overview/packets');
  // Charts off, so the table has the room to scroll.
  await page.getByRole('button', { name: 'Charts' }).click();
  await page.getByRole('row').nth(5).waitFor();
  await scrollAndOpen(page, 32);
});

test('the pop-out window: the panel keeps the reader\'s place in the table', async ({ page }) => {
  await routeFixtures(page, captureOn);
  await page.goto('/packet-monitor');
  await page.getByRole('row').nth(5).waitFor();
  await scrollAndOpen(page, 32);
});
