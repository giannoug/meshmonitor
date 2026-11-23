/**
 * The Automation Engine's rules as a device door reads them (Tasks 7.5, 8.3):
 * which devices a rule names (its source filters; none = every device), its
 * action types, and whether its trigger carries a limit. Shared by the
 * MeshCore and Meshtastic Automations pages; display only.
 */

export const ENGINE = '/overview/automations';

/** Engine actions that put something on the air. */
export const TRANSMITTING = new Set(['action.tapback', 'action.sendMessage', 'action.tracePathSchedule', 'action.requestData', 'action.broadcastWaypoint', 'action.runScript']);

export interface EngineRule {
  id: string;
  name: string;
  enabled: boolean;
  config: string;
}

export interface ReadRule {
  /** The source ids its source filters name; null: every device. */
  sources: string[] | null;
  actions: string[];
  /** Its trigger has a cooldown or a rate limit (s14n1: otherwise "No limit set", read literally). */
  limited: boolean;
}

/** The source ids a rule's source filters name (none: every device), its action types, and its trigger's limit. */
export function readRule(config: string): ReadRule {
  const sources: string[] = [];
  const actions: string[] = [];
  let filtered = false;
  let limited = false;
  const walk = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') {
      const node = o as { type?: unknown; params?: { sourceIds?: unknown; cooldownSeconds?: unknown; rateLimit?: unknown } };
      if (node.type === 'condition.sourceFilter' && Array.isArray(node.params?.sourceIds) && node.params.sourceIds.length > 0) {
        filtered = true;
        sources.push(...(node.params.sourceIds as string[]));
      }
      if (typeof node.type === 'string' && node.type.startsWith('action.')) actions.push(node.type);
      if (typeof node.type === 'string' && node.type.startsWith('trigger.')) {
        const rate = node.params?.rateLimit as { maxActions?: unknown } | undefined;
        if (Number(node.params?.cooldownSeconds ?? 0) > 0 || (rate && Number(rate.maxActions) > 0)) limited = true;
      }
      Object.values(o).forEach(walk);
    }
  };
  try {
    walk(JSON.parse(config));
  } catch {
    // An unreadable config names no device.
  }
  return { sources: filtered ? sources : null, actions, limited };
}
