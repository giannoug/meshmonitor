/**
 * Task 4.4 fix round 1: on a 390×844 phone, the Reports controls Workspace
 * re-hosts are phone targets — Mesh Issues' filter sheet (today's FilterBar),
 * its finding rows and sheet, and Coverage's survey bar and panel (today's
 * survey bar and receivers list) — at least 44 px tall, rows at least 52 px.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';
import * as R from '../../src/workspace/__fixtures__/reports';

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

async function presetMeshIssues(page: Page, view: object): Promise<void> {
  await page.evaluate((v) => {
    localStorage.setItem('meshIssues.viewState.v1', JSON.stringify({
      version: 1, view: 'byIssue', sortByType: {}, expandedNodes: [], expandedTypes: [],
      filters: { severities: [], tiers: [], issueTypes: [], sources: [], q: '', includeClosed: false, includeDismissed: true },
      ...v,
    }));
  }, view);
  await page.reload();
  await page.waitForLoadState('networkidle');
}

test('Mesh Issues: the filter sheet, finding rows and finding sheet are phone targets', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/overview/reports/mesh-issues');
  await presetMeshIssues(page, { expandedTypes: ['B1_router_cluster', 'C2_over_broadcasting'] });

  await page.getByRole('button', { name: /^Filters/ }).click();
  const filters = page.getByRole('dialog', { name: 'Filters' });
  await filters.getByText('Station G2').waitFor();
  expect(await shortTargets(filters)).toEqual([]);
  await filters.getByRole('button', { name: 'Close' }).click();

  const rows = page.getByRole('list', { name: 'B1 Router cluster' }).getByRole('listitem');
  for (const box of await rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
    expect(box).toBeGreaterThanOrEqual(52);
  }
  await rows.first().getByText('Cluster of 2').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Dismiss' }).waitFor();
  expect(await shortTargets(sheet)).toEqual([]);
});

test('Mesh Issues By node: toggles and Dismiss / Restore are phone targets, rows at least 52 px', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/overview/reports/mesh-issues');
  // Athens Rover, Piraeus Base (its finding dismissed, shown) and the Mesh-wide group, all open.
  await presetMeshIssues(page, { view: 'byNode', expandedNodes: [0xa1b2c302, 0xa1b2c304, 'mesh-wide'] });
  const view = page.getByTestId('mesh-by-node');
  await view.getByRole('button', { name: 'Restore' }).waitFor();
  await view.getByRole('button', { name: 'Dismiss' }).first().waitFor();
  expect(await shortTargets(view)).toEqual([]);
  // Group headers and finding headers: the first child of each group, and of each finding in a group's body.
  const rows = await view.evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>(':scope > div > div > div:first-child, :scope > div > div > div:nth-child(2) > div > div:first-child')]
      .map((r) => Math.round(r.getBoundingClientRect().height)),
  );
  expect(rows.length).toBeGreaterThanOrEqual(5);
  expect(rows.filter((h) => h < 52)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('Mesh Issues By node: rows stay at least 52 px for a viewer with no Dismiss (no canAct)', async ({ page }) => {
  await routeFixtures(page, {
    'GET /api/analysis/mesh-issues/status': () => new Response(JSON.stringify({ success: false, error: 'Forbidden', code: 'FORBIDDEN' }), {
      status: 403, headers: { 'content-type': 'application/json' },
    }),
  });
  await page.goto('/overview/reports/mesh-issues');
  await presetMeshIssues(page, { view: 'byNode', expandedNodes: [0xa1b2c302, 0xa1b2c304, 'mesh-wide'] });
  const view = page.getByTestId('mesh-by-node');
  await view.getByText('Piraeus Base').last().waitFor();
  await expect(view.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
  const rows = await view.evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>(':scope > div > div > div:first-child, :scope > div > div > div:nth-child(2) > div > div:first-child')]
      .map((r) => Math.round(r.getBoundingClientRect().height)),
  );
  expect(rows.length).toBeGreaterThanOrEqual(5);
  expect(rows.filter((h) => h < 52)).toEqual([]);
});

test('Coverage: the survey bar and the panel (receivers list open) are phone targets', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/overview/reports/coverage?report=coverage&sender=!a1b2c302');
  await page.waitForLoadState('networkidle');
  await page.getByText('Distance vs SNR (direct receptions)').waitFor();
  await page.getByRole('button', { name: 'All receivers' }).click();
  await page.getByRole('textbox', { name: 'Search receivers' }).waitFor();
  expect(await shortTargets(page.getByTestId('coverage-survey'))).toEqual([]);
  expect(await shortTargets(page.getByTestId('coverage-panel'))).toEqual([]);
});

/** Rounded heights of the elements matching `selector`. */
async function heights(page: Page, selector: string): Promise<number[]> {
  return page.locator(selector).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
}

async function noSidewaysScroll(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
}

test('Traceroute Explorer: pair rows, the filter sheet and the pair sheet are phone targets', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/overview/reports/traceroute-explorer');
  const rows = page.getByTestId('explorer-pair-item');
  await rows.first().waitFor();
  expect((await heights(page, '[data-testid="explorer-pair-item"]')).filter((h) => h < 52)).toEqual([]);
  expect(await shortTargets(page.getByTestId('report-frame'))).toEqual([]);
  await noSidewaysScroll(page);

  await page.getByRole('button', { name: 'Filters' }).click();
  const filters = page.getByRole('dialog', { name: 'Filters' });
  await filters.getByRole('button', { name: 'Answered' }).waitFor();
  expect(await shortTargets(filters)).toEqual([]);
  await filters.getByRole('button', { name: 'Close' }).click();

  await rows.first().getByRole('button').click();
  const sheet = page.getByRole('dialog', { name: 'Pair' });
  await sheet.getByRole('button', { name: 'Pair history' }).waitFor();
  expect(await shortTargets(sheet)).toEqual([]);
});

test('Solar: the header controls, cards and rows are phone targets; the sheets too', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/overview/reports/solar');
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await page.getByRole('button', { name: 'Run forecast' }).click();
  await page.getByText('Solar Forecast').waitFor();
  await page.getByRole('button', { name: /Glyfada Beach/ }).first().click();
  const daily = page.getByRole('button', { name: /Recent daily patterns/ });
  await daily.waitFor();
  expect(await shortTargets(page.getByTestId('report-frame'))).toEqual([]);
  expect(Math.round((await daily.boundingBox())!.height)).toBeGreaterThanOrEqual(52);
  const overridesRow = page.getByRole('button', { name: /Manual solar classification/ });
  expect(Math.round((await overridesRow.boundingBox())!.height)).toBeGreaterThanOrEqual(52);
  await noSidewaysScroll(page);

  await overridesRow.click();
  const overrides = page.getByRole('dialog', { name: 'Manual solar classification' });
  await overrides.getByRole('button', { name: 'Mark as solar' }).waitFor();
  expect(await shortTargets(overrides)).toEqual([]);
});

test('ok_to_mqtt: gateway rows, the filter sheet and the packet sheet are phone targets', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/overview/reports/mqtt-violations');
  await page.getByRole('button', { name: 'Filters' }).click();
  const filters = page.getByRole('dialog', { name: 'Filters' });
  await filters.getByRole('button', { name: '30 days' }).waitFor();
  expect(await shortTargets(filters)).toEqual([]);
  await filters.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Run report' }).click();
  await page.getByTestId('mqtt-gateway-item').first().waitFor();
  expect((await heights(page, '[data-testid="mqtt-gateway-item"]')).filter((h) => h < 52)).toEqual([]);
  expect(await shortTargets(page.getByTestId('report-frame'))).toEqual([]);
  await noSidewaysScroll(page);

  await page.getByTestId('mqtt-gateway-item').first().getByRole('button').click();
  const sheet = page.getByRole('dialog', { name: 'Athens MQTT gw' });
  await sheet.getByText('Nikos T-Echo').waitFor();
  expect(await shortTargets(sheet)).toEqual([]);
  expect((await sheet.locator('li').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))).filter((h) => h < 52)).toEqual([]);
});

test('NodeInfo Enrichment: the push card, Fix All, target rows and Fix are phone targets', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/overview/reports/nodeinfo-enrichment');
  await page.getByText('Marousi Mobile').waitFor();
  await page.getByRole('checkbox', { name: 'Also push to device NodeDB' }).check();
  expect(await shortTargets(page.getByTestId('report-frame'))).toEqual([]);
  const rows = await page.getByTestId('report-frame').locator('li').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(rows).toHaveLength(4);
  expect(rows.filter((h) => h < 52)).toEqual([]);
  await noSidewaysScroll(page);
});

test('ok_to_mqtt: the packet sheet pager is a phone target (fix round 1)', async ({ page }) => {
  // A drill total over one page (limit 100), so today's Previous / Next show.
  await routeFixtures(page, {
    'GET /api/analysis/mqtt-violations/packets': (url) => {
      const reply = R.mqttPacketsReply(url);
      return { ...reply, data: { ...reply.data, total: 250 } };
    },
  });
  await page.goto('/overview/reports/mqtt-violations');
  await page.getByRole('button', { name: 'Run report' }).click();
  await page.getByTestId('mqtt-gateway-item').first().getByRole('button').click();
  const sheet = page.getByRole('dialog', { name: /Athens MQTT gw/ });
  await sheet.getByRole('button', { name: 'Next' }).waitFor();
  await expect(sheet.getByText('Page 1 of 3')).toBeVisible();
  expect(await shortTargets(sheet)).toEqual([]);
});

test('Traceroute Explorer: Pair history over the pair sheet; Escape and Close shut only the history (Ruling CR)', async ({ page }) => {
  await routeFixtures(page);
  await page.goto('/overview/reports/traceroute-explorer');
  await page.getByTestId('explorer-pair-item').first().getByRole('button').click();
  const pair = page.getByRole('dialog', { name: 'Pair' });
  const history = page.getByRole('dialog', { name: /Traceroute History/i });

  await pair.getByRole('button', { name: 'Pair history' }).click();
  await expect(history).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(history).toHaveCount(0);
  await expect(pair).toBeVisible();

  await pair.getByRole('button', { name: 'Pair history' }).click();
  await expect(history).toBeVisible();
  await history.getByRole('button', { name: 'Close dialog' }).click();
  await expect(history).toHaveCount(0);
  await expect(pair).toBeVisible();
});
