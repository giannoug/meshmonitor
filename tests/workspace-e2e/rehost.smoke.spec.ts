/**
 * Re-hosted Classic pages (#6365, Task 1.5) render inside the Workspace shell
 * on the built app without page errors. Requests the Athens fixture does not
 * serve answer 404 and log one; those are not what this checks.
 */
import { expect, test } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';

for (const path of ['/source/src-g2/nodes', '/overview/reports']) {
  test(`re-hosted ${path} renders without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await routeFixtures(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-workspace-shell]')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(path);
    expect(errors.filter((e) => !/\b404\b|No fixture for/.test(e))).toEqual([]);
  });
}
