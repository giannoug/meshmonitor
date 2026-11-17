/**
 * Task 6.4 fix round 1 (I1): a row's ⋯ menu is never clipped by its card.
 * The LAST row's menu opens and its item takes a real click (Playwright
 * refuses a click on an item that a card's overflow hides), on the Channel
 * database, Map & tiles, Embed and You › Appearance (Task 6.3's theme list).
 * On phone the same, and the Server option labels and handles are 44 px.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';
import { CHANNEL_DB, serverFixtures } from '../../src/workspace/__fixtures__/server';
import { prefsFixtures } from '../../src/workspace/__fixtures__/preferences';
import { athensFixture } from '../../src/workspace/__fixtures__/athens';

/**
 * What a pointer at the item's centre hits, before anything scrolls: Playwright's own click would
 * scroll a clipped item into view inside an `overflow: hidden` card, which a person cannot do.
 */
async function hitsItself(item: Locator): Promise<boolean> {
  return item.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!at && (at === el || el.contains(at));
  });
}

async function lastRowItem(page: Page, path: string, menu: string, item: string) {
  await page.goto(path);
  await page.getByRole('button', { name: menu }).click();
  const target = page.getByRole('menuitem', { name: item });
  await target.waitFor();
  expect(await hitsItself(target)).toBe(true);
  await target.click();
}

for (const size of [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
]) {
  test.describe(size.name, () => {
    test.use({ viewport: size.viewport, colorScheme: 'dark' });

    test('Channel database: the last key\'s Delete opens today\'s confirm', async ({ page }) => {
      // The last key enabled, so its menu has both items (Decrypt, Delete): the tallest it gets.
      const keys = CHANNEL_DB.map((c, i) => (i === CHANNEL_DB.length - 1 ? { ...c, isEnabled: true } : c));
      await routeFixtures(page, { ...serverFixtures(), 'GET /api/channel-database': () => ({ success: true, data: keys, count: keys.length }) });
      await lastRowItem(page, '/server/channel-database', 'More for Old club key', 'Delete');
      await expect(page.getByRole('dialog', { name: 'Delete Channel?' })).toBeVisible();
    });

    test('Map & tiles: the last map style\'s and GeoJSON layer\'s menus', async ({ page }) => {
      await routeFixtures(page, serverFixtures());
      await lastRowItem(page, '/server/map', 'More for Athens dark (vector)', 'Delete');
      await expect(page.getByRole('dialog', { name: 'Delete' })).toBeVisible();
      await page.getByRole('dialog', { name: 'Delete' }).getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('button', { name: 'More for Hiking trails' }).click();
      const style = page.getByRole('menuitem', { name: 'Colour and style' });
      await style.waitFor();
      expect(await hitsItself(style)).toBe(true);
      await style.click();
      await expect(page.getByRole('dialog', { name: /Colour and style/ })).toBeVisible();
    });

    test('Embed: the last profile\'s Delete opens today\'s confirm', async ({ page }) => {
      await routeFixtures(page, serverFixtures());
      await lastRowItem(page, '/server/embed', 'More for Club site', 'Delete');
      await expect(page.getByRole('dialog', { name: 'Delete' })).toBeVisible();
    });

    test('Appearance: the last custom theme\'s Clone opens the editor', async ({ page }) => {
      await routeFixtures(page, {
        ...prefsFixtures(),
        'GET /api/auth/status': () => ({ ...athensFixture.authStatus, permissions: { global: { themes: { read: true, write: true } }, bySource: {} } }),
      });
      // On phone the theme list is its own page (s13n7).
      await lastRowItem(page, size.name === 'phone' ? '/preferences/appearance/themes' : '/preferences/appearance', 'More for Mesh green', 'Clone');
      await expect(page).toHaveURL(/\/preferences\/appearance\/themes\/new\?from=custom-mesh-green/);
    });
  });
}

test.describe('phone targets (M2)', () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

  test('the channel-database drag handle and the embed option labels are 44 px', async ({ page }) => {
    await routeFixtures(page, serverFixtures());
    await page.goto('/server/channel-database');
    const handle = page.getByRole('button', { name: 'Drag to reorder: Athens Ops' });
    const box = await handle.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.goto('/server/embed');
    await page.getByRole('button', { name: 'Edit Athens public' }).click();
    const label = page.locator('label', { hasText: 'Show Paths' });
    expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});
