/**
 * A Meshtastic device's built-in automations by id (Task 8.3): today's
 * Automation tab anchors (`automation#<id>`), which are also the Workspace's
 * `automation/<id>` pages. Kept apart so the router imports no page code.
 */
export const BUILTIN_IDS = [
  'auto-acknowledge', 'auto-responder', 'auto-welcome', 'auto-ping', 'geofence-triggers', 'forwarding',
  'auto-announce', 'timer-triggers', 'auto-time-sync',
  'airtime-cutoff', 'auto-favorite', 'auto-key-management', 'auto-heap-management',
  'auto-traceroute', 'auto-localstats', 'remote-admin-scanner', 'auto-delete-by-distance', 'ignored-nodes',
] as const;

export type BuiltinId = (typeof BUILTIN_IDS)[number];
