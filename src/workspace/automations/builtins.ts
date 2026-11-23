/**
 * A Meshtastic device's eighteen built-in automations (Task 8.3), as data, on
 * the same `Builtin` shape as MeshCore's (Task 7.5): what each reads and saves
 * (today's endpoints and bodies, from AutomationTab's sections), its fields on
 * the row kit with today's clamps and help, whether it is on, a summary, its
 * Sends line (`builtinSends`) and what a save does on today's server.
 *
 * Saving sends exactly today's request(s) for that built-in, once per press.
 * Nothing here runs a built-in: Send now, Run now and the per-row actions are
 * the page's own controls.
 */
import type { TFunction } from 'i18next';
import { isValidCron } from 'cron-validator';
import apiService from '../../services/api';
import { getPath, type Builtin, type Field, type Option, type Values } from '../meshcore/automations/builtins';
import { builtinTable as meshcoreTable } from '../meshcore/automations/builtins';
import { settingsToMatrix, matrixToSettings, type AutoAckMatrix } from '../../utils/autoAckMatrix';
import { hasRE2IncompatibleConstructs } from '../../utils/autoAckRegex';
import { hopLimitSettingValue, HOP_LIMIT_OVERRIDE_MAX } from '../../utils/hopLimitOverride';
import { resolveAutoAckMaxResponses, AUTO_ACK_MAX_RESPONSES_MAX, AUTO_ACK_MAX_RESPONSES_MIN } from '../../utils/autoAckMaxResponses';
import { HOP_EMOJI_SETTING_MAX_LENGTH } from '../../utils/hopEmoji';
import { DEVICE_ROLES } from '../../utils/deviceRole';
import { getHardwareModelName } from '../../utils/hardwareModel';
import {
  COOLDOWN_SECONDS_MAX,
  DISTANCE_DELETE_THRESHOLD_KM_MAX,
  GEOFENCE_COOLDOWN_MINUTES_MAX,
  GEOFENCE_INTERVAL_MINUTES_MAX,
  GEOFENCE_INTERVAL_MINUTES_MIN,
  HOP_FILTER_MAX,
  LAST_HEARD_FILTER_HOURS_MAX,
} from '../../components/automationInputLimits';
import {
  finalizeTrigger,
  hasErrors,
  newAutoResponderTrigger,
  patternText,
  triggerSyntax,
  validateAutoResponderTrigger,
} from '../../components/auto-responder/triggerModel';
import { finalizeTimerTrigger, firstTimerError, hasTimerErrors, newTimerTrigger, validateTimerTrigger } from '../../components/timer-triggers/timerTriggerModel';
import type { AutoResponderTrigger, GeofenceTrigger, TimerTrigger } from '../../components/auto-responder/types';
import { builtinIsOn, builtinSends, SENDS_NOTHING, type BuiltinId } from './builtinSends';

export type Group = 'replies' | 'scheduled' | 'care' | 'data';
export const GROUPS: Group[] = ['replies', 'scheduled', 'care', 'data'];

export interface MeshtasticBuiltin extends Builtin {
  id: BuiltinId;
  group: Group;
  /** A short value shown in place of a switch (Airtime cutoff's threshold, the ignored count). */
  value?(v: Values): string | null;
}

export interface MeshtasticCtx {
  channels: Array<{ id: number; name: string }>;
  /** This source's nodes (the poll's, or `/api/nodes` on the pages that need its fields). */
  nodes: Array<{ num: number; id: string; name: string; role?: number; hwModel?: number; hasRemoteAdmin?: boolean }>;
  scripts: Array<{ path: string; name: string }>;
  /** The airtime picker's eligible nodes (read on its page only). */
  candidates: Array<{ nodeNum: number; label: string }>;
  localNodeNum: number | null;
  /** The viewer's distance unit (today's Delete by Distance shows its threshold in it). */
  distanceUnit?: 'km' | 'mi';
  /** Today's shared `/api/settings?sourceId=` read, once per visit. */
  settings(sourceId: string): Promise<Record<string, unknown>>;
}

// ── values ────────────────────────────────────────────────────────────────────

type S = Record<string, unknown>;
const bool = (s: S, k: string) => s[k] === 'true' || s[k] === true;
const str = (s: S, k: string, d = '') => (s[k] === undefined || s[k] === null ? d : String(s[k]));
const num = (s: S, k: string, d: number) => {
  const v = s[k];
  if (v === undefined || v === null || v === '') return d;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? d : n;
};
/** AutomationContext's `jsonArr`: JSON first, then a CSV of numbers, then one number. */
function jsonArr<T>(s: S, k: string, d: T[]): T[] {
  const raw = s[k];
  if (raw === undefined || raw === null || raw === '') return d;
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) return parsed as T[];
  } catch { /* fall through */ }
  if (typeof raw === 'string' && raw.includes(',')) {
    const nums = raw.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n));
    if (nums.length > 0) return nums as unknown as T[];
  }
  if (typeof raw === 'string') {
    const n = parseInt(raw.trim(), 10);
    if (!isNaN(n)) return [n] as unknown as T[];
  }
  return d;
}
const b = (v: Values, k: string) => getPath(v, k) === true;
const n = (v: Values, k: string) => Number(getPath(v, k) ?? 0);
const list = <T = Values>(v: Values, k: string) => (Array.isArray(getPath(v, k)) ? (getPath(v, k) as T[]) : []);
const q = (sourceId: string) => `?sourceId=${encodeURIComponent(sourceId)}`;
const postSettings = (sourceId: string, body: Record<string, unknown>) => apiService.post(`/api/settings${q(sourceId)}`, body);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Today's auto-ack regex rule (AutoAcknowledgeSection validateRegex). */
function ackRegexError(t: TFunction, pattern: string): string | null {
  if (pattern.length > 100) return t('automation.auto_ack.pattern_too_long');
  if (/(\.\*){2,}|(\+.*\+)|(\*.*\*)|(\{[0-9]{3,}\})|(\{[0-9]+,\})/.test(pattern)) return t('automation.auto_ack.pattern_too_complex');
  if (hasRE2IncompatibleConstructs(pattern)) return t('automation.auto_ack.unsupported_regex');
  try {
    new RegExp(pattern, 'i');
    return null;
  } catch {
    return t('automation.auto_ack.invalid_regex');
  }
}

export const ACK_DEFAULTS = {
  regex: '^(test|ping)',
  message: '🤖 Copy, {NUMBER_HOPS} hops at {TIME}',
  messageDirect: '🤖 Copy, direct connection! SNR: {SNR}dB RSSI: {RSSI}dBm at {TIME}',
  testMessages: 'test\nTest message\nping\nPING\nHello world\nTESTING 123',
};

/** A trigger list's edited or new items, finalised the way today's Done does; unchanged ones as saved. */
function prepare<T extends { id: string }>(items: T[], saved: T[], finalize: (x: T) => T): T[] {
  const before = new Map(saved.map((x) => [x.id, JSON.stringify(x)]));
  return items.map((x) => (before.get(x.id) === JSON.stringify(x) ? x : finalize(x)));
}

// ── the table ─────────────────────────────────────────────────────────────────

export function builtinTable(t: TFunction, ctx: MeshtasticCtx): MeshtasticBuiltin[] {
  const nothing = () => t('workspace.automations.save.nothing');
  const channelName = (id: number) => ctx.channels.find((c) => c.id === id)?.name || t('forwarding.channel_n', { index: id });
  const channelOptions: Option[] = ctx.channels.map((c) => ({ value: String(c.id), label: c.name || channelName(c.id) }));
  const nodeOptions: Option[] = ctx.nodes.map((nd) => ({ value: String(nd.num), label: nd.name }));
  const scriptOptions: Option[] = [{ value: '', label: t('automation.timer_triggers.select_script', 'Select a script...') }, ...ctx.scripts.map((sc) => ({ value: sc.path, label: sc.name }))];
  const hopOptions: Option[] = [
    { value: '', label: t('automation.hop_limit_override.inherit', "Inherit (the node's own hop limit)") },
    { value: '0', label: t('automation.hop_limit_override.zero', '0 — local only, no relay') },
    ...Array.from({ length: HOP_LIMIT_OVERRIDE_MAX }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
  ];
  const hopField = (key: string): Field => ({
    kind: 'select', key, label: t('automation.hop_limit_override.label', 'Hop limit'), options: hopOptions,
    help: t('automation.hop_limit_override.description', "How far this automated message may travel. Capped at the node's own hop limit, so it can only shorten reach, never extend it. 0 keeps it to nodes that hear this radio directly."),
  });
  const sends = (id: BuiltinId) => (v: Values) => builtinSends(id, v, t, { channelName });
  const miles = ctx.distanceUnit === 'mi';
  const toUnit = (km: number) => (miles ? km * 0.621371 : km);
  const fromUnit = (val: number) => (miles ? val / 0.621371 : val);
  const scheduleFields = (help: string): Field[] => [
    { kind: 'toggle', key: 'scheduleEnabled', label: t('automation.remote_admin_scanner.schedule_window', 'Schedule window'), help },
    { kind: 'text', key: 'scheduleStart', label: t('automation.schedule.starting_at', 'Starting at'), placeholder: 'HH:MM', mono: true, maxLength: 5, showIf: (v) => b(v, 'scheduleEnabled') },
    { kind: 'text', key: 'scheduleEnd', label: t('automation.schedule.ending_at', 'Ending at'), placeholder: 'HH:MM', mono: true, maxLength: 5, showIf: (v) => b(v, 'scheduleEnabled') },
  ];
  const scheduleError = (v: Values) =>
    b(v, 'scheduleEnabled') && (!HHMM.test(String(v.scheduleStart)) || !HHMM.test(String(v.scheduleEnd)))
      ? t('workspace.automations.bad_time')
      : null;
  const roleOptions: Option[] = Object.entries(DEVICE_ROLES).map(([k, label]) => ({ value: k, label }));
  const hwOptions: Option[] = [...new Set(ctx.nodes.map((nd) => nd.hwModel).filter((h): h is number => typeof h === 'number'))]
    .sort((a, c) => a - c)
    .map((h) => ({ value: String(h), label: getHardwareModelName(h) }));
  const modeOptions: Option[] = [
    { value: 'or', label: t('workspace.automations.mode_or') },
    { value: 'and', label: t('workspace.automations.mode_and') },
  ];
  const filterRow = (key: string, label: string, enabledKey: string, modeKey: string | null, rest: Partial<Field>): Field[] => [
    { kind: 'toggle', key: enabledKey, label, showIf: (v) => b(v, 'filter.enabled') },
    ...(modeKey ? [{ kind: 'select' as const, key: modeKey, label: t('workspace.automations.combine', { name: label }), options: modeOptions, showIf: (v: Values) => b(v, 'filter.enabled') && b(v, enabledKey) }] : []),
    { kind: 'multi', key, label, ...rest, showIf: (v) => b(v, 'filter.enabled') && b(v, enabledKey) } as Field,
  ];

  // Forwarding is the same per-source route and rule model on both protocols: MeshCore's entry, over this device's nodes.
  const forwarding = meshcoreTable(t, {
    channels: ctx.channels,
    contacts: ctx.nodes.filter((nd) => nd.num !== ctx.localNodeNum).map((nd) => ({ publicKey: nd.id, name: `${nd.name} (${nd.id})` })),
    scripts: [],
  }).find((x) => x.id === 'forwarding')!;

  const table: MeshtasticBuiltin[] = [
    // ── Replies ──────────────────────────────────────────────────────────────
    {
      id: 'auto-acknowledge', group: 'replies', transmits: true, enabledKey: 'autoAckEnabled',
      title: t('automation.auto_ack.title', 'Auto Acknowledge'),
      description: t('automation.auto_ack.description'),
      load: async (sourceId) => {
        const s = await ctx.settings(sourceId);
        return {
          autoAckEnabled: bool(s, 'autoAckEnabled'),
          autoAckRegex: str(s, 'autoAckRegex') || ACK_DEFAULTS.regex,
          autoAckMessage: str(s, 'autoAckMessage') || ACK_DEFAULTS.message,
          autoAckMessageDirect: str(s, 'autoAckMessageDirect') || ACK_DEFAULTS.messageDirect,
          autoAckChannels: jsonArr<number>(s, 'autoAckChannels', []),
          autoAckSkipIncompleteNodes: bool(s, 'autoAckSkipIncompleteNodes'),
          autoAckIgnoredNodes: str(s, 'autoAckIgnoredNodes'),
          matrix: settingsToMatrix(s as Record<string, string>),
          autoAckCooldownSeconds: num(s, 'autoAckCooldownSeconds', 60),
          autoAckPreSendDelaySeconds: num(s, 'autoAckPreSendDelaySeconds', 0),
          // Clamp to [1,3] client-side too, as today (the server clamps, #4266).
          autoAckMaxAttempts: Math.min(3, Math.max(1, num(s, 'autoAckMaxAttempts', 3))),
          autoAckHopLimit: hopLimitSettingValue(s.autoAckHopLimit),
          autoAckMaxResponses: resolveAutoAckMaxResponses(s.autoAckMaxResponses as string | undefined),
          hopEmojiZeroHop: str(s, 'hopEmojiZeroHop'),
          hopEmojiMqtt: str(s, 'hopEmojiMqtt'),
          autoAckTestMessages: str(s, 'autoAckTestMessages') || ACK_DEFAULTS.testMessages,
        };
      },
      save: async (sourceId, v) => {
        await postSettings(sourceId, {
          autoAckEnabled: String(v.autoAckEnabled),
          autoAckRegex: v.autoAckRegex,
          autoAckMessage: v.autoAckMessage,
          autoAckMessageDirect: v.autoAckMessageDirect,
          autoAckChannels: list<number>(v, 'autoAckChannels').join(','),
          autoAckSkipIncompleteNodes: String(v.autoAckSkipIncompleteNodes),
          autoAckIgnoredNodes: v.autoAckIgnoredNodes,
          ...matrixToSettings(v.matrix as AutoAckMatrix),
          autoAckCooldownSeconds: String(v.autoAckCooldownSeconds),
          autoAckPreSendDelaySeconds: String(v.autoAckPreSendDelaySeconds),
          autoAckMaxAttempts: String(v.autoAckMaxAttempts),
          autoAckHopLimit: v.autoAckHopLimit,
          autoAckMaxResponses: String(v.autoAckMaxResponses),
          hopEmojiZeroHop: String(v.hopEmojiZeroHop ?? '').trim(),
          hopEmojiMqtt: String(v.hopEmojiMqtt ?? '').trim(),
          autoAckTestMessages: v.autoAckTestMessages,
        });
      },
      validate: (v) => ackRegexError(t, String(v.autoAckRegex ?? '')),
      savedKeys: [{ key: 'matrix', label: t('automation.auto_ack.response_matrix') }],
      isOn: (v) => builtinIsOn('auto-acknowledge', v),
      summary: (v) => t('workspace.automations.ack_summary', { regex: String(v.autoAckRegex) }),
      sends: sends('auto-acknowledge'),
      saveEffect: nothing,
      fields: (v) => [
        { kind: 'heading', key: 'h.trigger', label: t('workspace.automations.trigger_pattern') },
        { kind: 'text', key: 'autoAckRegex', label: t('automation.auto_ack.regex_label'), help: t('workspace.automations.regex_rules'), mono: true, maxLength: 100 },
        { kind: 'textarea', key: 'autoAckTestMessages', label: t('automation.auto_ack.pattern_testing'), placeholder: t('automation.auto_ack.test_placeholder') },
        { kind: 'multi', key: 'autoAckChannels', label: t('automation.auto_ack.active_channels'), options: channelOptions, numeric: true },
        { kind: 'heading', key: 'h.limits', label: t('workspace.automations.limits') },
        { kind: 'number', key: 'autoAckCooldownSeconds', label: t('automation.auto_ack.cooldown_label'), help: t('automation.auto_ack.cooldown_help'), min: 0, max: COOLDOWN_SECONDS_MAX },
        { kind: 'number', key: 'autoAckMaxResponses', label: t('automation.auto_ack.max_responses_label', 'Maximum number of responses'),
          help: `${t('automation.auto_ack.max_responses_help', 'other nodes (0 = no limit, default 2, max 10)')} · ${n(v, 'autoAckMaxResponses') > 0
            ? t('workspace.automations.quiet_after', { count: n(v, 'autoAckMaxResponses') })
            : t('automation.auto_ack.max_responses_zero_hint', '0 = no limit: always answer after the wait')}`,
          min: AUTO_ACK_MAX_RESPONSES_MIN, max: AUTO_ACK_MAX_RESPONSES_MAX },
        { kind: 'number', key: 'autoAckMaxAttempts', label: t('automation.auto_ack.max_attempts_label', 'Auto-Ack Resend Attempts'),
          help: t('automation.auto_ack.max_attempts_help', 'attempts (1 = least airtime, 3 = default)'), min: 1, max: 3 },
        { kind: 'number', key: 'autoAckPreSendDelaySeconds', label: t('automation.auto_ack.presend_delay_label', 'Pre-Send Delay'),
          help: t('automation.auto_ack.presend_delay_help', 'seconds (0 = send immediately, max 120)'), min: 0, max: 120 },
        hopField('autoAckHopLimit'),
        { kind: 'heading', key: 'h.templates', label: t('workspace.automations.message_templates') },
        { kind: 'textarea', key: 'autoAckMessage', label: t('automation.auto_ack.message_multihop'), help: t('automation.auto_ack.tokens_info') },
        { kind: 'textarea', key: 'autoAckMessageDirect', label: t('automation.auto_ack.message_direct') },
        { kind: 'text', key: 'hopEmojiZeroHop', label: t('automation.auto_ack.zero_hop_emoji', '0-hop tapback'), maxLength: HOP_EMOJI_SETTING_MAX_LENGTH,
          help: t('automation.auto_ack.zero_hop_emoji_description', 'The tapback for a message heard directly. Leave blank for *️⃣; some meshes use 0️⃣. Hop-count tapbacks in automations use it too.') },
        { kind: 'text', key: 'hopEmojiMqtt', label: t('automation.auto_ack.mqtt_emoji', 'MQTT tapback'), maxLength: HOP_EMOJI_SETTING_MAX_LENGTH,
          help: t('automation.auto_ack.mqtt_emoji_description', 'The tapback for a message that came over MQTT or UDP (the IP row). Leave blank to use its hop-count glyph. Automations use it for messages from an MQTT source, in place of #️⃣.') },
        { kind: 'heading', key: 'h.security', label: t('workspace.automations.security') },
        { kind: 'toggle', key: 'autoAckSkipIncompleteNodes', label: t('automation.auto_ack.skip_incomplete'), help: t('automation.auto_ack.skip_incomplete_description') },
        { kind: 'text', key: 'autoAckIgnoredNodes', label: t('automation.auto_ack.node_ignore_list'), help: t('automation.auto_ack.node_ignore_list_description'), mono: true },
      ],
    },
    {
      id: 'auto-responder', group: 'replies', transmits: true, enabledKey: 'autoResponderEnabled',
      title: t('auto_responder.title', 'Auto Responder'),
      description: t('auto_responder.description', ''),
      load: async (sourceId) => {
        const s = await ctx.settings(sourceId);
        return {
          autoResponderEnabled: bool(s, 'autoResponderEnabled'),
          autoResponderTriggers: jsonArr<AutoResponderTrigger>(s, 'autoResponderTriggers', []),
          autoResponderSkipIncompleteNodes: bool(s, 'autoResponderSkipIncompleteNodes'),
        };
      },
      save: async (sourceId, v, saved) => {
        const prepared = prepare(list<AutoResponderTrigger>(v, 'autoResponderTriggers'), list<AutoResponderTrigger>(saved, 'autoResponderTriggers'), finalizeTrigger);
        await postSettings(sourceId, {
          autoResponderEnabled: String(v.autoResponderEnabled),
          autoResponderTriggers: JSON.stringify(prepared),
          autoResponderSkipIncompleteNodes: String(v.autoResponderSkipIncompleteNodes),
        });
      },
      validate: (v, saved) => {
        const before = new Map(list<AutoResponderTrigger>(saved, 'autoResponderTriggers').map((x) => [x.id, JSON.stringify(x)]));
        for (const tr of list<AutoResponderTrigger>(v, 'autoResponderTriggers')) {
          if (before.get(tr.id) === JSON.stringify(tr)) continue;
          const errs = validateAutoResponderTrigger(finalizeTrigger(tr), t);
          if (hasErrors(errs)) return errs.trigger || errs.response || errs.channels || t('auto_responder.invalid_trigger');
        }
        return null;
      },
      isOn: (v) => builtinIsOn('auto-responder', v),
      summary: (v) => {
        const triggers = list<AutoResponderTrigger>(v, 'autoResponderTriggers');
        const scripts = new Set(triggers.filter((tr) => tr.responseType === 'script').map((tr) => tr.response)).size;
        return [t('workspace.automations.triggers_count', { count: triggers.length }), scripts > 0 && t('workspace.meshcore.auto.scripts', { count: scripts })].filter(Boolean).join(' · ');
      },
      sends: sends('auto-responder'),
      saveEffect: nothing,
      fields: () => [
        { kind: 'toggle', key: 'autoResponderSkipIncompleteNodes', label: t('automation.auto_ack.skip_incomplete'), help: t('automation.auto_ack.skip_incomplete_description') },
        {
          kind: 'list', key: 'autoResponderTriggers', label: t('workspace.meshcore.auto.triggers'), addLabel: t('workspace.automations.new_trigger'),
          searchLabel: t('automation.trigger_list.search_label', 'Search triggers'),
          itemFilter: {
            label: t('automation.trigger_list.type_label', 'Filter by type'),
            options: [{ value: 'all', label: t('auto_responder.filter_all') },
              ...(['text', 'http', 'script', 'traceroute', 'mailbox'] as const).map((r) => ({ value: r, label: t(`auto_responder.type_${r}`) }))],
            match: (x, value) => x.responseType === value,
          },
          // Today's TriggerCard confirm (#5808).
          confirmDelete: (x) => ({
            title: t('auto_responder.remove_trigger_title'),
            message: `${t('auto_responder.remove_trigger_draft_confirm')} ${patternText((x.trigger as string | string[]) ?? '')}`.trim(),
            confirmLabel: t('common.remove', 'Remove'),
          }),
          itemTitle: (x) => patternText((x.trigger as string | string[]) ?? '').trim() || t('workspace.automations.new_trigger'),
          itemSub: (x) => {
            const tr = x as unknown as AutoResponderTrigger;
            return [t(`auto_responder.type_${tr.responseType}`), tr.responseType === 'script' ? tr.response : null,
              Number(tr.cooldownSeconds ?? 0) > 0 && t('workspace.automations.cooldown_s', { count: Number(tr.cooldownSeconds) })].filter(Boolean).join(' · ');
          },
          newItem: () => newAutoResponderTrigger() as unknown as Values,
          validateItem: (x) => {
            const errs = validateAutoResponderTrigger(finalizeTrigger(x as unknown as AutoResponderTrigger), t);
            return hasErrors(errs) ? (errs.trigger || errs.response || errs.channels || null) : null;
          },
          itemFields: (x) => responderItemFields(t, x, channelOptions, scriptOptions),
        },
      ],
    },
    {
      id: 'auto-welcome', group: 'replies', transmits: true, enabledKey: 'autoWelcomeEnabled',
      title: t('automation.auto_welcome.title', 'Auto Welcome'),
      description: t('automation.auto_welcome.description'),
      load: async (sourceId) => {
        const s = await ctx.settings(sourceId);
        return {
          autoWelcomeEnabled: bool(s, 'autoWelcomeEnabled'),
          autoWelcomeMessage: s.autoWelcomeMessage !== undefined ? str(s, 'autoWelcomeMessage') : 'Welcome {LONG_NAME} ({SHORT_NAME}) to the mesh!',
          autoWelcomeTarget: s.autoWelcomeTarget !== undefined ? str(s, 'autoWelcomeTarget') : '0',
          autoWelcomeWaitForName: s.autoWelcomeWaitForName !== undefined ? bool(s, 'autoWelcomeWaitForName') : true,
          autoWelcomeMaxHops: num(s, 'autoWelcomeMaxHops', 5),
          autoWelcomeDelay: num(s, 'autoWelcomeDelay', 30),
        };
      },
      save: async (sourceId, v) => {
        await postSettings(sourceId, {
          autoWelcomeEnabled: String(v.autoWelcomeEnabled), autoWelcomeMessage: v.autoWelcomeMessage, autoWelcomeTarget: v.autoWelcomeTarget,
          autoWelcomeWaitForName: String(v.autoWelcomeWaitForName), autoWelcomeMaxHops: String(v.autoWelcomeMaxHops), autoWelcomeDelay: String(v.autoWelcomeDelay),
        });
      },
      isOn: (v) => builtinIsOn('auto-welcome', v),
      summary: (v) => (v.autoWelcomeTarget === 'dm' ? t('workspace.meshcore.auto.welcome_dm') : t('workspace.meshcore.auto.welcome_channel', { channel: channelName(Number(v.autoWelcomeTarget)) })),
      sends: sends('auto-welcome'),
      saveEffect: nothing,
      fields: () => [
        { kind: 'textarea', key: 'autoWelcomeMessage', label: t('automation.auto_welcome.message_label'), help: t('automation.auto_welcome.tokens_info') },
        { kind: 'select', key: 'autoWelcomeTarget', label: t('automation.auto_welcome.broadcast_target'), help: t('automation.auto_welcome.broadcast_target_description'),
          options: [{ value: 'dm', label: t('automation.auto_welcome.dm_to_new_node') }, ...channelOptions] },
        { kind: 'toggle', key: 'autoWelcomeWaitForName', label: t('automation.auto_welcome.wait_for_name'), help: t('automation.auto_welcome.wait_for_name_description') },
        { kind: 'number', key: 'autoWelcomeMaxHops', label: t('automation.auto_welcome.max_hops'), help: t('automation.auto_welcome.max_hops_description'), min: 1, max: 10 },
        { kind: 'number', key: 'autoWelcomeDelay', label: t('automation.auto_welcome.delay', 'Pre-send delay (seconds)'), help: t('automation.auto_welcome.delay_description'), min: 0, max: 120 },
      ],
    },
    {
      id: 'auto-ping', group: 'replies', transmits: true, enabledKey: 'autoPingEnabled',
      title: t('automation.auto_ping.title', 'Auto Ping'),
      description: t('automation.auto_ping.description'),
      load: async (sourceId) => {
        const d = await apiService.get<{ settings?: Values; sessions?: Values[] }>(`/api/settings/auto-ping${q(sourceId)}`);
        const s = d?.settings ?? {};
        return {
          autoPingEnabled: s.autoPingEnabled === true, autoPingIntervalSeconds: Number(s.autoPingIntervalSeconds ?? 30),
          autoPingMaxPings: Number(s.autoPingMaxPings ?? 20), autoPingTimeoutSeconds: Number(s.autoPingTimeoutSeconds ?? 60),
          sessions: Array.isArray(d?.sessions) ? d.sessions : [],
        };
      },
      save: async (sourceId, v) => {
        await apiService.post(`/api/settings/auto-ping${q(sourceId)}`, {
          autoPingEnabled: String(v.autoPingEnabled), autoPingIntervalSeconds: String(v.autoPingIntervalSeconds),
          autoPingMaxPings: String(v.autoPingMaxPings), autoPingTimeoutSeconds: String(v.autoPingTimeoutSeconds),
        });
      },
      isOn: (v) => builtinIsOn('auto-ping', v),
      summary: (v) => t('workspace.meshcore.auto.ping_summary', { max: n(v, 'autoPingMaxPings'), seconds: n(v, 'autoPingIntervalSeconds') }),
      sends: sends('auto-ping'),
      saveEffect: nothing,
      fields: () => [
        { kind: 'number', key: 'autoPingIntervalSeconds', label: t('automation.auto_ping.interval', 'Ping Interval (seconds)'), help: t('automation.auto_ping.interval_description'), min: 10, max: 300 },
        { kind: 'number', key: 'autoPingMaxPings', label: t('automation.auto_ping.max_pings', 'Max Pings Per Session'), help: t('automation.auto_ping.max_pings_description'), min: 1, max: 100 },
        { kind: 'number', key: 'autoPingTimeoutSeconds', label: t('automation.auto_ping.timeout', 'Ping Timeout (seconds)'), help: t('automation.auto_ping.timeout_description'), min: 10, max: 300 },
      ],
    },
    {
      id: 'geofence-triggers', group: 'replies', transmits: true, enabledKey: null,
      title: t('automation.geofence_triggers.title', 'Geofence Triggers'),
      description: t('automation.geofence_triggers.description', ''),
      load: async (sourceId) => ({ geofenceTriggers: jsonArr<GeofenceTrigger>(await ctx.settings(sourceId), 'geofenceTriggers', []) }),
      save: async (sourceId, v, saved) => {
        const prepared = prepare(list<GeofenceTrigger>(v, 'geofenceTriggers'), list<GeofenceTrigger>(saved, 'geofenceTriggers'), finalizeGeofence);
        await postSettings(sourceId, { geofenceTriggers: JSON.stringify(prepared) });
      },
      isOn: (v) => builtinIsOn('geofence-triggers', v),
      summary: (v) => t('workspace.automations.triggers_count', { count: list(v, 'geofenceTriggers').length }),
      sends: sends('geofence-triggers'),
      // Today's geofence engine: a save recomputes who is inside without firing; "while inside" timers restart.
      saveEffect: (v) => (list<GeofenceTrigger>(v, 'geofenceTriggers').some((g) => g.enabled && g.event === 'while_inside')
        ? t('workspace.automations.save.geofence_inside') : t('workspace.automations.save.geofence')),
      fields: () => [
        {
          kind: 'list', key: 'geofenceTriggers', label: t('workspace.meshcore.auto.triggers'), addLabel: t('workspace.automations.add_trigger'), itemEnabledKey: 'enabled',
          // Today's remove modal words (GeofenceTriggersSection).
          confirmDelete: (x) => ({
            title: t('workspace.automations.remove_geofence_title'),
            message: t('workspace.automations.remove_geofence_message', { name: String(x.name ?? '') }),
            confirmLabel: t('common.remove', 'Remove'),
          }),
          itemTitle: (x) => String(x.name || t('workspace.automations.new_trigger')),
          itemSub: (x) => geofenceSub(t, x as unknown as GeofenceTrigger, channelName),
          newItem: () => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`, name: '', enabled: true, shape: null, event: 'entry',
            nodeFilter: { type: 'all' }, responseType: 'text', response: '', channel: 'dm', verifyResponse: false,
          }),
          validateItem: (x) => geofenceError(t, x),
          itemFields: (x) => geofenceItemFields(t, x, channelOptions, scriptOptions),
        },
      ],
    },
    { ...forwarding, id: 'forwarding', group: 'replies', sends: sends('forwarding') },

    // ── Scheduled sends ──────────────────────────────────────────────────────
    {
      id: 'auto-announce', group: 'scheduled', transmits: true, enabledKey: 'autoAnnounceEnabled',
      title: t('automation.auto_announce.title', 'Auto Announce'),
      description: t('automation.auto_announce.description'),
      load: async (sourceId) => {
        const s = await ctx.settings(sourceId);
        return {
          autoAnnounceEnabled: bool(s, 'autoAnnounceEnabled'),
          autoAnnounceIntervalHours: num(s, 'autoAnnounceIntervalHours', 6),
          autoAnnounceMessage: s.autoAnnounceMessage !== undefined ? str(s, 'autoAnnounceMessage') : 'MeshMonitor {VERSION} online for {DURATION} {FEATURES}',
          autoAnnounceChannelIndexes: jsonArr<number>(s, 'autoAnnounceChannelIndexes', [0]),
          autoAnnounceHopLimit: hopLimitSettingValue(s.autoAnnounceHopLimit),
          autoAnnounceSplitLongMessages: s.autoAnnounceSplitLongMessages === 'true',
          autoAnnounceOnStart: bool(s, 'autoAnnounceOnStart'),
          autoAnnounceUseSchedule: bool(s, 'autoAnnounceUseSchedule'),
          autoAnnounceSchedule: s.autoAnnounceSchedule !== undefined ? str(s, 'autoAnnounceSchedule') : '0 */6 * * *',
          autoAnnounceNodeInfoEnabled: bool(s, 'autoAnnounceNodeInfoEnabled'),
          autoAnnounceNodeInfoChannels: jsonArr<number>(s, 'autoAnnounceNodeInfoChannels', []),
          autoAnnounceNodeInfoDelaySeconds: num(s, 'autoAnnounceNodeInfoDelaySeconds', 30),
        };
      },
      save: async (sourceId, v) => {
        await postSettings(sourceId, {
          autoAnnounceEnabled: String(v.autoAnnounceEnabled),
          autoAnnounceIntervalHours: v.autoAnnounceIntervalHours,
          autoAnnounceMessage: v.autoAnnounceMessage,
          autoAnnounceChannelIndexes: JSON.stringify(v.autoAnnounceChannelIndexes),
          autoAnnounceOnStart: String(v.autoAnnounceOnStart),
          autoAnnounceUseSchedule: String(v.autoAnnounceUseSchedule),
          autoAnnounceSchedule: v.autoAnnounceSchedule,
          autoAnnounceHopLimit: v.autoAnnounceHopLimit,
          autoAnnounceSplitLongMessages: String(v.autoAnnounceSplitLongMessages),
          autoAnnounceNodeInfoEnabled: String(v.autoAnnounceNodeInfoEnabled),
          autoAnnounceNodeInfoChannels: JSON.stringify(v.autoAnnounceNodeInfoChannels),
          autoAnnounceNodeInfoDelaySeconds: v.autoAnnounceNodeInfoDelaySeconds,
        });
      },
      validate: (v) => {
        if (b(v, 'autoAnnounceUseSchedule') && !isValidCron(String(v.autoAnnounceSchedule ?? ''), { seconds: false })) return t('automation.auto_announce.cannot_save_invalid_cron');
        if (list(v, 'autoAnnounceChannelIndexes').length === 0) return t('automation.auto_announce.no_channels_selected', 'Please select at least one broadcast channel');
        return null;
      },
      isOn: (v) => builtinIsOn('auto-announce', v),
      summary: (v) => [list<number>(v, 'autoAnnounceChannelIndexes').map(channelName).join(', '),
        b(v, 'autoAnnounceUseSchedule') ? t('workspace.meshcore.auto.on_schedule', { cron: v.autoAnnounceSchedule }) : t('workspace.meshcore.auto.every_hours', { count: n(v, 'autoAnnounceIntervalHours') })].join(' · '),
      sends: sends('auto-announce'),
      // Today's restartAnnounceScheduler (autoAnnounceService.ts): re-armed from the save; Announce on Start sends one 30 s later unless one went out in the last hour.
      saveEffect: (v) => (!b(v, 'autoAnnounceEnabled') ? nothing() : b(v, 'autoAnnounceOnStart') ? t('workspace.automations.save.announce_on_start') : t('workspace.automations.save.announce')),
      fields: () => [
        { kind: 'heading', key: 'h.where', label: t('workspace.automations.where_how_often') },
        { kind: 'multi', key: 'autoAnnounceChannelIndexes', label: t('automation.auto_announce.broadcast_channel'), options: channelOptions, numeric: true },
        { kind: 'toggle', key: 'autoAnnounceUseSchedule', label: t('automation.auto_announce.scheduled_sends'), help: t('automation.auto_announce.scheduled_sends_description') },
        { kind: 'number', key: 'autoAnnounceIntervalHours', label: t('automation.auto_announce.interval'), help: t('automation.auto_announce.interval_description'), min: 3, max: 24,
          warn: t('workspace.automations.announce_airtime'), showIf: (v) => !b(v, 'autoAnnounceUseSchedule') },
        { kind: 'text', key: 'autoAnnounceSchedule', label: t('automation.auto_announce.cron_expression'), help: t('automation.auto_announce.cron_expression_description'), mono: true,
          showIf: (v) => b(v, 'autoAnnounceUseSchedule') },
        { kind: 'toggle', key: 'autoAnnounceOnStart', label: t('automation.auto_announce.announce_on_start'), help: t('automation.auto_announce.announce_on_start_description') },
        hopField('autoAnnounceHopLimit'),
        { kind: 'toggle', key: 'autoAnnounceSplitLongMessages', label: t('automation.auto_announce.split_label', 'Long Announcements'),
          help: t('automation.split_long.help', 'Split a long message into up to 3 marked parts instead of cutting it. Each part is a separate transmission.') },
        { kind: 'heading', key: 'h.message', label: t('automation.group.message', 'Message') },
        { kind: 'textarea', key: 'autoAnnounceMessage', label: t('automation.auto_announce.message_label'), help: t('automation.auto_announce.message_description') },
        { kind: 'heading', key: 'h.nodeinfo', label: t('automation.auto_announce.nodeinfo_title') },
        { kind: 'toggle', key: 'autoAnnounceNodeInfoEnabled', label: t('automation.auto_announce.nodeinfo_title'), help: t('automation.auto_announce.nodeinfo_description') },
        { kind: 'multi', key: 'autoAnnounceNodeInfoChannels', label: t('automation.auto_announce.nodeinfo_channels'), options: channelOptions, numeric: true,
          showIf: (v) => b(v, 'autoAnnounceNodeInfoEnabled') },
        { kind: 'number', key: 'autoAnnounceNodeInfoDelaySeconds', label: t('automation.auto_announce.nodeinfo_delay'), help: t('automation.auto_announce.nodeinfo_delay_description'),
          min: 10, max: 300, showIf: (v) => b(v, 'autoAnnounceNodeInfoEnabled') },
      ],
    },
    {
      id: 'timer-triggers', group: 'scheduled', transmits: true, enabledKey: null,
      title: t('automation.timer_triggers.section_title', 'Timer Triggers'),
      description: t('automation.timer_triggers.description', ''),
      load: async (sourceId) => ({ timerTriggers: jsonArr<TimerTrigger>(await ctx.settings(sourceId), 'timerTriggers', []) }),
      save: async (sourceId, v, saved) => {
        const prepared = prepare(list<TimerTrigger>(v, 'timerTriggers'), list<TimerTrigger>(saved, 'timerTriggers'), finalizeTimerTrigger);
        try {
          await postSettings(sourceId, { timerTriggers: JSON.stringify(prepared) });
        } catch (err) {
          // A split timer that fires faster than every 5 minutes (#6330): today's words.
          if ((err as { body?: { code?: string } })?.body?.code === 'SPLIT_TIMER_INTERVAL_TOO_SHORT') {
            throw new Error(t('automation.split_long.timer_min_interval', { minutes: 5, defaultValue: 'A timer that splits long messages needs an interval of at least {{minutes}} minutes.' }), { cause: err });
          }
          throw err;
        }
      },
      validate: (v, saved) => {
        const before = new Map(list<TimerTrigger>(saved, 'timerTriggers').map((x) => [x.id, JSON.stringify(x)]));
        for (const tr of list<TimerTrigger>(v, 'timerTriggers')) {
          if (before.get(tr.id) === JSON.stringify(tr)) continue;
          const errs = validateTimerTrigger(finalizeTimerTrigger(tr), t);
          if (hasTimerErrors(errs)) return firstTimerError(errs) ?? errs.channels ?? null;
        }
        return null;
      },
      isOn: (v) => builtinIsOn('timer-triggers', v),
      summary: (v) => t('workspace.automations.timers_count', { count: list(v, 'timerTriggers').length }),
      sends: sends('timer-triggers'),
      // Today's timers are cron: a save re-arms each to its next time of day and fires nothing.
      saveEffect: () => t('workspace.automations.save.timers'),
      fields: () => [
        {
          kind: 'list', key: 'timerTriggers', label: t('workspace.automations.timers'), addLabel: t('automation.timer_triggers.add_trigger', 'Add Timer'), itemEnabledKey: 'enabled',
          searchLabel: t('automation.timer_triggers.search', 'Search timers…').replace(/…$/, ''),
          itemFilter: {
            label: t('automation.trigger_list.type_label', 'Filter by type'),
            options: [
              { value: 'all', label: t('automation.timer_triggers.filter_all', 'All types') },
              { value: 'script', label: t('automation.timer_triggers.type_script', 'Script') },
              { value: 'text', label: t('automation.timer_triggers.type_text', 'Text Message') },
            ],
            match: (x, value) => (x.responseType ?? 'script') === value,
          },
          confirmDelete: (x) => ({
            title: t('automation.timer_triggers.remove_title', 'Remove timer?'),
            message: `${t('automation.trigger_card.delete_message', 'The trigger is removed from the list now and deleted when you save.')} ${String(x.name || x.cronExpression || '')}`.trim(),
            confirmLabel: t('common.remove', 'Remove'),
          }),
          itemTitle: (x) => String(x.name || t('meshcore.automation.timers.untitled', 'New trigger')),
          itemSub: (x) => [String(x.cronExpression ?? ''), typeof x.lastRun === 'number' ? `${t('meshcore.automation.timers.last_run', 'Last run')} ${new Date(x.lastRun).toLocaleString()}` : null]
            .filter(Boolean).join(' · '),
          newItem: () => newTimerTrigger() as unknown as Values,
          validateItem: (x) => {
            const errs = validateTimerTrigger(finalizeTimerTrigger(x as unknown as TimerTrigger), t);
            return hasTimerErrors(errs) ? (firstTimerError(errs) ?? errs.channels ?? null) : null;
          },
          itemFields: (x) => timerItemFields(t, x, channelOptions, scriptOptions),
        },
      ],
    },
    {
      id: 'auto-time-sync', group: 'scheduled', transmits: true, enabledKey: 'enabled',
      title: t('automation.time_sync.title', 'Auto Time Sync'),
      description: t('automation.time_sync.description'),
      load: async (sourceId) => {
        const d = await apiService.get<Values>(`/api/settings/time-sync-nodes${q(sourceId)}`);
        return {
          enabled: d?.enabled === true, intervalMinutes: Number(d?.intervalMinutes || 15), expirationHours: Number(d?.expirationHours || 24),
          filterEnabled: d?.filterEnabled === true, nodeNums: Array.isArray(d?.nodeNums) ? d.nodeNums : [],
        };
      },
      save: async (sourceId, v) => {
        await apiService.post(`/api/settings/time-sync-nodes${q(sourceId)}`, {
          enabled: v.enabled, nodeNums: v.nodeNums, filterEnabled: v.filterEnabled, expirationHours: v.expirationHours, intervalMinutes: v.intervalMinutes,
        });
      },
      isOn: (v) => builtinIsOn('auto-time-sync', v),
      summary: (v) => t('workspace.automations.every_minutes', { count: n(v, 'intervalMinutes') }),
      sends: sends('auto-time-sync'),
      // Today's /time-sync-nodes route re-arms the interval from the save (setTimeSyncInterval); nothing is sent now.
      saveEffect: (v) => (b(v, 'enabled') ? t('workspace.automations.save.interval') : nothing()),
      fields: () => [
        { kind: 'number', key: 'intervalMinutes', label: t('automation.time_sync.interval'), help: t('automation.time_sync.interval_description'), min: 15, max: 1440 },
        { kind: 'number', key: 'expirationHours', label: t('automation.time_sync.expiration_hours'), help: t('automation.time_sync.expiration_hours_description'), min: 1, max: 24 },
        { kind: 'toggle', key: 'filterEnabled', label: t('automation.time_sync.limit_to_nodes'), help: t('automation.time_sync.filter_description') },
        { kind: 'multi', key: 'nodeNums', label: t('automation.time_sync.select_nodes'), numeric: true, showIf: (v) => b(v, 'filterEnabled'),
          options: ctx.nodes.filter((nd) => nd.hasRemoteAdmin || nd.num === ctx.localNodeNum).map((nd) => ({ value: String(nd.num), label: nd.name })) },
      ],
    },

    // ── Node care ────────────────────────────────────────────────────────────
    {
      id: 'airtime-cutoff', group: 'care', transmits: false, enabledKey: null,
      title: t('automation.airtime_cutoff.title', 'Cutoff Airtime Utilization Threshold'),
      description: t('automation.airtime_cutoff.description', ''),
      load: async (sourceId) => {
        const s = await ctx.settings(sourceId);
        const raw = parseInt(str(s, 'automationAirtimeCutoffThreshold', '30'), 10);
        const hops = parseInt(str(s, 'automationAirtimeCutoffNeighborMaxHops', '0'), 10);
        const samples = parseInt(str(s, 'automationAirtimeCutoffNeighborSampleCount', '3'), 10);
        let nodes: number[] = [];
        try {
          const arr = JSON.parse(str(s, 'automationAirtimeCutoffNeighborNodes') || '[]');
          if (Array.isArray(arr)) nodes = arr.map(Number).filter((x, i, all) => Number.isInteger(x) && x > 0 && all.indexOf(x) === i);
        } catch { /* none */ }
        return {
          automationAirtimeCutoffThreshold: Number.isFinite(raw) && raw >= 0 && raw <= 100 ? raw : 30,
          automationAirtimeCutoffSource: s.automationAirtimeCutoffSource === 'neighbors' ? 'neighbors' : 'local',
          automationAirtimeCutoffNeighborMaxHops: Number.isFinite(hops) && hops >= 0 && hops <= 7 ? hops : 0,
          automationAirtimeCutoffNeighborMode: s.automationAirtimeCutoffNeighborMode === 'manual' ? 'manual' : 'auto',
          automationAirtimeCutoffNeighborSampleCount: Number.isFinite(samples) ? Math.max(3, Math.min(5, Math.floor(samples))) : 3,
          automationAirtimeCutoffNeighborNodes: nodes,
        };
      },
      save: async (sourceId, v) => {
        await postSettings(sourceId, {
          automationAirtimeCutoffThreshold: String(v.automationAirtimeCutoffThreshold),
          automationAirtimeCutoffSource: v.automationAirtimeCutoffSource,
          automationAirtimeCutoffNeighborMaxHops: String(v.automationAirtimeCutoffNeighborMaxHops),
          automationAirtimeCutoffNeighborMode: v.automationAirtimeCutoffNeighborMode,
          automationAirtimeCutoffNeighborSampleCount: String(v.automationAirtimeCutoffNeighborSampleCount),
          automationAirtimeCutoffNeighborNodes: JSON.stringify(v.automationAirtimeCutoffNeighborNodes),
        });
      },
      validate: (v) => {
        const manual = v.automationAirtimeCutoffSource === 'neighbors' && v.automationAirtimeCutoffNeighborMode === 'manual';
        const count = list(v, 'automationAirtimeCutoffNeighborNodes').length;
        return manual && (count < 3 || count > 5)
          ? t('automation.airtime_cutoff.manual_count_error', { min: 3, max: 5, defaultValue: 'Pick {{min}} to {{max}} infrastructure nodes for manual mode' })
          : null;
      },
      isOn: (v) => builtinIsOn('airtime-cutoff', v),
      value: (v) => `${n(v, 'automationAirtimeCutoffThreshold')} %`,
      summary: (v) => t('workspace.automations.airtime_summary', { threshold: n(v, 'automationAirtimeCutoffThreshold') }),
      sends: sends('airtime-cutoff'),
      saveEffect: nothing,
      fields: () => [
        { kind: 'number', key: 'automationAirtimeCutoffThreshold', label: t('automation.airtime_cutoff.threshold_label', 'Cutoff Airtime Utilization Threshold (%)'),
          help: t('automation.airtime_cutoff.threshold_hint', ''), min: 0, max: 100 },
        { kind: 'select', key: 'automationAirtimeCutoffSource', label: t('automation.airtime_cutoff.source_label', 'Measure Channel Utilization from'),
          help: t('automation.airtime_cutoff.source_hint', ''),
          options: [
            { value: 'local', label: t('automation.airtime_cutoff.source_local_option', 'Local node (own Channel Utilization)') },
            { value: 'neighbors', label: t('automation.airtime_cutoff.source_neighbors_option', 'Nearby infrastructure (average of routers)') },
          ] },
        { kind: 'select', key: 'automationAirtimeCutoffNeighborMode', label: t('automation.airtime_cutoff.mode_label', 'Choose infrastructure nodes'),
          help: t('automation.airtime_cutoff.mode_hint', ''), showIf: (v) => v.automationAirtimeCutoffSource === 'neighbors',
          options: [
            { value: 'auto', label: t('automation.airtime_cutoff.mode_auto_option', 'Auto (strongest RSSI)') },
            { value: 'manual', label: t('automation.airtime_cutoff.mode_manual_option', 'Manual (selected nodes)') },
          ] },
        { kind: 'number', key: 'automationAirtimeCutoffNeighborSampleCount', label: t('automation.airtime_cutoff.sample_count_label', 'Number of infrastructure nodes to average'),
          min: 3, max: 5, showIf: (v) => v.automationAirtimeCutoffSource === 'neighbors' && v.automationAirtimeCutoffNeighborMode === 'auto' },
        { kind: 'multi', key: 'automationAirtimeCutoffNeighborNodes', label: t('automation.airtime_cutoff.picker_label', 'Infrastructure nodes to average'), numeric: true,
          help: t('automation.airtime_cutoff.picker_hint', ''), options: ctx.candidates.map((c) => ({ value: String(c.nodeNum), label: c.label })),
          showIf: (v) => v.automationAirtimeCutoffSource === 'neighbors' && v.automationAirtimeCutoffNeighborMode === 'manual' },
        { kind: 'number', key: 'automationAirtimeCutoffNeighborMaxHops', label: t('automation.airtime_cutoff.max_hops_label', 'Maximum hops for neighbour candidates'),
          min: 0, max: 7, showIf: (v) => v.automationAirtimeCutoffSource === 'neighbors' },
      ],
    },
    {
      id: 'auto-favorite', group: 'care', transmits: false, enabledKey: 'autoFavoriteEnabled',
      title: t('automation.auto_favorite.title', 'Auto Favorite'),
      description: t('automation.auto_favorite.description', ''),
      load: async (sourceId) => {
        const s = await ctx.settings(sourceId);
        return {
          autoFavoriteEnabled: s.autoFavoriteEnabled === 'true',
          autoFavoriteStaleHours: parseInt(str(s, 'autoFavoriteStaleHours') || '72'),
          autoFavoriteExcludeAircraft: s.autoFavoriteExcludeAircraft !== 'false',
          aircraftDetectionEnabled: s.aircraftDetectionEnabled !== 'false',
        };
      },
      save: async (sourceId, v) => {
        await postSettings(sourceId, {
          autoFavoriteEnabled: v.autoFavoriteEnabled ? 'true' : 'false',
          autoFavoriteStaleHours: String(v.autoFavoriteStaleHours),
          autoFavoriteExcludeAircraft: v.autoFavoriteExcludeAircraft ? 'true' : 'false',
        });
      },
      isOn: (v) => builtinIsOn('auto-favorite', v),
      summary: () => t('automation.auto_favorite.target_routers', '0-hop Router, Router Late, and Client Base nodes'),
      sends: sends('auto-favorite'),
      saveEffect: nothing,
      fields: () => [
        { kind: 'number', key: 'autoFavoriteStaleHours', label: t('automation.auto_favorite.stale_hours_label', 'Staleness threshold (hours)'), help: t('automation.auto_favorite.stale_hours_hint', ''), min: 1, max: 720 },
        { kind: 'toggle', key: 'autoFavoriteExcludeAircraft', label: t('automation.auto_favorite.exclude_aircraft_label', 'Exclude likely aircraft'), help: t('automation.auto_favorite.exclude_aircraft_hint', '') },
      ],
    },
    {
      id: 'auto-key-management', group: 'care', transmits: true, enabledKey: 'autoKeyManagementEnabled',
      title: t('automation.auto_key_management.title', 'Auto Key Management'),
      description: t('automation.auto_key_management.description'),
      load: async (sourceId) => {
        const s = await ctx.settings(sourceId);
        return {
          autoKeyManagementEnabled: bool(s, 'autoKeyManagementEnabled'), autoKeyManagementIntervalMinutes: num(s, 'autoKeyManagementIntervalMinutes', 5),
          autoKeyManagementMaxExchanges: num(s, 'autoKeyManagementMaxExchanges', 3), autoKeyManagementAutoPurge: bool(s, 'autoKeyManagementAutoPurge'),
          autoKeyManagementImmediatePurge: bool(s, 'autoKeyManagementImmediatePurge'),
        };
      },
      save: async (sourceId, v) => {
        await postSettings(sourceId, {
          autoKeyManagementEnabled: String(v.autoKeyManagementEnabled), autoKeyManagementIntervalMinutes: String(v.autoKeyManagementIntervalMinutes),
          autoKeyManagementMaxExchanges: String(v.autoKeyManagementMaxExchanges), autoKeyManagementAutoPurge: String(v.autoKeyManagementAutoPurge),
          autoKeyManagementImmediatePurge: String(v.autoKeyManagementImmediatePurge),
        });
      },
      isOn: (v) => builtinIsOn('auto-key-management', v),
      summary: () => t('workspace.automations.key_summary'),
      sends: sends('auto-key-management'),
      saveEffect: nothing,
      fields: () => [
        { kind: 'number', key: 'autoKeyManagementIntervalMinutes', label: t('automation.auto_key_management.interval_minutes'), help: t('automation.auto_key_management.interval_description'), min: 1, max: 60 },
        { kind: 'number', key: 'autoKeyManagementMaxExchanges', label: t('automation.auto_key_management.max_exchanges'), help: t('automation.auto_key_management.max_exchanges_description'), min: 1, max: 10 },
        { kind: 'toggle', key: 'autoKeyManagementAutoPurge', label: t('automation.auto_key_management.auto_purge'), help: t('automation.auto_key_management.auto_purge_description') },
        { kind: 'toggle', key: 'autoKeyManagementImmediatePurge', label: t('automation.auto_key_management.immediate_purge'), help: t('automation.auto_key_management.immediate_purge_description') },
      ],
    },
    {
      id: 'auto-heap-management', group: 'care', transmits: false, enabledKey: 'autoHeapManagementEnabled',
      title: t('automation.auto_heap.title', 'Auto Heap Management'),
      description: t('automation.auto_heap.warning', ''),
      load: async (sourceId) => {
        const s = await ctx.settings(sourceId);
        return { autoHeapManagementEnabled: s.autoHeapManagementEnabled === 'true', thresholdKb: Math.round(parseInt(str(s, 'autoHeapManagementThresholdBytes') || '20000') / 1000) };
      },
      save: async (sourceId, v) => {
        await postSettings(sourceId, { autoHeapManagementEnabled: v.autoHeapManagementEnabled ? 'true' : 'false', autoHeapManagementThresholdBytes: String(n(v, 'thresholdKb') * 1000) });
      },
      isOn: (v) => builtinIsOn('auto-heap-management', v),
      summary: (v) => t('workspace.automations.heap_summary', { kb: n(v, 'thresholdKb') }),
      sends: sends('auto-heap-management'),
      saveEffect: nothing,
      fields: () => [
        { kind: 'number', key: 'thresholdKb', label: t('automation.auto_heap.threshold_label', 'Heap free threshold (KB)'), help: t('automation.auto_heap.threshold_hint', ''), min: 1, max: 500,
          warn: t('automation.auto_heap.warning', '') },
      ],
    },

    // ── Data ─────────────────────────────────────────────────────────────────
    nodeFilterBuiltin('auto-traceroute'),
    nodeFilterBuiltin('auto-localstats'),
    {
      id: 'remote-admin-scanner', group: 'data', transmits: true, enabledKey: 'enabled',
      title: t('automation.remote_admin_scanner.title', 'Remote Admin Scanner'),
      description: t('automation.remote_admin_scanner.description'),
      load: async (sourceId) => {
        const s = await ctx.settings(sourceId);
        const interval = parseInt(str(s, 'remoteAdminScannerIntervalMinutes')) || 0;
        return {
          enabled: interval > 0, intervalMinutes: interval > 0 ? interval : 5, expirationHours: parseInt(str(s, 'remoteAdminScannerExpirationHours')) || 168,
          scheduleEnabled: s.remoteAdminScheduleEnabled === 'true', scheduleStart: str(s, 'remoteAdminScheduleStart') || '00:00', scheduleEnd: str(s, 'remoteAdminScheduleEnd') || '00:00',
        };
      },
      save: async (sourceId, v) => {
        await postSettings(sourceId, {
          remoteAdminScannerIntervalMinutes: String(b(v, 'enabled') ? n(v, 'intervalMinutes') : 0), remoteAdminScannerExpirationHours: String(v.expirationHours),
          remoteAdminScheduleEnabled: String(v.scheduleEnabled), remoteAdminScheduleStart: v.scheduleStart, remoteAdminScheduleEnd: v.scheduleEnd,
        });
      },
      validate: scheduleError,
      isOn: (v) => builtinIsOn('remote-admin-scanner', v),
      summary: (v) => t('workspace.automations.every_minutes', { count: n(v, 'intervalMinutes') }),
      sends: sends('remote-admin-scanner'),
      saveEffect: nothing,
      fields: () => [
        { kind: 'number', key: 'intervalMinutes', label: t('automation.remote_admin_scanner.interval'), help: t('automation.remote_admin_scanner.interval_description'), min: 1, max: 60 },
        { kind: 'number', key: 'expirationHours', label: t('automation.remote_admin_scanner.expiration_hours'), help: t('automation.remote_admin_scanner.expiration_hours_description'), min: 24, max: 168 },
        ...scheduleFields(t('automation.remote_admin_scanner.schedule_window_description')),
      ],
    },
    {
      id: 'auto-delete-by-distance', group: 'data', transmits: false, enabledKey: 'autoDeleteByDistanceEnabled',
      title: t('automation.distance_delete.title', 'Auto Delete by Distance'),
      description: t('automation.distance_delete.description'),
      load: async (sourceId) => {
        const s = await ctx.settings(sourceId);
        return {
          autoDeleteByDistanceEnabled: bool(s, 'autoDeleteByDistanceEnabled'), autoDeleteByDistanceIntervalHours: num(s, 'autoDeleteByDistanceIntervalHours', 24),
          autoDeleteByDistanceThresholdKm: num(s, 'autoDeleteByDistanceThresholdKm', 100),
          autoDeleteByDistanceLat: s.autoDeleteByDistanceLat ? num(s, 'autoDeleteByDistanceLat', 0) : null,
          autoDeleteByDistanceLon: s.autoDeleteByDistanceLon ? num(s, 'autoDeleteByDistanceLon', 0) : null,
          autoDeleteByDistanceAction: s.autoDeleteByDistanceAction === 'ignore' ? 'ignore' : 'delete',
        };
      },
      save: async (sourceId, v) => {
        const body: Record<string, string> = {
          autoDeleteByDistanceEnabled: String(v.autoDeleteByDistanceEnabled), autoDeleteByDistanceIntervalHours: String(v.autoDeleteByDistanceIntervalHours),
          autoDeleteByDistanceThresholdKm: String(v.autoDeleteByDistanceThresholdKm), autoDeleteByDistanceAction: String(v.autoDeleteByDistanceAction),
        };
        const lat = parseFloat(String(v.autoDeleteByDistanceLat));
        const lon = parseFloat(String(v.autoDeleteByDistanceLon));
        if (!isNaN(lat)) body.autoDeleteByDistanceLat = String(lat);
        if (!isNaN(lon)) body.autoDeleteByDistanceLon = String(lon);
        await postSettings(sourceId, body);
      },
      isOn: (v) => builtinIsOn('auto-delete-by-distance', v),
      // In the viewer's unit, as the threshold field (today's Delete by Distance).
      summary: (v) => t('workspace.automations.distance_summary', {
        distance: Math.round(toUnit(n(v, 'autoDeleteByDistanceThresholdKm'))), unit: miles ? 'mi' : 'km', hours: n(v, 'autoDeleteByDistanceIntervalHours'),
      }),
      sends: sends('auto-delete-by-distance'),
      // Today's distanceDeleteScheduler: every save while on re-arms it with a first run 2 minutes later.
      saveEffect: (v) => (b(v, 'autoDeleteByDistanceEnabled') ? t('workspace.automations.save.distance') : nothing()),
      fields: () => [
        { kind: 'number', key: 'autoDeleteByDistanceLat', label: t('automation.distance_delete.latitude'), nullable: true, min: -90, max: 90 },
        { kind: 'number', key: 'autoDeleteByDistanceLon', label: t('automation.distance_delete.longitude'), nullable: true, min: -180, max: 180 },
        // Today's: the threshold shows and is typed in the viewer's unit, stored in km (to 0.1).
        { kind: 'number', key: 'autoDeleteByDistanceThresholdKm', label: `${t('automation.distance_delete.threshold')} (${miles ? 'mi' : 'km'})`, min: 1,
          max: Math.floor(toUnit(DISTANCE_DELETE_THRESHOLD_KM_MAX)),
          read: (v) => Math.round(toUnit(n(v, 'autoDeleteByDistanceThresholdKm'))),
          set: (v, value) => ({ ...v, autoDeleteByDistanceThresholdKm: Math.round(fromUnit(Number(value)) * 10) / 10 }) },
        { kind: 'select', key: 'autoDeleteByDistanceIntervalHours', label: t('automation.distance_delete.interval'), numeric: true,
          options: [6, 12, 24, 48].map((h) => ({ value: String(h), label: t('automation.distance_delete.interval_hours', { count: h }) })) },
        { kind: 'select', key: 'autoDeleteByDistanceAction', label: t('automation.distance_delete.action', 'Action for nodes beyond threshold'),
          options: [{ value: 'delete', label: t('automation.distance_delete.action_delete', 'Delete node') }, { value: 'ignore', label: t('automation.distance_delete.action_ignore', 'Ignore node') }],
          warn: t('automation.distance_delete.note_delete'), warnIf: (v) => v.autoDeleteByDistanceAction === 'delete' },
      ],
    },
    {
      id: 'ignored-nodes', group: 'data', transmits: false, enabledKey: null,
      title: t('automation.ignored_nodes.title', 'Ignored Nodes'),
      description: t('automation.ignored_nodes.description', ''),
      load: async (sourceId) => {
        const rows = await apiService.get<unknown>(`/api/ignored-nodes${q(sourceId)}`);
        return { nodes: Array.isArray(rows) ? rows : [] };
      },
      save: async () => undefined,
      // A list, not something that is on: today has no on state for it.
      isOn: () => false,
      value: (v) => t('workspace.automations.ignored_count', { count: list(v, 'nodes').length }),
      summary: (v) => t('workspace.automations.ignored_count', { count: list(v, 'nodes').length }),
      sends: sends('ignored-nodes'),
      saveEffect: nothing,
      fields: () => [],
    },
  ];
  return table;

  /** Auto-traceroute and Remote LocalStats: an interval, a time window and today's node filters, saved as today (3 requests). */
  function nodeFilterBuiltin(id: 'auto-traceroute' | 'auto-localstats'): MeshtasticBuiltin {
    const tr = id === 'auto-traceroute';
    const p = tr ? 'traceroute' : 'remoteLocalStats';
    const filterPath = tr ? 'traceroute-nodes' : 'remote-localstats-nodes';
    const intervalPath = tr ? 'traceroute-interval' : 'remote-localstats-interval';
    const defInterval = tr ? 15 : 60;
    const k = tr ? 'automation.auto_traceroute' : 'automation.auto_localstats';
    return {
      id, group: 'data', transmits: true, enabledKey: 'enabled',
      title: tr ? t('automation.auto_traceroute.title', 'Auto Traceroute') : t('automation.auto_localstats.title', 'Auto Remote LocalStats'),
      description: t(`${k}.description`, ''),
      load: async (sourceId) => {
        const [f, s] = await Promise.all([apiService.get<Values>(`/api/settings/${filterPath}${q(sourceId)}`), ctx.settings(sourceId)]);
        const interval = parseInt(str(s, `${p}IntervalMinutes`, '0'), 10);
        const filter: Values = {
          enabled: f?.enabled === true, nodeNums: f?.nodeNums ?? [], filterRoles: f?.filterRoles ?? [], filterNameRegex: f?.filterNameRegex || '.*',
          filterNodesEnabled: f?.filterNodesEnabled !== false, filterRolesEnabled: f?.filterRolesEnabled !== false, filterRegexEnabled: f?.filterRegexEnabled !== false,
          filterLastHeardEnabled: f?.filterLastHeardEnabled !== false, filterLastHeardHours: f?.filterLastHeardHours || 168,
        };
        if (tr) {
          const mode = (x: unknown) => (x === 'and' ? 'and' : 'or');
          Object.assign(filter, {
            filterChannels: f?.filterChannels ?? [], filterHwModels: f?.filterHwModels ?? [],
            filterChannelsEnabled: f?.filterChannelsEnabled !== false, filterHwModelsEnabled: f?.filterHwModelsEnabled !== false,
            filterNodesMode: mode(f?.filterNodesMode), filterChannelsMode: mode(f?.filterChannelsMode), filterRolesMode: mode(f?.filterRolesMode),
            filterHwModelsMode: mode(f?.filterHwModelsMode), filterRegexMode: mode(f?.filterRegexMode),
            filterHopsEnabled: f?.filterHopsEnabled === true, filterHopsMin: f?.filterHopsMin ?? 0, filterHopsMax: f?.filterHopsMax ?? 10,
            expirationHours: f?.expirationHours || 24, sortByHops: f?.sortByHops === true,
          });
        } else {
          filter.filterFavoriteEnabled = f?.filterFavoriteEnabled === true;
        }
        return {
          enabled: !isNaN(interval) && interval > 0, intervalMinutes: !isNaN(interval) && interval > 0 ? interval : defInterval,
          scheduleEnabled: s[`${p}ScheduleEnabled`] === 'true', scheduleStart: str(s, `${p}ScheduleStart`) || '00:00', scheduleEnd: str(s, `${p}ScheduleEnd`) || '00:00',
          filter,
        };
      },
      save: async (sourceId, v) => {
        const interval = b(v, 'enabled') ? n(v, 'intervalMinutes') : 0;
        await postSettings(sourceId, {
          [`${p}IntervalMinutes`]: interval, [`${p}ScheduleEnabled`]: String(v.scheduleEnabled), [`${p}ScheduleStart`]: v.scheduleStart, [`${p}ScheduleEnd`]: v.scheduleEnd,
        });
        await apiService.post(`/api/settings/${filterPath}${q(sourceId)}`, v.filter);
        // Today's SettingsContext setter, which every save calls: it re-arms this source's scheduler.
        await apiService.post(`/api/settings/${intervalPath}`, { intervalMinutes: interval, sourceId });
      },
      validate: (v) => scheduleError(v),
      isOn: (v) => builtinIsOn(id, v),
      summary: (v) => t('workspace.automations.every_minutes', { count: n(v, 'intervalMinutes') }),
      sends: sends(id),
      // Today's scheduler restart (startTracerouteScheduler / startRemoteLocalStatsScheduler): the first send 0–5 min after the save.
      saveEffect: (v) => (b(v, 'enabled') ? t('workspace.automations.save.jitter') : nothing()),
      fields: () => [
        { kind: 'number', key: 'intervalMinutes', label: t(`${k}.interval`, t('workspace.automations.interval_minutes')), min: tr ? 3 : 5, max: tr ? 60 : 1440 },
        ...scheduleFields(t(`${k}.schedule_window_description`, '')),
        ...(tr ? [{ kind: 'number' as const, key: 'filter.expirationHours', label: t('automation.auto_traceroute.expiration_hours', 'Skip nodes traced in the last (hours)'), min: 0, max: 168 }] : []),
        { kind: 'heading', key: 'h.filter', label: t('workspace.automations.node_filter') },
        { kind: 'toggle', key: 'filter.enabled', label: t('workspace.automations.limit_nodes') },
        ...filterRow('filter.nodeNums', t('workspace.automations.filter_nodes'), 'filter.filterNodesEnabled', tr ? 'filter.filterNodesMode' : null, { options: nodeOptions, numeric: true }),
        ...(tr ? filterRow('filter.filterChannels', t('workspace.automations.filter_channels'), 'filter.filterChannelsEnabled', 'filter.filterChannelsMode', { options: channelOptions, numeric: true }) : []),
        ...filterRow('filter.filterRoles', t('workspace.automations.filter_roles'), 'filter.filterRolesEnabled', tr ? 'filter.filterRolesMode' : null, { options: roleOptions, numeric: true }),
        ...(tr ? filterRow('filter.filterHwModels', t('workspace.automations.filter_hw'), 'filter.filterHwModelsEnabled', 'filter.filterHwModelsMode', { options: hwOptions, numeric: true }) : []),
        { kind: 'toggle', key: 'filter.filterRegexEnabled', label: t('workspace.automations.filter_regex'), showIf: (v) => b(v, 'filter.enabled') },
        ...(tr ? [{ kind: 'select' as const, key: 'filter.filterRegexMode', label: t('workspace.automations.combine', { name: t('workspace.automations.filter_regex') }), options: modeOptions,
          showIf: (v: Values) => b(v, 'filter.enabled') && b(v, 'filter.filterRegexEnabled') }] : []),
        { kind: 'text', key: 'filter.filterNameRegex', label: t('workspace.automations.name_regex'), mono: true, showIf: (v) => b(v, 'filter.enabled') && b(v, 'filter.filterRegexEnabled') },
        ...(!tr ? [{ kind: 'toggle' as const, key: 'filter.filterFavoriteEnabled', label: t('workspace.automations.filter_favorite'), showIf: (v: Values) => b(v, 'filter.enabled') }] : []),
        { kind: 'toggle', key: 'filter.filterLastHeardEnabled', label: t('workspace.automations.filter_last_heard') },
        { kind: 'number', key: 'filter.filterLastHeardHours', label: t('workspace.automations.last_heard_hours'), min: 1, max: LAST_HEARD_FILTER_HOURS_MAX,
          showIf: (v) => b(v, 'filter.filterLastHeardEnabled') },
        ...(tr ? [
          { kind: 'toggle' as const, key: 'filter.filterHopsEnabled', label: t('workspace.automations.filter_hops') },
          { kind: 'number' as const, key: 'filter.filterHopsMin', label: t('workspace.automations.hops_min'), min: 0, max: HOP_FILTER_MAX, showIf: (v: Values) => b(v, 'filter.filterHopsEnabled') },
          { kind: 'number' as const, key: 'filter.filterHopsMax', label: t('workspace.automations.hops_max'), min: 0, max: HOP_FILTER_MAX, showIf: (v: Values) => b(v, 'filter.filterHopsEnabled') },
          { kind: 'toggle' as const, key: 'filter.sortByHops', label: t('workspace.automations.sort_by_hops') },
        ] : []),
      ],
    };
  }
}

// ── trigger editors ───────────────────────────────────────────────────────────

const CHANNEL_DM = 'dm';
const CHANNEL_NONE = 'none';

/** Mixed channel lists (`'dm' | 'none' | number`) stored as today: numbers stay numbers. */
const mixedChannels = (value: unknown) => (Array.isArray(value) ? value.map((x) => (x === CHANNEL_DM || x === CHANNEL_NONE ? x : Number(x))) : []);

function responderItemFields(t: TFunction, x: Values, channelOptions: Option[], scriptOptions: Option[]): Field[] {
  const type = String(x.responseType ?? 'text');
  return [
    { kind: 'select', key: 'syntax', label: t('workspace.meshcore.auto.syntax'),
      options: [{ value: 'pattern', label: t('workspace.automations.pattern') }, { value: 'regex', label: t('workspace.automations.regex') }],
      set: (item, value) => ({ ...item, syntax: value }) },
    { kind: 'text', key: 'trigger', label: triggerSyntax(x) === 'regex' ? t('workspace.automations.regex') : t('workspace.automations.pattern'), mono: true,
      help: t('auto_responder.trigger_help', ''), set: (item, value) => ({ ...item, trigger: value }) },
    { kind: 'select', key: 'responseType', label: t('workspace.automations.response_type'),
      options: (['text', 'http', 'script', 'traceroute', 'mailbox'] as const).map((r) => ({ value: r, label: t(`auto_responder.type_${r}`) })),
      help: type === 'mailbox' ? `${t('auto_responder.mailbox_description')} ${t('auto_responder.mailbox_pattern_hint')} msg {recipient} {body:.+},inbox,inbox play {sender},inbox play,inbox delete {id},inbox clear` : undefined,
      set: (item, value) => ({ ...item, responseType: value, response: '' }) },
    ...(type === 'script'
      ? [
          { kind: 'select' as const, key: 'response', label: t('auto_responder.type_script'), options: scriptOptions },
          { kind: 'text' as const, key: 'scriptArgs', label: t('workspace.automations.arguments'), mono: true },
        ]
      : type === 'http'
        ? [{ kind: 'text' as const, key: 'response', label: t('workspace.automations.http_url'), mono: true }]
        : type === 'text'
          ? [{ kind: 'textarea' as const, key: 'response', label: t('auto_responder.type_text') }]
          : type === 'traceroute'
            ? [{ kind: 'text' as const, key: 'response', label: t('workspace.automations.traceroute_target'), placeholder: t('auto_responder.traceroute_placeholder'), help: t('workspace.automations.traceroute_target_help') }]
            : []),
    { kind: 'multi', key: 'channels', label: t('workspace.automations.channels'),
      options: [{ value: CHANNEL_DM, label: t('workspace.automations.direct_messages') }, ...channelOptions, ...(type === 'script' ? [{ value: CHANNEL_NONE, label: t('workspace.automations.no_mesh_output') }] : [])],
      set: (item, value) => ({ ...item, channels: mixedChannels(value), channel: undefined }) },
    { kind: 'number', key: 'cooldownSeconds', label: t('workspace.automations.cooldown'), help: t('workspace.automations.cooldown_help'), min: 0, max: COOLDOWN_SECONDS_MAX },
    // DM only: a channel trigger has no Verify response (today's Done drops it there, finalizeTrigger).
    { kind: 'toggle', key: 'verifyResponse', label: t('workspace.automations.verify'), help: t('workspace.automations.verify_help'),
      showIf: (v) => (Array.isArray(v.channels) ? v.channels : v.channel !== undefined ? [v.channel] : []).includes(CHANNEL_DM) },
    // Today's split option: text and HTTP replies only.
    { kind: 'toggle', key: 'multiline', label: t('workspace.automations.multiline'), help: t('workspace.automations.multiline_help'), showIf: () => type === 'text' || type === 'http' },
  ];
}

function timerItemFields(t: TFunction, x: Values, channelOptions: Option[], scriptOptions: Option[]): Field[] {
  const type = String(x.responseType ?? 'script');
  return [
    { kind: 'text', key: 'name', label: t('workspace.automations.name'), maxLength: 60 },
    { kind: 'toggle', key: 'enabled', label: t('common.enabled', 'Enabled') },
    { kind: 'text', key: 'cronExpression', label: t('automation.auto_announce.cron_expression'), mono: true },
    { kind: 'select', key: 'responseType', label: t('workspace.automations.response_type'),
      options: [{ value: 'text', label: t('auto_responder.type_text') }, { value: 'script', label: t('auto_responder.type_script') }] },
    ...(type === 'script'
      ? [
          { kind: 'select' as const, key: 'scriptPath', label: t('auto_responder.type_script'), options: scriptOptions },
          { kind: 'text' as const, key: 'scriptArgs', label: t('workspace.automations.arguments'), mono: true },
        ]
      : [{ kind: 'textarea' as const, key: 'response', label: t('auto_responder.type_text'), maxLength: 200 }]),
    { kind: 'multi', key: 'channels', label: t('workspace.automations.channels'),
      options: [...channelOptions, ...(type === 'script' ? [{ value: CHANNEL_NONE, label: t('workspace.automations.no_mesh_output') }] : [])],
      set: (item, value) => ({ ...item, channels: mixedChannels(value), channel: undefined }) },
    { kind: 'toggle', key: 'multiline', label: t('automation.split_long.label', 'Split long messages'),
      help: t('automation.split_long.help', 'Split a long message into up to 3 marked parts instead of cutting it. Each part is a separate transmission.') },
  ];
}

function geofenceItemFields(t: TFunction, x: Values, channelOptions: Option[], scriptOptions: Option[]): Field[] {
  const type = String(x.responseType ?? 'text');
  return [
    { kind: 'text', key: 'name', label: t('workspace.automations.name'), maxLength: 60 },
    { kind: 'select', key: 'event', label: t('workspace.automations.event'),
      options: [
        { value: 'entry', label: t('workspace.automations.entry') },
        { value: 'exit', label: t('workspace.automations.exit') },
        { value: 'while_inside', label: t('workspace.automations.while_inside') },
      ],
      set: (item, value) => ({ ...item, event: value, whileInsideIntervalMinutes: value === 'while_inside' ? (item.whileInsideIntervalMinutes ?? 5) : undefined }) },
    { kind: 'number', key: 'whileInsideIntervalMinutes', label: t('workspace.automations.inside_interval'), min: GEOFENCE_INTERVAL_MINUTES_MIN, max: GEOFENCE_INTERVAL_MINUTES_MAX,
      showIf: (v) => v.event === 'while_inside' },
    { kind: 'select', key: 'responseType', label: t('workspace.automations.response_type'),
      options: [{ value: 'text', label: t('workspace.automations.text_message') }, { value: 'script', label: t('auto_responder.type_script') }],
      set: (item, value) => ({ ...item, responseType: value, channel: value === 'text' && item.channel === CHANNEL_NONE ? CHANNEL_DM : item.channel }) },
    ...(type === 'script'
      ? [
          { kind: 'select' as const, key: 'scriptPath', label: t('auto_responder.type_script'), options: scriptOptions },
          { kind: 'text' as const, key: 'scriptArgs', label: t('workspace.automations.arguments'), mono: true },
        ]
      : [{ kind: 'textarea' as const, key: 'response', label: t('workspace.automations.message') }]),
    { kind: 'select', key: 'channel', label: t('workspace.automations.channel'),
      options: [{ value: CHANNEL_DM, label: t('workspace.automations.direct_message') }, ...channelOptions, ...(type === 'script' ? [{ value: CHANNEL_NONE, label: t('workspace.automations.no_mesh_output') }] : [])],
      set: (item, value) => ({ ...item, channel: value === CHANNEL_DM || value === CHANNEL_NONE ? value : Number(value), verifyResponse: value === CHANNEL_DM ? item.verifyResponse : false }) },
    { kind: 'number', key: 'cooldownMinutes', label: t('workspace.automations.cooldown_minutes'), min: 0, max: GEOFENCE_COOLDOWN_MINUTES_MAX },
    { kind: 'toggle', key: 'verifyResponse', label: t('workspace.automations.verify'), help: t('workspace.automations.verify_help'), showIf: (v) => v.channel === CHANNEL_DM },
  ];
}

/** Today's Add / Update checks (GeofenceTriggersSection handleAddOrUpdateTrigger). */
function geofenceError(t: TFunction, x: Values): string | null {
  if (!String(x.name ?? '').trim()) return t('automation.geofence_triggers.name_required', 'Name is required');
  if (!x.shape) return t('automation.geofence_triggers.shape_required', 'Please define a geofence shape on the map');
  if (x.responseType === 'script' && !x.scriptPath) return t('automation.geofence_triggers.script_required', 'Script is required');
  if (x.responseType === 'text' && !String(x.response ?? '').trim()) return t('automation.geofence_triggers.message_required', 'Message is required');
  return null;
}

/** The shape today's Add / Update stores: trimmed text, only the fields the response type uses, a cooldown only when set. */
export function finalizeGeofence(x: GeofenceTrigger): GeofenceTrigger {
  const script = x.responseType === 'script';
  return {
    ...x,
    name: x.name.trim(),
    whileInsideIntervalMinutes: x.event === 'while_inside' ? x.whileInsideIntervalMinutes : undefined,
    response: script ? undefined : (x.response ?? '').trim(),
    scriptPath: script ? x.scriptPath : undefined,
    scriptArgs: script && x.scriptArgs?.trim() ? x.scriptArgs.trim() : undefined,
    verifyResponse: x.channel === 'dm' ? !!x.verifyResponse : false,
    cooldownMinutes: x.cooldownMinutes && x.cooldownMinutes > 0 ? x.cooldownMinutes : undefined,
  };
}

function geofenceSub(t: TFunction, g: GeofenceTrigger, channelName: (id: number) => string): string {
  const shape = g.shape?.type === 'circle'
    ? t('workspace.automations.circle_km', { km: g.shape.radiusKm })
    : g.shape?.type === 'polygon' ? t('workspace.automations.polygon') : '—';
  const nodes = g.nodeFilter?.type === 'selected' ? t('workspace.meshcore.auto.nodes_count', { count: g.nodeFilter.nodeNums.length }) : t('workspace.automations.all_nodes');
  const where = g.channel === 'dm' ? t('workspace.automations.direct_message') : g.channel === 'none' ? t('workspace.automations.no_mesh_output') : channelName(Number(g.channel));
  return [shape, t(`workspace.automations.${g.event === 'while_inside' ? 'while_inside' : g.event}`), nodes, where,
    g.cooldownMinutes ? t('workspace.automations.cooldown_min', { count: g.cooldownMinutes }) : null].filter(Boolean).join(' · ');
}

/** The Sends filter: built-ins that put something on the air. */
export const transmits = (b: MeshtasticBuiltin) => !SENDS_NOTHING.has(b.id);
