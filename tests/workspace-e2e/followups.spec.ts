/**
 * Layout the unit tests can't see (follow-ups plan, #6365): the wide tables fit their
 * panel at 1280 px (boards 7-01, 8-15), the phone switcher draws one focus ring (D1), and the
 * Activity device button is a 44 px target (W4-e).
 */
import { expect, test, type Page } from '@playwright/test';
import { BOARDS } from './boards';
import { routeFixtures } from './fixtureRoutes';

const DESKTOP = { width: 1280, height: 800 };

/** Opens a board as boards.spec.ts does, at the given viewport. `setup: false` skips the board's (English-text) setup. */
async function open(page: Page, id: string, viewport: { width: number; height: number }, { setup = true } = {}): Promise<void> {
  const board = BOARDS.find((b) => b.id === id);
  if (!board) throw new Error(`no board ${id}`);
  await page.setViewportSize(viewport);
  await routeFixtures(page, board.fixtures);
  await board.init?.(page);
  await page.goto(board.path);
  await page.waitForLoadState('networkidle');
  if (setup) await board.setup?.(page);
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

for (const language of ['en', 'pl', 'es']) test(`8-15 observers and nodes tables fit their column (${language})`, async ({ page }) => {
  // i18next reads the language from localStorage first (src/config/i18n.ts).
  await page.addInitScript((l) => localStorage.setItem('language', l), language);
  await open(page, '8-15-mqtt-region-feed', DESKTOP, { setup: language === 'en' });
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

/** The Activity page's own header (the shell's switcher header is hidden there), and its device button. */
function activityHeader(page: Page) {
  const header = page.locator('header', { has: page.getByRole('heading', { name: 'Activity', level: 1 }) });
  return { header, button: header.getByRole('button', { name: /Station G2/ }) };
}

test('Activity device button is a 44 px target', async ({ page }) => {
  await open(page, 'c-home-e4-activity', PHONE);
  const { button } = activityHeader(page);
  const box = (await button.boundingBox())!;
  // How many 1 px rows down the button's centre column hit it.
  const tall = await button.evaluate((el, b) => {
    let n = 0;
    for (let y = Math.floor(b.y) - 40; y <= b.y + b.height + 40; y++) {
      if (document.elementFromPoint(b.x + b.width / 2, y + 0.5)?.closest('button') === el) n++;
    }
    return n;
  }, box);
  expect(tall).toBeGreaterThanOrEqual(44);
});

test('the 44 px target stays inside the Activity header', async ({ page }) => {
  await open(page, 'c-home-e4-activity', PHONE);
  const { header, button } = activityHeader(page);
  const b = (await button.boundingBox())!;
  const h = (await header.boundingBox())!;
  const below = await button.evaluate((el, p) => document.elementFromPoint(p.x, p.y)?.closest('button') === el, { x: b.x + b.width / 2, y: h.y + h.height + 1 });
  expect(below).toBe(false);
});

// F3 in a real browser: jsdom treats :focus-visible as :focus, so only Chromium tells a keyboard delete from a mouse one.
const CHANNEL = '/source/src-g2/channel/0';
const DELETED = { 'DELETE /api/messages/:id': () => ({ message: 'Message deleted successfully' }) };

async function openChannel(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await routeFixtures(page, DELETED);
  await page.goto(CHANNEL);
  await page.locator('[data-row-target]').first().waitFor();
}

const focusedRowId = (page: Page) => page.evaluate(() => document.activeElement?.closest('[data-message-id]')?.getAttribute('data-message-id') ?? null);

test('a keyboard delete hands focus to the next message', async ({ page }) => {
  await openChannel(page);
  const rows = page.locator('[data-row-target]');
  const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-message-id')));
  const row = rows.nth(0);
  await row.focus();
  await page.keyboard.press('ArrowRight');
  const more = row.getByRole('button', { name: 'More actions' });
  const isFocused = (l: typeof more) => l.evaluate((el) => el === document.activeElement);
  for (let i = 0; i < 8 && !(await isFocused(more)); i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  // The ⋯ menu keeps focus on ⋯; its items follow it in Tab order.
  const del = row.getByRole('button', { name: /^Delete/ });
  await expect(del).toBeEnabled();
  for (let i = 0; i < 8 && !(await isFocused(del)); i++) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const confirm = page.getByRole('dialog', { name: 'Delete this message' }).getByRole('button', { name: 'Delete' });
  await expect(confirm).toBeEnabled();
  await confirm.press('Enter');
  await expect.poll(() => focusedRowId(page)).toBe(ids[1]);
});

test('a mouse delete moves no focus onto another message', async ({ page }) => {
  await openChannel(page);
  const row = page.locator('[data-row-target]').first();
  await row.hover();
  await row.getByRole('button', { name: 'More actions' }).click();
  const del = row.getByRole('button', { name: /^Delete/ });
  await expect(del).toBeEnabled();
  await del.click();
  const confirm = page.getByRole('dialog', { name: 'Delete this message' }).getByRole('button', { name: 'Delete' });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByRole('dialog', { name: 'Delete this message' })).toHaveCount(0);
  expect(await focusedRowId(page)).toBeNull();
});
