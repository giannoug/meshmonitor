import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { BOARDS } from './boards';
import { routeFixtures } from './fixtureRoutes';

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
} as const;

const SHOTS = fileURLToPath(new URL('../../test-results/workspace-boards/', import.meta.url));

for (const board of BOARDS) {
  test.describe(board.id, () => {
    // The boards are drawn in Mocha, the dark default (Latte follows a light OS scheme).
    test.use({ viewport: VIEWPORTS[board.size], colorScheme: 'dark' });

    test(board.id, async ({ page }) => {
      await routeFixtures(page);
      await page.goto(board.path);
      await page.waitForLoadState('networkidle');
      await board.setup?.(page);
      await page.screenshot({ path: `${SHOTS}${board.id}.png` });
    });
  });
}

// Keeps an empty BOARDS list a passing run rather than "No tests found".
if (BOARDS.length === 0) test.skip('no boards yet', () => {});
