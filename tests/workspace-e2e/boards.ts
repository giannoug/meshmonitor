/**
 * Boards screenshotted by `npm run test:workspace-e2e`. Each task that builds a
 * board adds its entry here (board protocol step BP6).
 */
import type { Page } from '@playwright/test';
import { athensFixture } from '../../src/workspace/__fixtures__/athens';

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
  // The MQTT mirror, on a DM as the boards draw it (Task 2.4); the TX-disabled and guest states
  // need other fixtures and are checked in Vitest.
  { id: '10-05-read-only', size: 'desktop', path: '/source/src-mqtt/dm/!a1b2c301' },
  { id: '10-14-read-only', size: 'phone', path: '/source/src-mqtt/dm/!a1b2c301' },
  // Task 2.4: the DM, past "Message anyway", replying, with Purge data open (desktop) / the node actions sheet (phone).
  {
    id: '10-01-dm-conversation',
    size: 'desktop',
    path: '/source/src-g2/dm/!a1b2c301',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Message anyway' }).click();
      const theirs = page.locator('[data-message-id]', { hasText: 'Can you run a traceroute to me?' });
      await theirs.hover();
      await theirs.getByRole('button', { name: 'Reply' }).click();
      await page.getByTestId('dm-header').getByRole('button', { name: 'Data' }).click();
      await page.getByRole('button', { name: /^Purge Data/ }).click();
      const sheet = page.getByRole('dialog', { name: 'Purge Data for Kifisia Rooftop' });
      await sheet.getByRole('checkbox', { name: 'Purge All Messages' }).check();
      await sheet.getByRole('checkbox', { name: 'Purge Traceroutes' }).check();
    },
  },
  {
    id: '10-07-dm-conversation',
    size: 'phone',
    path: '/source/src-g2/dm/!a1b2c301',
    setup: async (page) => {
      await page.getByTestId('key-mismatch-warning').waitFor();
      await page.getByRole('button', { name: 'Node actions' }).click();
      await page.getByRole('dialog', { name: /Kifisia Rooftop/ }).getByRole('tab', { name: 'Ask the node' }).waitFor();
    },
  },
  // Task 2.5: message actions, details, translate and the emoji picker, on the Kifisia Rooftop DM.
  {
    id: '10-02-message-details',
    size: 'desktop',
    path: '/source/src-g2/dm/!a1b2c301',
    setup: async (page) => {
      await openDm(page);
      const ours = page.locator('[data-message-id]', { hasText: 'Running one now' });
      await ours.hover();
      await ours.getByRole('button', { name: 'More actions' }).click();
      await ours.getByRole('button', { name: /^Details/ }).click();
      await page.getByRole('complementary', { name: 'Delivery Details' }).getByText('Attempt 2').waitFor();
    },
  },
  {
    id: '10-08-message-actions',
    size: 'phone',
    path: '/source/src-g2/dm/!a1b2c301',
    setup: async (page) => {
      await openDm(page);
      await page.locator('[data-message-id]', { hasText: 'Running one now' }).click({ button: 'right' });
      await page.getByRole('dialog', { name: /^You · / }).waitFor();
    },
  },
  {
    id: '10-09-translate',
    size: 'phone',
    path: '/source/src-g2/dm/!a1b2c301',
    setup: async (page) => {
      await openDm(page);
      await page.locator('textarea').fill('Running one now, should be 2 hops via Halandri, then I will try the Hymettus relay at noon');
      await page.getByRole('button', { name: 'Translate', exact: true }).click();
      const sheet = page.getByRole('dialog', { name: 'Translate Outgoing Message' });
      await sheet.getByRole('button', { name: 'Translate', exact: true }).click();
      await sheet.getByText('LoRa Packet Payload Warning').waitFor();
    },
  },
  {
    id: '10-10-message-details',
    size: 'phone',
    path: '/source/src-g2/dm/!a1b2c301',
    setup: async (page) => {
      await openDm(page);
      await page.locator('[data-message-id]', { hasText: 'Running one now' }).click({ button: 'right' });
      await page.getByRole('dialog', { name: /^You · / }).getByRole('button', { name: /^Details/ }).click();
      await page.getByRole('dialog', { name: 'Delivery Details' }).getByText('Attempt 2').waitFor();
    },
  },
  {
    id: '18-05-emoji-picker',
    size: 'desktop',
    path: '/source/src-g2/dm/!a1b2c301',
    setup: async (page) => {
      await openDm(page);
      const theirs = page.locator('[data-message-id]', { hasText: 'Can you run a traceroute to me?' });
      await theirs.hover();
      await theirs.getByRole('button', { name: 'React', exact: true }).click();
      await page.getByRole('dialog', { name: 'React with an emoji' }).getByRole('button', { name: 'Custom emoji' }).click();
    },
  },
  {
    // The set saved in Appearance replaces the defaults: served for this shot, then the page reloads.
    id: '18-06-emoji-picker',
    size: 'phone',
    path: '/source/src-g2/dm/!a1b2c301',
    setup: async (page) => {
      const saved = [['👍', 'Thumbs up'], ['❤️', 'Heart'], ['😂', 'Laugh'], ['😮', 'Wow'], ['👋', 'Wave']].map(([emoji, title]) => ({ emoji, title }));
      await page.route((url) => url.pathname.endsWith('/api/settings'), (route) =>
        route.fulfill({ json: { ...athensFixture.settings, customTapbackEmojis: JSON.stringify(saved) } }),
      );
      await page.reload();
      await page.waitForLoadState('networkidle');
      await openDm(page);
      await page.locator('[data-message-id]', { hasText: 'Can you run a traceroute to me?' }).click({ button: 'right' });
      await page.getByRole('dialog', { name: /^Kifisia Rooftop · / }).getByRole('button', { name: /Custom/ }).click();
      await page.getByRole('dialog', { name: 'React with an emoji' }).getByRole('button', { name: 'Custom emoji' }).click();
    },
  },
];

/** Past the unmessageable banner, to the conversation. */
async function openDm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Message anyway' }).click();
  await page.getByText('Running one now').waitFor();
}
