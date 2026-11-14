/**
 * Task 3.2: on a touch phone, a real finger dragging the node peek up from
 * its body opens the node page (g1-map). jsdom's synthetic pointer events
 * cannot show this: the browser only hands the drag to the page when the
 * sheet's touch-action leaves vertical panning to it.
 */
import { expect, test } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark' });

test('a touch drag up from the peek body opens the node page', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/source/src-g2/map');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Node list' }).tap();
  await page.getByRole('list', { name: 'On the map' }).getByRole('button', { name: /Kifisia Rooftop/ }).tap();
  const peek = page.getByRole('dialog', { name: 'Kifisia Rooftop' });
  // Start on the stats, in the sheet's scrolling body (not the handle or the head).
  const start = await peek.getByText('Hops', { exact: true }).boundingBox();
  if (!start) throw new Error('no Hops label');
  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;

  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', at?: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: at === undefined ? [] : [{ x, y: at, id: 1 }] });
  await touch('touchStart', y);
  for (let step = 1; step <= 10; step += 1) await touch('touchMove', y - step * 15);
  await touch('touchEnd');

  await expect(page).toHaveURL(/\/source\/src-g2\/node\/!a1b2c301/);
});
