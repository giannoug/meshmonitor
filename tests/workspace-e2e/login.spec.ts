/**
 * The rail's Login dialog (Task 1.6 fix): it must be the topmost element over
 * the whole shell, not trapped under the sidebar by the rail's stacking context.
 */
import { expect, test } from '@playwright/test';
import { athensFixture } from '../../src/workspace/__fixtures__/athens';
import { routeFixtures } from './fixtureRoutes';

test.use({ viewport: { width: 1280, height: 800 } });

test('anonymous Login opens a dialog on top of the rail and sidebar', async ({ page }) => {
  await routeFixtures(page, {
    'GET /api/auth/status': () => ({
      ...athensFixture.authStatus,
      authenticated: false,
      user: null,
      permissions: { global: {}, bySource: { 'src-g2': { nodes: { read: true, write: false } } } },
    }),
  });
  await page.goto('/source/src-g2/nodes');
  await page.waitForLoadState('networkidle');
  await page.getByRole('navigation', { name: 'Devices' }).getByRole('button', { name: 'Login' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  // The dialog's centre, and a point over the sidebar (covered by the dialog's backdrop).
  const hits = await page.evaluate(
    ([x, y]) => {
      const d = document.querySelector('[role="dialog"]')!;
      const atCentre = document.elementFromPoint(x, y);
      const overSidebar = document.elementFromPoint(200, 400);
      return {
        centre: !!atCentre && d.contains(atCentre),
        sidebar: !!overSidebar && !!overSidebar.closest('aside'),
      };
    },
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(hits).toEqual({ centre: true, sidebar: false });
});
