import { existsSync } from 'node:fs';
import { chromium, defineConfig } from '@playwright/test';

// Use @playwright/test's own Chromium; fall back to the preinstalled one when
// its pinned revision is not downloaded (never `playwright install` here).
const executablePath = existsSync(chromium.executablePath()) ? undefined : '/opt/pw-browsers/chromium';
const PORT = 4179;

export default defineConfig({
  testDir: '.',
  outputDir: '../../test-results/workspace-e2e',
  reporter: 'list',
  fullyParallel: true,
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    cwd: '../..',
    reuseExistingServer: !process.env.CI,
  },
});
