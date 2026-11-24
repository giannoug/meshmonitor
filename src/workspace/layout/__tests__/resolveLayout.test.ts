import { describe, it, expect } from 'vitest';
import { resolveLayout } from '../resolveLayout';
import { classicFallback } from '../classicFallback';

describe('resolveLayout', () => {
  it.each([
    [{ userLayout: 'workspace', defaultLayout: 'classic' }, 'workspace'],
    [{ userLayout: 'classic', defaultLayout: 'workspace' }, 'classic'],
    [{ userLayout: null, defaultLayout: 'workspace' }, 'workspace'],
    [{ defaultLayout: 'workspace' }, 'workspace'],
    [{ userLayout: null, defaultLayout: null }, 'classic'],
    [{}, 'classic'],
  ] as const)('%o → %s', (input, expected) => {
    expect(resolveLayout(input)).toBe(expected);
  });
});

describe('classicFallback', () => {
  it.each([
    ['/overview', '/'],
    ['/overview/map', '/'],
    ['/overview/analysis', '/analysis'],
    ['/overview/reports', '/reports'],
    ['/overview/reports/mesh-issues', '/reports'],
    ['/overview/messages', '/unified/messages'],
    // Export messages is a Workspace page (Task 4.6); Classic exports from Unified Messages.
    ['/overview/messages/export', '/unified/messages'],
    ['/overview/telemetry', '/unified/telemetry'],
    ['/overview/packets', '/unified/packets'],
    ['/overview/automations', '/automations'],
    ['/overview/automations/variables', '/automations'],
    ['/overview/automations/templates/bridge', '/automations'],
    ['/overview/users', '/users'],
    ['/overview/audit', '/'],
    ['/overview/dashboard', '/'],
    ['/preferences/appearance', '/settings'],
    ['/server/backup', '/settings'],
    ['/you', '/'],
    ['/you/security', '/'],
    ['/source/abc/node/123', '/source/abc/messages'],
    ['/source/abc/node/123/telemetry', '/source/abc/messages'],
    ['/source/abc/dm/123', '/source/abc/messages'],
    ['/source/abc/channel/0', '/source/abc/channels'],
    // The device map (Task 3.1): Classic's Nodes tab, which holds the map.
    ['/source/abc/map', '/source/abc/nodes'],
    // The DM inbox (Task 2.6): Classic's DM tab.
    ['/source/abc/dms', '/source/abc/messages'],
    ['/source/abc/activity', '/source/abc/'],
    ['/source/abc/room/xyz', '/source/abc/'],
    ['/automations/rule-1', '/automations'],
    ['/automations/rule-1/runs', '/automations'],
  ])('%s → %s', (path, expected) => {
    expect(classicFallback(path)).toBe(expected);
  });

  it.each(['/source/abc/channels', '/', '/settings', '/automations', '/source/abc/settings', '/unified/messages'])(
    '%s → null',
    (path) => {
      expect(classicFallback(path)).toBeNull();
    },
  );
});

// F.2 A23-I1: a Workspace device-settings link opens today's section; the remote target is Admin Commands.
describe('classicFallback for device settings', () => {
  it.each([
    ['/source/abc/settings/lora', '', '/source/abc/configuration#config-lora'],
    ['/source/abc/settings/identity', '', '/source/abc/configuration#config-node-identity'],
    ['/source/abc/settings/channels', '', '/source/abc/configuration#config-channels'],
    ['/source/abc/settings/security', '', '/source/abc/configuration#config-security'],
    ['/source/abc/settings/device/position', '', '/source/abc/configuration#config-position'],
    ['/source/abc/settings/device/network/', '', '/source/abc/configuration#config-network'],
    ['/source/abc/settings/modules/mqtt', '', '/source/abc/configuration#config-mqtt'],
    ['/source/abc/settings/modules/telemetry', '', '/source/abc/configuration#config-telemetry'],
    ['/source/abc/settings/maintenance/firmware', '', '/source/abc/configuration#config-firmware'],
    ['/source/abc/settings/maintenance/danger', '', '/source/abc/configuration#config-danger'],
    ['/source/abc/settings/modules', '', '/source/abc/configuration'],
    ['/source/abc/settings/maintenance', '', '/source/abc/configuration'],
    // MeshMonitor categories stay on the Settings tab.
    ['/source/abc/settings/telemetry', '', '/source/abc/settings#settings-telemetry'],
    ['/source/abc/settings/notifications', '', '/source/abc/settings#settings-notifications'],
    ['/source/abc/settings/data', '', '/source/abc/settings#settings-reset-ui'],
    ['/source/abc/settings/mqtt-bridge', '', '/source/abc/settings#settings-mqtt-bridge'],
    // A MeshCore page: Classic's MeshCore page ignores the path.
    ['/source/abc/settings/radio', '', '/source/abc/settings'],
    // The remote target.
    ['/source/abc/settings', '?node=', '/source/abc/admin'],
    ['/source/abc/settings', '?node=!a1b2c3d4', '/source/abc/admin'],
    ['/source/abc/settings/lora', '?node=!a1b2c3d4', '/source/abc/admin'],
  ])('%s%s → %s', (path, search, expected) => {
    expect(classicFallback(path, search)).toBe(expected);
  });

  it('leaves the bare Settings tab alone', () => {
    expect(classicFallback('/source/abc/settings', '')).toBeNull();
  });
});
