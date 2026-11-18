/**
 * This radio's serial console quick actions by device type, moved as is out
 * of MeshCoreLocalConsole (Rule X, Task 7.4) so the Workspace's Console page
 * offers the same chips.
 */
import type { ActionCommand } from './CliConsoleBody';

/** Verbs that the synthetic Companion CLI implements. Keep in sync with
 *  MeshCoreManager.runSyntheticLocalCli. */
const COMPANION_ACTION_CATALOG: ActionCommand[] = [
  { key: 'ver',    labelKey: 'meshcore.localConsole.action.ver',    defaultLabel: 'Version', command: 'ver' },
  { key: 'stats',  labelKey: 'meshcore.localConsole.action.stats',  defaultLabel: 'Stats',   command: 'stats' },
  { key: 'clock',  labelKey: 'meshcore.localConsole.action.clock',  defaultLabel: 'Clock',   command: 'clock' },
  // One click sends the cheap zero-hop advert; a flood (`advert`) must be typed,
  // or sent from the status bar's confirmed "Flood advert" button.
  { key: 'advert', labelKey: 'meshcore.localConsole.action.advert_zerohop', defaultLabel: 'Zero-hop advert', command: 'advert.zerohop' },
  { key: 'help',   labelKey: 'meshcore.localConsole.action.help',   defaultLabel: 'Help',    command: 'help' },
];

/** Companion fw 1.18.0+ (#5868): the shim's verbs plus reads from the
 *  firmware CLI and a danger Reboot. WiFi verbs exist only on WiFi builds,
 *  so they are typed, not buttons. */
const COMPANION_NATIVE_ACTION_CATALOG: ActionCommand[] = [
  { key: 'ver',    labelKey: 'meshcore.localConsole.action.ver',    defaultLabel: 'Version', command: 'ver' },
  { key: 'stats',  labelKey: 'meshcore.localConsole.action.stats',  defaultLabel: 'Stats',   command: 'stats' },
  { key: 'clock',  labelKey: 'meshcore.localConsole.action.clock',  defaultLabel: 'Clock',   command: 'clock' },
  { key: 'radio',  labelKey: 'meshcore.localConsole.action.radio',  defaultLabel: 'Radio',   command: 'get radio' },
  { key: 'tx',     labelKey: 'meshcore.localConsole.action.tx',     defaultLabel: 'TX power', command: 'get tx' },
  { key: 'tz',     labelKey: 'meshcore.localConsole.action.tz',     defaultLabel: 'Time zone', command: 'get tz.offset' },
  { key: 'advert', labelKey: 'meshcore.localConsole.action.advert_zerohop', defaultLabel: 'Zero-hop advert', command: 'advert.zerohop' },
  { key: 'help',   labelKey: 'meshcore.localConsole.action.help',   defaultLabel: 'Help',    command: 'help' },
  { key: 'reboot', labelKey: 'meshcore.remoteConsole.action.reboot', defaultLabel: 'Reboot', command: 'reboot', danger: true },
];

/** Repeater / Room Server firmware: the native serial CLI handles a
 *  much larger command set. We surface the same safe verbs as the
 *  remote-Repeater console for consistency, plus a danger Reboot. */
const REPEATER_ACTION_CATALOG: ActionCommand[] = [
  { key: 'ver',       labelKey: 'meshcore.remoteConsole.action.ver',       defaultLabel: 'Version',  command: 'ver' },
  { key: 'stats',     labelKey: 'meshcore.remoteConsole.action.stats',     defaultLabel: 'Stats',    command: 'stats' },
  { key: 'neighbors', labelKey: 'meshcore.remoteConsole.action.neighbors', defaultLabel: 'Neighbors', command: 'neighbors' },
  { key: 'discover_neighbors', labelKey: 'meshcore.remoteConsole.action.discover_neighbors', defaultLabel: 'Discover neighbors', command: 'discover.neighbors' },
  { key: 'clock',     labelKey: 'meshcore.remoteConsole.action.clock',     defaultLabel: 'Clock',    command: 'clock' },
  { key: 'advert',    labelKey: 'meshcore.localConsole.action.advert_zerohop', defaultLabel: 'Zero-hop advert', command: 'advert.zerohop' },
  { key: 'reboot',    labelKey: 'meshcore.remoteConsole.action.reboot',    defaultLabel: 'Reboot',   command: 'reboot', danger: true },
];

/** The quick actions MeshCoreLocalConsole offers for this device (its `actionCatalog`). */
export function localActionCatalog(deviceType: number | undefined, nativeCompanionCli: boolean, receiveOnly: boolean): ActionCommand[] {
  let base =
    deviceType === 2 || deviceType === 3 ? REPEATER_ACTION_CATALOG :
    nativeCompanionCli ? COMPANION_NATIVE_ACTION_CATALOG :
    deviceType === 1 ? COMPANION_ACTION_CATALOG :
    [];
  if (deviceType !== 2) base = base.filter(a => a.key !== 'discover_neighbors');
  if (!receiveOnly) return base;
  return base.map(action => (action.key === 'advert' || action.key === 'discover_neighbors') ? { ...action, disabled: true } : action);
}
