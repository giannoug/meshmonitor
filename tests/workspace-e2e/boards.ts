/**
 * Boards screenshotted by `npm run test:workspace-e2e`. Each task that builds a
 * board adds its entry here (board protocol step BP6).
 */
import type { Page } from '@playwright/test';
import { athensFixture } from '../../src/workspace/__fixtures__/athens';
import { renumberedFixtures } from '../../src/workspace/node-page/__tests__/nodePageFixtures';
import { captureOn } from '../../src/workspace/__fixtures__/packets';
import { usersFixtures } from '../../src/workspace/__fixtures__/users';
import type { FixtureHandler } from '../../src/workspace/__fixtures__/fixtureApi';
import { deviceConfigFixtures } from '../../src/workspace/__fixtures__/deviceConfig';
import { g2deviceConfigWith } from '../../src/workspace/settings/__tests__/radioFixtures';
import { boardChannels, g2On282, pollWith } from '../../src/workspace/settings/__tests__/categoryFixtures';
import { flashFailed, maintenanceFixtures, reloadFixtures } from '../../src/workspace/settings/__tests__/maintenanceFixtures';
import { bridgeFixtures, meshmonitorFixtures } from '../../src/workspace/settings/__tests__/meshmonitorFixtures';

export interface Board {
  id: string;
  size: 'phone' | 'desktop';
  path: string;
  /** Opens the sheet or menu the board shows, after the page has loaded. */
  setup?: (page: Page) => Promise<void>;
  /** Fixture overrides for this board (`routeFixtures`). */
  fixtures?: Partial<Record<string, FixtureHandler>>;
}

const PINS: Board['fixtures'] = {
  ...deviceConfigFixtures,
  'GET /api/user/preferences': () => ({
    success: true,
    data: { preferences: { ...athensFixture.userPreferences, 'settings.pins': ['modules/mqtt', 'modules/storeforward'] } },
  }),
};

/** Task 5.5: Station G2's three channels as the boards draw them. */
const CHANNELS: Board['fixtures'] = {
  ...PINS,
  ...pollWith(boardChannels),
  'POST /api/channels/encode-url': () => ({ url: 'https://meshtastic.org/e/#CgcSAQE6AggNEg8IATgDQANIAVAeaAHABgE' }),
  'POST /api/channels/decode-url': () => ({
    channels: [
      { name: 'LongFast', psk: 'AQ==', positionPrecision: 13, uplinkEnabled: true, downlinkEnabled: false },
      { name: 'Coast', psk: 'b3JkZXJzLXN0cmluZy05UT0=', positionPrecision: 15, uplinkEnabled: false, downlinkEnabled: true },
    ],
    loraConfig: { region: 3, modemPreset: 0, hopLimit: 3 },
  }),
  // The import never answers, so the page stays on its first step for the screenshot.
  'POST /api/channels/import-config': () => new Promise(() => {}),
};

/** Station G2 after the 2.8.2 update, with two admin keys (12-04). */
const SECURITY: Board['fixtures'] = {
  ...PINS,
  ...g2On282,
  'GET /api/device/security-keys': () => ({ publicKey: 'Kq7xF2bW9mQpublicpublicpublicpublicpublic0=', privateKey: 'cHJpdmF0ZXByaXZhdGVwcml2YXRlcHJpdmF0ZTAxMjM=' }),
};

/** Task 5.7: Station G2's backups, releases (OTA on) and a reload that finds three changes. */
const MAINTENANCE = (): Board['fixtures'] => ({ ...PINS, ...maintenanceFixtures, ...reloadFixtures() });

/** Task 5.8: Station G2's MeshMonitor settings and notification preferences. */
/** A fresh server per board, as MAINTENANCE() is: one board's saves never reach another. */
const MESHMONITOR = (): Board['fixtures'] => ({ ...PINS, ...meshmonitorFixtures() });

/** This browser is subscribed for Station G2 and Heltec MeshCore (s2). */
const PUSH_HERE: Board['fixtures'] = {
  'POST /api/push/subscription-status': (_url, init) => ({
    subscribed: [athensFixture.sources[0].id, athensFixture.sources[1].id].includes(JSON.parse(String(init?.body)).sourceId),
    otherSources: 1,
  }),
};

/** Two bridge edits, so the dock shows "2 changes · Save bridge settings" (12-13 / 12-24). */
async function editBridge(page: Page) {
  await page.getByLabel('Username').fill('athens-ops');
  await page.getByLabel('Upstream URL').fill('mqtts://mqtt.athensmesh.gr:8884');
  await page.getByRole('region', { name: 'Unsaved bridge settings' }).waitFor();
}

/** Push in this browser, granted and subscribed, before the page's scripts run (s2). */
async function pushInThisBrowser(page: Page) {
  await page.addInitScript(() => {
    const subscription = { endpoint: 'https://push.example/abc', getKey: () => new ArrayBuffer(3), unsubscribe: async () => true };
    const pushManager = { getSubscription: async () => subscription, subscribe: async () => subscription };
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'granted', requestPermission: async () => 'granted' } });
    Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager }), register: async () => ({}), addEventListener: () => {} } });
  });
  await page.reload();
  await page.getByText('DMs only').first().waitFor();
}

async function reloadFromRadio(page: Page) {
  await page.getByRole('button', { name: 'Reload Config' }).click();
  await page.getByText('3 change(s) detected', { exact: true }).waitFor();
}

async function openRestore(page: Page) {
  await page.getByRole('listitem').filter({ hasText: 'g2-1111.yaml' }).getByRole('button', { name: 'Restore' }).click();
  await page.getByRole('dialog', { name: 'Restore this backup?' }).waitFor();
}

async function openPurge(page: Page) {
  await page.getByRole('button', { name: 'Purge Node Database' }).click();
  await page.getByRole('dialog', { name: 'Purge the node database?' }).waitFor();
}

/** Station G2 holding Medium Fast, so a Long Fast edit reads as on b-set-d1 / d3 / p2. */
const MEDIUM_FAST: Board['fixtures'] = { ...PINS, ...g2deviceConfigWith({ modemPreset: 4 }) };

export const BOARDS: Board[] = [
  // Task 1.6 built the frame (rail + sidebar); Task 2.3 the channel list and the open channel.
  { id: 'a-chat-D-desktop', size: 'desktop', path: '/source/src-g2/channel/0' },
  // Task 1.7 built the phone frame (header, tab bar); Task 2.6 the device Home under it.
  { id: 'a-chat-D-phone', size: 'phone', path: '/source/src-g2' },
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
  // Task 2.6: the phone device Home, the DM inbox, and message search.
  { id: 'c-home-e1-home', size: 'phone', path: '/source/src-g2' },
  { id: 'c-home-e3-dms', size: 'phone', path: '/source/src-g2/dms' },
  {
    // Today's filter is a select (DmFilterSelect); the shot shows the inbox with it, not an open sheet.
    id: '10-11-dm-inbox',
    size: 'phone',
    path: '/source/src-g2/dms',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Pin to top of list: Kifisia Rooftop' }).click();
    },
  },
  {
    id: '10-15-search-messages',
    size: 'desktop',
    path: '/source/src-g2/channel/0',
    setup: async (page) => {
      // The board draws the Mac hint; the sidebar reads the platform again when search opens.
      await page.evaluate(() => Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' }));
      await page.getByRole('complementary', { name: 'Station G2' }).getByRole('link', { name: /LongFast/ }).waitFor();
      await page.getByRole('button', { name: /^Search Messages/ }).click();
      await searchRelay(page);
    },
  },
  {
    id: '10-16-search-messages',
    size: 'phone',
    path: '/source/src-g2',
    setup: async (page) => {
      await page.getByRole('link', { name: /Athens Rover/ }).waitFor();
      await page.getByRole('button', { name: /Search Messages/ }).click();
      await searchRelay(page);
    },
  },
  // Task 2.8: Activity (phone tab, empty, and the desktop bell's panel).
  { id: 'c-home-e4-activity', size: 'phone', path: '/source/src-g2/activity' },
  { id: 'c-home-e5-activity-empty', size: 'phone', path: '/source/src-rak/activity' },
  {
    id: 'c-home-e6-desktop-activity',
    size: 'desktop',
    path: '/source/src-g2/channel/0',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Activity, 3 unread' }).click();
      await page.getByRole('dialog', { name: /Activity/ }).getByText(/replied in #LongFast/).waitFor();
    },
  },
  // Task 3.1: the device map, its node peek, the Layers drawer and the neighbour link peek.
  {
    id: 'Main',
    size: 'desktop',
    path: '/source/src-g2/map',
    setup: async (page) => {
      await page.getByRole('list', { name: 'On the map' }).getByRole('button', { name: /Kifisia Rooftop/ }).click();
      await page.getByRole('complementary', { name: 'Kifisia Rooftop' }).waitFor();
    },
  },
  {
    id: 'f2-layers',
    size: 'desktop',
    path: '/source/src-g2/map',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Layers' }).click();
      await page.getByTestId('layers-drawer').getByText('Ducting').waitFor();
    },
  },
  {
    // The board also draws a one-way link's hover card; built one at a time (D9c), the shot shows the peek.
    id: '15-09-neighbour-peek',
    size: 'desktop',
    path: '/source/src-g2/map',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Layers' }).click();
      await page.getByRole('switch', { name: 'Show Neighbor Info' }).click();
      await page.getByTestId('layers-drawer').getByRole('button', { name: 'Close' }).click();
      await page.getByRole('button', { name: 'Hide the node list' }).click();
      await page.locator('path.neighbor-line').first().click({ force: true });
      await page.getByRole('complementary', { name: 'Neighbour link' }).waitFor();
    },
  },
  // Task 3.2: the phone map, its peek sheet, the Layers sheet and the neighbour link sheet.
  {
    id: 'g1-map',
    size: 'phone',
    path: '/source/src-g2/map',
    setup: async (page) => {
      // The board's state: Show Traceroute off (today it defaults on, with its mode banner).
      await page.getByRole('button', { name: 'Turn off Show Traceroute' }).click();
      await page.getByRole('button', { name: 'Node list' }).click();
      await page.getByRole('list', { name: 'On the map' }).getByRole('button', { name: /Kifisia Rooftop/ }).click();
      await page.getByRole('dialog', { name: 'Kifisia Rooftop' }).getByText('Swipe up for the node page').waitFor();
      // The centring fly-to runs up to ZOOM_ANIMATION_DURATION_MAX_SECONDS (2 s), then the tiles load.
      await page.waitForTimeout(2500);
    },
  },
  {
    id: 'g2-layers',
    size: 'phone',
    path: '/source/src-g2/map',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Layers' }).click();
      await page.getByRole('dialog', { name: 'Layers' }).getByText('Ducting').waitFor();
    },
  },
  {
    // As 15-09: the board's one-way hover card is built apart (D9c); the shot shows the peek.
    id: '15-21-neighbour-peek',
    size: 'phone',
    path: '/source/src-g2/map',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Layers' }).click();
      const sheet = page.getByRole('dialog', { name: 'Layers' });
      await sheet.getByRole('switch', { name: 'Show Neighbor Info' }).click();
      await sheet.getByRole('button', { name: 'Close' }).click();
      // The link runs past the phone viewport, so a pointer click cannot land on it: send the DOM click to
      // its hit line (the invisible companion after it, NEIGHBOR_LINK_HIT_WEIGHT), which Leaflet handles.
      await page.locator('path.neighbor-line + path').first().dispatchEvent('click');
      await page.getByRole('dialog', { name: /Neighbour link/ }).waitFor();
    },
  },
  // Task 3.3: Nodes, its Columns picker, the filters (desktop panel, phone sheet) and Add node from URL.
  {
    id: 'f3-nodes',
    size: 'desktop',
    path: '/source/src-g2/nodes',
    setup: async (page) => {
      await page.getByRole('button', { name: /Columns/ }).click();
      await page.getByText('Columns · drag to reorder').waitFor();
    },
  },
  { id: 'g3-nodes', size: 'phone', path: '/source/src-g2/nodes' },
  {
    id: '15-10-more-filters',
    size: 'desktop',
    path: '/source/src-g2/nodes',
    setup: async (page) => {
      await page.getByRole('button', { name: /More filters/ }).click();
      await page.getByRole('dialog', { name: /More filters/ }).getByText('Device Role').waitFor();
    },
  },
  {
    id: '15-14-filters',
    size: 'phone',
    path: '/source/src-g2/nodes',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Filters' }).click();
      await page.getByRole('dialog', { name: /Filters/ }).getByText('Device Role').waitFor();
    },
  },
  {
    id: '15-15-add-from-url',
    size: 'phone',
    path: '/source/src-g2/nodes',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Add node from URL' }).click();
      const dialog = page.getByRole('dialog', { name: 'Add node from URL' });
      await dialog.getByRole('textbox').fill('https://meshtastic.org/v/#CgcI5o2q7gUSDkx5Y2FiZXR0dXMgSGlrZXIaBExZQ0gi');
    },
  },
  // Task 3.4: the node page. Kifisia Rooftop, and Athens Rover (a tracked asset) for Position.
  { id: 'f4-node', size: 'desktop', path: '/source/src-g2/node/!a1b2c301', setup: (page) => nodeHeading(page, 'Kifisia Rooftop') },
  {
    id: 'f5-telemetry',
    size: 'desktop',
    path: '/source/src-g2/node/!a1b2c301/telemetry',
    setup: async (page) => {
      await page.getByText(/Battery Level/).first().waitFor();
    },
  },
  { id: 'g4-node', size: 'phone', path: '/source/src-g2/node/!a1b2c301', setup: (page) => nodeHeading(page, 'Kifisia Rooftop') },
  {
    id: 'g5-links',
    size: 'phone',
    path: '/source/src-g2/node/!a1b2c301/links',
    setup: async (page) => {
      await page.getByText(/Last traced/).waitFor();
    },
  },
  {
    id: '15-02-position',
    size: 'desktop',
    path: '/source/src-g2/node/!a1b2c302/position',
    setup: async (page) => {
      await page.getByTestId('asset-playback-bar').waitFor();
    },
  },
  {
    id: '15-03-admin',
    size: 'desktop',
    path: '/source/src-g2/node/!a1b2c301/admin',
    setup: async (page) => {
      await showRenumbering(page);
      await page.getByRole('button', { name: 'Create QR code' }).click();
      await page.getByRole('button', { name: /Copy URL/ }).waitFor();
    },
  },
  {
    id: '15-04-traceroute-history',
    size: 'desktop',
    path: '/source/src-g2/node/!a1b2c301/links',
    setup: async (page) => {
      await page.getByText(/Showing 4 traceroute/).waitFor();
    },
  },
  {
    // The phone boards draw the header collapsed to one bar, as after a scroll.
    id: '15-12-position',
    size: 'phone',
    path: '/source/src-g2/node/!a1b2c302/position',
    setup: async (page) => {
      await page.getByTestId('asset-playback-bar').waitFor();
      await collapseNodeHeader(page);
    },
  },
  {
    id: '15-16-admin',
    size: 'phone',
    path: '/source/src-g2/node/!a1b2c301/admin',
    setup: async (page) => {
      await showRenumbering(page);
      await page.getByRole('button', { name: 'Create QR code' }).click();
      await page.getByRole('button', { name: /Copy URL/ }).waitFor();
      await collapseNodeHeader(page);
    },
  },
  {
    id: '15-17-traceroute-history',
    size: 'phone',
    path: '/source/src-g2/node/!a1b2c301/links',
    setup: async (page) => {
      await page.getByText(/Showing 4 traceroute/).waitFor();
      await collapseNodeHeader(page);
    },
  },
  // Task 3.5: the node menus and dialogs. Boards that draw several menus or dialogs at once are built one
  // at a time (D9c): each shot shows one, and Vitest checks the rest.
  {
    // 15-01 draws the three menus open; the shot shows Data, with its "Who can use these" card.
    id: '15-01-node-menus',
    size: 'desktop',
    path: '/source/src-g2/node/!a1b2c301',
    setup: async (page) => {
      await nodeHeading(page, 'Kifisia Rooftop');
      await page.getByRole('button', { name: 'Data', exact: true }).click();
      await page.getByRole('note', { name: 'Who can use these' }).waitFor();
    },
  },
  {
    // 15-05 draws four dialogs; the shot shows Copy NodeInfo.
    id: '15-05-node-dialogs',
    size: 'desktop',
    path: '/source/src-g2/node/!a1b2c301',
    setup: async (page) => {
      await nodeHeading(page, 'Kifisia Rooftop');
      await page.getByRole('button', { name: 'Data', exact: true }).click();
      await page.getByRole('button', { name: /^Copy NodeInfo/ }).click();
      await page.getByRole('dialog', { name: 'Copy NodeInfo' }).getByText('Incoming').waitFor();
    },
  },
  {
    id: '15-06-identity-merge',
    size: 'desktop',
    path: '/source/src-g2/node/!a1b2c301/admin',
    setup: async (page) => {
      await showRenumbering(page);
      await page.getByRole('button', { name: /Merge history…/ }).click();
      await page.getByRole('dialog', { name: 'Merge node history' }).getByText('Rows moved:').waitFor();
    },
  },
  { id: '15-11-node-menus', size: 'phone', path: '/source/src-g2/node/!a1b2c301', setup: (page) => openNodeTile(page, 'Organise') },
  {
    id: '15-18-node-dialogs',
    size: 'phone',
    path: '/source/src-g2/node/!a1b2c301',
    setup: async (page) => {
      await openNodeTile(page, 'Data');
      await page.getByRole('button', { name: /^Purge Data/ }).click();
      const sheet = page.getByRole('dialog', { name: 'Purge Data for Kifisia Rooftop' });
      await sheet.getByRole('checkbox', { name: 'Purge All Messages' }).check();
      await sheet.getByRole('checkbox', { name: 'Purge Traceroutes' }).check();
    },
  },
  {
    id: '15-19-identity-merge',
    size: 'phone',
    path: '/source/src-g2/node/!a1b2c301',
    setup: async (page) => {
      await serveRenumbering(page);
      await openNodeTile(page, 'Data');
      await page.getByRole('button', { name: /^Merge history…/ }).click();
      await page.getByRole('dialog', { name: 'Merge node history' }).getByText('Rows moved:').waitFor();
    },
  },
  { id: '15-22-data-menu', size: 'phone', path: '/source/src-g2/node/!a1b2c301', setup: (page) => openNodeTile(page, 'Data') },
  {
    id: '15-25-request-telemetry',
    size: 'phone',
    path: '/source/src-g2/node/!a1b2c301',
    setup: async (page) => {
      await openNodeTile(page, 'Ask the node');
      await page.getByRole('button', { name: /^Request Telemetry/ }).click();
      await page.getByRole('dialog', { name: 'Request Telemetry' }).waitFor();
    },
  },
  // Task 3.6: map editing. Boards drawing several things at once are built one at a time (D9c).
  {
    id: '15-07-waypoint-editor',
    size: 'desktop',
    path: '/source/src-g2/map',
    setup: async (page) => {
      await openMapMenu(page, 'Add waypoint here');
      const sheet = page.getByRole('dialog', { name: 'New waypoint' });
      await sheet.getByLabel('Name (≤29 bytes)').fill('Trailhead');
      await sheet.getByLabel(/^Rebroadcast every/).fill('30');
      await sheet.getByRole('combobox', { name: 'Shape' }).selectOption('circle');
    },
  },
  {
    // 15-08 also draws the marker form and the delete confirm; the shot shows the menu.
    id: '15-08-map-menu',
    size: 'desktop',
    path: '/source/src-g2/map',
    setup: (page) => openMapMenu(page),
  },
  {
    id: '15-13-waypoint-editor',
    size: 'phone',
    path: '/source/src-g2/map',
    setup: async (page) => {
      await openMapMenu(page, 'Add waypoint here');
      await page.getByRole('dialog', { name: 'New waypoint' }).getByLabel(/^Rebroadcast every/).fill('30');
    },
  },
  { id: '15-20-long-press-menu', size: 'phone', path: '/source/src-g2/map', setup: (page) => openMapMenu(page) },
  {
    id: '15-23-delete-waypoint',
    size: 'phone',
    path: '/source/src-g2/map',
    setup: async (page) => {
      await openTrailhead(page, 'Delete…');
      await page.getByRole('dialog', { name: 'Delete waypoint “Trailhead”?' }).waitFor();
    },
  },
  {
    id: '15-24-geofence',
    size: 'phone',
    path: '/source/src-g2/map',
    setup: async (page) => {
      await openTrailhead(page, 'Edit');
      await page.getByRole('dialog', { name: 'Edit waypoint' }).getByRole('button', { name: /^Geofence/ }).click();
      await page.getByRole('dialog', { name: 'Geofence' }).getByRole('button', { name: 'Done' }).waitFor();
    },
  },
  {
    id: '15-26-local-marker',
    size: 'phone',
    path: '/source/src-g2/map',
    setup: async (page) => {
      await openMapMenu(page, 'Add local marker here');
      await page.getByRole('dialog', { name: 'New local marker' }).getByLabel('Label').fill('Site B');
    },
  },
  // Task 4.1: the Overview. Task 4.3 adds 5-08's Analysis frame (Tools, Time, Layers, the chips, the inspect hint).
  { id: 'f6-overview', size: 'desktop', path: '/overview/map' },
  { id: '5-07-overview-home', size: 'phone', path: '/overview' },
  {
    id: '5-08-overview-map',
    size: 'phone',
    path: '/overview/map',
    setup: (page) => presetAnalysis(page, { traceroutes: ON_24H, neighbors: ON_24H }),
  },
  // Task 4.2: Analysis on the Overview map (desktop). Today's Map Analysis config is preset as a returning user has it.
  {
    id: '5-01-overview-analysis',
    size: 'desktop',
    path: '/overview/map',
    setup: async (page) => {
      await presetAnalysis(page, { traceroutes: ON_24H, neighbors: ON_24H, hopShading: { enabled: true, lookbackHours: null } });
      await page.locator('.leaflet-marker-icon', { hasText: 'KFR' }).dispatchEvent('click');
      await page.getByTestId('analysis-inspector').getByText('Traceroute Links').waitFor();
    },
  },
  {
    id: '5-02-layers-analysis',
    size: 'desktop',
    path: '/overview/analysis',
    setup: async (page) => {
      await presetAnalysis(page, { traceroutes: ON_24H, neighbors: ON_24H });
      const drawer = page.getByTestId('layers-drawer');
      await drawer.getByRole('button', { name: /^Traceroute filters/ }).click();
      await drawer.getByText('Min occurrences').waitFor();
    },
  },
  {
    id: '5-03-time-trails',
    size: 'desktop',
    path: '/overview/map',
    setup: async (page) => {
      await presetAnalysis(page, { trails: { enabled: true, lookbackHours: 6 } }, { timeSlider: { enabled: true } });
      await page.locator('.leaflet-trails-pane path.leaflet-interactive').first().dispatchEvent('click');
      await page.getByTestId('analysis-inspector').getByText('Position Trail').waitFor();
    },
  },
  {
    // 5-04 draws the Tools menu over the open Link Profile drawer.
    id: '5-04-link-profile',
    size: 'desktop',
    path: '/overview/map',
    setup: async (page) => {
      await openTools(page, 'Link Profile');
      const drawer = page.getByTestId('link-profile-drawer');
      await drawer.waitFor();
      // A and B: two clicks on the map, clear of the legend and the drawer; the fixture serves the terrain.
      const map = page.locator('.leaflet-container');
      const box = (await map.boundingBox())!;
      await map.click({ position: { x: box.width * 0.45, y: box.height * 0.3 } });
      await map.click({ position: { x: box.width * 0.75, y: box.height * 0.45 } });
      await drawer.getByText('Margin', { exact: true }).waitFor();
      await openTools(page);
    },
  },
  {
    id: '5-05-site-planner',
    size: 'desktop',
    path: '/overview/map',
    setup: async (page) => {
      await page.route((url) => url.pathname.endsWith('/api/sources/src-g2/markers'), (route) =>
        route.fulfill({ json: { success: true, data: [CANDIDATE_SITE] } }),
      );
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.locator('.leaflet-localMarkers-pane .leaflet-marker-icon').dispatchEvent('click');
      await page.getByText('Candidate site').waitFor();
      await page.getByRole('button', { name: /^Layers/ }).click();
      await page.getByTestId('layers-drawer').getByRole('switch', { name: 'GNSS DOP' }).click();
      await page.getByRole('button', { name: /^Layers/ }).click();
      await openTools(page, 'Site Planner');
      await page.getByText('Predict coverage').waitFor();
    },
  },
  {
    id: '5-06-route-segment',
    size: 'desktop',
    path: '/overview/map',
    setup: async (page) => {
      await presetAnalysis(page, { traceroutes: ON_24H });
      // A node first, so its segments carry a direction.
      await page.locator('.leaflet-marker-icon', { hasText: 'KFR' }).dispatchEvent('click');
      await page.getByTestId('analysis-inspector').getByText('Traceroute Links').waitFor();
      await page.locator('.leaflet-paths-pane path.leaflet-interactive').first().dispatchEvent('click');
      await page.getByTestId('analysis-inspector').getByText('Route Segment').waitFor();
      await page.getByTestId('analysis-inspector').getByText(/^\d+ m$/).first().waitFor();
    },
  },
  // Task 4.3: Analysis on the phone. The Tools and Layers sheets, the docked inspector, Link Profile and Site Planner / GNSS DOP.
  {
    // 5-09 draws Link Profile chosen: picked, then the sheet opened again over its drawer.
    id: '5-09-tools-time',
    size: 'phone',
    path: '/overview/map',
    setup: async (page) => {
      await presetAnalysis(page, {}, { timeSlider: { enabled: true } });
      await openPhoneSheet(page, 'Tools');
      await page.getByRole('dialog', { name: 'Tools' }).getByRole('radio', { name: 'Link Profile' }).click();
      await page.getByTestId('link-profile-drawer').waitFor();
      await openPhoneSheet(page, 'Time');
    },
  },
  {
    id: '5-10-inspector-sheet',
    size: 'phone',
    path: '/overview/map',
    setup: async (page) => {
      await presetAnalysis(page, { neighbors: ON_24H });
      await page.locator('.leaflet-neighbors-pane path.leaflet-interactive').first().dispatchEvent('click');
      await page.getByTestId('analysis-inspector').getByText('View terrain profile').waitFor();
    },
  },
  {
    id: '5-11-link-profile-sheet',
    size: 'phone',
    path: '/overview/map',
    setup: async (page) => {
      await openPhoneSheet(page, 'Tools');
      await page.getByRole('dialog', { name: 'Tools' }).getByRole('radio', { name: 'Link Profile' }).click();
      const drawer = page.getByTestId('link-profile-drawer');
      await drawer.waitFor();
      // A and B: two taps on the map above the sheet; the fixture serves the terrain.
      const map = page.locator('.leaflet-container');
      const box = (await map.boundingBox())!;
      await map.click({ position: { x: box.width * 0.3, y: box.height * 0.15 } });
      await map.click({ position: { x: box.width * 0.7, y: box.height * 0.3 } });
      await drawer.getByText('Margin', { exact: true }).waitFor();
    },
  },
  {
    id: '5-12-layers-sheet',
    size: 'phone',
    path: '/overview/map',
    setup: async (page) => {
      await presetAnalysis(page, { traceroutes: ON_24H, neighbors: ON_24H });
      await openPhoneSheet(page, 'Layers');
    },
  },
  {
    id: '5-13-planner-dop-sheet',
    size: 'phone',
    path: '/overview/map',
    setup: async (page) => {
      await openPhoneSheet(page, 'Layers');
      const layers = page.getByRole('dialog', { name: 'Layers' });
      await layers.getByRole('switch', { name: 'GNSS DOP' }).click();
      await layers.getByRole('button', { name: 'Close' }).click();
      await openPhoneSheet(page, 'Tools');
      await page.getByRole('dialog', { name: 'Tools' }).getByRole('radio', { name: 'Site Planner' }).click();
      await page.getByText('Predict coverage').waitFor();
      await page.getByText('GNSS DOP overlay').waitFor();
    },
  },
  // Task 4.4: Overview › Reports — the list, Mesh Issues (today's parts, sections preset open), Coverage.
  { id: '6-01-reports-list', size: 'desktop', path: '/overview/reports' },
  { id: '6-08-reports-list', size: 'phone', path: '/overview/reports' },
  {
    id: '6-02-mesh-issues',
    size: 'desktop',
    path: '/overview/reports/mesh-issues',
    setup: async (page) => {
      await presetMeshIssues(page, ['B1_router_cluster', 'B3_asymmetric_link', 'C2_over_broadcasting'], { includeDismissed: true });
      await showClusterDetails(page);
    },
  },
  {
    // The router cluster's finding sheet over the list, its map shown, as the board draws it.
    id: '6-09-mesh-issues',
    size: 'phone',
    path: '/overview/reports/mesh-issues',
    setup: async (page) => {
      await presetMeshIssues(page, ['B1_router_cluster'], {});
      await page.getByRole('list', { name: 'B1 Router cluster' }).getByText('Cluster of 2').click();
      const sheet = page.getByRole('dialog');
      await sheet.getByRole('button', { name: 'Show map' }).click();
      await sheet.locator('.leaflet-container').waitFor();
    },
  },
  {
    id: '6-15-mesh-issues-filters',
    size: 'phone',
    path: '/overview/reports/mesh-issues',
    setup: async (page) => {
      await presetMeshIssues(page, [], { includeDismissed: true, tiers: ['B'] });
      await page.getByRole('button', { name: 'Filters · 2' }).click();
      await page.getByRole('dialog', { name: 'Filters' }).getByText('Station G2').waitFor();
    },
  },
  {
    // The linked live survey (Kifisia walk) applied, the receivers list open as the board draws it.
    id: '6-03-coverage',
    size: 'desktop',
    path: '/overview/reports/coverage?report=coverage&sender=!a1b2c302&survey=6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Stop survey' }).waitFor();
      await page.getByText('Distance vs SNR (direct receptions)').waitFor();
      await page.getByRole('button', { name: 'All receivers' }).click();
      await page.getByRole('textbox', { name: 'Search receivers' }).waitFor();
    },
  },
  {
    id: '6-10-coverage',
    size: 'phone',
    path: '/overview/reports/coverage?report=coverage&sender=!a1b2c302',
    setup: async (page) => {
      await page.getByText('Distance vs SNR (direct receptions)').waitFor();
    },
  },
  // Task 4.5: Traceroute Explorer, Solar, ok_to_mqtt and NodeInfo Enrichment.
  {
    id: '6-04-traceroute-explorer',
    size: 'desktop',
    path: '/overview/reports/traceroute-explorer',
    setup: async (page) => {
      // Station G2 → Kifisia Rooftop: open the pair and select its newest run.
      const pair = page.getByTestId('explorer-pair-row').filter({ hasText: 'KIF' });
      await pair.click();
      await page.locator('[data-testid="explorer-pair-row"]:has-text("KIF") + tr').click();
      await page.getByTestId('traceroute-explorer-detail').waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
  {
    id: '6-11-traceroute-explorer',
    size: 'phone',
    path: '/overview/reports/traceroute-explorer',
    setup: async (page) => {
      await page.getByTestId('explorer-pair-item').first().getByRole('button').click();
      await page.getByRole('dialog').getByTestId('traceroute-explorer-detail').waitFor();
    },
  },
  ...(['desktop', 'phone'] as const).map((size) => ({
    id: size === 'desktop' ? '6-05-solar' : '6-12-solar',
    size,
    path: '/overview/reports/solar',
    setup: async (page: Page) => {
      await page.getByRole('button', { name: 'Run analysis' }).click();
      await page.getByRole('button', { name: 'Run forecast' }).click();
      await page.getByText('Solar Forecast').waitFor();
      await page.getByRole('button', { name: /Glyfada Beach/ }).first().click();
      await page.locator('.recharts-surface').first().waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  })),
  {
    id: '6-06-mqtt-violations',
    size: 'desktop',
    path: '/overview/reports/mqtt-violations',
    setup: async (page) => {
      await page.getByRole('checkbox', { name: 'Include unproven (unreadable bit)' }).check();
      await page.getByRole('button', { name: 'Run report' }).click();
      await page.getByText('Athens MQTT gw').click();
      await page.getByText('Nikos T-Echo').waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
  {
    id: '6-13-mqtt-violations',
    size: 'phone',
    path: '/overview/reports/mqtt-violations',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Filters' }).click();
      const filters = page.getByRole('dialog', { name: 'Filters' });
      await filters.getByRole('checkbox', { name: 'Include unproven (unreadable bit)' }).check();
      await filters.getByRole('button', { name: 'Close' }).click();
      await page.getByRole('button', { name: 'Run report' }).click();
      await page.getByTestId('mqtt-gateway-item').first().getByRole('button').click();
      await page.getByRole('dialog').getByText('Nikos T-Echo').waitFor();
    },
  },
  {
    id: '6-07-nodeinfo-enrichment',
    size: 'desktop',
    path: '/overview/reports/nodeinfo-enrichment',
    setup: async (page) => {
      await page.getByRole('checkbox', { name: 'Also push to device NodeDB' }).check();
      await page.getByText('Marousi Mobile').click();
      await page.getByRole('dialog', { name: 'Copy NodeInfo' }).getByRole('button', { name: 'Confirm' }).waitFor();
    },
  },
  {
    id: '6-14-nodeinfo-enrichment',
    size: 'phone',
    path: '/overview/reports/nodeinfo-enrichment',
    setup: async (page) => {
      await page.getByRole('checkbox', { name: 'Also push to device NodeDB' }).check();
    },
  },
  // Task 4.6: Overview › Messages and its export.
  {
    id: '7-01-messages',
    size: 'desktop',
    path: '/overview/messages',
    setup: async (page) => {
      await page.getByTestId('feed-row').filter({ hasText: 'Anyone hearing the Hymettus relay' }).getByRole('button', { name: 'heard by 3' }).click();
      await page.getByRole('complementary', { name: 'Reception details' }).waitFor();
    },
  },
  {
    id: '7-02-export-messages',
    size: 'desktop',
    path: '/overview/messages',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Export' }).click();
      await page.getByRole('dialog', { name: 'Export messages' }).waitFor();
    },
  },
  {
    // The board shows All channels, with a channel tag on each message (s7n2).
    id: '7-06-messages',
    size: 'phone',
    path: '/overview/messages',
    setup: async (page) => {
      await page.getByRole('combobox', { name: 'Channel' }).selectOption('__all__');
      await page.getByTestId('feed-row').filter({ hasText: 'Anyone hearing the Hymettus relay' }).first().click();
      await page.getByRole('dialog', { name: 'Reception details' }).waitFor();
    },
  },
  { id: '7-09-export-messages', size: 'phone', path: '/overview/messages/export' },
  // Task 4.7: Overview › Telemetry and Packets, the pop-out window, an MQTT device's receptions.
  {
    // The board draws the Temperature card's menu open.
    id: '7-03-telemetry-graphs',
    size: 'desktop',
    path: '/overview/telemetry',
    setup: async (page) => {
      const card = page.getByTestId('combined-telemetry-chart').filter({ has: page.getByRole('heading', { name: /^Temperature/ }) });
      await card.getByRole('button', { name: 'Chart actions' }).click();
      await page.getByRole('menu').waitFor();
    },
  },
  {
    id: '7-04-telemetry-latest',
    size: 'desktop',
    path: '/overview/telemetry',
    setup: async (page) => {
      await page.getByRole('tab', { name: 'Latest' }).click();
      await page.getByRole('region', { name: 'Station G2' }).waitFor();
    },
  },
  {
    id: '7-05-packets',
    fixtures: captureOn,
    size: 'desktop',
    path: '/overview/packets',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Filters' }).click();
      await page.getByRole('row').filter({ hasText: 'Hearing you direct from Marousi' }).first().click();
      await page.getByRole('complementary', { name: 'Raw packet #4821' }).waitFor();
    },
  },
  {
    id: '7-07-telemetry',
    size: 'phone',
    path: '/overview/telemetry',
    setup: async (page) => {
      await page.getByRole('heading', { name: /^Battery Level/ }).waitFor();
    },
  },
  {
    // The board draws the filter sheet open over the list.
    id: '7-08-packets',
    fixtures: captureOn,
    size: 'phone',
    path: '/overview/packets',
    setup: async (page) => {
      await page.getByTestId('packet-row').first().waitFor();
      await page.getByRole('button', { name: 'Filters' }).click();
      await page.getByRole('dialog', { name: 'Filters' }).waitFor();
    },
  },
  {
    id: '18-01-packets-popout',
    fixtures: captureOn,
    size: 'desktop',
    path: '/packet-monitor',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Filters' }).click();
      await page.getByRole('row').filter({ hasText: 'Hearing you direct from Marousi' }).first().click();
      await page.getByRole('complementary', { name: 'Raw packet #4821' }).waitFor();
    },
  },
  {
    id: '18-02-packets-popout',
    fixtures: captureOn,
    size: 'phone',
    path: '/packet-monitor',
    setup: async (page) => {
      await page.getByTestId('packet-row').first().waitFor();
    },
  },
  {
    // Five of the six gateways picked (the board's "5 of 6"), then the first packet's receptions.
    id: '18-03-mqtt-receptions',
    size: 'desktop',
    path: '/source/src-mqtt/packetmonitor',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Filters' }).click();
      const gateways = page.getByRole('group', { name: 'Gateways' });
      await gateways.getByRole('button', { name: 'Select all' }).click();
      await gateways.getByRole('checkbox', { name: /Glyfada Beach/ }).uncheck();
      await page.getByRole('button', { name: '4 Receptions' }).first().click();
      await page.getByRole('complementary', { name: 'Packet Detail' }).getByText('Kifisia Rooftop').waitFor();
    },
  },
  {
    id: '18-04-mqtt-receptions',
    size: 'phone',
    path: '/source/src-mqtt/packetmonitor',
    setup: async (page) => {
      await page.getByTestId('packet-row').filter({ hasText: 'Marousi Mobile' }).click();
      await page.getByRole('dialog', { name: 'Packet Detail' }).getByText('Kifisia Rooftop').waitFor();
    },
  },
  // Task 4.8: Users (admins only) and the Audit log (audit:read), install-wide.
  {
    id: 'o4-users',
    fixtures: usersFixtures,
    size: 'desktop',
    path: '/overview/users',
    setup: async (page) => {
      await openUserRow(page, 'nikos');
      await page.getByRole('tab', { name: 'Permissions' }).click();
      await page.getByRole('button', { name: /^Node Details & DM on Station G2: / }).waitFor();
    },
  },
  {
    id: '13-13-manage-user',
    fixtures: usersFixtures,
    size: 'desktop',
    path: '/overview/users',
    setup: async (page) => {
      await openUserRow(page, 'Field team');
      await page.getByRole('tabpanel', { name: 'Account' }).waitFor();
    },
  },
  {
    id: '13-18-users',
    fixtures: usersFixtures,
    size: 'phone',
    path: '/overview/users',
    setup: async (page) => {
      await openUserRow(page, 'Field team');
      await page.getByRole('dialog', { name: 'Field team' }).getByRole('button', { name: 'Make Admin' }).waitFor();
    },
  },
  {
    id: 'q4-permissions',
    fixtures: usersFixtures,
    size: 'phone',
    path: '/overview/users',
    setup: async (page) => {
      await openUserRow(page, 'nikos');
      await page.getByRole('dialog', { name: 'nikos' }).getByRole('button', { name: /^Permissions/ }).click();
      await page.getByRole('group', { name: 'Node Details & DM' }).waitFor();
    },
  },
  {
    id: 'o5-audit',
    fixtures: usersFixtures,
    size: 'desktop',
    path: '/overview/audit',
    setup: async (page) => {
      await page.getByRole('row').filter({ hasText: 'settings_updated' }).click();
      await page.locator('pre').filter({ hasText: 'maxNodeAgeHours' }).waitFor();
    },
  },
  {
    id: '16-03-audit-log',
    fixtures: usersFixtures,
    size: 'phone',
    path: '/overview/audit',
    setup: async (page) => {
      await page.getByTestId('audit-row').first().waitFor();
      await page.getByRole('button', { name: /^Filters/ }).click();
      await page.getByRole('dialog', { name: 'Filters' }).waitFor();
    },
  },
  {
    id: '16-08-audit-entry',
    fixtures: usersFixtures,
    size: 'phone',
    path: '/overview/audit',
    setup: async (page) => {
      await page.getByTestId('audit-row').first().click();
      await page.getByRole('dialog', { name: 'settings_updated' }).waitFor();
    },
  },
  // Task 5.2: the device settings frame, its list and the Device / Modules indexes.
  // Station G2's device configuration; the Pinned group shows from the user's pins (Task 5.4 adds pinning).
  // Task 5.3: with a LoRa edit queued, the list shows the one-line save bar.
  {
    id: 'b-set-p1-list',
    size: 'phone',
    path: '/source/src-g2/settings/lora',
    fixtures: PINS,
    setup: async (page) => {
      await stepHops(page);
      await page.getByTestId('settings-back').click();
      await page.getByRole('region', { name: 'Unsaved radio changes' }).getByText('1 unsaved change').waitFor();
    },
  },
  { id: '12-06-device-index', size: 'desktop', path: '/source/src-g2/settings/device', fixtures: PINS },
  { id: '12-22-device-index', size: 'phone', path: '/source/src-g2/settings/device', fixtures: deviceConfigFixtures },
  { id: 'b-set-d2-modules', size: 'desktop', path: '/source/src-g2/settings/modules', fixtures: PINS },
  { id: '12-07-modules-index', size: 'desktop', path: '/source/src-g2/settings/modules', fixtures: PINS },
  { id: 'b-set-p4-modules', size: 'phone', path: '/source/src-g2/settings/modules', fixtures: deviceConfigFixtures },
  // Task 5.3: LoRa, the radio save bar and Review. Station G2 holds Medium Fast here, so the edit reads as on the boards.
  { id: 'b-set-d1-lora', size: 'desktop', path: '/source/src-g2/settings/lora', fixtures: MEDIUM_FAST, setup: queueLoraAndDevice },
  {
    id: 'b-set-d3-review',
    size: 'desktop',
    path: '/source/src-g2/settings/lora',
    fixtures: MEDIUM_FAST,
    setup: async (page) => {
      await queueLoraAndDevice(page);
      await page.getByRole('region', { name: 'Unsaved radio changes' }).getByRole('button', { name: 'Review' }).click();
      await page.getByRole('dialog', { name: 'Review changes' }).waitFor();
    },
  },
  // Task 5.4: ⌘, settings search over Node display, with the user's pins in the list.
  {
    id: 'b-set-d4-search',
    size: 'desktop',
    path: '/source/src-g2/settings/node-display',
    fixtures: PINS,
    setup: async (page) => {
      // The board draws the Mac hint in the sidebar and the dialog; the sidebar reads the platform as it
      // renders, so set it before the page's scripts run and load the page again.
      await page.addInitScript(() => Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' }));
      await page.reload();
      await page.getByRole('heading', { level: 1, name: 'Node Display' }).waitFor();
      await page.keyboard.press('Meta+Comma');
      const dialog = page.getByRole('dialog', { name: 'Search settings' });
      await dialog.getByRole('combobox', { name: 'Search settings' }).fill('hop');
      await dialog.getByRole('group', { name: 'Station G2' }).waitFor();
    },
  },
  {
    id: 'b-set-p2-lora',
    size: 'phone',
    path: '/source/src-g2/settings/lora',
    fixtures: MEDIUM_FAST,
    setup: async (page) => {
      await pickLongFast(page);
      await stepHops(page);
      await page.getByRole('region', { name: 'Unsaved radio changes' }).waitFor();
    },
  },
  {
    // US, where Short Turbo is legal on 2.7.15 (EU_868 hides it, as today).
    id: 'b-set-p3-sheet',
    size: 'phone',
    path: '/source/src-g2/settings/lora',
    fixtures: { ...deviceConfigFixtures, ...g2deviceConfigWith({ modemPreset: 4, region: 1 }) },
    setup: async (page) => {
      await pickLongFast(page);
      await page.getByRole('button', { name: 'Modem Preset' }).click();
      await page.getByRole('dialog', { name: 'Modem Preset' }).waitFor();
    },
  },
  // Task 5.5: Identity, Channels (list, a channel, Share and import) and Security.
  { id: '12-05-identity', size: 'desktop', path: '/source/src-g2/settings/identity', fixtures: PINS, setup: renameShort },
  { id: '12-21-identity', size: 'phone', path: '/source/src-g2/settings/identity', fixtures: PINS, setup: renameShort },
  { id: '12-01-channels', size: 'desktop', path: '/source/src-g2/settings/channels', fixtures: CHANNELS, setup: reorderAthens },
  { id: '12-14-channels', size: 'phone', path: '/source/src-g2/settings/channels', fixtures: CHANNELS, setup: reorderAthens },
  {
    id: '12-02-channel-edit',
    size: 'desktop',
    path: '/source/src-g2/settings/channels/2',
    fixtures: CHANNELS,
    setup: async (page) => {
      await page.getByLabel('Location Precision (bits)').fill('13');
      await page.getByRole('region', { name: 'Unsaved channel changes' }).waitFor();
    },
  },
  {
    id: '12-15-channel-edit',
    size: 'phone',
    path: '/source/src-g2/settings/channels/2',
    fixtures: CHANNELS,
    setup: async (page) => {
      await page.getByRole('switch', { name: 'Uplink Enabled' }).click();
      await page.getByRole('region', { name: 'Unsaved channel changes' }).waitFor();
    },
  },
  {
    id: '12-03-share-import',
    size: 'desktop',
    path: '/source/src-g2/settings/channels/share',
    fixtures: CHANNELS,
    setup: async (page) => {
      await page.getByLabel('Meshtastic Configuration URL').fill('https://meshtastic.org/e/#CgcSAQE6AggNEg8IATgDQANIAVAeaAHABgE');
      await page.getByRole('button', { name: 'Decode URL' }).click();
      await page.getByRole('button', { name: 'Import Selected' }).click();
      await page.getByText('Sending configuration to device...').waitFor();
    },
  },
  { id: '12-16-share-qr', size: 'phone', path: '/source/src-g2/settings/channels/share', fixtures: CHANNELS },
  { id: '12-04-security', size: 'desktop', path: '/source/src-g2/settings/security', fixtures: SECURITY, setup: (page) => confirmPolicy(page, 'desktop', 'Strict') },
  {
    id: '12-17-security',
    size: 'phone',
    path: '/source/src-g2/settings/security',
    fixtures: SECURITY,
    setup: async (page) => {
      await page.getByRole('switch', { name: 'Debug Log API Enabled' }).click();
      await page.getByRole('region', { name: 'Unsaved radio changes' }).waitFor();
    },
  },
  { id: '12-26-security-strict', size: 'phone', path: '/source/src-g2/settings/security', fixtures: SECURITY, setup: (page) => confirmPolicy(page, 'phone', 'Strict') },
  { id: '18-07-security-balanced', size: 'desktop', path: '/source/src-g2/settings/security', fixtures: SECURITY, setup: (page) => confirmPolicy(page, 'desktop', 'Balanced') },
  { id: '18-08-security-balanced', size: 'phone', path: '/source/src-g2/settings/security', fixtures: SECURITY, setup: (page) => confirmPolicy(page, 'phone', 'Balanced') },
  // Task 5.7: Maintenance (the page, its Backup and Danger zone sheets) and Firmware (today's OTA wizard, stopped mid-flash).
  {
    id: '12-08-maintenance',
    size: 'desktop',
    path: '/source/src-g2/settings/maintenance',
    fixtures: MAINTENANCE(),
    setup: async (page) => {
      await reloadFromRadio(page);
      await openRestore(page);
    },
  },
  { id: '12-18-maintenance', size: 'phone', path: '/source/src-g2/settings/maintenance', fixtures: MAINTENANCE(), setup: reloadFromRadio },
  { id: '12-27-restore-confirm', size: 'phone', path: '/source/src-g2/settings/maintenance', fixtures: MAINTENANCE(), setup: openRestore },
  { id: '12-28-purge-confirm', size: 'phone', path: '/source/src-g2/settings/maintenance', fixtures: MAINTENANCE(), setup: openPurge },
  { id: '12-10-danger-confirm', size: 'desktop', path: '/source/src-g2/settings/maintenance/danger', fixtures: MAINTENANCE(), setup: openPurge },
  {
    id: '12-09-firmware-update',
    size: 'desktop',
    path: '/source/src-g2/settings/maintenance/firmware',
    fixtures: { ...MAINTENANCE(), ...flashFailed },
    setup: (page) => page.getByRole('button', { name: /Retry Flash/ }).waitFor(),
  },
  {
    id: '12-19-firmware',
    size: 'phone',
    path: '/source/src-g2/settings/maintenance/firmware',
    fixtures: { ...MAINTENANCE(), ...flashFailed },
    setup: (page) => page.getByRole('button', { name: /Retry Flash/ }).waitFor(),
  },
  // Task 5.8: the In MeshMonitor pages (saved as you go), the bridge setup (its own Save) and You › Notifications.
  {
    id: 'b-set-d5-notifications',
    size: 'desktop',
    path: '/source/src-g2/settings/notifications',
    fixtures: MESHMONITOR(),
    setup: async (page) => {
      await page.getByRole('switch', { name: 'Emoji Reactions' }).click();
      await page.getByText('Saved').first().waitFor();
    },
  },
  { id: 's2-notifications', size: 'phone', path: '/you/notifications', fixtures: { ...MESHMONITOR(), ...PUSH_HERE }, setup: pushInThisBrowser },
  {
    id: '12-12-meshmonitor-data',
    size: 'desktop',
    path: '/source/src-g2/settings/node-display',
    fixtures: MESHMONITOR(),
    setup: async (page) => {
      await page.getByRole('switch', { name: 'Detect likely aircraft' }).click();
      await page.getByText('Saved').first().waitFor();
    },
  },
  { id: '12-23-meshmonitor-data', size: 'phone', path: '/source/src-g2/settings/data', fixtures: MESHMONITOR() },
  { id: '12-13-mqtt-bridge', size: 'desktop', path: '/source/src-bridge/settings/mqtt-bridge', fixtures: { ...PINS, ...bridgeFixtures() }, setup: editBridge },
  { id: '12-24-mqtt-bridge', size: 'phone', path: '/source/src-bridge/settings/mqtt-bridge', fixtures: { ...PINS, ...bridgeFixtures() }, setup: editBridge },
];

/** Identity: the short name G2 → SG2. */
async function renameShort(page: Page) {
  await page.getByLabel('Short Name').fill('SG2');
  await page.getByRole('region', { name: 'Unsaved radio changes' }).waitFor();
}

/** Channels: Reorder mode, Athens Ops moved to the top. */
async function reorderAthens(page: Page) {
  await page.getByRole('button', { name: 'Reorder' }).click();
  await page.getByRole('button', { name: 'Move Athens Ops up' }).click();
  await page.getByRole('button', { name: 'Move Athens Ops up' }).click();
  await page.getByRole('region', { name: 'Reorder mode' }).getByText('Channel order changed. Apply to device?').waitFor();
}

/** Security: pick a Protection Level, Save & restart, and (Strict) type the short name. */
async function confirmPolicy(page: Page, size: 'desktop' | 'phone', level: 'Strict' | 'Balanced') {
  const label = 'Protection Level (packet authenticity)';
  const option = level === 'Strict' ? 'Strict: require authentication' : 'Balanced: prefer authenticated';
  if (size === 'desktop') {
    await page.getByLabel(label).selectOption(level === 'Strict' ? '2' : '1');
  } else {
    await page.getByRole('button', { name: label }).click();
    await page.getByRole('dialog', { name: label }).getByRole('radio', { name: option }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
  }
  await page.getByRole('region', { name: 'Unsaved radio changes' }).getByRole('button', { name: 'Save & restart' }).click();
  const dialog = page.getByRole('dialog', { name: `Set Protection Level to ${level}?` });
  await dialog.waitFor();
  if (level === 'Strict') await dialog.getByLabel('Type G2 to confirm').fill('G2');
}

/** Phone: one step up on Hop Limit. */
async function stepHops(page: Page) {
  await page.locator('[data-setting-id="lora.hopLimit"]').getByRole('button', { name: 'Increase' }).click();
}

/** Phone: Long Fast from the preset sheet. */
async function pickLongFast(page: Page) {
  await page.getByRole('button', { name: 'Modem Preset' }).click();
  await page.getByRole('dialog', { name: 'Modem Preset' }).getByRole('radio', { name: /^LONG_FAST/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
}

/** Desktop: Long Fast and hop limit 4 on LoRa, Local only on Device, then back to LoRa. */
async function queueLoraAndDevice(page: Page) {
  await page.getByLabel('Modem Preset').selectOption('0');
  await page.getByLabel('Hop Limit').fill('4');
  const nav = page.getByRole('navigation', { name: 'Settings' });
  await nav.getByRole('link', { name: 'Device', exact: true }).click();
  await page.getByRole('main').getByRole('link', { name: /^Device/ }).first().click();
  await page.getByLabel(/Rebroadcast Mode/).selectOption('2');
  await nav.getByRole('link', { name: 'LoRa' }).click();
  await page.getByRole('region', { name: 'Unsaved radio changes' }).getByText(/3 changes in LoRa and Device/).waitFor();
}

const ON_24H = { enabled: true, lookbackHours: 24 };
const CANDIDATE_SITE = {
  id: 7, sourceId: 'src-g2', label: 'Candidate site', description: 'Rooftop survey', latitude: 37.99, longitude: 23.76,
  altitude: null, icon: 'pin', color: 'amber', createdBy: 1, createdAt: Date.now() - 86_400_000, updatedAt: Date.now() - 86_400_000,
};

/** Today's Map Analysis config (localStorage `mapAnalysis.config.v1`) with these layers on, then the page reloads. */
async function presetAnalysis(page: Page, layers: Record<string, { enabled: boolean; lookbackHours: number | null }>, extra: object = {}): Promise<void> {
  await page.evaluate(([l, e]) => {
    const key = 'mapAnalysis.config.v1';
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null') ?? {};
    localStorage.setItem(key, JSON.stringify({ version: 1, ...stored, ...e, layers: { ...(stored.layers ?? {}), ...l } }));
  }, [layers, extra] as const);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('.leaflet-marker-icon', { hasText: 'KFR' }).waitFor();
}

/** Today's Mesh Issues view state (localStorage `meshIssues.viewState.v1`): these sections open and these filters, then the page reloads. */
async function presetMeshIssues(page: Page, expandedTypes: string[], filters: object): Promise<void> {
  await page.evaluate(([types, f]) => {
    localStorage.setItem('meshIssues.viewState.v1', JSON.stringify({
      version: 1, view: 'byIssue', sortByType: {}, expandedNodes: [], expandedTypes: types,
      filters: { severities: [], tiers: [], issueTypes: [], sources: [], q: '', includeClosed: false, includeDismissed: false, ...f },
    }));
  }, [expandedTypes, filters] as const);
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/** Opens the router cluster's finding (recommendation, map, members), as 6-02 and 6-09 draw it. */
async function showClusterDetails(page: Page): Promise<void> {
  const section = page.locator('section', { has: page.getByRole('button', { name: /^B1 Router cluster/, expanded: true }) });
  await section.getByRole('button', { name: 'Show details' }).click();
  await section.getByRole('button', { name: 'Show map' }).click();
  await section.locator('.leaflet-container').waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Opens the Overview map's Tools menu, and picks `item` if given. */
async function openTools(page: Page, item?: string): Promise<void> {
  await page.getByRole('button', { name: 'Tools' }).click();
  const menu = page.getByRole('menu', { name: 'Tools' });
  await menu.waitFor();
  if (item) await menu.getByRole('menuitemradio', { name: new RegExp(`^${item}`) }).click();
}

/** Phone (Task 4.3): a button on the bar under the map opens its sheet; Tools and Time open the one Tools sheet. */
async function openPhoneSheet(page: Page, button: 'Tools' | 'Time' | 'Layers'): Promise<void> {
  await page.getByRole('toolbar', { name: 'Map tools' }).getByRole('button', { name: new RegExp(`^${button}`) }).click();
  await page.getByRole('dialog', { name: button === 'Layers' ? 'Layers' : 'Tools' }).waitFor();
}

/** Kifisia Rooftop's detected renumbering, served for this shot, then the page reloads. */
async function serveRenumbering(page: Page): Promise<void> {
  await page.route((url) => url.pathname.endsWith('/api/nodes/identity-changes'), (route) =>
    route.fulfill({ json: renumberedFixtures['GET /api/nodes/identity-changes']() }),
  );
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/** As serveRenumbering, on the Admin tab: waits for 15-03 / 15-16's notice. */
async function showRenumbering(page: Page): Promise<void> {
  await serveRenumbering(page);
  await page.getByRole('button', { name: /Merge history…/ }).waitFor();
}

/** The phone node page's tile, opening the Node actions sheet on that tab. */
async function openNodeTile(page: Page, name: 'Ask the node' | 'Organise' | 'Data'): Promise<void> {
  await nodeHeading(page, 'Kifisia Rooftop');
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('dialog', { name: /Node actions/ }).waitFor();
}

async function nodeHeading(page: Page, name: string): Promise<void> {
  await page.getByRole('heading', { level: 1, name }).waitFor();
}

/** Scroll the node page until its full header has slid under the bar, and wait for the one-bar header. */
async function collapseNodeHeader(page: Page): Promise<void> {
  await page.getByTestId('node-bar').evaluate((bar) => {
    const header = bar.nextElementSibling as HTMLElement;
    bar.parentElement!.scrollTop = header.offsetTop + header.offsetHeight - bar.offsetHeight + 8;
  });
  await page.locator('[data-testid="node-bar"][data-collapsed]').waitFor();
}

async function searchRelay(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Search Messages' });
  await dialog.getByRole('textbox', { name: 'Search for text in messages...' }).fill('relay');
  await dialog.getByRole('button', { name: 'Search', exact: true }).click();
  await dialog.getByText(/Showing 5 of 31 results/).waitFor();
}

/** Past the unmessageable banner, to the conversation. */
async function openDm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Message anyway' }).click();
  await page.getByText('Running one now').waitFor();
}

/** Right-clicks the map (a long-press on touch fires the same event), then picks `item` if given. */
async function openMapMenu(page: Page, item?: string): Promise<void> {
  const map = page.locator('.leaflet-container');
  const box = (await map.boundingBox())!;
  // Clear of the desktop's node list (left) and the phone's map buttons (right).
  await map.click({ button: 'right', position: { x: box.width * 0.45, y: box.height * 0.4 } });
  const menu = page.getByRole('menu', { name: 'Map actions' });
  await menu.waitFor();
  if (item) await menu.getByRole('menuitem', { name: new RegExp(`^${item}`) }).click();
}

/** Trailhead's popup (its marker may sit under the phone's overlay: the DOM click goes to Leaflet), then one of its actions. */
async function openTrailhead(page: Page, action: 'Edit' | 'Delete…'): Promise<void> {
  await page.locator('.waypoint-icon', { hasText: '\u26FA' }).dispatchEvent('click');
  await page.locator('.leaflet-popup').getByRole('button', { name: action }).click();
}

/** A row of the Users list (desktop column or phone list). */
async function openUserRow(page: Page, name: string): Promise<void> {
  await page.getByRole('list', { name: 'Users' }).getByRole('button', { name: new RegExp(`^${name}\\b`) }).click();
}
