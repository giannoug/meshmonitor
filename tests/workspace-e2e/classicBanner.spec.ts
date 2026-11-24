/**
 * Task 9.3 fix round 1: the r3 banner is on top and clickable on Classic's
 * default Nodes tab (a fixed map view), on Channels, and with a TX-disabled
 * AppBanner (which cannot be dismissed); and it covers none of them: the
 * AppBanners, the Nodes view and the page heading all start below it.
 * (AppBanners still overlay the page top as they do today; they never offset it.) A real
 * click fails if anything covers the button; the save it sends proves it landed.
 */
import { expect, test } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';

const NO_LAYOUT = { 'GET /api/user/preferences': () => ({ success: true, data: { preferences: {} } }) };
const TX_OFF = { 'GET /api/device/tx-status': () => ({ txEnabled: false, udpRelayEnabled: false, canTransmit: false }) };

const CASES = [
  { name: 'Nodes (default tab)', path: '/source/src-g2', fixtures: NO_LAYOUT },
  { name: 'Channels', path: '/source/src-g2/channels', fixtures: NO_LAYOUT },
  { name: 'Nodes with a TX-disabled banner', path: '/source/src-g2/nodes', fixtures: { ...NO_LAYOUT, ...TX_OFF } },
  { name: 'Channels with a TX-disabled banner', path: '/source/src-g2/channels', fixtures: { ...NO_LAYOUT, ...TX_OFF } },
];

for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  for (const c of CASES) {
    test(`${c.name} at ${size.width} px: the banner is on top and Try it / Not now are clickable`, async ({ page }) => {
      await page.setViewportSize(size);
      const puts: string[] = [];
      await routeFixtures(page, {
        ...c.fixtures,
        'PUT /api/user/preferences/:key': (url) => {
          puts.push(decodeURIComponent(url.pathname.split('/').pop()!));
          return { success: true };
        },
      });
      await page.goto(c.path);
      await page.waitForLoadState('networkidle');
      const banner = page.getByRole('region', { name: 'Try the Workspace layout' });
      await expect(banner).toBeVisible();
      const bottom = (await banner.boundingBox())!.y + (await banner.boundingBox())!.height;
      if (c.fixtures === NO_LAYOUT) {
        await expect(page.locator('.warning-banner')).toHaveCount(0);
      } else {
        // The TX banner stacks below the r3 banner, fully visible.
        await expect(page.locator('.warning-banner')).toBeVisible();
        expect((await page.locator('.warning-banner').boundingBox())!.y).toBeGreaterThanOrEqual(bottom - 1);
      }
      // Classic's own surfaces start below the r3 banner. (AppBanners overlay the page, as they do today.)
      const surface = c.path.endsWith('/channels')
        ? page.getByRole('heading', { name: /^Channels \(/ })
        : page.locator('.nodes-split-view');
      expect((await surface.boundingBox())!.y).toBeGreaterThanOrEqual(bottom - 1);
      for (const name of ['Try it', 'Not now', 'Dismiss']) {
        const button = banner.getByRole('button', { name });
        const hit = await button.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return !!top && el.contains(top);
        });
        expect(hit, `${name} is the top element at its centre`).toBe(true);
      }
      await banner.getByRole('button', { name: 'Not now' }).click();
      await expect.poll(() => puts).toEqual(['layout', 'workspace.bannerDismissed']);
    });
  }
}
