/**
 * Serve every `/api/*` request from the Athens fixture (no backend runs), and
 * refuse the socket.io connection so the app stays on its polling path.
 */
import type { Page } from '@playwright/test';
import { fixtureApi, type FixtureHandler } from '../../src/workspace/__fixtures__/fixtureApi';

export async function routeFixtures(
  page: Page,
  overrides?: Partial<Record<string, FixtureHandler>>,
): Promise<void> {
  const api = fixtureApi(overrides);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const res = api(request.url(), { method: request.method(), body: request.postData() ?? undefined });
    if (!res) {
      await route.fulfill({ status: 404, json: { error: `No fixture for ${request.method()} ${request.url()}` } });
      return;
    }
    await route.fulfill({
      status: res.status,
      headers: Object.fromEntries(res.headers),
      body: await res.text(),
    });
  });
  await page.route('**/socket.io/**', (route) => route.abort());
}
