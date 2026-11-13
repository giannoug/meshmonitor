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

export const BOARDS: Board[] = [
  // Task 1.6 builds the frame (rail + sidebar); the chat pane is Phase 2's.
  { id: 'a-chat-D-desktop', size: 'desktop', path: '/source/src-g2/channels' },
  // Task 1.7: the phone frame (header, tab bar); the device home under it is Phase 2's.
  { id: 'a-chat-D-phone', size: 'phone', path: '/source/src-g2/channels' },
  {
    id: 'c-home-e2-switcher',
    size: 'phone',
    path: '/source/src-g2/channels',
    setup: async (page) => {
      await page.getByRole('button', { name: /switch device/ }).click();
      await page.getByRole('dialog', { name: 'Devices' }).getByText('Athens MQTT').waitFor();
    },
  },
  { id: 's1-you', size: 'phone', path: '/you' },
];
