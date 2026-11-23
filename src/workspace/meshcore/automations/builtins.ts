/**
 * A MeshCore radio's twelve built-in automations (Task 7.5), as data: what
 * each reads and saves (today's endpoints, bodies and clamps, from
 * MeshCoreAutomationsView's sections), its fields on the row kit, whether it
 * is on, a one-line summary and its Sends line. The overview (8-14, 8-31) and
 * each built-in's page read this one table.
 *
 * Saving writes today's settings keys through today's route; the routes clamp
 * and re-arm their schedulers as today. Nothing here runs a built-in: Send now,
 * Run now and the per-node rows are their own controls (`extra`).
 */
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { isValidCron } from 'cron-validator';
import apiService from '../../../services/api';
import { validateForwardingRules, type ForwardingRule } from '../../../types/forwarding';
import { meshCoreTriggerSyntax, validateMeshCoreResponderPattern } from '../../../components/MeshCore/meshcoreResponderMatch';
import {
  hasMeshCoreTimerErrors,
  meshCoreTimerChannelIndexes,
  newMeshCoreTimerTrigger,
  validateMeshCoreTimer,
  type MeshCoreTimerTrigger,
} from '../../../components/MeshCore/meshcoreTimerModel';
import { newTriggerId } from '../../../components/shared/automation/triggerList';
import { DEFAULT_MESHCORE_ADVERT_MODE, isMeshCoreAdvertMode, LEGACY_MESHCORE_ADVERT_MODE } from '../../../types/meshcoreAdvert';

export type Values = Record<string, unknown>;

export interface Option {
  value: string;
  label: string;
}

export type FieldKind = 'toggle' | 'number' | 'text' | 'textarea' | 'select' | 'multi' | 'list' | 'heading';

export interface Field {
  kind: FieldKind;
  /** Dotted path into the values (`filter.hopsMin`). */
  key: string;
  label: string;
  help?: string;
  /** Today's warning, shown next to the input (only while `warnIf` holds, when given). */
  warn?: string;
  warnIf?(v: Values): boolean;
  showIf?(v: Values): boolean;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  placeholder?: string;
  mono?: boolean;
  /** select / multi: the options; `numeric` stores numbers. */
  options?: Option[];
  numeric?: boolean;
  /** number: an empty field stores null (a home latitude). */
  nullable?: boolean;
  /** Writes the value into the values where one field sets several keys (a forwarding rule's source). */
  set?(v: Values, value: unknown): Values;
  /** list: one item's title, line, its own fields and its rule. */
  addLabel?: string;
  itemTitle?(item: Values): string;
  itemSub?(item: Values): string;
  newItem?(): Values;
  itemFields?(item: Values): Field[];
  /** The item's errors, or null. `isNew`: not in the saved list. */
  validateItem?(item: Values, isNew: boolean): string | null;
  itemEnabledKey?: string;
  /** list: a search box over the items (its label, read by screen readers). */
  searchLabel?: string;
  /** list: more of the item's controls under its fields in the sheet (a map, a test). */
  itemExtra?(item: Values, setItem: (item: Values) => void): ReactNode;
}

export type Extra = 'announce' | 'timers' | 'distance' | 'favorite' | 'autoPing' | 'timeSync' | 'remoteTelemetry' | 'forwarding';

export interface Builtin {
  id: string;
  title: string;
  description: string;
  /** Sends on the mesh when it runs. */
  transmits: boolean;
  companionOnly?: boolean;
  /** Its on/off switch today, or null (no switch: per trigger or per node). */
  enabledKey: string | null;
  load(sourceId: string): Promise<Values>;
  /** Today's request(s) for a save, sent once; only the parts that changed. */
  save(sourceId: string, values: Values, saved: Values): Promise<void>;
  isOn(v: Values): boolean;
  summary(v: Values): string;
  /** What it sends when it runs, in today's words where they exist; null: nothing on the mesh. */
  sends(v: Values): string | null;
  /**
   * What a save does now, from today's server (Task 7.5 HP): a route that
   * re-arms its scheduler and runs soon says so; otherwise saving sends nothing.
   */
  saveEffect(v: Values): string;
  fields(v: Values): Field[];
  validate?(v: Values, saved: Values): string | null;
  extra?: Extra;
}

export interface BuiltinCtx {
  channels: Array<{ id: number; name: string }>;
  contacts: Array<{ publicKey: string; name: string; advType?: number }>;
  scripts: Array<{ path: string; name: string }>;
}

// ── values ────────────────────────────────────────────────────────────────────

export function getPath(v: Values, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Values)[k] : undefined), v);
}

export function setPath(v: Values, path: string, value: unknown): Values {
  const [head, ...rest] = path.split('.');
  if (rest.length === 0) return { ...v, [head]: value };
  return { ...v, [head]: setPath((v[head] as Values) ?? {}, rest.join('.'), value) };
}

const b = (v: Values, k: string) => getPath(v, k) === true;
const n = (v: Values, k: string) => Number(getPath(v, k) ?? 0);
const s = (v: Values, k: string) => String(getPath(v, k) ?? '');
const list = <T = Values>(v: Values, k: string) => (Array.isArray(getPath(v, k)) ? (getPath(v, k) as T[]) : []);
const same = (a: unknown, c: unknown) => JSON.stringify(a) === JSON.stringify(c);
const pick = (v: Values, keys: string[]) => Object.fromEntries(keys.map((k) => [k, v[k]]));
const data = async <T = Values>(path: string) => ((await apiService.get<{ data?: T }>(path))?.data ?? ({} as T));
const base = (sourceId: string) => `/api/sources/${encodeURIComponent(sourceId)}`;
const auto = (sourceId: string, path: string) => `${base(sourceId)}/meshcore/automation/${path}`;

/** Today's auto-ack regex rule (MeshCoreAutoAckSection validateRegex). */
function regexError(pattern: string): string | null {
  if (pattern.length > 100) return 'Pattern too long (max 100 chars)';
  if (/(\.\*){2,}|(\+.*\+)|(\*.*\*)|(\{[0-9]{3,}\})|(\{[0-9]+,\})/.test(pattern)) return 'Pattern too complex (possible ReDoS)';
  try {
    new RegExp(pattern, 'i');
    return null;
  } catch {
    return 'Invalid regex syntax';
  }
}

// ── the table ─────────────────────────────────────────────────────────────────

export function builtinTable(t: TFunction, ctx: BuiltinCtx): Builtin[] {
  const saveNothing = () => t('workspace.meshcore.auto.save_nothing');
  const channelOptions: Option[] = ctx.channels.map((c) => ({ value: String(c.id), label: c.name || t('forwarding.channel_n', { index: c.id }) }));
  const channelName = (id: number) => ctx.channels.find((c) => c.id === id)?.name || t('forwarding.channel_n', { index: id });
  const channelNames = (ids: number[]) => ids.map(channelName).join(', ');
  const contactOptions: Option[] = ctx.contacts.map((c) => ({ value: c.publicKey, label: c.name }));
  const scriptOptions: Option[] = ctx.scripts.map((sc) => ({ value: sc.path, label: sc.name }));
  const scopeOptions = (withTrigger: boolean): Option[] => [
    { value: 'inherit', label: t('workspace.meshcore.auto.scope_inherit') },
    ...(withTrigger ? [{ value: 'trigger', label: t('workspace.meshcore.auto.scope_trigger') }] : []),
    { value: 'unscoped', label: t('workspace.meshcore.auto.scope_unscoped') },
    { value: 'named', label: t('workspace.meshcore.auto.scope_named') },
  ];
  const scopeFields = (label: string, withTrigger: boolean, prefix = ''): Field[] => [
    { kind: 'select', key: `${prefix}scopeMode`, label, options: scopeOptions(withTrigger) },
    { kind: 'text', key: `${prefix}scopeName`, label: t('workspace.meshcore.auto.scope_name'), maxLength: 30, showIf: (v) => getPath(v, `${prefix}scopeMode`) === 'named' },
  ];
  const splitHelp = t('automation.split_long.help', 'Split a long message into up to 3 marked parts instead of cutting it. Each part is a separate transmission.');
  // Today's warning (MeshCoreAdvertModeField), shown for flood only.
  const floodWarning = t('meshcore.advert.flood_automated_warning');
  const advertModes: Option[] = [
    { value: 'zero_hop', label: t('meshcore.advert.mode_zero_hop', 'Zero-hop (nearby nodes only)') },
    { value: 'flood', label: t('meshcore.advert.mode_flood', 'Flood (whole mesh, costly)') },
  ];

  const pathfindingKeys = ['enabled', 'pathDiscoveryEnabled', 'neighborsEnabled', 'intervalMinutes', 'repeatHours'];
  const ackKeys = ['enabled', 'regex', 'message', 'channels', 'directMessages', 'useDM', 'cooldownSeconds', 'preSendDelaySeconds', 'testMessages', 'ignoredNodes', 'splitLongMessages', 'scopeMode', 'scopeName'];
  const announceKeys = ['enabled', 'intervalHours', 'message', 'channelIndexes', 'splitLongMessages', 'announceOnStart', 'useSchedule', 'schedule', 'advertEnabled', 'advertDelaySeconds', 'advertMode', 'scopeMode', 'scopeName'];

  return [
    {
      id: 'auto-pathfinding',
      title: t('workspace.meshcore.auto.pathfinding', 'Auto-pathfinding'),
      description: t('meshcore.automation.pathfinding.description', 'Automatically discover paths and collect neighbor information from your MeshCore contacts on a recurring schedule.'),
      transmits: true,
      enabledKey: 'enabled',
      load: async (sourceId) => {
        const [core, filter] = await Promise.all([data(auto(sourceId, 'pathfinding')), data(auto(sourceId, 'pathfinding/filter'))]);
        return {
          enabled: core.enabled ?? false, pathDiscoveryEnabled: core.pathDiscoveryEnabled ?? true, neighborsEnabled: core.neighborsEnabled ?? true,
          intervalMinutes: core.intervalMinutes ?? 5, repeatHours: core.repeatHours ?? 24, schedulerRunning: core.schedulerRunning ?? false, lastRunAt: core.lastRunAt ?? null,
          filter: {
            enabled: false, targetKeys: [], contactsEnabled: false, regexEnabled: false, nameRegex: '.*', lastHeardEnabled: false, lastHeardHours: 168,
            hopsEnabled: false, hopsMin: 0, hopsMax: 10, signalEnabled: false, rssiMin: -200, snrMin: -100, ...filter,
          },
        };
      },
      save: async (sourceId, v, saved) => {
        if (!same(pick(v, pathfindingKeys), pick(saved, pathfindingKeys))) await apiService.post(auto(sourceId, 'pathfinding'), pick(v, pathfindingKeys));
        if (!same(v.filter, saved.filter)) await apiService.post(auto(sourceId, 'pathfinding/filter'), v.filter);
      },
      isOn: (v) => b(v, 'enabled'),
      summary: (v) =>
        [b(v, 'pathDiscoveryEnabled') && t('workspace.meshcore.auto.pf_companions'), b(v, 'neighborsEnabled') && t('workspace.meshcore.auto.pf_repeaters')]
          .filter(Boolean).join(', ') || t('workspace.meshcore.auto.pf_none'),
      saveEffect: (v) => (b(v, 'enabled') && (b(v, 'pathDiscoveryEnabled') || b(v, 'neighborsEnabled')) ? t('workspace.meshcore.auto.save_pathfinding') : saveNothing()),
      sends: (v) => t('workspace.meshcore.auto.pf_sends', { minutes: n(v, 'intervalMinutes'), hours: n(v, 'repeatHours') }),
      validate: (v) => (b(v, 'filter.regexEnabled') && regexError(s(v, 'filter.nameRegex')) ? t('meshcore.automation.pathfinding.filter.regex_invalid', 'Invalid regular expression') : null),
      fields: () => [
        { kind: 'toggle', key: 'enabled', label: t('workspace.meshcore.auto.pathfinding', 'Auto-pathfinding') },
        { kind: 'toggle', key: 'pathDiscoveryEnabled', label: t('meshcore.automation.pathfinding.path_discovery', 'Path Discovery for Companions'),
          help: t('meshcore.automation.pathfinding.path_discovery_desc', 'Sends a path discovery request to each Companion contact. The device learns the forwarding route via its normal path return mechanism.') },
        { kind: 'toggle', key: 'neighborsEnabled', label: t('meshcore.automation.pathfinding.neighbors', 'Neighbors for Repeaters'),
          help: t('meshcore.automation.pathfinding.neighbors_desc', 'Queries the neighbor list from each Repeater contact. Returns nearby nodes with signal quality information.') },
        { kind: 'number', key: 'intervalMinutes', label: t('meshcore.automation.pathfinding.interval', 'Time between commands (minutes)'), min: 3, max: 60,
          help: t('meshcore.automation.pathfinding.interval_desc', 'Delay between each individual path discovery or neighbor request to avoid flooding the mesh.') },
        { kind: 'number', key: 'repeatHours', label: t('meshcore.automation.pathfinding.repeat', 'Repeat every (hours)'), min: 1, max: 168,
          help: t('meshcore.automation.pathfinding.repeat_desc', 'How often the full cycle runs. All eligible contacts are processed in each cycle.') },
        { kind: 'heading', key: 'filter', label: t('meshcore.automation.pathfinding.filter.title', 'Target Filter'),
          help: t('meshcore.automation.pathfinding.filter.description', 'Optionally narrow which contacts Auto-Pathfinding targets, instead of every Companion and Repeater contact.') },
        { kind: 'toggle', key: 'filter.enabled', label: t('meshcore.automation.pathfinding.filter.master_toggle', 'Filter target contacts') },
        { kind: 'toggle', key: 'filter.contactsEnabled', label: t('meshcore.automation.pathfinding.filter.contacts_enable', 'Limit to selected contacts'), showIf: (v) => b(v, 'filter.enabled') },
        { kind: 'multi', key: 'filter.targetKeys', label: t('meshcore.automation.pathfinding.filter.contacts_label', 'Specific contacts'),
          options: ctx.contacts.filter((c) => c.advType === 1 || c.advType === 2).map((c) => ({ value: c.publicKey, label: c.name })),
          showIf: (v) => b(v, 'filter.enabled') && b(v, 'filter.contactsEnabled') },
        { kind: 'toggle', key: 'filter.regexEnabled', label: t('meshcore.automation.pathfinding.filter.regex_enable', 'Filter by name (regex)'), showIf: (v) => b(v, 'filter.enabled') },
        { kind: 'text', key: 'filter.nameRegex', label: t('meshcore.automation.pathfinding.filter.regex_label', 'Name regex'), mono: true, maxLength: 100,
          showIf: (v) => b(v, 'filter.enabled') && b(v, 'filter.regexEnabled') },
        { kind: 'toggle', key: 'filter.lastHeardEnabled', label: t('meshcore.automation.pathfinding.filter.last_heard_enable', 'Limit by last heard'), showIf: (v) => b(v, 'filter.enabled') },
        { kind: 'number', key: 'filter.lastHeardHours', label: t('meshcore.automation.pathfinding.filter.last_heard_label', 'Heard within (hours)'), min: 1, max: 8760,
          help: t('meshcore.automation.pathfinding.filter.last_heard_description', 'Applies only to Auto-Pathfinding targeting.'),
          showIf: (v) => b(v, 'filter.enabled') && b(v, 'filter.lastHeardEnabled') },
        { kind: 'toggle', key: 'filter.hopsEnabled', label: t('meshcore.automation.pathfinding.filter.hops_enable', 'Limit by hop range'),
          help: t('meshcore.automation.pathfinding.filter.hops_unknown_note', 'Contacts with an unknown route (flood) are excluded when this is on.'), showIf: (v) => b(v, 'filter.enabled') },
        { kind: 'number', key: 'filter.hopsMin', label: t('meshcore.automation.pathfinding.filter.hops_min_label', 'Min hops'), min: 0, max: 64,
          showIf: (v) => b(v, 'filter.enabled') && b(v, 'filter.hopsEnabled') },
        { kind: 'number', key: 'filter.hopsMax', label: t('meshcore.automation.pathfinding.filter.hops_max_label', 'Max hops'), min: 0, max: 64,
          showIf: (v) => b(v, 'filter.enabled') && b(v, 'filter.hopsEnabled') },
        { kind: 'toggle', key: 'filter.signalEnabled', label: t('meshcore.automation.pathfinding.filter.signal_enable', 'Limit by signal quality'),
          help: t('meshcore.automation.pathfinding.filter.signal_note', 'Leave a threshold at its floor value to ignore it.'), showIf: (v) => b(v, 'filter.enabled') },
        { kind: 'number', key: 'filter.rssiMin', label: t('meshcore.automation.pathfinding.filter.rssi_min_label', 'Min RSSI (dBm)'), min: -200, max: 0,
          showIf: (v) => b(v, 'filter.enabled') && b(v, 'filter.signalEnabled') },
        { kind: 'number', key: 'filter.snrMin', label: t('meshcore.automation.pathfinding.filter.snr_min_label', 'Min SNR (dB)'), min: -100, max: 30, step: 0.5,
          showIf: (v) => b(v, 'filter.enabled') && b(v, 'filter.signalEnabled') },
      ],
    },
    {
      id: 'auto-ack',
      title: t('workspace.meshcore.auto.ack', 'Auto-ack'),
      description: t('workspace.meshcore.auto.ack_description'),
      transmits: true,
      enabledKey: 'enabled',
      load: async (sourceId) => {
        const d = await data(auto(sourceId, 'autoack'));
        return {
          enabled: !!d.enabled, regex: d.regex || '^(test|ping)', message: d.message || '', channels: Array.isArray(d.channels) ? d.channels : [],
          directMessages: !!d.directMessages, useDM: !!d.useDM, cooldownSeconds: typeof d.cooldownSeconds === 'number' ? d.cooldownSeconds : 0,
          preSendDelaySeconds: typeof d.preSendDelaySeconds === 'number' ? d.preSendDelaySeconds : 0, testMessages: d.testMessages || '',
          ignoredNodes: typeof d.ignoredNodes === 'string' ? d.ignoredNodes : '', splitLongMessages: d.splitLongMessages === true,
          scopeMode: d.scopeMode || 'inherit', scopeName: d.scopeName || '',
        };
      },
      save: async (sourceId, v) => { await apiService.post(auto(sourceId, 'autoack'), pick(v, ackKeys)); },
      isOn: (v) => b(v, 'enabled'),
      summary: (v) => {
        const where = [channelNames(list<number>(v, 'channels')), b(v, 'directMessages') ? t('meshcore.automation.autoack.direct_messages', 'Direct Messages') : '']
          .filter(Boolean).join(' · ');
        return t('workspace.meshcore.auto.ack_summary', { regex: s(v, 'regex'), where: where || '—' });
      },
      saveEffect: saveNothing,
      sends: () => t('workspace.meshcore.auto.ack_sends'),
      validate: (v) => {
        const err = regexError(s(v, 'regex'));
        return err ? `Invalid regex pattern: ${err}` : null;
      },
      fields: () => [
        { kind: 'toggle', key: 'enabled', label: t('workspace.meshcore.auto.ack', 'Auto-ack') },
        { kind: 'text', key: 'regex', label: t('automation.auto_ack.regex_label', 'Trigger Pattern (regular expression)'), mono: true, maxLength: 100,
          help: t('meshcore.automation.autoack.regex_default', 'Default: ^(test|ping)') },
        { kind: 'multi', key: 'channels', label: t('automation.auto_ack.active_channels', 'Active Channels'), options: channelOptions, numeric: true },
        { kind: 'toggle', key: 'directMessages', label: t('meshcore.automation.autoack.direct_messages', 'Direct Messages') },
        { kind: 'textarea', key: 'message', label: t('meshcore.automation.autoack.message_label', 'Acknowledgement Message'), maxLength: 500,
          help: t('workspace.meshcore.auto.tokens_hint') },
        { kind: 'toggle', key: 'useDM', label: t('meshcore.automation.autoack.always_respond_dm', 'Always respond via DM') },
        { kind: 'toggle', key: 'splitLongMessages', label: t('meshcore.automation.autoack.split_label', 'Long Replies'), help: splitHelp },
        ...scopeFields(t('meshcore.automation.autoack.scope_label', 'Reply Scope'), true),
        { kind: 'number', key: 'cooldownSeconds', label: t('automation.auto_ack.cooldown_label', 'Per-Sender Cooldown'), min: 0, max: 3600,
          help: t('automation.auto_ack.cooldown_help', 'seconds (0 = no cooldown)') },
        { kind: 'number', key: 'preSendDelaySeconds', label: t('automation.auto_ack.presend_delay_label', 'Pre-Send Delay'), min: 0, max: 120,
          help: t('automation.auto_ack.presend_delay_help', 'seconds (0 = send immediately, max 120)') },
        { kind: 'textarea', key: 'ignoredNodes', label: t('meshcore.automation.autoack.node_ignore_list', 'Sender Ignore List'),
          help: t('meshcore.automation.autoack.node_ignore_list_description') },
        { kind: 'textarea', key: 'testMessages', label: t('automation.auto_ack.pattern_testing', 'Pattern Testing') },
      ],
    },
    {
      id: 'auto-announce',
      title: t('workspace.meshcore.auto.announce', 'Auto-announce'),
      description: t('workspace.meshcore.auto.announce_description'),
      transmits: true,
      enabledKey: 'enabled',
      extra: 'announce',
      load: async (sourceId) => {
        const d = await data(auto(sourceId, 'announce'));
        return {
          enabled: !!d.enabled, intervalHours: d.intervalHours ?? 6, message: d.message || '', channelIndexes: Array.isArray(d.channelIndexes) ? d.channelIndexes : [0],
          splitLongMessages: d.splitLongMessages === true, announceOnStart: !!d.announceOnStart, useSchedule: !!d.useSchedule, schedule: d.schedule || '0 */6 * * *',
          advertEnabled: !!d.advertEnabled, advertDelaySeconds: d.advertDelaySeconds ?? 30,
          // An older server omits advertMode; its enabled bursts flood (MeshCoreAutoAnnounceSection).
          advertMode: isMeshCoreAdvertMode(d.advertMode) ? d.advertMode : d.advertEnabled ? LEGACY_MESHCORE_ADVERT_MODE : DEFAULT_MESHCORE_ADVERT_MODE,
          scopeMode: d.scopeMode || 'inherit', scopeName: d.scopeName || '', lastRunAt: d.lastRunAt ?? null,
        };
      },
      save: async (sourceId, v) => { await apiService.post(auto(sourceId, 'announce'), pick(v, announceKeys)); },
      isOn: (v) => b(v, 'enabled'),
      summary: (v) => {
        const when = b(v, 'useSchedule') ? s(v, 'schedule') : t('workspace.meshcore.auto.every_hours', { count: n(v, 'intervalHours') });
        return [channelNames(list<number>(v, 'channelIndexes')), when, b(v, 'advertEnabled') ? t('workspace.meshcore.auto.with_advert', { mode: s(v, 'advertMode') === 'flood' ? t('workspace.meshcore.flood').toLowerCase() : t('workspace.meshcore.auto.zero_hop') }) : '']
          .filter(Boolean).join(' · ');
      },
      saveEffect: (v) => (b(v, 'enabled') ? t('workspace.meshcore.auto.save_announce') : saveNothing()),
      sends: (v) => {
        const when = b(v, 'useSchedule') ? t('workspace.meshcore.auto.on_schedule', { cron: s(v, 'schedule') }) : t('workspace.meshcore.auto.every_hours', { count: n(v, 'intervalHours') });
        const count = list(v, 'channelIndexes').length || 1;
        const advert = b(v, 'advertEnabled') ? (s(v, 'advertMode') === 'flood' ? t('workspace.meshcore.auto.plus_flood_advert') : t('workspace.meshcore.auto.plus_advert')) : '';
        return t('workspace.meshcore.auto.announce_sends', { count, advert, when });
      },
      validate: (v) => (b(v, 'useSchedule') && !isValidCron(s(v, 'schedule'), { seconds: false, alias: true, allowBlankDay: true }) ? t('meshcore.automation.announce.invalid_cron', 'Invalid cron expression') : null),
      fields: () => [
        { kind: 'toggle', key: 'enabled', label: t('workspace.meshcore.auto.announce', 'Auto-announce') },
        { kind: 'toggle', key: 'useSchedule', label: t('automation.auto_announce.scheduled_sends', 'Use Cron Schedule') },
        { kind: 'number', key: 'intervalHours', label: t('automation.auto_announce.interval', 'Announcement Interval (hours)'), min: 1, max: 168, showIf: (v) => !b(v, 'useSchedule') },
        { kind: 'text', key: 'schedule', label: t('automation.auto_announce.cron_expression', 'Cron Expression'), mono: true,
          help: t('automation.auto_announce.cron_expression_description', 'Schedule format: minute hour day month weekday.'), showIf: (v) => b(v, 'useSchedule') },
        { kind: 'toggle', key: 'announceOnStart', label: t('meshcore.automation.announce.on_start', 'Announce on connection') },
        { kind: 'textarea', key: 'message', label: t('automation.auto_announce.message_label', 'Announcement Message'), maxLength: 500, help: t('workspace.meshcore.auto.tokens_hint') },
        { kind: 'multi', key: 'channelIndexes', label: t('automation.auto_announce.broadcast_channel', 'Broadcast Channels'), options: channelOptions, numeric: true },
        { kind: 'toggle', key: 'splitLongMessages', label: t('meshcore.automation.announce.split_label', 'Long Announcements'), help: splitHelp },
        ...scopeFields(t('meshcore.automation.announce.scope_label', 'Scope'), false),
        { kind: 'toggle', key: 'advertEnabled', label: t('meshcore.automation.announce.advert_enabled', 'Send advert after each announcement') },
        { kind: 'select', key: 'advertMode', label: t('meshcore.advert.mode_label', 'Advert reach'), options: advertModes, showIf: (v) => b(v, 'advertEnabled'),
          warn: floodWarning, warnIf: (v) => v.advertMode === 'flood' },
        { kind: 'number', key: 'advertDelaySeconds', label: t('meshcore.automation.announce.advert_delay', 'seconds delay (0–600)'), min: 0, max: 600, showIf: (v) => b(v, 'advertEnabled') },
      ],
    },
    {
      id: 'auto-responder',
      title: t('workspace.meshcore.auto.responder', 'Auto-responder'),
      description: t('workspace.meshcore.auto.responder_description'),
      transmits: true,
      enabledKey: 'enabled',
      load: async (sourceId) => {
        const d = await data(auto(sourceId, 'responder'));
        return { enabled: !!d.enabled, triggers: Array.isArray(d.triggers) ? d.triggers : [] };
      },
      save: async (sourceId, v) => { await apiService.post(auto(sourceId, 'responder'), { enabled: v.enabled, triggers: v.triggers }); },
      isOn: (v) => b(v, 'enabled'),
      summary: (v) => {
        const triggers = list(v, 'triggers');
        const scripts = triggers.filter((tr) => tr.responseType === 'script').length;
        return [t('automation.trigger_count', { count: triggers.length, defaultValue: '{{count}} triggers' }), scripts ? t('workspace.meshcore.auto.scripts', { count: scripts }) : '']
          .filter(Boolean).join(' · ');
      },
      saveEffect: saveNothing,
      sends: () => t('workspace.meshcore.auto.responder_sends'),
      fields: () => {
        return [
          { kind: 'toggle', key: 'enabled', label: t('workspace.meshcore.auto.responder', 'Auto-responder') },
          {
            kind: 'list', key: 'triggers', label: t('workspace.meshcore.auto.triggers'), addLabel: t('meshcore.automation.responder.add_button', 'Add trigger'),
            itemEnabledKey: 'enabled',
            itemTitle: (tr) => s(tr, 'name') || t('meshcore.automation.responder.untitled', 'New trigger'),
            itemSub: (tr) => [s(tr, 'pattern'), tr.responseType === 'script' ? t('meshcore.automation.responder.response_script', 'Run script') : t('meshcore.automation.responder.response_text', 'Send text'),
              tr.replyAsDM ? t('meshcore.automation.responder.chip_dm', 'DMs') : ''].filter(Boolean).join(' · '),
            newItem: () => ({ id: newTriggerId(), name: '', enabled: true, pattern: '', syntax: 'pattern', responseType: 'text', response: '', channels: [], listenDMs: true,
              replyAsDM: false, cooldownSeconds: 60, preSendDelaySeconds: 0, scopeMode: 'inherit', scopeName: '' }),
            validateItem: (tr, isNew) => {
              if (isNew && !s(tr, 'name').trim()) return t('meshcore.automation.responder.name_required', 'Name is required');
              const r = validateMeshCoreResponderPattern(s(tr, 'pattern'), meshCoreTriggerSyntax(tr));
              return r.valid ? null : (r.error ?? 'Invalid pattern');
            },
            itemFields: () => [
              { kind: 'text', key: 'name', label: t('meshcore.automation.responder.name', 'Name'), placeholder: t('meshcore.automation.responder.name_placeholder', 'Trigger name'), maxLength: 60 },
              { kind: 'toggle', key: 'enabled', label: t('common.enabled', 'Enabled') },
              { kind: 'select', key: 'syntax', label: t('workspace.meshcore.auto.syntax'), options: [
                { value: 'pattern', label: t('workspace.meshcore.auto.syntax_pattern') }, { value: 'regex', label: t('workspace.meshcore.auto.syntax_regex') }] },
              { kind: 'text', key: 'pattern', label: t('meshcore.automation.responder.pattern_label', 'Pattern'), mono: true, maxLength: 200 },
              { kind: 'select', key: 'responseType', label: t('meshcore.automation.responder.response_type', 'Action'), options: [
                { value: 'text', label: t('meshcore.automation.responder.response_text', 'Send text') }, { value: 'script', label: t('meshcore.automation.responder.response_script', 'Run script') }] },
              { kind: 'textarea', key: 'response', label: t('meshcore.automation.responder.response', 'Response (token expansion supported)'), maxLength: 500,
                placeholder: t('meshcore.automation.responder.response_placeholder', 'Response text (supports {VERSION}, {DURATION}, …)'), showIf: (x) => x.responseType !== 'script' },
              { kind: 'select', key: 'scriptPath', label: t('meshcore.automation.responder.script', 'Script'),
                options: [{ value: '', label: t('meshcore.automation.responder.select_script', '(select script)') }, ...scriptOptions], showIf: (x) => x.responseType === 'script' },
              { kind: 'text', key: 'scriptArgs', label: t('meshcore.automation.responder.script_args', 'Script args (token expansion)'), showIf: (x) => x.responseType === 'script' },
              { kind: 'multi', key: 'channels', label: t('meshcore.automation.responder.channels', 'Listen on channels'), options: channelOptions, numeric: true },
              { kind: 'toggle', key: 'listenDMs', label: t('meshcore.automation.responder.listen_dms', 'Listen on DMs') },
              { kind: 'toggle', key: 'replyAsDM', label: t('meshcore.automation.responder.reply_dm', 'Reply as DM') },
              { kind: 'number', key: 'cooldownSeconds', label: t('meshcore.automation.responder.cooldown', 'Cooldown (s)'), min: 0, max: 3600 },
              { kind: 'number', key: 'preSendDelaySeconds', label: t('meshcore.automation.responder.presend_delay', 'Pre-Send Delay (s)'), min: 0, max: 120 },
              { kind: 'toggle', key: 'multiline', label: t('automation.split_long.toggle', 'Split long messages'), help: splitHelp, showIf: (x) => x.responseType !== 'script' },
              ...scopeFields(t('meshcore.automation.autoack.scope_label', 'Reply Scope'), true),
            ],
          },
        ];
      },
    },
    {
      id: 'auto-ping',
      title: t('automation.auto_ping.title', 'Auto Ping'),
      description: t('meshcore.automation.autoping.description'),
      transmits: true,
      companionOnly: true,
      enabledKey: 'autoPingEnabled',
      extra: 'autoPing',
      load: async (sourceId) => {
        const d = await data<{ settings?: Values; sessions?: unknown[] }>(auto(sourceId, 'auto-ping'));
        return { autoPingEnabled: false, autoPingIntervalSeconds: 30, autoPingMaxPings: 20, autoPingTimeoutSeconds: 60, ...(d.settings ?? {}), sessions: d.sessions ?? [] };
      },
      save: async (sourceId, v) => {
        await apiService.post(auto(sourceId, 'auto-ping'), pick(v, ['autoPingEnabled', 'autoPingIntervalSeconds', 'autoPingMaxPings', 'autoPingTimeoutSeconds']));
      },
      isOn: (v) => b(v, 'autoPingEnabled'),
      summary: (v) => t('workspace.meshcore.auto.ping_summary', { max: n(v, 'autoPingMaxPings'), seconds: n(v, 'autoPingIntervalSeconds') }),
      saveEffect: saveNothing,
      sends: (v) => t('workspace.meshcore.auto.ping_sends', { max: n(v, 'autoPingMaxPings') }),
      fields: () => [
        { kind: 'toggle', key: 'autoPingEnabled', label: t('automation.auto_ping.title', 'Auto Ping'), warn: t('meshcore.automation.autoping.airtime_warning') },
        { kind: 'number', key: 'autoPingIntervalSeconds', label: t('automation.auto_ping.interval', 'Ping Interval (seconds)'), min: 10, max: 300,
          help: t('automation.auto_ping.interval_description', 'Time between each ping in a session') },
        { kind: 'number', key: 'autoPingMaxPings', label: t('automation.auto_ping.max_pings', 'Max Pings Per Session'), min: 1, max: 100,
          help: t('automation.auto_ping.max_pings_description', 'Maximum number of pings a user can request in a single session') },
        { kind: 'number', key: 'autoPingTimeoutSeconds', label: t('automation.auto_ping.timeout', 'Ping Timeout (seconds)'), min: 10, max: 300,
          help: t('meshcore.automation.autoping.timeout_description') },
      ],
    },
    {
      id: 'forwarding',
      title: t('forwarding.title', 'Forwarding'),
      description: t('forwarding.description'),
      transmits: true,
      enabledKey: 'enabled',
      extra: 'forwarding',
      load: async (sourceId) => {
        const d = await data<{ enabled?: boolean; rules?: ForwardingRule[] }>(`${base(sourceId)}/forwarding`);
        // A missing flag means on, as on the server.
        return { enabled: d.enabled !== false, rules: Array.isArray(d.rules) ? d.rules : [] };
      },
      save: async (sourceId, v, saved) => {
        if (v.enabled !== saved.enabled) await apiService.put(`${base(sourceId)}/forwarding/enabled`, { enabled: v.enabled });
        if (!same(v.rules, saved.rules)) {
          const r = validateForwardingRules(v.rules);
          if (!r.ok) throw new Error(r.error);
          await apiService.post(`${base(sourceId)}/forwarding`, { rules: r.rules });
        }
      },
      validate: (v) => {
        const r = validateForwardingRules(v.rules);
        return r.ok ? null : r.error;
      },
      isOn: (v) => b(v, 'enabled') && list(v, 'rules').some((r) => r.enabled === true),
      summary: (v) => t('forwarding.count', { count: list(v, 'rules').length }),
      saveEffect: saveNothing,
      sends: () => t('workspace.meshcore.auto.forwarding_sends'),
      fields: () => [
        { kind: 'toggle', key: 'enabled', label: t('forwarding.master_label', 'Forwarding on for this source') },
        {
          kind: 'list', key: 'rules', label: t('forwarding.title', 'Forwarding'), addLabel: t('forwarding.add', 'Add forwarding rule'), itemEnabledKey: 'enabled',
          itemTitle: (r) => s(r, 'name') || t('forwarding.rule', 'rule'),
          itemSub: (r) => {
            const fromText = getPath(r, 'match.isDM') ? t('forwarding.match_dm', 'Direct messages') : channelName(n(r, 'match.channel'));
            const to = getPath(r, 'forwardTo.destinationNodeId')
              ? contactOptions.find((c) => c.value === getPath(r, 'forwardTo.destinationNodeId'))?.label ?? s(r, 'forwardTo.destinationNodeId').slice(0, 8)
              : channelName(n(r, 'forwardTo.channel'));
            return `${fromText} → ${to}`;
          },
          newItem: () => ({ id: newTriggerId(), name: '', enabled: false, match: { isDM: true }, forwardTo: { destinationNodeId: '' }, prefix: '{from}: ' }),
          itemFields: () => [
            { kind: 'text', key: 'name', label: t('forwarding.name', 'Name'), placeholder: t('forwarding.name_placeholder', 'Rule name'), maxLength: 60 },
            { kind: 'toggle', key: 'enabled', label: t('common.enabled', 'Enabled') },
            { kind: 'select', key: 'match.channel', label: t('forwarding.match', 'Forward messages from'), numeric: true,
              options: [{ value: '', label: t('forwarding.match_dm', 'Direct messages') }, ...channelOptions],
              // A rule matches DMs or one channel, never both (types/forwarding).
              set: (r, value) => {
                const { channel: _c, isDM: _d, ...rest } = (r.match ?? {}) as Values;
                return { ...r, match: value == null ? { ...rest, isDM: true } : { ...rest, channel: value } };
              } },
            { kind: 'select', key: 'match.fromNodeId', label: t('forwarding.from_node', 'Only from sender'), options: [{ value: '', label: t('forwarding.any_sender', 'Any sender') }, ...contactOptions] },
            { kind: 'text', key: 'match.textRegex', label: t('forwarding.text_regex', 'Only if text matches (regex, optional)'), mono: true, maxLength: 100 },
            { kind: 'select', key: 'forwardTo.channel', label: t('forwarding.target', 'Forward to'), numeric: true,
              options: [{ value: '', label: t('forwarding.target_node', 'Node (DM)') }, ...channelOptions], warn: t('forwarding.channel_airtime_warning'),
              set: (r, value) => ({ ...r, forwardTo: value == null ? { destinationNodeId: '' } : { channel: value } }) },
            { kind: 'select', key: 'forwardTo.destinationNodeId', label: t('forwarding.target_node', 'Node (DM)'),
              options: [{ value: '', label: t('forwarding.pick_node', 'Pick a node...') }, ...contactOptions], showIf: (r) => getPath(r, 'forwardTo.channel') == null },
            { kind: 'text', key: 'prefix', label: t('forwarding.prefix', 'Prefix (optional)'), help: t('forwarding.prefix_hint'), maxLength: 40 },
          ],
        },
      ],
    },
    {
      id: 'timer-triggers',
      title: t('workspace.meshcore.auto.timers', 'Timer triggers'),
      description: t('workspace.meshcore.auto.timers_description'),
      transmits: true,
      enabledKey: null,
      extra: 'timers',
      load: async (sourceId) => {
        const d = await data(auto(sourceId, 'timers'));
        return { triggers: Array.isArray(d.triggers) ? d.triggers : [] };
      },
      save: async (sourceId, v) => { await apiService.post(auto(sourceId, 'timers'), { triggers: v.triggers }); },
      isOn: (v) => list(v, 'triggers').some((tr) => tr.enabled === true),
      summary: (v) => {
        const triggers = list<MeshCoreTimerTrigger>(v, 'triggers');
        return [t('automation.trigger_count', { count: triggers.length, defaultValue: '{{count}} triggers' }),
          ...triggers.slice(0, 2).map((tr) => (tr.scheduleType === 'cron' ? tr.cronExpression : t('meshcore.automation.timers.every_minutes', { count: tr.intervalMinutes, defaultValue: 'every {{count}} min' })))]
          .filter(Boolean).join(' · ');
      },
      saveEffect: (v) => (list(v, 'triggers').some((tr) => tr.enabled === true) ? t('workspace.meshcore.auto.save_timers') : saveNothing()),
      sends: () => t('workspace.meshcore.auto.timers_sends'),
      fields: () => [
        {
          kind: 'list', key: 'triggers', label: t('workspace.meshcore.auto.triggers'), addLabel: t('meshcore.automation.timers.add_button', 'Add trigger'), itemEnabledKey: 'enabled',
          itemTitle: (tr) => s(tr, 'name') || t('meshcore.automation.timers.untitled', 'New trigger'),
          itemSub: (tr) => [tr.scheduleType === 'cron' ? s(tr, 'cronExpression') : t('meshcore.automation.timers.every_minutes', { count: n(tr, 'intervalMinutes'), defaultValue: 'every {{count}} min' }),
            tr.responseType === 'advert' ? t('meshcore.automation.timers.response_advert', 'Send advert') : tr.responseType === 'script' ? t('meshcore.automation.timers.response_script', 'Run script')
              : tr.destination === 'dm' ? t('meshcore.automation.timers.dest_dm', 'Direct Message') : channelNames(meshCoreTimerChannelIndexes(tr as unknown as MeshCoreTimerTrigger))]
            .filter(Boolean).join(' · '),
          newItem: () => newMeshCoreTimerTrigger() as unknown as Values,
          validateItem: (tr, isNew) => {
            const errs = validateMeshCoreTimer(tr as unknown as MeshCoreTimerTrigger, isNew, (k, f, o) => String(t(k, { defaultValue: f, ...(o ?? {}) })));
            return hasMeshCoreTimerErrors(errs) ? Object.values(errs).filter(Boolean).join(' ') : null;
          },
          itemFields: () => [
            { kind: 'text', key: 'name', label: t('meshcore.automation.timers.name', 'Name'), placeholder: t('meshcore.automation.timers.name_placeholder', 'Trigger name'), maxLength: 60 },
            { kind: 'toggle', key: 'enabled', label: t('common.enabled', 'Enabled') },
            { kind: 'select', key: 'scheduleType', label: t('meshcore.automation.timers.schedule_type', 'Schedule'), options: [
              { value: 'cron', label: t('meshcore.automation.timers.cron', 'Cron') }, { value: 'interval', label: t('meshcore.automation.timers.interval', 'Interval (minutes)') }] },
            { kind: 'text', key: 'cronExpression', label: t('meshcore.automation.timers.cron_expr', 'Cron expression'), mono: true, showIf: (x) => x.scheduleType === 'cron' },
            { kind: 'number', key: 'intervalMinutes', label: t('meshcore.automation.timers.interval_minutes', 'Interval (minutes)'), min: 1, max: 10080, showIf: (x) => x.scheduleType === 'interval' },
            { kind: 'select', key: 'responseType', label: t('meshcore.automation.timers.response_type', 'Action'), options: [
              { value: 'text', label: t('meshcore.automation.timers.response_text', 'Send text') }, { value: 'advert', label: t('meshcore.automation.timers.response_advert', 'Send advert') },
              { value: 'script', label: t('meshcore.automation.timers.response_script', 'Run script') }] },
            { kind: 'select', key: 'advertMode', label: t('meshcore.advert.mode_label', 'Advert reach'), options: advertModes, showIf: (x) => x.responseType === 'advert',
              warn: floodWarning, warnIf: (x) => (x.advertMode ?? LEGACY_MESHCORE_ADVERT_MODE) === 'flood' },
            { kind: 'textarea', key: 'response', label: t('meshcore.automation.timers.response_message', 'Message (token expansion supported)'), maxLength: 500, showIf: (x) => x.responseType === 'text' },
            { kind: 'select', key: 'scriptPath', label: t('meshcore.automation.timers.script', 'Script'),
              options: [{ value: '', label: t('meshcore.automation.timers.select_script', '(select script)') }, ...scriptOptions], showIf: (x) => x.responseType === 'script' },
            { kind: 'text', key: 'scriptArgs', label: t('meshcore.automation.timers.script_args', 'Script args (token expansion)'), showIf: (x) => x.responseType === 'script' },
            { kind: 'select', key: 'destination', label: t('meshcore.automation.timers.destination', 'Destination'), options: [
              { value: 'channel', label: t('meshcore.automation.timers.dest_channel', 'Channel') }, { value: 'dm', label: t('meshcore.automation.timers.dest_dm', 'Direct Message') }],
              showIf: (x) => x.responseType !== 'advert' },
            { kind: 'multi', key: 'channelIndexes', label: t('meshcore.automation.timers.channels', 'Channels'), options: channelOptions, numeric: true,
              help: t('meshcore.automation.timers.channels_cap_hint', { max: 4 }), showIf: (x) => x.responseType !== 'advert' && x.destination !== 'dm' },
            { kind: 'select', key: 'contactPublicKey', label: t('meshcore.automation.timers.contact', 'Contact'),
              options: [{ value: '', label: t('meshcore.automation.timers.select_contact', '(select contact)') }, ...contactOptions], showIf: (x) => x.responseType !== 'advert' && x.destination === 'dm' },
            { kind: 'toggle', key: 'multiline', label: t('automation.split_long.toggle', 'Split long messages'), help: splitHelp, showIf: (x) => x.responseType === 'text' },
            ...scopeFields(t('meshcore.automation.announce.scope_label', 'Scope'), false),
          ],
        },
      ],
    },
    {
      id: 'delete-by-distance',
      title: t('meshcore.automation.delete_distance.title', 'Auto Delete by Distance'),
      description: t('meshcore.automation.delete_distance.description'),
      transmits: false,
      enabledKey: 'enabled',
      extra: 'distance',
      load: async (sourceId) => {
        const d = await data<{ settings?: Values; running?: boolean }>(auto(sourceId, 'auto-delete-distance'));
        return { enabled: false, intervalHours: 24, thresholdKm: 100, lat: null, lon: null, action: 'delete', ...(d.settings ?? {}), running: d.running ?? false };
      },
      save: async (sourceId, v) => {
        await apiService.post(auto(sourceId, 'auto-delete-distance'), pick(v, ['enabled', 'intervalHours', 'thresholdKm', 'lat', 'lon', 'action']));
      },
      isOn: (v) => b(v, 'enabled'),
      summary: (v) => t('workspace.meshcore.auto.distance_summary', { km: n(v, 'thresholdKm'), hours: n(v, 'intervalHours') }),
      saveEffect: (v) => (b(v, 'enabled') ? t('workspace.meshcore.auto.save_distance') : saveNothing()),
      sends: () => null,
      fields: () => [
        { kind: 'toggle', key: 'enabled', label: t('meshcore.automation.delete_distance.title', 'Auto Delete by Distance') },
        { kind: 'select', key: 'action', label: t('meshcore.automation.delete_distance.action', 'Action'), help: t('meshcore.automation.delete_distance.action_description'),
          options: [{ value: 'delete', label: t('meshcore.automation.delete_distance.action_delete', 'Delete') }, { value: 'ignore', label: t('meshcore.automation.delete_distance.action_ignore', 'Ignore') }] },
        { kind: 'number', key: 'thresholdKm', label: t('meshcore.automation.delete_distance.threshold', { unit: 'km' }), min: 1, max: 50000,
          help: t('meshcore.automation.delete_distance.threshold_description') },
        { kind: 'number', key: 'intervalHours', label: t('meshcore.automation.delete_distance.interval', 'Run interval (hours)'), min: 6, max: 48,
          help: t('meshcore.automation.delete_distance.interval_description') },
        { kind: 'number', key: 'lat', label: t('meshcore.automation.delete_distance.home_lat', 'Home latitude'), min: -90, max: 90, step: 0.0001, nullable: true,
          help: t('meshcore.automation.delete_distance.home_description') },
        { kind: 'number', key: 'lon', label: t('meshcore.automation.delete_distance.home_lon', 'Home longitude'), min: -180, max: 180, step: 0.0001, nullable: true },
      ],
    },
    {
      id: 'time-sync',
      title: t('meshcore.automation.time_sync.title', 'Time Sync'),
      description: t('meshcore.automation.time_sync.description'),
      transmits: true,
      enabledKey: null,
      extra: 'timeSync',
      load: async (sourceId) => ({ nodes: (await data<{ nodes?: Values[] }>(auto(sourceId, 'time-sync'))).nodes ?? [] }),
      save: async () => {},
      isOn: (v) => list(v, 'nodes').length > 0,
      summary: (v) => t('workspace.meshcore.auto.nodes_count', { count: list(v, 'nodes').length }),
      saveEffect: saveNothing,
      sends: () => t('workspace.meshcore.auto.time_sync_sends'),
      fields: () => [],
    },
    {
      id: 'remote-telemetry',
      title: t('meshcore.automation.remote_telemetry.title', 'Remote Telemetry'),
      description: t('meshcore.automation.remote_telemetry.description'),
      transmits: true,
      enabledKey: null,
      extra: 'remoteTelemetry',
      load: async (sourceId) => ({ nodes: (await data<{ nodes?: Values[] }>(auto(sourceId, 'remote-telemetry'))).nodes ?? [] }),
      save: async () => {},
      isOn: (v) => list(v, 'nodes').length > 0,
      summary: (v) => t('workspace.meshcore.auto.nodes_count', { count: list(v, 'nodes').length }),
      saveEffect: saveNothing,
      sends: () => t('workspace.meshcore.auto.telemetry_sends'),
      fields: () => [],
    },
    {
      id: 'auto-favorite',
      title: t('meshcore.automation.auto_favorite.title', 'Auto Favorite'),
      description: t('meshcore.automation.auto_favorite.description'),
      transmits: false,
      enabledKey: 'enabled',
      extra: 'favorite',
      load: async (sourceId) => {
        const d = await data<{ settings?: Values; running?: boolean }>(auto(sourceId, 'auto-favorite'));
        return { enabled: false, intervalHours: 6, staleHours: 72, trackedCount: 0, ...(d.settings ?? {}), running: d.running ?? false };
      },
      save: async (sourceId, v) => { await apiService.post(auto(sourceId, 'auto-favorite'), pick(v, ['enabled', 'intervalHours', 'staleHours'])); },
      isOn: (v) => b(v, 'enabled'),
      summary: (v) => t('workspace.meshcore.auto.favorite_summary', { hours: n(v, 'intervalHours'), stale: n(v, 'staleHours') }),
      saveEffect: (v) => (b(v, 'enabled') ? t('workspace.meshcore.auto.save_favorite') : saveNothing()),
      sends: () => null,
      fields: () => [
        { kind: 'toggle', key: 'enabled', label: t('meshcore.automation.auto_favorite.title', 'Auto Favorite') },
        { kind: 'number', key: 'staleHours', label: t('meshcore.automation.auto_favorite.stale', 'Active window (hours)'), min: 1, max: 720,
          help: t('meshcore.automation.auto_favorite.stale_description') },
        { kind: 'number', key: 'intervalHours', label: t('meshcore.automation.auto_favorite.interval', 'Sweep interval (hours)'), min: 1, max: 48,
          help: t('meshcore.automation.auto_favorite.interval_description') },
      ],
    },
    {
      id: 'auto-welcome',
      title: t('meshcore.automation.auto_welcome.title', 'Auto Welcome'),
      description: t('meshcore.automation.auto_welcome.description'),
      transmits: true,
      enabledKey: 'enabled',
      load: async (sourceId) => {
        const d = await data<{ settings?: Values }>(auto(sourceId, 'auto-welcome'));
        return { enabled: false, message: 'Welcome {NAME} to the mesh!', target: 'dm', waitForName: true, maxHops: 3, delaySeconds: 30, maxPerHour: 6, ...(d.settings ?? {}) };
      },
      save: async (sourceId, v) => {
        await apiService.post(auto(sourceId, 'auto-welcome'), pick(v, ['enabled', 'message', 'target', 'waitForName', 'maxHops', 'delaySeconds', 'maxPerHour']));
      },
      isOn: (v) => b(v, 'enabled'),
      summary: (v) => (s(v, 'target') === 'dm' ? t('workspace.meshcore.auto.welcome_dm') : t('workspace.meshcore.auto.welcome_channel', { channel: channelName(n(v, 'target')) })),
      saveEffect: saveNothing,
      sends: (v) => t('workspace.meshcore.auto.welcome_sends', { max: n(v, 'maxPerHour') }),
      fields: () => [
        { kind: 'toggle', key: 'enabled', label: t('meshcore.automation.auto_welcome.title', 'Auto Welcome') },
        { kind: 'textarea', key: 'message', label: t('meshcore.automation.auto_welcome.message', 'Welcome message'), maxLength: 200,
          help: t('meshcore.automation.auto_welcome.message_description') },
        { kind: 'select', key: 'target', label: t('meshcore.automation.auto_welcome.target', 'Send as'), help: t('meshcore.automation.auto_welcome.target_description'),
          options: [{ value: 'dm', label: t('meshcore.automation.auto_welcome.target_dm', 'Direct message to the new node') },
            ...channelOptions.map((o) => ({ value: o.value, label: `${t('meshcore.automation.auto_welcome.target_channel', 'Channel post')} · ${o.label}` }))],
          warn: t('forwarding.channel_airtime_warning') },
        { kind: 'toggle', key: 'waitForName', label: t('meshcore.automation.auto_welcome.wait_for_name', 'Wait for the node’s name before greeting'),
          help: t('meshcore.automation.auto_welcome.wait_for_name_description') },
        { kind: 'number', key: 'maxPerHour', label: t('meshcore.automation.auto_welcome.max_per_hour', 'Max welcomes per hour'), min: 1, max: 60,
          help: t('meshcore.automation.auto_welcome.max_per_hour_description') },
        { kind: 'number', key: 'maxHops', label: t('meshcore.automation.auto_welcome.max_hops', 'Maximum hops'), min: 0, max: 7,
          help: t('meshcore.automation.auto_welcome.max_hops_description') },
        { kind: 'number', key: 'delaySeconds', label: t('meshcore.automation.auto_welcome.delay', 'Pre-send delay (seconds)'), min: 0, max: 600,
          help: t('meshcore.automation.auto_welcome.delay_description') },
      ],
    },
  ];
}

/** The fields, flattened, that differ between two values: the dock's change list. */
export function changedLabels(fields: Field[], v: Values, saved: Values): string[] {
  return fields.filter((f) => f.kind !== 'heading' && !same(getPath(v, f.key), getPath(saved, f.key))).map((f) => f.label);
}
