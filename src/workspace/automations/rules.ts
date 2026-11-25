/**
 * The Automation Engine's rules as the Workspace pages read them (Task 8.4):
 * the shared queries, and pure readers over a rule's saved graph (its trigger,
 * limit, step summaries, Sends line and what Run now would send). Display
 * only: nothing here writes a rule.
 */
import type { TFunction } from 'i18next';
import apiService from '../../services/api';
import { BLOCK_BY_TYPE, fieldsFor, fieldVisible } from '../../components/automations/catalog';
import { decompile, type FormBlock } from '../../components/automations/compile';
import type { Run, Variable } from '../../components/automations/automationsPageLogic';
import type { UnifiedChannelOption } from '../../components/automations/AutomationBuilder';
import type { AutomationGraph, AutomationNode } from '../../types/automation';
import { TRANSMITTING } from './engineRules';

export const variablesQuery = {
  queryKey: ['workspace', 'automations', 'variables'] as const,
  queryFn: () => apiService.get<Variable[]>('/api/automations/variables'),
  refetchOnWindowFocus: false,
};

export const runsQuery = (id: string) => ({
  queryKey: ['workspace', 'automations', 'runs', id] as const,
  queryFn: () => apiService.get<Run[]>(`/api/automations/${encodeURIComponent(id)}/runs`),
  // Re-read on each open, as Classic does; no interval, and a refetch only on mount.
  staleTime: 0,
  refetchOnWindowFocus: false,
});

export const channelsQuery = {
  queryKey: ['workspace', 'automations', 'channels'] as const,
  queryFn: () => apiService.get<UnifiedChannelOption[]>('/api/automations/channels'),
  refetchOnWindowFocus: false,
};

export const regionsQuery = {
  queryKey: ['workspace', 'automations', 'regions'] as const,
  queryFn: async () => (await apiService.get<{ regions?: Array<{ name: string }> }>('/api/automations/regions')).regions?.map((r) => r.name) ?? [],
  refetchOnWindowFocus: false,
};

export function readGraph(config: string): AutomationGraph | null {
  try {
    const g = JSON.parse(config) as AutomationGraph;
    return g && Array.isArray(g.nodes) ? g : null;
  } catch {
    return null;
  }
}

export const triggerOf = (g: AutomationGraph | null): AutomationNode | undefined => g?.nodes.find((n) => String(n.type).startsWith('trigger.'));

export interface RuleLimit {
  cooldownSeconds: number;
  rateLimit: { maxActions: number; windowSeconds: number } | null;
}

/** The trigger's cooldown and rate limit, as stored (0 / null when absent). */
export function limitOf(trigger: AutomationNode | undefined): RuleLimit {
  const p = (trigger?.params ?? {}) as { cooldownSeconds?: unknown; rateLimit?: { maxActions?: unknown; windowSeconds?: unknown } };
  const cooldownSeconds = Number(p.cooldownSeconds ?? 0) || 0;
  const max = Number(p.rateLimit?.maxActions ?? 0) || 0;
  const win = Number(p.rateLimit?.windowSeconds ?? 0) || 0;
  return { cooldownSeconds, rateLimit: max > 0 ? { maxActions: max, windowSeconds: win } : null };
}

export const isLimited = (l: RuleLimit) => l.cooldownSeconds > 0 || l.rateLimit !== null;

/**
 * Whether the steps view can show and save this graph without losing anything:
 * today's builder shape (decompile), and no key beyond the ones compile writes.
 * Anything else is edited as JSON (s14n4), so a save never rewrites what the
 * steps view cannot show (GR).
 */
export function drawable(g: unknown): boolean {
  if (!g || typeof g !== 'object' || !decompile(g)) return false;
  const graph = g as Record<string, unknown> & AutomationGraph;
  const only = (o: object, keys: string[]) => Object.keys(o).every((k) => keys.includes(k));
  return only(graph, ['version', 'nodes', 'edges']) && graph.version === 1
    && graph.nodes.every((n) => only(n, ['id', 'type', 'params']))
    && graph.edges.every((e) => only(e, ['from', 'to']));
}

/** The trigger's chip word (14-01: Message, Telemetry, Schedule…). */
export const triggerChip = (t: TFunction, type: string | undefined) =>
  type ? t(`workspace.rules.chip.${type.replace('trigger.', '')}`, { defaultValue: BLOCK_BY_TYPE[type]?.label ?? type }) : '';

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v)).trim();

function optionLabel(block: FormBlock, name: string, triggerType: string): string {
  const def = BLOCK_BY_TYPE[block.type];
  const f = def?.fields.find((x) => x.name === name && fieldVisible(x, block.params));
  const v = str(block.params[name]);
  if (!f || !v) return v;
  const opts = f.kind === 'fieldselect' ? fieldsFor(block.type, triggerType).flatMap((g) => g.options) : f.options ?? [];
  return opts.find((o) => o.value === v)?.label ?? v;
}

/** Names the viewer can read; the rest are counted, never named (two-source rule). */
export function deviceNames(ids: string[], readable: Array<{ id: string; name: string }>, t: TFunction): string {
  const named = ids.map((id) => readable.find((s) => s.id === id)?.name).filter((n): n is string => !!n);
  const hidden = ids.length - named.length;
  return [...named, ...(hidden > 0 ? [t('workspace.rules.other_devices', { count: hidden })] : [])].join(', ');
}

/** `channelMulti` stores `{ name, protocol? }` (a plain name in older graphs). */
const channelList = (v: unknown) =>
  (Array.isArray(v) ? v.map((c) => `#${typeof c === 'string' ? c : String((c as { name?: unknown })?.name ?? '')}`).join(', ') : '');

/** One line saying what a step does (m2's cards), from its saved params. */
export function stepSummary(block: FormBlock, triggerType: string, t: TFunction, readable: Array<{ id: string; name: string }>): string {
  const p = block.params;
  const def = BLOCK_BY_TYPE[block.type];
  switch (block.type) {
    case 'trigger.message': {
      const where = channelList(p.channels) || (str(p.channelName) ? `#${str(p.channelName)}` : '');
      return [
        where ? t('workspace.rules.step.message_in', { where }) : t('workspace.rules.step.message'),
        str(p.textContains) && t('workspace.rules.step.containing', { text: str(p.textContains) }),
        str(p.regex) && t('workspace.rules.step.matching', { text: str(p.regex) }),
      ].filter(Boolean).join(' ');
    }
    case 'trigger.schedule':
      return t('workspace.rules.step.schedule', { cron: str(p.cron) || '—' });
    case 'condition.string':
    case 'condition.numeric': {
      const field = optionLabel(block, 'field', triggerType);
      return `${field.charAt(0).toUpperCase()}${field.slice(1)} ${optionLabel(block, 'op', triggerType)} ${str(p.value)}`.trim();
    }
    case 'condition.sourceFilter': {
      const ids = Array.isArray(p.sourceIds) ? (p.sourceIds as string[]) : [];
      return ids.length ? t('workspace.rules.step.source_in', { devices: deviceNames(ids, readable, t) }) : t('workspace.rules.step.any_source');
    }
    case 'action.sendMessage': {
      const to = str(p.to);
      const where = to ? t('workspace.rules.step.dm_to', { to }) : channelList(p.channels) ? t('workspace.rules.step.in', { where: channelList(p.channels) }) : t('workspace.rules.step.same_channel');
      return t('workspace.rules.step.send', { where, text: str(p.text) || '—' });
    }
    case 'action.runScript': {
      const script = str(p.scriptPath).split('/').pop() || '—';
      return str(p.args) ? t('workspace.rules.step.script_args', { script, args: str(p.args) }) : t('workspace.rules.step.script', { script });
    }
    default: {
      const bits = (def?.fields ?? [])
        // Advanced fields stay out of the one-line summary (notify's Apprise URLs carry tokens).
        .filter((f) => !f.advanced && fieldVisible(f, p) && ['text', 'number', 'select', 'textarea', 'emoji', 'nodeNum', 'scriptselect', 'variable'].includes(f.kind) && str(p[f.name]))
        .slice(0, 2)
        .map((f) => (f.kind === 'select' ? optionLabel(block, f.name, triggerType) : str(p[f.name])));
      return [def?.label ?? block.type, ...bits].join(' · ');
    }
  }
}

/** One transmitting action as Run now would send it from the saved rule (14-04). */
export interface WouldSend {
  type: string;
  label: string;
  /** The devices it names; empty: the triggering one, which Run now does not have. */
  sourceIds: string[];
  where: string;
  text: string;
  /** Run a script: the script's file name. */
  script?: string;
}

export function wouldSend(g: AutomationGraph | null, t: TFunction): WouldSend[] {
  return (g?.nodes ?? [])
    .filter((n) => TRANSMITTING.has(String(n.type)))
    .map((n) => {
      const p = (n.params ?? {}) as Record<string, unknown>;
      const to = str(p.to);
      const where = to ? t('workspace.rules.step.dm_to', { to }) : channelList(p.channels) ? t('workspace.rules.step.in', { where: channelList(p.channels) }) : t('workspace.rules.step.same_channel');
      const text = n.type === 'action.sendMessage' ? str(p.text) : n.type === 'action.tapback' ? str(p.emoji) : '';
      return {
        type: String(n.type),
        label: BLOCK_BY_TYPE[n.type]?.label ?? String(n.type),
        sourceIds: Array.isArray(p.sourceIds) ? (p.sourceIds as string[]) : [],
        where,
        text,
        script: str(p.scriptPath).split('/').pop(),
      };
    });
}

/** What one transmitting step puts on the air, in a few words (s14n1). */
export function sendsWhat(s: WouldSend, t: TFunction): string {
  switch (s.type) {
    case 'action.sendMessage': return t('workspace.rules.sends.message', { where: s.where });
    case 'action.tapback': return t('workspace.rules.sends.tapback');
    case 'action.requestData': return t('workspace.rules.sends.request');
    case 'action.broadcastWaypoint': return t('workspace.rules.sends.waypoint');
    case 'action.tracePathSchedule': return t('workspace.rules.sends.traces');
    default: return s.label.toLowerCase();
  }
}

/** The rule's Sends line (s14n1), from its saved graph only. */
export function ruleSends(g: AutomationGraph | null, t: TFunction): string {
  const sends = wouldSend(g, t);
  if (sends.length === 0) return t('workspace.settings.savebar.sends_nothing');
  const trigger = triggerOf(g);
  // A script sends nothing itself; it is named only when nothing else sends.
  const shown = sends.filter((s) => s.type !== 'action.runScript');
  if (shown.length === 0) return t('workspace.rules.sends.script_only', { script: sends.map((s) => s.script || '—').join(', ') });
  const what = shown.map((s) => sendsWhat(s, t)).join(' + ');
  const when = trigger?.type === 'trigger.schedule'
    ? t('workspace.rules.sends.on_schedule', { cron: str(trigger.params?.cron) })
    : t('workspace.rules.sends.each_time');
  const l = limitOf(trigger);
  const limit = [
    l.cooldownSeconds > 0 && t('workspace.rules.sends.cooldown', { seconds: l.cooldownSeconds }),
    l.rateLimit && t('workspace.rules.sends.rate', { max: l.rateLimit.maxActions, seconds: l.rateLimit.windowSeconds }),
  ].filter(Boolean);
  return [`${t('workspace.rules.sends.sends', { what })} ${when}`, ...limit].join(' · ');
}

/** A run's result in 14-13's words, from today's stored status and steps. */
export type RunKind = 'sent' | 'done' | 'skipped' | 'failed';

export function runKind(run: Run, steps: Array<{ type?: string; outcome: string; detail?: Record<string, unknown> }> | null): RunKind {
  if (run.status === 'failed') return 'failed';
  const ran = (steps ?? []).filter((s) => s.outcome === 'action:ok' && s.detail?.skipped !== true);
  if (ran.length === 0) return 'skipped';
  return ran.some((s) => TRANSMITTING.has(String(s.type))) ? 'sent' : 'done';
}
