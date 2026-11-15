/**
 * Task 4.6: Overview › Messages opens on the newest message, as today's
 * Unified Messages does (newest at the bottom, the feed scrolls inside itself).
 */
import { expect, test } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';

// Short enough that the fixture's feed overflows and must scroll.
test.use({ viewport: { width: 1280, height: 560 }, colorScheme: 'dark' });

test('the feed opens scrolled to the newest message', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/overview/messages');
  const newest = page.getByTestId('feed-row').filter({ hasText: 'Yes, loud and clear from Marousi' });
  await newest.waitFor();
  await page.waitForLoadState('networkidle');
  await expect(newest).toBeInViewport({ ratio: 1 });
  const feed = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="feed-row"]')!.parentElement!;
    return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight };
  });
  expect(feed.max).toBeGreaterThan(0);
  expect(feed.top).toBeGreaterThanOrEqual(feed.max - 1);
});
