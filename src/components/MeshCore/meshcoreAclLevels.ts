/** Permission levels recognized by MeshCore's `setperm` command.
 *  Mapping from the firmware (CommonCLI.cpp handleCommand):
 *    0 — remove the ACL entry (revoke all access)
 *    1 — guest (read-only stats / telemetry)
 *    2 — read-write (room servers only — can post)
 *    3 — admin (full control, including ACL management)
 */
export const PERMISSION_LEVELS = [
  { value: 0, key: 'remove',    defaultLabel: 'Remove (revoke access)' },
  { value: 1, key: 'guest',     defaultLabel: 'Guest (read-only)' },
  { value: 2, key: 'readwrite', defaultLabel: 'Read/Write (room servers)' },
  { value: 3, key: 'admin',     defaultLabel: 'Admin (full control)' },
] as const;

/** A `setperm` target: exactly 64 hex characters (today's form check). */
export const isAclKey = (key: string) => /^[0-9a-f]{64}$/.test(key);
