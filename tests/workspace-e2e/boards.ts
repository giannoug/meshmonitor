/**
 * Boards screenshotted by `npm run test:workspace-e2e`. Each task that builds a
 * board adds its entry here (board protocol step BP6).
 */
import type { Page } from '@playwright/test';
import { athensFixture } from '../../src/workspace/__fixtures__/athens';
import { renumberedFixtures } from '../../src/workspace/node-page/__tests__/nodePageFixtures';

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
    id: '6-09-mesh-issues',
    size: 'phone',
    path: '/overview/reports/mesh-issues',
    setup: async (page) => {
      await presetMeshIssues(page, ['B1_router_cluster'], {});
      await showClusterDetails(page);
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
];

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
