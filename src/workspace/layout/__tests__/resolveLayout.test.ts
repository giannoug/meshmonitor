import { describe, it, expect } from 'vitest';
import { resolveLayout } from '../resolveLayout';
import { classicFallback } from '../classicFallback';

describe('resolveLayout', () => {
  it.each([
    [{ preview: false, userLayout: 'workspace', defaultLayout: 'workspace' }, 'classic'],
    [{ preview: false, userLayout: null, defaultLayout: 'workspace' }, 'classic'],
    [{ preview: true, userLayout: 'workspace', defaultLayout: 'classic' }, 'workspace'],
    [{ preview: true, userLayout: 'classic', defaultLayout: 'workspace' }, 'classic'],
    [{ preview: true, userLayout: null, defaultLayout: 'workspace' }, 'workspace'],
    [{ preview: true, defaultLayout: 'workspace' }, 'workspace'],
    [{ preview: true, userLayout: null, defaultLayout: null }, 'classic'],
    [{ preview: true }, 'classic'],
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
    ['/overview/telemetry', '/unified/telemetry'],
    ['/overview/packets', '/unified/packets'],
    ['/overview/automations', '/automations'],
    ['/overview/users', '/users'],
    ['/overview/audit', '/'],
    ['/overview/dashboard', '/'],
    ['/preferences/appearance', '/settings'],
    ['/server/backup', '/settings'],
    ['/you', '/'],
    ['/you/security', '/'],
    ['/source/abc/settings/lora', '/source/abc/settings'],
    ['/source/abc/node/123', '/source/abc/messages'],
    ['/source/abc/node/123/telemetry', '/source/abc/messages'],
    ['/source/abc/dm/123', '/source/abc/messages'],
    ['/source/abc/channel/0', '/source/abc/channels'],
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
