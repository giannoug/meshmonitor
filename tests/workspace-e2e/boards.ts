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
  // Task 1.6 built the frame (rail + sidebar); Task 2.3 the channel list and the open channel.
  { id: 'a-chat-D-desktop', size: 'desktop', path: '/source/src-g2/channel/0' },
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
  // Task 1.8. The You sidebar of r2 is 6.1's; r4's Server sidebar and the rest of General are 6.4's.
  // r3-classic-banner is not here: the banner ships off (WORKSPACE_ENTRY_ENABLED), so its check is Vitest-only.
  { id: 'r2-you-layout', size: 'desktop', path: '/you/layout' },
  { id: 's3-layout', size: 'phone', path: '/you/layout' },
  { id: 'r4-server-general', size: 'desktop', path: '/server/general' },
  // Task 2.3: the channel thread, its menu and info, beacons, the read-only states.
  { id: '10-06-channel-thread', size: 'phone', path: '/source/src-g2/channel/0' },
  {
    // The board also draws Channel info beside the menu; built one at a time (D9c), the shot shows the menu.
    id: '10-03-channel-menu',
    size: 'desktop',
    path: '/source/src-g2/channel/0',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Channel options' }).click();
      await page.getByRole('menu', { name: 'Channel options' }).waitFor();
    },
  },
  {
    id: '10-12-channel-info',
    size: 'phone',
    path: '/source/src-g2/channel/0',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Channel options' }).click();
      await page.getByRole('dialog', { name: 'Channel Information' }).getByRole('button', { name: 'Purge' }).click();
      await page.getByRole('dialog', { name: 'Purge All Messages' }).waitFor();
    },
  },
  ...(['desktop', 'phone'] as const).map((size) => ({
    id: size === 'desktop' ? '10-04-beacons' : '10-13-beacons',
    size,
    path: '/source/src-g2/channel/0/beacons',
    setup: async (page: Page) => {
      await page.getByTestId('beacons-filter-all').click();
      await page.getByTestId(`beacon-offer-${0xa1b2c303}`).getByRole('button', { name: 'Join channel' }).click();
      const sheet = page.getByRole('dialog', { name: 'Join this channel?' });
      await sheet.getByText('in use by "gauntlet"').click();
      await sheet.getByRole('button', { name: 'Replace and join' }).waitFor();
    },
  })),
  // The MQTT mirror; the TX-disabled and guest states need other fixtures and are checked in Vitest.
  { id: '10-05-read-only', size: 'desktop', path: '/source/src-mqtt/channel/0' },
  { id: '10-14-read-only', size: 'phone', path: '/source/src-mqtt/channel/0' },
];
