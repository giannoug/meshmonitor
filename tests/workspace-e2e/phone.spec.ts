/**
 * Task 1.7: the phone shell fits a 360 px phone and an 844×390 landscape one
 * (the latter is the narrow desktop shell, D8) with no sideways scroll, with
 * the device switcher open too, and the tab bar shows on phone only.
 */
import { expect, test, type Page } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';

async function overflow(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of document.querySelectorAll('[data-workspace-shell] header, [data-workspace-shell] nav, [role="dialog"], [role="dialog"] *, [data-workspace-shell] nav *, [data-workspace-shell] header *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5)) out.push(`${el.tagName}.${el.className}`);
    }
    return { out, scroll: document.documentElement.scrollWidth - vw };
  });
}

for (const viewport of [{ width: 360, height: 740 }, { width: 844, height: 390 }]) {
  test(`${viewport.width}×${viewport.height}: nothing overflows sideways`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await routeFixtures(page, {
      // Long names: the header and the switcher rows truncate rather than widen the page.
      'GET /api/sources': () => [
        { id: 'src-g2', name: 'Station G2 on the very long Lycabettus hill road above Athens', type: 'meshtastic_tcp', enabled: true },
        { id: 'src-mqtt', name: 'Athens MQTT with an equally long and descriptive name', type: 'mqtt_broker', enabled: true },
      ],
    });
    await page.goto('/source/src-g2/channels');
    await page.waitForLoadState('networkidle');
    const phone = viewport.width < 768;
    await expect(page.getByRole('navigation', { name: 'Tabs' })).toHaveCount(phone ? 1 : 0);
    const closed = await overflow(page);
    expect(closed.out).toEqual([]);
    expect(closed.scroll).toBeLessThanOrEqual(0);
    if (phone) {
      await page.getByRole('button', { name: /switch device/ }).click();
      await expect(page.getByRole('dialog', { name: 'Devices' })).toBeVisible();
      const open = await overflow(page);
      expect(open.out).toEqual([]);
      expect(open.scroll).toBeLessThanOrEqual(0);
    }
  });
}
