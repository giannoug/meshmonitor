import { describe, it, expect } from 'vitest';
import {
  PREFERENCE_CATEGORIES,
  workspaceRedirect,
  classicSourceLocation,
  meshcoreViewForPath,
  reticulumViewForPath,
} from './routes';

const loc = (url: string) => {
  const u = new URL(url, 'http://x');
  return { pathname: u.pathname, search: u.search, hash: u.hash };
};

describe('workspaceRedirect', () => {
  it.each([
    // Classic #section deep links land on the category.
    ['/source/s1/configuration#config-lora', false, '/source/s1/settings/lora'],
    ['/source/s1/configuration#config-node-identity', false, '/source/s1/settings/node-identity'],
    ['/source/s1/settings#settings-node-display', false, '/source/s1/settings/node-display'],
    ['/source/s1/settings#settings-mqtt-bridge', false, '/source/s1/settings/mqtt-bridge'],
    ['/settings#settings-language', true, '/preferences/language'],
    ['/settings#settings-meshcore-messaging', false, '/preferences/meshcore-messaging'],
    ['/settings#settings-backup', true, '/server/backup'],
    ['/settings#settings-remote-admin', true, '/server/remote-admin'],
    // Retired tabs.
    ['/source/s1/admin', false, '/source/s1/settings?node='],
    ['/source/s1/notifications', false, '/source/s1/settings/notifications'],
    ['/source/s1/configuration', false, '/source/s1/settings'],
    ['/source/s1/configuration/', false, '/source/s1/settings'],
    // /settings with no section: by role.
    ['/settings', true, '/server/general'],
    ['/settings', false, '/preferences/appearance'],
  ])('%s (admin=%s) → %s', (url, isAdmin, to) => {
    expect(workspaceRedirect(loc(url), { isAdmin })).toBe(to);
  });

  it.each([
    ['/settings#settings-%E0%A4%A', true, '/server/general'],
    ['/source/s1/configuration#config-%E0', false, '/source/s1/settings'],
    ['/source/s1/settings#%', false, null],
    ['/nodes#%E0', false, null],
  ])('a malformed hash on %s does not throw (→ %s)', (url, isAdmin, to) => {
    expect(workspaceRedirect(loc(url), { isAdmin })).toBe(to);
  });

  it('every preference category goes to /preferences', () => {
    for (const c of PREFERENCE_CATEGORIES) {
      expect(workspaceRedirect(loc(`/settings#settings-${c}`))).toBe(`/preferences/${c}`);
    }
  });

  it.each([
    '/', '/source/s1/nodes', '/source/s1/settings', '/source/s1/settings/lora#config-lora',
    '/source/s1/settings#config-lora', '/overview/reports', '/preferences/units', '/server/general',
  ])('leaves %s alone', (url) => {
    expect(workspaceRedirect(loc(url), { isAdmin: true })).toBeNull();
  });
});

describe('classicSourceLocation (what App sees for a Workspace URL)', () => {
  it.each([
    ['/source/s1/settings', 'meshtastic_tcp', '/source/s1/configuration', ''],
    ['/source/s1/settings', 'mqtt_broker', '/source/s1/settings', ''],
    ['/source/s1/settings/lora', 'meshtastic_tcp', '/source/s1/configuration', '#config-lora'],
    ['/source/s1/settings/lora/presets', 'meshtastic_tcp', '/source/s1/configuration', '#config-lora'],
    ['/source/s1/settings/node-display', 'meshtastic_tcp', '/source/s1/settings', '#settings-node-display'],
    ['/source/s1/settings/notifications', 'meshtastic_tcp', '/source/s1/notifications', ''],
    ['/source/s1/settings?node=', 'meshtastic_tcp', '/source/s1/admin', ''],
    ['/source/s1/settings/lora?node=!a1b2c3d4', 'meshtastic_tcp', '/source/s1/admin', ''],
    ['/source/s1/node/!a1b2c3d4/telemetry', 'meshtastic_tcp', '/source/s1/messages', ''],
    ['/source/s1/dm/!a1b2c3d4', 'meshtastic_tcp', '/source/s1/messages', ''],
    ['/source/s1/channel/2', 'meshtastic_tcp', '/source/s1/channels', ''],
    ['/source/s1/dms', 'meshtastic_tcp', '/source/s1/', ''],
    ['/source/s1/nodes', 'meshtastic_tcp', '/source/s1/nodes', ''],
    ['/source/s1/', 'meshtastic_tcp', '/source/s1/', ''],
  ])('%s on %s → %s%s', (url, type, pathname, hash) => {
    expect(classicSourceLocation(loc(url), type)).toEqual({ pathname, hash });
  });
});

describe('meshcoreViewForPath', () => {
  it.each([
    ['', '', 'nodes'],
    ['', '#configuration', 'configuration'],
    ['channels', '', 'channels'],
    ['configuration', '', 'configuration'],
    ['settings/radio', '', 'settings'],
    ['channel/3', '', 'channels'],
    ['dm/abcd', '', 'dms'],
    ['room/r1', '', 'rooms'],
    ['node/abcd/info', '', 'nodes'],
    ['admin', '', null],
  ])('%s %s → %s', (splat, hash, view) => {
    expect(meshcoreViewForPath(splat, hash)).toBe(view);
  });
});

describe('reticulumViewForPath', () => {
  it.each([
    ['', 'destinations'],
    ['interfaces', 'interfaces'],
    ['paths', 'paths'],
    ['dm/abc', 'dms'],
    ['nodes', null],
  ])('%s → %s', (splat, view) => {
    expect(reticulumViewForPath(splat)).toBe(view);
  });
});
