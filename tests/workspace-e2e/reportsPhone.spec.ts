/**
 * Task 4.4 fix round 1: on a 390×844 phone, the Reports controls Workspace
 * re-hosts are phone targets — Mesh Issues' filter sheet (today's FilterBar),
 * its finding rows and sheet, and Coverage's survey bar and panel (today's
 * survey bar and receivers list) — at least 44 px tall, rows at least 52 px.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { routeFixtures } from './fixtureRoutes';

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
