/**
 * Boards screenshotted by `npm run test:workspace-e2e`. Each task that builds a
 * board adds its entry here (board protocol step BP6).
 */
import type { Page } from '@playwright/test';

export interface Board {
  id: string;
  size: 'phone' | 'desktop';
  path: string;
  /** Opens the sheet or menu the board shows, after the page has loaded. */
  setup?: (page: Page) => Promise<void>;
}

export const BOARDS: Board[] = [];
