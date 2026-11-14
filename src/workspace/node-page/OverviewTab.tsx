/**
 * The node page's Overview (boards f4-node, g4-node): four stat cards (hops,
 * SNR · RSSI, battery, channel utilisation), then Radio (with today's signal
 * trend and coverage link), Position (the node's map) and Identity & security
 * (with the status message and the remote-admin metadata), from the node row
 * the poll already carries: the rest of today's node details. Display only;
 * the signal trend makes the same read the DM's node details make.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ShowCoverageLink } from '../../components/Analysis/ShowCoverageLink';
import SignalTrendBadge from '../../components/SignalTrendBadge';
import { useMapContext } from '../../contexts/MapContext';
import { useData } from '../../contexts/DataContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useChannels, useNodes } from '../../hooks/useServerData';
import type { DeviceInfo } from '../../types/device';
import { formatRelativeTime } from '../../utils/datetime';
import { getDistanceToNode } from '../../utils/distance';
import { getEffectiveHops } from '../../utils/nodeHops';
import { parseNodeId } from '../../utils/nodeHelpers';
import { parseRemoteAdminMetadata } from '../../utils/remoteAdminMetadata';
import { formatDuration } from '../../utils/telemetryFormat';
import { batteryText, hopsText } from '../nodes/nodeColumns';
import { useIsPhone } from '../shell/useIsPhone';
import { Fact, FactCard, Facts } from './Facts';
import NodeMap from './NodeMap';
import styles from './OverviewTab.module.css';

export interface OverviewTabProps {
  sourceId: string;
  node: DeviceInfo;
  mapNodes: DeviceInfo[];
}

const pct = (v: number) => `${v.toFixed(v < 10 ? 1 : 0)}%`;

export default function OverviewTab({ sourceId, node, mapNodes }: OverviewTabProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { currentNodeId } = useData();
  const { traceroutes } = useMapContext();
  const { nodes } = useNodes();
  const { channels } = useChannels();
  const { nodeHopsCalculation, distanceUnit, timeFormat, dateFormat } = useSettings();

  const isHome = node.user?.id === currentNodeId;
  const hops = isHome ? 0 : getEffectiveHops(node, nodeHopsCalculation, traceroutes, currentNodeId ? parseNodeId(currentNodeId) : null);
  const home = nodes.find((n) => n.user?.id === currentNodeId);
  const m = node.deviceMetrics;
  const uptime = node.uptimeSeconds ?? m?.uptimeSeconds;
  const channel = node.channel != null ? channels.find((c) => c.id === node.channel) : undefined;
  const channelName = node.channel == null ? null : channel?.displayName || channel?.name || t('channels.channel_fallback', { channelNum: node.channel });
  const pos = node.position;
  const distance = isHome ? null : getDistanceToNode(home, node, distanceUnit);
  const key = node.user?.publicKey;

  const stat = (label: string, value: ReactNode, sub?: ReactNode) => (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd className={styles.value}>{value}</dd>
      {sub && <dd className={styles.sub}>{sub}</dd>}
    </div>
  );
  const stats = [
    hops < 999 && stat(t('nodes.hops'), hopsText(hops, t)),
    (node.snr != null || node.rssi != null) &&
      stat(
        `${t('workspace.map.snr')} · ${t('workspace.map.rssi')}`,
        `${node.snr != null ? node.snr.toFixed(1) : '—'} · ${node.rssi ?? '—'}`,
        'dB · dBm',
      ),
    m?.batteryLevel != null && stat(t('workspace.map.battery'), batteryText(m.batteryLevel, t), m.voltage != null ? `${m.voltage.toFixed(2)} V` : null),
    m?.channelUtilization != null &&
      stat(t('workspace.map.ch_util'), pct(m.channelUtilization), m.airUtilTx != null ? `${t('nodes.air_util_tx')} ${pct(m.airUtilTx)}` : null),
  ].filter(Boolean);
  // NodeDetailsBlock's remote-admin metadata rows: only for a node with remote admin.
  const metadata = node.hasRemoteAdmin && node.remoteAdminMetadata ? parseRemoteAdminMetadata(node.remoteAdminMetadata) : null;
  const yesNo = (v: boolean) => (v ? t('common.yes') : t('common.no'));
  const nodeId = node.user?.id ?? `!${node.nodeNum.toString(16).padStart(8, '0')}`;
  const remoteAdmin = node.lastRemoteAdminCheck == null
    ? t('node_details.remote_admin_unknown')
    : node.hasRemoteAdmin ? t('node_details.remote_admin_yes') : t('node_details.remote_admin_no');

  return (
    <div className={styles.overview} data-phone={isPhone || undefined}>
      {stats.length > 0 && <dl className={styles.stats}>{stats}</dl>}
      <div className={styles.sections}>
        <FactCard title={t('workspace.node.radio')}>
          <Facts>
            {hops < 999 && <Fact label={t('node_details.hops_away')}>{hopsText(hops, t)}</Fact>}
            {channelName && <Fact label={t('workspace.node.heard_on')}>{`# ${channelName} · ${node.viaMqtt ? 'MQTT' : 'RF'}`}</Fact>}
            {uptime != null && <Fact label={t('node_details.uptime')}>{formatDuration(uptime)}</Fact>}
            {m?.noiseFloor != null && <Fact label={t('node_details.noise_floor')}>{`${m.noiseFloor} dBm`}</Fact>}
          </Facts>
          {/* Today's signal trend card (it fetches its own trend, as in the DM's node details) and coverage link. */}
          <div className={styles.extras}>
            <SignalTrendBadge nodeId={nodeId} sourceId={sourceId} />
            {node.user?.id && <ShowCoverageLink senderId={node.user.id} />}
          </div>
        </FactCard>
        {pos?.latitude != null && pos.longitude != null && (
          <FactCard title={t('node_details.position', 'Position')} className={styles.position}>
            <div className={styles.mapCard}>
              <NodeMap node={node} mapNodes={mapNodes} size="card" />
              <p className={styles.mapFoot}>
                <span>
                  {`${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`}
                  {pos.altitude != null && ` · ${pos.altitude} m`}
                </span>
                {distance && <span>{distance}</span>}
              </p>
            </div>
          </FactCard>
        )}
        <FactCard title={t('workspace.node.identity')}>
          <Facts>
            {/* The node's own broadcast status (#4818): a node property, rendered verbatim. */}
            {node.nodeStatus && <Fact label={t('node_details.status_message', 'Status')}>{node.nodeStatus}</Fact>}
            {key && (
              <Fact label={t('node_details.public_key')}>
                <span title={key}>{`${key.slice(0, 4)}…${key.slice(-5)}`}</span>
              </Fact>
            )}
            <Fact label={t('node_details.node_id')}>{String(node.nodeNum >>> 0)}</Fact>
            {typeof node.firstHeard === 'number' && (
              <Fact label={t('node_details.first_heard', 'First Heard')}>{formatRelativeTime(node.firstHeard * 1000, timeFormat, dateFormat, false)}</Fact>
            )}
            <Fact label={t('node_details.remote_admin')}>{remoteAdmin}</Fact>
            {metadata?.firmwareVersion && <Fact label={t('node_details.remote_firmware')}>{metadata.firmwareVersion}</Fact>}
            {metadata?.hasWifi !== undefined && <Fact label={t('node_details.has_wifi')}>{yesNo(metadata.hasWifi)}</Fact>}
            {metadata?.hasBluetooth !== undefined && <Fact label={t('node_details.has_bluetooth')}>{yesNo(metadata.hasBluetooth)}</Fact>}
            {metadata?.hasEthernet !== undefined && <Fact label={t('node_details.has_ethernet')}>{yesNo(metadata.hasEthernet)}</Fact>}
            {metadata?.canShutdown !== undefined && <Fact label={t('node_details.can_shutdown')}>{yesNo(metadata.canShutdown)}</Fact>}
          </Facts>
        </FactCard>
      </div>
    </div>
  );
}
