/**
 * A Meshtastic built-in's Sends line (Task 8.3, s14n1): what it puts on the
 * air, read only from the settings it already has. It names today's limits
 * (a cooldown, the auto-ack response cap, a retry count, an interval) and
 * never a cap, limit or per-minute figure the server does not enforce. A
 * built-in that is off reads "When on, …".
 *
 * `settings` is the built-in's own values as `builtins.ts` loads them (keyed
 * by today's setting names); `ctx` names channels.
 */
import type { TFunction } from 'i18next';
import { Cron } from 'croner';
import { FORWARDING_MAX_PER_WINDOW } from '../../types/forwarding';

import type { BuiltinId } from './ids';

export type { BuiltinId };

export interface SendsCtx {
  channelName?(index: number): string;
  /** "Now", for the timers' runs in the next 24 h (tests pin it). */
  now?: number;
}

type V = Record<string, unknown>;
const num = (v: V, k: string) => Number(v[k] ?? 0);
const bool = (v: V, k: string) => v[k] === true;
const arr = <T = unknown>(v: V, k: string) => (Array.isArray(v[k]) ? (v[k] as T[]) : []);

/** Built-ins that put nothing on the air (the overview's "Sends on the mesh" leaves them out). */
export const SENDS_NOTHING: ReadonlySet<BuiltinId> = new Set<BuiltinId>([
  'airtime-cutoff', 'auto-favorite', 'auto-heap-management', 'auto-delete-by-distance', 'ignored-nodes',
]);

/** Whether the built-in is on, from its own settings (Ignored nodes is a list, never off). */
export function builtinIsOn(id: BuiltinId, v: V): boolean {
  switch (id) {
    case 'auto-acknowledge': return bool(v, 'autoAckEnabled');
    case 'auto-responder': return bool(v, 'autoResponderEnabled');
    case 'auto-welcome': return bool(v, 'autoWelcomeEnabled');
    case 'auto-ping': return bool(v, 'autoPingEnabled');
    case 'geofence-triggers': return arr<V>(v, 'geofenceTriggers').some((g) => g.enabled === true);
    case 'forwarding': return bool(v, 'enabled') && arr<V>(v, 'rules').some((r) => r.enabled === true);
    case 'auto-announce': return bool(v, 'autoAnnounceEnabled');
    case 'timer-triggers': return arr<V>(v, 'timerTriggers').some((tr) => tr.enabled === true);
    case 'auto-time-sync': return bool(v, 'enabled');
    case 'airtime-cutoff': return num(v, 'automationAirtimeCutoffThreshold') > 0;
    case 'auto-favorite': return bool(v, 'autoFavoriteEnabled');
    case 'auto-key-management': return bool(v, 'autoKeyManagementEnabled');
    case 'auto-heap-management': return bool(v, 'autoHeapManagementEnabled');
    case 'auto-traceroute': return bool(v, 'enabled');
    case 'auto-localstats': return bool(v, 'enabled');
    case 'remote-admin-scanner': return bool(v, 'enabled');
    case 'auto-delete-by-distance': return bool(v, 'autoDeleteByDistanceEnabled');
    case 'ignored-nodes': return true;
  }
}

/** How many times a cron fires in the 24 h after `now` (a bad expression: 0). */
export function runsInADay(expr: string, now: number): number {
  try {
    const end = now + 86_400_000;
    return new Cron(expr, { paused: true }).nextRuns(1441, new Date(now)).filter((d) => d.getTime() <= end).length;
  } catch {
    return 0;
  }
}

function line(id: BuiltinId, v: V, t: TFunction, ctx: SendsCtx): string {
  const k = (key: string, opts?: Record<string, unknown>) => t(`workspace.automations.sends.${key}`, opts ?? {});
  const channel = (i: number) => ctx.channelName?.(i) ?? t('forwarding.channel_n', { index: i });
  const join = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' · ');
  switch (id) {
    case 'auto-acknowledge': {
      const cooldown = num(v, 'autoAckCooldownSeconds');
      const quiet = num(v, 'autoAckMaxResponses');
      const attempts = num(v, 'autoAckMaxAttempts');
      return join(
        cooldown > 0 ? k('ack_cooldown', { seconds: cooldown }) : k('ack_each'),
        quiet > 0 && k('ack_quiet', { count: quiet }),
        attempts > 1 && k('ack_retry', { count: attempts }),
      );
    }
    case 'auto-responder': {
      const triggers = arr<V>(v, 'autoResponderTriggers');
      const cooled = triggers.some((tr) => Number(tr.cooldownSeconds ?? 0) > 0);
      return join(cooled ? k('responder_cooldown') : k('responder_no_cooldown'), k('responder_reply'));
    }
    case 'auto-welcome': {
      const target = String(v.autoWelcomeTarget ?? 'dm');
      const base = target === 'dm' ? k('welcome_dm') : k('welcome_channel', { channel: channel(Number(target)) });
      return bool(v, 'autoWelcomeWaitForName') ? k('welcome_named', { text: base }) : base;
    }
    case 'auto-ping':
      return k('ping', { max: num(v, 'autoPingMaxPings'), seconds: num(v, 'autoPingIntervalSeconds') });
    case 'geofence-triggers': {
      const on = arr<V>(v, 'geofenceTriggers').filter((g) => g.enabled === true);
      const open = on.filter((g) => !(Number(g.cooldownMinutes ?? 0) > 0)).length;
      return join(open > 0 ? k('geofence_open', { count: open }) : k('geofence_cooldown'), k('triggers', { count: on.length }));
    }
    case 'forwarding':
      return k('forwarding', { max: FORWARDING_MAX_PER_WINDOW });
    case 'auto-announce': {
      const where = arr<number>(v, 'autoAnnounceChannelIndexes').map(channel).join(', ');
      const hop = String(v.autoAnnounceHopLimit ?? '');
      const when = bool(v, 'autoAnnounceUseSchedule')
        ? k('announce_cron', { channels: where, cron: String(v.autoAnnounceSchedule ?? '') })
        : k('announce_every', { channels: where, count: num(v, 'autoAnnounceIntervalHours') });
      const nodeInfo = bool(v, 'autoAnnounceNodeInfoEnabled') ? arr(v, 'autoAnnounceNodeInfoChannels').length : 0;
      return join(when, hop !== '' && k('hop_limit', { count: Number(hop) }), nodeInfo > 0 && k('announce_nodeinfo', { count: nodeInfo }));
    }
    case 'timer-triggers': {
      const on = arr<V>(v, 'timerTriggers').filter((tr) => tr.enabled === true);
      const runs = on.reduce((sum, tr) => sum + runsInADay(String(tr.cronExpression ?? ''), ctx.now ?? Date.now()), 0);
      return join(k('timer_run'), k('runs_a_day', { count: runs }));
    }
    case 'auto-time-sync':
      return k('time_sync', { minutes: num(v, 'intervalMinutes') });
    case 'airtime-cutoff': {
      const threshold = num(v, 'automationAirtimeCutoffThreshold');
      return threshold > 0 ? k('airtime', { threshold }) : k('airtime_off');
    }
    case 'auto-key-management':
      return k('key_repair', { max: num(v, 'autoKeyManagementMaxExchanges'), minutes: num(v, 'autoKeyManagementIntervalMinutes') });
    case 'auto-heap-management':
      return k('heap', { kb: num(v, 'thresholdKb') });
    case 'auto-traceroute':
      return join(k('traceroute', { minutes: num(v, 'intervalMinutes') }), bool(v, 'scheduleEnabled') && k('window', { start: v.scheduleStart, end: v.scheduleEnd }));
    case 'auto-localstats':
      return join(k('localstats', { minutes: num(v, 'intervalMinutes') }), bool(v, 'scheduleEnabled') && k('window', { start: v.scheduleStart, end: v.scheduleEnd }));
    case 'remote-admin-scanner':
      return join(k('admin_scanner', { minutes: num(v, 'intervalMinutes') }), bool(v, 'scheduleEnabled') && k('window', { start: v.scheduleStart, end: v.scheduleEnd }));
    case 'auto-favorite':
    case 'auto-delete-by-distance':
    case 'ignored-nodes':
      return t('workspace.settings.savebar.sends_nothing');
  }
}

/**
 * The Sends line for one built-in. Off reads "When on, …"; a line that is
 * only "Sends nothing on the mesh" reads the same either way.
 */
export function builtinSends(id: BuiltinId, settings: Record<string, unknown>, t: TFunction, ctx: SendsCtx = {}): string {
  const text = line(id, settings, t, ctx);
  // Airtime cutoff's own line says when it is off (threshold 0); "sends nothing" needs no "When on".
  if (id === 'airtime-cutoff' || text === t('workspace.settings.savebar.sends_nothing') || builtinIsOn(id, settings)) return text;
  return t('workspace.automations.sends.when_on', { text: text.charAt(0).toLowerCase() + text.slice(1) });
}
