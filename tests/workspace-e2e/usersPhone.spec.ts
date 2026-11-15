/**
 * Task 4.8 fix round 1 (ruling DC): on a 390×844 phone, the q4 permissions
 * page is all phone targets — the chips, segments, View on Map toggles, the
 * install-wide rows and the Virtual Channel Permissions card (labels and
 * Save) — at least 44 px tall, its rows at least 52 px.
 */
import { expect, test, type Locator } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';
import { usersFixtures } from '../../src/workspace/__fixtures__/users';

test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

/** Visible buttons, selects, labels and non-checkbox inputs under `root` shorter than `min` px. */
async function shortTargets(root: Locator, min = 44): Promise<string[]> {
  return root.evaluate((el, m) => {
    const out: string[] = [];
    for (const c of el.querySelectorAll<HTMLElement>("button, select, label, input:not([type='checkbox']):not([type='hidden'])")) {
      const r = c.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < m - 0.5) out.push(`${c.tagName} "${(c.textContent ?? '').trim().slice(0, 30)}" ${r.height}`);
    }
    return out;
  }, min);
}

const heights = (rows: Locator) => rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));

test('q4: chips, segments, toggles, install-wide rows and the virtual channel card are phone targets', async ({ page }) => {
  await routeFixtures(page, usersFixtures);
  await page.goto('/overview/users');
  await page.getByRole('list', { name: 'Users' }).getByRole('button', { name: /^nikos\b/ }).click();
  await page.getByRole('dialog', { name: 'nikos' }).getByRole('button', { name: /^Permissions/ }).click();
  await page.getByRole('group', { name: 'Node Details & DM' }).waitFor();
  await page.getByRole('button', { name: /^Across this MeshMonitor/ }).click();
  await page.getByRole('group', { name: 'Security' }).waitFor();

  const card = page.getByRole('region', { name: 'Virtual Channel Permissions' });
  await card.getByRole('button', { name: 'Save Virtual Channel Permissions' }).waitFor();
  expect(await shortTargets(card)).toEqual([]);
  for (const h of await heights(card.getByRole('group'))) expect(h).toBeGreaterThanOrEqual(52);

  expect(await shortTargets(page.getByTestId('phone-permissions'))).toEqual([]);
});
