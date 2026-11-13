/**
 * Review Focus 1 (Task 1.6): with sixteen devices and long names, the rail
 * scrolls on its own and nothing is wider than the viewport.
 */
import { expect, test } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';

const many = Array.from({ length: 16 }, (_, i) => ({
  id: `src-${i}`,
  name: `Very long device name number ${i} on the Lycabettus hill above Athens`,
  type: 'meshtastic_tcp',
  enabled: true,
}));

for (const width of [1280, 820]) {
  test(`16 devices at ${width} px: the rail scrolls, nothing overflows sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await routeFixtures(page, {
      'GET /api/sources': () => many,
      'GET /api/sources/:id/status': () => ({ connected: true }),
    });
    await page.goto(`/source/src-3/nodes`);
    await page.waitForLoadState('networkidle');
    const rail = page.getByRole('navigation', { name: 'Devices' });
    await expect(rail.getByRole('link', { name: /^Very long device name number 15/ })).toBeAttached();
    expect(await rail.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
    expect(await rail.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    const wide = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const out: string[] = [];
      for (const el of document.querySelectorAll('[data-workspace-shell] nav, [data-workspace-shell] aside, [data-workspace-shell] nav *, [data-workspace-shell] aside *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > vw + 0.5 || r.width > vw)) out.push(`${el.tagName}.${el.className}`);
      }
      return { out, scroll: document.documentElement.scrollWidth - vw };
    });
    expect(wide.out).toEqual([]);
    expect(wide.scroll).toBeLessThanOrEqual(0);
  });
}
