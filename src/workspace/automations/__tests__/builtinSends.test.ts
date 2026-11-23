/**
 * `builtinSends` (Task 8.3, s14n1): every built-in's Sends line from fixture
 * settings, on and off. Each line names only a limit today's server enforces;
 * none invents a per-minute cap (the only "a minute" is Forwarding's real
 * FORWARDING_MAX_PER_WINDOW), and an off built-in reads "When on, …".
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { createInstance, type TFunction } from 'i18next';
import { builtinSends, type BuiltinId } from '../builtinSends';
import { BUILTIN_IDS } from '../ids';

const en = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../../public/locales/en.json'), 'utf8'));
const i18n = createInstance();
void i18n.init({ lng: 'en', resources: { en: { translation: en } }, initAsync: false, interpolation: { escapeValue: false } });
const t = i18n.t.bind(i18n) as TFunction;
const channelName = (i: number) => ['LongFast', 'Local', 'Hiking'][i] ?? `Channel ${i}`;
// A fixed morning, so the timers' runs in the next 24 h are fixed.
const now = new Date('2026-11-23T06:00:00').getTime();

const on: Record<BuiltinId, Record<string, unknown>> = {
  'auto-acknowledge': { autoAckEnabled: true, autoAckCooldownSeconds: 60, autoAckMaxResponses: 2, autoAckMaxAttempts: 3 },
  'auto-responder': { autoResponderEnabled: true, autoResponderTriggers: [{ id: 'a', cooldownSeconds: 60 }, { id: 'b' }] },
  'auto-welcome': { autoWelcomeEnabled: true, autoWelcomeTarget: 'dm', autoWelcomeWaitForName: true },
  'auto-ping': { autoPingEnabled: true, autoPingMaxPings: 20, autoPingIntervalSeconds: 30 },
  'geofence-triggers': { geofenceTriggers: [{ enabled: true, cooldownMinutes: 30 }, { enabled: true, cooldownMinutes: 60 }] },
  forwarding: { enabled: true, rules: [{ enabled: true }] },
  'auto-announce': { autoAnnounceEnabled: true, autoAnnounceChannelIndexes: [0], autoAnnounceIntervalHours: 6, autoAnnounceHopLimit: '3' },
  'timer-triggers': { timerTriggers: [{ enabled: true, cronExpression: '0 8 * * *' }, { enabled: true, cronExpression: '0 20 * * *' }] },
  'auto-time-sync': { enabled: true, intervalMinutes: 60 },
  'airtime-cutoff': { automationAirtimeCutoffThreshold: 30 },
  'auto-favorite': { autoFavoriteEnabled: true },
  'auto-key-management': { autoKeyManagementEnabled: true, autoKeyManagementMaxExchanges: 3, autoKeyManagementIntervalMinutes: 5 },
  'auto-heap-management': { autoHeapManagementEnabled: true, thresholdKb: 20 },
  'auto-traceroute': { enabled: true, intervalMinutes: 15 },
  'auto-localstats': { enabled: true, intervalMinutes: 60, scheduleEnabled: true, scheduleStart: '08:00', scheduleEnd: '20:00' },
  'remote-admin-scanner': { enabled: true, intervalMinutes: 5 },
  'auto-delete-by-distance': { autoDeleteByDistanceEnabled: true },
  'ignored-nodes': { nodes: [] },
};

const expected: Record<BuiltinId, string> = {
  'auto-acknowledge': '60 s cooldown per sender · stays quiet once 2 other nodes replied · DM replies are sent up to 3 times',
  'auto-responder': 'Cooldown per trigger and node · 1 reply per match',
  'auto-welcome': '1 DM per new node, once it has a name',
  'auto-ping': 'Up to 20 pings per “ping N” request, 30 s apart',
  'geofence-triggers': '1 message per node per trigger’s cooldown · 2 triggers on',
  forwarding: '1 message per forwarded message, at most 5 a minute per rule',
  'auto-announce': 'On LongFast every 6 h · hop limit 3',
  'timer-triggers': '1 message per timer run · 2 runs in the next 24 h',
  'auto-time-sync': '1 time-set admin packet to 1 node every 60 min',
  'airtime-cutoff': 'Pauses the built-ins that send above 30 % channel use · sends nothing',
  'auto-favorite': 'Sends nothing on the mesh',
  'auto-key-management': 'Up to 3 NodeInfo exchanges per mismatched node, checked every 5 min',
  'auto-heap-management': 'Sends nothing on the mesh: below 20 KB free, removes the 10 least-recently-heard nodes and reboots this node',
  'auto-traceroute': '1 traceroute every 15 min',
  'auto-localstats': '1 LocalStats request to 1 node every 60 min · only 08:00–20:00',
  'remote-admin-scanner': '1 admin probe to 1 node every 5 min',
  'auto-delete-by-distance': 'Sends nothing on the mesh',
  'ignored-nodes': 'Sends nothing on the mesh',
};

describe('builtinSends', () => {
  it.each(BUILTIN_IDS.map((id) => [id]))('%s, on', (id) => {
    expect(builtinSends(id, on[id], t, { channelName, now })).toBe(expected[id]);
  });

  it('a built-in that is off reads "When on, …"', () => {
    expect(builtinSends('auto-traceroute', { enabled: false, intervalMinutes: 15 }, t)).toBe('When on, 1 traceroute every 15 min');
    expect(builtinSends('auto-welcome', { autoWelcomeEnabled: false, autoWelcomeTarget: '2', autoWelcomeWaitForName: false }, t, { channelName }))
      .toBe('When on, 1 message on Hiking per new node');
    expect(builtinSends('forwarding', { enabled: false, rules: [{ enabled: true }] }, t)).toBe('When on, 1 message per forwarded message, at most 5 a minute per rule');
    // "Sends nothing" reads the same on or off; a threshold of 0 says it is off.
    expect(builtinSends('auto-favorite', { autoFavoriteEnabled: false }, t)).toBe('Sends nothing on the mesh');
    expect(builtinSends('airtime-cutoff', { automationAirtimeCutoffThreshold: 0 }, t)).toBe('Off (threshold 0) · sends nothing on the mesh');
  });

  it('names only today\'s limits: no invented per-minute cap anywhere', () => {
    const lines = BUILTIN_IDS.flatMap((id) => [builtinSends(id, on[id], t, { channelName, now }), builtinSends(id, {}, t, { channelName, now })]);
    for (const line of lines) {
      if (/a minute|per minute|\/min\b/i.test(line)) expect(line).toMatch(/at most 5 a minute per rule$/);
      expect(line).not.toMatch(/replies a minute|per hour/);
    }
  });

  it('no cooldown and no response cap: the auto-ack line says so, with no limit', () => {
    expect(builtinSends('auto-acknowledge', { autoAckEnabled: true, autoAckCooldownSeconds: 0, autoAckMaxResponses: 0, autoAckMaxAttempts: 1 }, t))
      .toBe('1 reply per matching message');
    expect(builtinSends('auto-responder', { autoResponderEnabled: true, autoResponderTriggers: [{ id: 'a' }] }, t)).toBe('No trigger has a cooldown · 1 reply per match');
    expect(builtinSends('geofence-triggers', { geofenceTriggers: [{ enabled: true }] }, t)).toBe('1 message per node event · 1 trigger has no cooldown · 1 trigger on');
  });
});
