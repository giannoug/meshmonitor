/**
 * The Automation Engine page's pure logic (moved verbatim out of
 * AutomationsPage, #6365 Rule X), shared with the Workspace's rules pages:
 * the row shapes, the builder's default form and save-time validation, the
 * empty-send check, and the variable form's name rule and config.
 */
import { isValidCron } from 'cron-validator';
import { BLOCK_BY_TYPE } from './catalog';
import { outputNameErrors, type WorkflowForm } from './compile';
import { emptySendFinding } from '../../types/automation';
import { tracePathScheduleParamErrors } from '../../types/tracePathSchedule';

/** One line per action whose text is empty (#5697), named as the builder names it. */
export function emptySendLines(config: unknown): string[] {
  const nodes = (config as { nodes?: unknown } | null)?.nodes;
  if (!Array.isArray(nodes)) return [];
  const out: string[] = [];
  for (const n of nodes as Array<{ type?: unknown; params?: Record<string, unknown> }>) {
    if (typeof n?.type !== 'string') continue;
    const f = emptySendFinding(n.type, n.params);
    if (f) out.push(`${BLOCK_BY_TYPE[n.type]?.label ?? n.type}: ${f.detail}`);
  }
  return out;
}

export interface Automation {
  id: string; name: string; description: string | null; enabled: boolean; config: string;
  createdAt: number; updatedAt: number;
}
export interface Variable {
  id: string; name: string; description: string | null;
  type: 'string' | 'integer' | 'float' | 'boolean' | 'flag';
  scope: 'global' | 'source' | 'node' | 'sourceNode'; readonly: boolean; config: string;
}
export interface Run {
  id: string; status: string; sourceId: string | null; startedAt: number; log: string | null;
  /** JSON `ctx.fields` bag captured when the rule fired — the triggering message (#4711). */
  triggerEvent: string | null;
}

export const VARIABLE_TYPES = ['string', 'integer', 'float', 'boolean', 'flag', 'json'] as const;
export const VARIABLE_SCOPES: { value: Variable['scope']; label: string }[] = [
  { value: 'global', label: 'Global' }, { value: 'source', label: 'Per Source' },
  { value: 'node', label: 'Per Node' }, { value: 'sourceNode', label: 'Per Source + Node' },
];

export const DEFAULT_FORM: WorkflowForm = {
  trigger: { type: 'trigger.message', params: { textContains: 'ping' } },
  // eslint-disable-next-line meshmonitor-ui/no-hardcoded-ui-glyph -- #6365 moved verbatim from AutomationsPage: the tapback a new rule sends (protocol content, not UI)
  rules: [{ conditions: [], actions: [{ type: 'action.tapback', params: { emoji: '👍' } }] }],
  combine: null,
};

/** Builder-form validation: each rule needs an action (unless it only feeds a combine). */
export function validateForm(form: WorkflowForm): string[] {
  const errs: string[] = [];
  if (form.trigger.type === 'trigger.geofence') {
    const shape = form.trigger.params.shape as { type?: string; vertices?: unknown[] } | undefined;
    if (!shape || (shape.type === 'polygon' && (shape.vertices?.length ?? 0) < 3)) {
      errs.push('Draw a geofence region (circle or polygon) on the map.');
    }
  }
  if (form.trigger.type === 'trigger.becameMobile' || form.trigger.type === 'trigger.leftHome') {
    const nums = form.trigger.params.nodeNums;
    if (!Array.isArray(nums) || nums.length === 0) {
      errs.push('Select at least one node to watch.');
    }
  }
  if (form.trigger.type === 'trigger.leftHome') {
    const thr = form.trigger.params.thresholdMeters;
    if (thr != null && thr !== '' && !(Number(thr) > 0)) {
      errs.push('Home-distance threshold must be greater than 0 metres.');
    }
  }
  // #5723: the same limits the server enforces, said before the save round trip.
  for (const rule of form.rules ?? []) {
    for (const action of rule.actions ?? []) {
      if (action.type !== 'action.tracePathSchedule') continue;
      for (const e of tracePathScheduleParamErrors('', action.params ?? {})) {
        errs.push(e.replace('action.tracePathSchedule "" ', 'Scheduled trace paths: '));
      }
    }
  }
  if (form.trigger.type === 'trigger.schedule') {
    const cron = String(form.trigger.params.cron ?? '').trim();
    if (!cron || !isValidCron(cron, { seconds: false, alias: true, allowBlankDay: true })) {
      errs.push('Enter a valid 5-field cron expression for the schedule (e.g. "0 * * * *").');
    }
  }
  if (form.rules.length === 0) errs.push('Add at least one rule.');
  form.rules.forEach((r, i) => {
    if (r.actions.length === 0 && !(form.combine && r.conditions.length > 0)) {
      errs.push(`Rule ${i + 1} needs at least one action.`);
    }
  });
  if (form.combine && form.combine.actions.length === 0) errs.push('The FINALLY step needs at least one action.');
  errs.push(...outputNameErrors(form));
  return errs;
}

export function triggerLabel(a: Automation): string {
  try {
    const t = ((JSON.parse(a.config).nodes ?? []) as Array<{ type?: unknown }>).find((n) => String(n.type).startsWith('trigger.'));
    return t ? String(t.type).replace('trigger.', '') : '';
  } catch { return ''; }
}

export function scopeLabel(s: Variable['scope']): string {
  return VARIABLE_SCOPES.find((x) => x.value === s)?.label ?? s;
}

export function pretty(jsonStr: string): string { try { return JSON.stringify(JSON.parse(jsonStr), null, 2); } catch { return jsonStr; } }

/** A variable name {{ var.name.field }} can index: letters, digits and underscore. */
export const isVariableName = (name: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
export const VARIABLE_NAME_ERROR = 'Name must be a letters/digits/underscore identifier (no dots or spaces) — needed so {{ var.name.field }} can index JSON.';

/** The `config` POST /api/automations/variables stores for the new-variable form. */
export function variableConfig(type: Variable['type'], defaultValue: string, flagDuration: string): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (defaultValue !== '') config.defaultValue = (type === 'integer' || type === 'float') ? Number(defaultValue) : defaultValue;
  if (type === 'flag' && flagDuration !== '') config.flagDurationSeconds = Number(flagDuration);
  return config;
}
