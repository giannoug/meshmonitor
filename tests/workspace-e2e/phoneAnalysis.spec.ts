/**
 * Task 4.3 fix round 1 (I1): on a 390×844 phone, the Overview map's bottom
 * dock (Link Profile, Site Planner, GNSS DOP, Time Slider) leaves every
 * control tappable. jsdom computes no layout; a real click (no `force`) fails
 * when another element covers its target.
 */
import { expect, test } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';

test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

test('with the Time Slider and GNSS DOP on, the Link Profile drawer\'s last control is tappable', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/overview/map');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    const key = 'mapAnalysis.config.v1';
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null') ?? {};
    localStorage.setItem(key, JSON.stringify({ version: 1, ...stored, timeSlider: { enabled: true } }));
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.getByTestId('time-slider').waitFor();

  const bar = page.getByRole('toolbar', { name: 'Map tools' });
  await bar.getByRole('button', { name: /^Layers/ }).click();
  const layers = page.getByRole('dialog', { name: 'Layers' });
  await layers.getByRole('switch', { name: 'GNSS DOP' }).click();
  await layers.getByRole('button', { name: 'Close' }).click();
  await bar.getByRole('button', { name: /^Tools/ }).click();
  await page.getByRole('dialog', { name: 'Tools' }).getByRole('radio', { name: 'Link Profile' }).click();

  const drawer = page.getByTestId('link-profile-drawer');
  await drawer.waitFor();
  const map = page.locator('.leaflet-container');
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width * 0.3, y: box.height * 0.1 } });
  await map.click({ position: { x: box.width * 0.7, y: box.height * 0.2 } });
  await drawer.getByText('Margin', { exact: true }).waitFor();

  // The drawer's last control, then its Reset: real clicks, which fail if the DOP panel or the slider covers them.
  const kFactor = drawer.getByLabel('Earth k-factor');
  await kFactor.click();
  await expect(kFactor).toBeFocused();
  await page.getByTestId('gnss-dop-panel').getByRole('button', { name: 'Now' }).click();
  await drawer.getByRole('button', { name: 'Reset' }).click();
  await expect(drawer.getByText('Margin', { exact: true })).toHaveCount(0);
});
