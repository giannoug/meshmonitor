/**
 * Layout the unit tests can't see (follow-ups plan, #6365): the wide tables fit their
 * panel at 1280 px (boards 7-01, 8-15), the phone switcher draws one focus ring (D1), and the
 * Activity device button is a 44 px target (W4-e).
 */
import { expect, test, type Page } from '@playwright/test';
import { BOARDS } from './boards';
import { routeFixtures } from './fixtureRoutes';

const DESKTOP = { width: 1280, height: 800 };

/** Opens a board as boards.spec.ts does, at the given viewport. */
async function open(page: Page, id: string, viewport: { width: number; height: number }): Promise<void> {
  const board = BOARDS.find((b) => b.id === id);
  if (!board) throw new Error(`no board ${id}`);
  await page.setViewportSize(viewport);
  await routeFixtures(page, board.fixtures);
  await board.init?.(page);
  await page.goto(board.path);
  await page.waitForLoadState('networkidle');
  await board.setup?.(page);
}

/** The table's scroll box: its parent's visible and full widths. */
function fits(page: Page, table: string): Promise<{ client: number; scroll: number }> {
  return page.locator(table).evaluate((t) => ({ client: t.parentElement!.clientWidth, scroll: t.parentElement!.scrollWidth }));
}

test.use({ colorScheme: 'dark' });

test('7-01 receptions table fits its panel', async ({ page }) => {
  await open(page, '7-01-messages', DESKTOP);
  const { client, scroll } = await fits(page, 'aside table');
  expect(scroll).toBeLessThanOrEqual(client);
});

test('8-15 observers and nodes tables fit their column', async ({ page }) => {
  await open(page, '8-15-mqtt-region-feed', DESKTOP);
  await page.getByTestId('feed-observer').first().waitFor();
  // Observers, then the nodes from adverts: the overview's only two tables.
  await expect(page.locator('table')).toHaveCount(2);
  for (const table of ['table >> nth=0', 'table >> nth=1']) {
    const { client, scroll } = await fits(page, table);
    expect(scroll, table).toBeLessThanOrEqual(client);
  }
});

const PHONE = { width: 390, height: 844 };

test('phone switcher shows one focus ring, on the square', async ({ page }) => {
  await open(page, 'c-home-e1-home', PHONE);
  const button = page.locator('header[data-device] button').first();
  await button.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const rings = await button.evaluate((el) => ({
    focused: el === document.activeElement && el.matches(':focus-visible'),
    button: getComputedStyle(el).outlineStyle,
    square: getComputedStyle(el.querySelector('[class*=square]')!).outlineStyle,
  }));
  expect(rings).toEqual({ focused: true, button: 'none', square: 'solid' });
});

test('Activity device button is a 44 px target', async ({ page }) => {
  await open(page, 'c-home-e4-activity', PHONE);
  const button = page.locator('header button[aria-haspopup=dialog]').first();
  const box = (await button.boundingBox())!;
  const hits = await button.evaluate((el, b) => {
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    return [y - 21, y + 21].map((py) => document.elementFromPoint(x, py)?.closest('button') === el);
  }, box);
  expect(hits).toEqual([true, true]);
});
