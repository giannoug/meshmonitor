import type { ActionCommand } from './CliConsoleBody';

/**
 * Quick-action catalog for remote Repeater / Room Server contacts.
 * Clicking a button pre-fills the command input — it does NOT auto-send,
 * so the user can edit before pressing Send and danger commands route
 * through the typed-name confirmation modal naturally.
 *
 * No `stats` entry: there is no bare `stats` verb in the firmware's CLI —
 * only `stats-core`/`stats-radio`/`stats-packets`, all serial-only (same
 * class of restriction as `get acl`, see MESHCORE_REMOTE_ADMIN.md). The
 * working equivalent for a remote node is `MeshCoreRemoteStatsPanel` (in the console),
 * which fetches via the binary SendStatusReq instead of CLI text (#4026).
 */
export const REMOTE_ACTION_CATALOG: ActionCommand[] = [
  { key: 'ver',       labelKey: 'meshcore.remoteConsole.action.ver',       defaultLabel: 'Version',  command: 'ver' },
  { key: 'neighbors', labelKey: 'meshcore.remoteConsole.action.neighbors', defaultLabel: 'Neighbors', command: 'neighbors' },
  { key: 'discover_neighbors', labelKey: 'meshcore.remoteConsole.action.discover_neighbors', defaultLabel: 'Discover neighbors', command: 'discover.neighbors' },
  { key: 'clock',     labelKey: 'meshcore.remoteConsole.action.clock',     defaultLabel: 'Clock',    command: 'clock' },
  { key: 'clock_sync', labelKey: 'meshcore.remoteConsole.action.clock_sync', defaultLabel: 'Sync clock', command: 'clock sync' },
  { key: 'advert',    labelKey: 'meshcore.remoteConsole.action.advert',    defaultLabel: 'Send advert', command: 'advert' },
  { key: 'reboot',    labelKey: 'meshcore.remoteConsole.action.reboot',    defaultLabel: 'Reboot',   command: 'reboot', danger: true },
];
