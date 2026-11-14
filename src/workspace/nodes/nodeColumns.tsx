/**
 * The Nodes table's optional columns (board f3-nodes): each a field today's
 * Nodes view already shows (the list row, the node details, the export), with
 * its label, the sort it maps to, and its cell. Node and Role are always
 * shown. The visible set and its order are the user preference
 * `workspace.nodes.columns` (`useNodeColumns`).
 */
import { useState, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { UiIcon } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import type { DeviceInfo } from '../../types/device';
import type { SortField } from '../../types/ui';
import type { DateFormat, TimeFormat } from '../../contexts/SettingsContext';
import { formatRelativeTime } from '../../utils/datetime';
import { getDistanceToNode } from '../../utils/distance';
import { getHardwareModelName } from '../../utils/nodeHelpers';
import { formatDuration } from '../../utils/telemetryFormat';
import { useUserPreferences } from '../prefs/useUserPreferences';
import styles from './NodesTable.module.css';

export interface CellContext {
  t: TFunction;
  hopsOf(node: DeviceInfo): number;
  home: DeviceInfo | undefined;
  distanceUnit: 'km' | 'mi';
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
}

export interface NodeColumn {
  id: string;
  /** i18n key of the header and the picker row. */
  label: string;
  sort?: SortField;
  cell(node: DeviceInfo, c: CellContext): ReactNode;
}

const dash = '—';

export const nodeIdOf = (n: DeviceInfo) => n.user?.id ?? `!${n.nodeNum.toString(16).padStart(8, '0')}`;
export const nodeNameOf = (n: DeviceInfo) => n.user?.longName || n.user?.shortName || nodeIdOf(n);
/** The avatar's text and colour, as the map's rows. */
export const shortLabel = (n: DeviceInfo) => n.user?.shortName?.trim() || String(n.nodeNum).slice(-4);
export const avatarStyle = (n: DeviceInfo) => ({ background: `var(--device-${(n.nodeNum % 8) + 1})` });
const pct = (v: number | undefined) => (v == null ? dash : `${v.toFixed(1)}%`);

/** Hops as today's list says them: Direct, a number, or nothing known. */
export function hopsText(hops: number, t: TFunction): string {
  return hops >= 999 ? dash : hops === 0 ? t('workspace.chat.direct') : String(hops);
}

/** Battery as today's row chip: "Plugged In" at 101, else a percentage. */
export function batteryText(level: number | undefined, t: TFunction): string | null {
  return level == null ? null : level === 101 ? t('nodes.plugged_in') : `${level}%`;
}

export const NODE_COLUMNS: NodeColumn[] = [
  { id: 'hops', label: 'nodes.hops', sort: 'hops', cell: (n, c) => hopsText(c.hopsOf(n), c.t) },
  // Today's list shows SNR and RSSI only for a direct node: further away they describe the last relay.
  { id: 'snr', label: 'node_popup.snr', sort: 'snr', cell: (n) => (n.hopsAway === 0 && n.snr != null ? n.snr.toFixed(1) : dash) },
  { id: 'rssi', label: 'workspace.map.rssi', cell: (n) => (n.hopsAway === 0 && n.rssi != null ? String(n.rssi) : dash) },
  {
    id: 'battery',
    label: 'nodes.battery',
    sort: 'battery',
    cell: (n, c) => {
      const level = n.deviceMetrics?.batteryLevel;
      const text = batteryText(level, c.t);
      if (!text) return dash;
      if (level === 101) return text;
      return (
        <span className={styles.battery}>
          <span className={styles.bar} data-low={level! < 25 || undefined}>
            <span style={{ width: `${Math.min(level!, 100)}%` }} />
          </span>
          {text}
        </span>
      );
    },
  },
  {
    id: 'lastHeard',
    label: 'nodes.last_heard',
    sort: 'lastHeard',
    cell: (n, c) => (n.lastHeard ? formatRelativeTime(n.lastHeard * 1000, c.timeFormat, c.dateFormat) : c.t('time.never')),
  },
  { id: 'distance', label: 'workspace.nodes.col_distance', cell: (n, c) => getDistanceToNode(c.home, n, c.distanceUnit) ?? dash },
  { id: 'hardware', label: 'nodes.hardware', sort: 'hwModel', cell: (n) => (n.user?.hwModel ? getHardwareModelName(n.user.hwModel) : dash) },
  { id: 'firmware', label: 'node_details.firmware', cell: (n) => n.firmwareVersion || dash },
  {
    id: 'uptime',
    label: 'nodes.uptime',
    sort: 'uptime',
    cell: (n) => {
      const s = n.uptimeSeconds ?? n.deviceMetrics?.uptimeSeconds;
      return s == null ? dash : formatDuration(s);
    },
  },
  { id: 'chUtil', label: 'workspace.map.ch_util', cell: (n) => pct(n.deviceMetrics?.channelUtilization) },
  { id: 'airTx', label: 'nodes.air_util_tx', cell: (n) => pct(n.deviceMetrics?.airUtilTx) },
  {
    id: 'position',
    label: 'node_details.position',
    cell: (n) => (n.position?.latitude != null && n.position.longitude != null ? `${n.position.latitude.toFixed(4)}, ${n.position.longitude.toFixed(4)}` : dash),
  },
  {
    id: 'publicKey',
    label: 'node_details.public_key',
    cell: (n) => (n.user?.publicKey ? <span className={styles.key} title={n.user.publicKey}>{n.user.publicKey}</span> : dash),
  },
  {
    id: 'viaMqtt',
    label: 'node_details.via_mqtt',
    cell: (n, c) => (n.viaMqtt ? <span title={c.t('nodes.via_mqtt')} aria-label={c.t('nodes.via_mqtt')}><UiIcon name="network" size={16} /></span> : dash),
  },
];

/** The columns board f3 draws switched on. */
export const DEFAULT_COLUMNS = ['hops', 'snr', 'rssi', 'battery', 'lastHeard', 'distance', 'hardware'];
export const COLUMNS_PREF = 'workspace.nodes.columns';

const known = new Set(NODE_COLUMNS.map((c) => c.id));

/** The visible columns in order, saved to the signed-in user's preferences (a guest's last the page). */
export function useNodeColumns(): [string[], (next: string[]) => void] {
  const { authStatus } = useAuth();
  const signedIn = authStatus?.authenticated === true;
  const { prefs, setPref } = useUserPreferences({ enabled: signedIn });
  const [local, setLocal] = useState<string[] | null>(null);
  const saved = prefs[COLUMNS_PREF];
  const stored = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string' && known.has(id)) : null;
  const columns = (signedIn ? stored : local) ?? DEFAULT_COLUMNS;
  const set = (next: string[]) => {
    if (!signedIn) return setLocal(next);
    // A failed save rolls the preference back, so the column visibly returns.
    setPref(COLUMNS_PREF, next).catch(() => {});
  };
  return [columns, set];
}
