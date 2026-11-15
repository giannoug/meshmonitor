/**
 * Task 4.6: Overview › Messages opens on the newest message, as today's
 * Unified Messages does (newest at the bottom, the feed scrolls inside itself),
 * and opening the receptions panel, which narrows the feed, keeps it there and
 * keeps the opened row in view (fix round 1).
 */
import { expect, test, type Page } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';

const NEWEST = 'Yes, loud and clear from Marousi';
const PSY = 'Anyone hearing the Hymettus relay';

async function open(page: Page) {
  await routeFixtures(page);
  await page.goto('/overview/messages');
  await page.getByTestId('feed-row').filter({ hasText: NEWEST }).waitFor();
  await page.waitForLoadState('networkidle');
}

const row = (page: Page, text: string) => page.getByTestId('feed-row').filter({ hasText: text }).first();

test.describe('a feed that overflows', () => {
  // Short enough that the fixture's feed overflows and must scroll.
  test.use({ viewport: { width: 1280, height: 560 }, colorScheme: 'dark' });

  test('the feed opens scrolled to the newest message', async ({ page }) => {
    await open(page);
    await expect(row(page, NEWEST)).toBeInViewport({ ratio: 1 });
    const feed = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="feed-row"]')!.parentElement!;
      return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight };
    });
    expect(feed.max).toBeGreaterThan(0);
    expect(feed.top).toBeGreaterThanOrEqual(feed.max - 1);
  });

  test('an older row opened from mid-feed stays in view beside the panel', async ({ page }) => {
    await open(page);
    const rover = row(page, 'Morning all, rover is back on LongFast');
    await rover.getByRole('button', { name: 'heard by 2' }).click();
    await page.getByRole('complementary', { name: 'Reception details' }).waitFor();
    await expect(rover).toBeInViewport({ ratio: 1 });
  });
});

test.describe('the board size (7-01)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });

  test('opening the panel keeps the newest message at the bottom and the opened row in view', async ({ page }) => {
    await open(page);
    await row(page, PSY).getByRole('button', { name: 'heard by 3' }).click();
    await page.getByRole('complementary', { name: 'Reception details' }).waitFor();
    await expect(row(page, NEWEST)).toBeInViewport({ ratio: 1 });
    await expect(row(page, PSY)).toBeInViewport({ ratio: 1 });
  });
});
