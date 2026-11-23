/**
 * A Meshtastic-family device's Info (boards o2-info, 16-01-info; notes s16n0,
 * s16n3): `/source/:id/info`, what MeshMonitor knows about this connection and
 * its radio, in groups: Connection, Radio, This node, Mesh, Records, MQTT and
 * Server. The summary shows a few of each group's values (desktop: cards;
 * phone: the first three as cards, the rest as rows); each group opens its
 * page (`info/<group>`) with every field today's Info tab shows for it.
 *
 * Reads are today's InfoTab's, at today's cadence (`useInfoTabData`, moved
 * out of InfoTab: route records, the virtual node, server info, the local
 * node's stats, the security keys once, the packet distribution and the
 * message counts, each every minute) plus the device's poll, which the other
 * device pages share. Secrets are today's: the public key shown, the private
 * key masked until Show (and the server sends them to admins only). Clear
 * record (traceroute:write) asks first with today's words; it changes
 * MeshMonitor's records only. Nothing here sends on the mesh.
 */
import { lazy, Suspense, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { version } from '../../../package.json';
import { UiIcon } from '../../components/icons';
import DeviceCounterNote from '../../components/DeviceCounterNote';
import RouteSegmentRecord from '../../components/RouteSegmentRecord';
import TransportBreakdown from '../../components/TransportBreakdown';
import {
  availableChannels, hardwareModelChart, lastMessageTime, mostRecentlyHeardName, packetsByDeviceChart, packetsByTypeChart, portLabel,
  portnumTypeName, radioStatsCharts,
} from '../../components/infoTabCharts';
import { formatUptime, useInfoTabData } from '../../components/useInfoTabData';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useSettings } from '../../contexts/SettingsContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { useChannels, useNodes } from '../../hooks/useServerData';
import { appBasename } from '../../init';
import type { RouteSegmentRecords, RouteSegmentView } from '../../services/api';
import type { ResourceType } from '../../types/permission';
import { formatDateTime } from '../../utils/datetime';
import { getDeviceRoleName } from '../../utils/deviceRole';
import { getHardwareModelName } from '../../utils/hardwareModel';
import { countNodesByTransport, isMqttOnlySourceType, transportCutoffSec, type NodeTransportClass } from '../../utils/nodeTransport';
import { getSourceEndpointLabel } from '../../utils/sourceEndpoint';
import ChatProviders from '../chat/ChatProviders';
import { useChatRuntime } from '../chat/useChatRuntime';
import ToolHead from '../meshcore/ToolHead';
import ConfirmSheet from '../patterns/ConfirmSheet';
import { useShellDevices } from '../shell/shellDevices';
import { useIsPhone } from '../shell/useIsPhone';
import { INFO_GROUPS, type InfoGroup } from './deviceTools';
import mc from '../meshcore/McTools.module.css';
import styles from './Tools.module.css';

const PacketStatsChart = lazy(() => import('../../components/PacketStatsChart'));
const NetworkSurveyPanel = lazy(() => import('../../components/survey/NetworkSurveyPanel'));
const TelemetryGraphs = lazy(() => import('../../components/TelemetryGraphs'));
const PacketRateGraphs = lazy(() => import('../../components/PacketRateGraphs'));
const TransportSeriesGraphs = lazy(() => import('../../components/TransportSeriesGraphs'));


const TRANSPORT_FILTER_OPTIONS = ['all', 'rf', 'udp', 'mqtt'] as const;
const ROUTE_SEGMENT_TRANSPORT_ORDER: NodeTransportClass[] = ['rf', 'udp', 'mqtt'];

export default function InfoRoute({ sourceId, source, group }: { sourceId: string; source: DashboardSource; group: InfoGroup | null }) {
  return (
    <ChatProviders sourceId={sourceId} source={source} classicTab="nodes">
      <Info sourceId={sourceId} source={source} group={group} />
    </ChatProviders>
  );
}

type Row = [label: string, value: ReactNode];

function Rows({ rows }: { rows: Row[] }) {
  return (
    <dl className={mc.kv}>
      {rows.map(([label, value]) => (
        <div key={label} className={mc.kvRow}>
          <dt className={mc.kvLabel}>{label}</dt>
          <dd className={mc.kvValue}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Info({ sourceId, source, group }: { sourceId: string; source: DashboardSource; group: InfoGroup | null }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { authStatus, hasPermission } = useAuth();
  const settings = useSettings();
  const { view } = useChatRuntime(-1);
  const { connectionStatus, currentNodeId, deviceInfo: rawDeviceInfo, deviceConfig: rawDeviceConfig } = useData();
  const { nodes } = useNodes();
  const { channels } = useChannels();
  const { sources } = useShellDevices();
  const live = sources.find((s) => s.id === sourceId)?.live;
  const isAuthenticated = authStatus?.authenticated === true;
  const isMqttOnlySource = isMqttOnlySourceType(source.type);
  const showTransport = !isMqttOnlySource;
  // An MQTT feed has no local node: never show a device identity or config for it (#5367).
  const deviceConfig = isMqttOnlySource ? null : (rawDeviceConfig as Record<string, any> | null); // eslint-disable-line @typescript-eslint/no-explicit-any -- today's untyped poll config
  const deviceInfo = rawDeviceInfo as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any -- today's untyped poll config
  const canReadTraceroute = hasPermission('traceroute', 'read');
  const canWriteTraceroute = hasPermission('traceroute', 'write');
  const d = useInfoTabData({ connectionStatus, currentNodeId, isAuthenticated, isMqttOnlySource });
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const clearingRef = useRef(false);
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const label = (key: string) => t(key).replace(/:\s*$/, '');
  const yesNo = (v: unknown) => (v ? t('common.yes') : t('common.no'));
  const unknown = t('info.unknown');

  const endpointHidden = source.endpointHidden === true && !isMqttOnlySource;
  const address = endpointHidden ? t('info.node_address_hidden', 'Hidden') : getSourceEndpointLabel(source);
  const localNode = nodes.find((n) => n.user?.id === currentNodeId);
  const tally = useMemo(
    () => countNodesByTransport(nodes, settings.maxNodeAgeHours ? transportCutoffSec(settings.maxNodeAgeHours) : undefined),
    [nodes, settings.maxNodeAgeHours],
  );
  const stats = d.localStats as Record<string, number> | null;
  const virtual = useMemo(() => {
    const list = Array.isArray(d.virtualNodeStatus?.sources) ? d.virtualNodeStatus.sources : [];
    return (list.find((s: { sourceId?: string }) => s.sourceId === sourceId) ?? null) as
      | { enabled: boolean; isRunning?: boolean; allowAdminCommands?: boolean; clientCount?: number; clients?: Array<{ id: string; ip: string; connectedAt: number; lastActivity: number }> }
      | null;
  }, [d.virtualNodeStatus, sourceId]);
  // App's getAvailableChannels and InfoTab's Recent Activity, from the same helpers (infoTabCharts).
  const activeChannels = useMemo(
    () => availableChannels(channels, view.messages, (ch) => hasPermission(`channel_${ch}` as ResourceType, 'read')),
    [channels, view.messages, hasPermission],
  );
  const lastMessage = useMemo(() => {
    const last = lastMessageTime(view.messages, view.channelMessages);
    return last ? formatDateTime(last, settings.timeFormat, settings.dateFormat) : t('common.none');
  }, [view.messages, view.channelMessages, settings.timeFormat, settings.dateFormat, t]);

  const groupTitle: Record<InfoGroup, string> = {
    connection: t('workspace.info.group_connection'),
    radio: t('workspace.info.group_radio'),
    node: t('workspace.info.group_node'),
    mesh: t('workspace.info.group_mesh'),
    records: t('workspace.info.group_records'),
    mqtt: t('workspace.info.group_mqtt'),
    server: t('workspace.info.group_server'),
  };
  // Groups follow today's sections' own conditions.
  const shown: Record<InfoGroup, boolean> = {
    connection: true,
    radio: !!deviceConfig,
    node: !isMqttOnlySource,
    mesh: true,
    records: canReadTraceroute,
    mqtt: !!deviceConfig && isAuthenticated,
    server: true,
  };

  // ── Values ─────────────────────────────────────────────────────────────
  const firmware = deviceConfig?.basic ? deviceConfig.basic.firmwareVersion || t('info.not_available') : null;
  const virtualLine = virtual
    ? virtual.enabled
      ? t('workspace.info.virtual_line', { state: t('common.enabled'), count: virtual.clientCount ?? 0 })
      : t('common.disabled')
    : t('info.virtual_node_unavailable');
  const region = deviceConfig ? `${deviceConfig.radio?.region || unknown} · ${deviceConfig.radio?.modemPreset || unknown}` : null;
  const pct = (v: number | undefined) => (typeof v === 'number' ? `${Math.round(v * 10) / 10}%` : t('info.na'));
  const channelUtil = pct(stats?.channelUtilization ?? localNode?.deviceMetrics?.channelUtilization);
  const airtime = pct(stats?.airUtilTx ?? localNode?.deviceMetrics?.airUtilTx);
  const hopLimit = deviceConfig?.radio?.hopLimit !== undefined ? String(deviceConfig.radio.hopLimit) : unknown;
  const hardware = localNode?.user?.hwModel ? getHardwareModelName(localNode.user.hwModel) : unknown;
  const metrics = localNode?.deviceMetrics;
  const battery = metrics
    ? [metrics.batteryLevel !== undefined ? (metrics.batteryLevel > 100 ? t('workspace.info.mains') : `${metrics.batteryLevel}%`) : null, metrics.voltage !== undefined ? `${metrics.voltage.toFixed(2)} V` : null]
        .filter(Boolean)
        .join(' · ') || t('info.na')
    : t('info.na');
  const uptimeSecs = stats?.hostUptimeSeconds ?? stats?.uptimeSeconds;
  const uptime = uptimeSecs !== undefined ? formatUptime(uptimeSecs) : t('info.na');
  const position = localNode?.position ? `${localNode.position.latitude.toFixed(4)}, ${localNode.position.longitude.toFixed(4)}` : t('info.na');
  const longest = d.longestActiveSegment;
  const recordLine = longest ? `${longest.distanceKm.toFixed(1)} km · ${longest.toNodeName}` : t('info.no_active_routes');

  const summary: Record<InfoGroup, Row[]> = {
    connection: [
      ...(isAuthenticated && address ? [[label('info.node_address'), address] as Row] : []),
      [label('info.connection_status_label'), connectionStatus],
      ...(firmware ? [[label('info.firmware_version'), firmware] as Row] : []),
      [t('info.virtual_node'), virtualLine],
    ],
    radio: [
      [`${label('info.region')} · ${label('info.modem_preset')}`, region ?? unknown],
      [t('workspace.dashboard.tile.channelUtil'), channelUtil],
      [t('workspace.dashboard.tile.airtimeTx'), airtime],
      [label('info.hop_limit'), hopLimit],
    ],
    node: [
      [t('nodes.hardware'), hardware],
      [t('nodes.battery'), battery],
      [t('nodes.uptime'), uptime],
      [t('node_details.position'), position],
    ],
    mesh: [
      [label('info.total_nodes'), nodes.length],
      ...(live?.activeNodeCount !== undefined ? [[t('workspace.nodes.online'), live.activeNodeCount] as Row] : []),
      [label('info.total_messages'), d.messageCounts?.total ?? '—'],
      ...(stats?.numPacketsTx !== undefined ? [[label('info.packets_tx'), stats.numPacketsTx.toLocaleString()] as Row] : []),
    ],
    records: [
      [t('info.longest_route'), recordLine],
      [t('info.record_holder'), d.recordHolderSegment ? `${d.recordHolderSegment.distanceKm.toFixed(1)} km · ${d.recordHolderSegment.toNodeName}` : t('info.no_record_holder')],
    ],
    mqtt: [
      [label('info.mqtt_enabled'), yesNo(deviceConfig?.mqtt?.enabled)],
      [label('info.mqtt_server'), deviceConfig?.mqtt?.server || t('info.not_configured')],
      [label('info.mqtt_root_topic'), deviceConfig?.mqtt?.rootTopic || 'msh'],
    ],
    server: [
      [label('info.version'), version],
      ...(d.serverInfo ? [[label('info.timezone'), d.serverInfo.timezone] as Row] : []),
    ],
  };
  const moreLine: Record<InfoGroup, string> = {
    connection: connectionStatus,
    radio: region ?? unknown,
    node: hardware,
    mesh: t('workspace.info.mesh_line', { count: nodes.length }),
    records: recordLine,
    mqtt: deviceConfig?.mqtt?.enabled ? t('common.enabled') : t('common.disabled'),
    server: version,
  };

  if (group && !shown[group]) return <Navigate replace to={`${base}/info`} />;

  // ── A group's page ─────────────────────────────────────────────────────
  if (group) {
    return (
      <div className={`${mc.page} ${styles.phoneScope}`} data-phone={isPhone ? '' : undefined}>
        <ToolHead title={groupTitle[group]} subtitle={source.name} back={{ label: t('nav.info'), to: `${base}/info` }}
          actions={<Link className={mc.link} to={`${base}/info`}>{t('workspace.info.all_groups')}</Link>} phoneActions={null} />
        <Suspense fallback={<p className={mc.note}>{t('common.loading_indicator')}</p>}>
          {groupBody()}
        </Suspense>
        <ConfirmSheet
          open={d.clearTarget !== null}
          title={t('info.clear_record_title')}
          body={d.clearTarget === 'all' || d.clearTarget === null ? t('info.clear_record_confirm') : t('info.clear_record_confirm_transport', { transport: t(`transport.${d.clearTarget}`) })}
          confirmLabel={t('info.clear_record')}
          danger
          submitOnEnter={false}
          onCancel={() => d.setClearTarget(null)}
          onConfirm={async () => {
            // One clear per confirm: a second press before the sheet closes waits for the first.
            if (clearingRef.current) return;
            clearingRef.current = true;
            try {
              await d.confirmClearRecordHolder();
            } finally {
              clearingRef.current = false;
            }
          }}
        />
      </div>
    );
  }

  function card(title: ReactNode, body: ReactNode, key: string) {
    return (
      <section key={key} className={mc.section}>
        {title}
        <div className={mc.card}>{body}</div>
      </section>
    );
  }

  function groupBody() {
    switch (group) {
      case 'connection':
        return (
          <>
            {card(<h2 className={mc.sectionTitle}>{t('info.connection_status')}</h2>, (
              <>
                {isMqttOnlySource && <p className={styles.prose} data-testid="info-no-local-node">{t('info.no_local_node')}</p>}
                <Rows rows={[
                  ...(isAuthenticated && address ? [[label('info.node_address'), address] as Row] : []),
                  ...(deviceConfig?.basic?.nodeId ? [[label('info.node_id'), deviceConfig.basic.nodeId] as Row] : []),
                  ...(deviceConfig?.basic?.nodeName ? [[label('info.node_name'), deviceConfig.basic.nodeName] as Row] : []),
                  ...(firmware ? [[label('info.firmware_version'), firmware] as Row] : []),
                  [label('info.connection_status_label'), connectionStatus],
                  ...(uptimeSecs !== undefined ? [[label('info.uptime'), uptime] as Row] : []),
                  [label('info.uses_tls'), yesNo(deviceInfo?.meshtasticUseTls)],
                  ...(deviceInfo?.deviceMetadata?.rebootCount !== undefined ? [[label('info.reboot_count'), deviceInfo.deviceMetadata.rebootCount] as Row] : []),
                  ...(typeof deviceInfo?.deviceMetadata?.bleAddress === 'string' && deviceInfo.deviceMetadata.bleAddress ? [[label('info.ble_address'), deviceInfo.deviceMetadata.bleAddress] as Row] : []),
                ]} />
              </>
            ), 'conn')}
            {card(<h2 className={mc.sectionTitle}>{t('info.virtual_node')}</h2>, (
              <>
                {d.loadingVirtualNode && <p className={styles.prose}>{t('common.loading_indicator')}</p>}
                {!d.loadingVirtualNode && !virtual && <p className={styles.prose}>{t('info.virtual_node_unavailable')}</p>}
                {!d.loadingVirtualNode && virtual && (
                  <Rows rows={[
                    [label('info.virtual_node_status'), virtual.enabled ? t('common.enabled') : t('common.disabled')],
                    ...(virtual.enabled
                      ? ([
                          [label('info.server_running'), yesNo(virtual.isRunning)],
                          [label('info.virtual_node_admin_commands'), virtual.allowAdminCommands ? t('info.virtual_node_admin_allowed') : t('info.virtual_node_admin_blocked')],
                          [label('info.connected_clients'), virtual.clientCount ?? 0],
                        ] as Row[])
                      : []),
                    ...(virtual.enabled ? (virtual.clients ?? []).map((c) => [
                      `${label('info.client_id')} ${c.id}`,
                      `${label('info.client_ip')} ${c.ip} · ${label('info.client_connected')} ${formatDateTime(new Date(c.connectedAt), settings.timeFormat, settings.dateFormat)} · ${label('info.client_last_activity')} ${formatDateTime(new Date(c.lastActivity), settings.timeFormat, settings.dateFormat)}`,
                    ] as Row) : []),
                  ]} />
                )}
                <p className={styles.prose}>{t('info.virtual_node_description')}</p>
              </>
            ), 'vn')}
          </>
        );
      case 'radio': {
        // Today's RX/TX breakdowns and colours (infoTabCharts).
        const { rxTotal: rx, rxData, txTotal: tx, txData } = radioStatsCharts(stats, t);
        return (
          <>
            {card(<h2 className={mc.sectionTitle}>{t('info.lora_config')}</h2>, (
              <Rows rows={[
                [label('info.device_role'), getDeviceRoleName(localNode?.user?.role)],
                [label('info.region'), deviceConfig?.radio?.region || unknown],
                [label('info.modem_preset'), deviceConfig?.radio?.modemPreset || unknown],
                [label('info.channel_number'), deviceConfig?.radio?.channelNum ?? unknown],
                [label('info.frequency'), deviceConfig?.radio?.frequency || unknown],
                [label('info.hop_limit'), hopLimit],
                [label('info.tx_power'), deviceConfig?.radio?.txPower !== undefined ? `${deviceConfig.radio.txPower} dBm` : unknown],
                [label('info.tx_enabled'), deviceConfig?.radio?.txEnabled !== undefined ? yesNo(deviceConfig.radio.txEnabled) : unknown],
                [label('info.boosted_rx_gain'), deviceConfig?.radio?.sx126xRxBoostedGain !== undefined ? yesNo(deviceConfig.radio.sx126xRxBoostedGain) : unknown],
                [t('workspace.dashboard.tile.channelUtil'), channelUtil],
                [t('workspace.dashboard.tile.airtimeTx'), airtime],
              ]} />
            ), 'lora')}
            {(rx > 0 || tx > 0) && card(<h2 className={mc.sectionTitle}>{t('info.radio_statistics')}</h2>, (
              <div className={styles.chartCard}>
                <DeviceCounterNote text={t('info.device_counters_note')} testId="info-radio-device-note" />
                {rx > 0 && <PacketStatsChart title={t('info.rx_statistics')} data={rxData} total={rx} chartId="rx" bare />}
                {tx > 0 && <PacketStatsChart title={t('info.tx_statistics')} data={txData} total={tx} chartId="tx" bare />}
              </div>
            ), 'radioStats')}
            {currentNodeId && connectionStatus === 'connected' && card(null, (
              <div className={styles.chartCard}>
                <PacketRateGraphs nodeId={currentNodeId} telemetryHours={settings.telemetryVisualizationHours} baseUrl={appBasename} />
              </div>
            ), 'rates')}
          </>
        );
      }
      case 'node':
        return (
          <>
            {card(<h2 className={mc.sectionTitle}>{groupTitle.node}</h2>, (
              <Rows rows={[
                ...(localNode?.user?.longName ? [[label('info.node_name'), localNode.user.longName] as Row] : []),
                ...(currentNodeId ? [[label('info.node_id'), currentNodeId] as Row] : []),
                [t('nodes.hardware'), hardware],
                [label('info.device_role'), getDeviceRoleName(localNode?.user?.role)],
                [t('nodes.battery'), battery],
                [t('nodes.uptime'), uptime],
                [t('node_details.position'), position],
              ]} />
            ), 'node')}
            {deviceConfig && isAuthenticated && card(<h2 className={mc.sectionTitle}>{t('info.secrets')}</h2>, (
              <>
                {d.loadingSecurityKeys && <p className={styles.prose}>{t('common.loading_indicator')}</p>}
                {!d.loadingSecurityKeys && d.securityKeys && (
                  <>
                    <div className={styles.secretRow}>
                      <label className={styles.secretLabel} htmlFor="ws-info-public-key">{label('info.public_key')}</label>
                      <input id="ws-info-public-key" className={styles.secret} type="text" readOnly value={d.securityKeys.publicKey || t('info.not_available')} />
                    </div>
                    <div className={styles.secretRow}>
                      <label className={styles.secretLabel} htmlFor="ws-info-private-key">{label('info.private_key')}</label>
                      <input id="ws-info-private-key" className={styles.secret} type={showPrivateKey ? 'text' : 'password'} readOnly value={d.securityKeys.privateKey || t('info.not_available')} />
                      <button
                        type="button"
                        className={mc.iconButton}
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        aria-label={showPrivateKey ? t('info.hide_private_key', 'Hide') : t('info.show_private_key', 'Show')}
                        title={showPrivateKey ? t('info.hide_private_key', 'Hide') : t('info.show_private_key', 'Show')}
                      >
                        <UiIcon name={showPrivateKey ? 'visibilityOff' : 'visibility'} size={16} />
                      </button>
                    </div>
                  </>
                )}
                {!d.loadingSecurityKeys && !d.securityKeys && <p className={styles.prose}>{t('info.secrets_unavailable')}</p>}
              </>
            ), 'secrets')}
            {currentNodeId && connectionStatus === 'connected' && card(<h2 className={mc.sectionTitle}>{t('info.local_telemetry')}</h2>, (
              <div className={styles.chartCard}>
                <TelemetryGraphs nodeId={currentNodeId} temperatureUnit={settings.temperatureUnit} telemetryHours={settings.telemetryVisualizationHours} baseUrl={appBasename} showTimeRangeSelector />
              </div>
            ), 'telemetry')}
          </>
        );
      case 'mesh':
        return meshGroup();
      case 'records':
        return (
          <>
            {card(<h2 className={mc.sectionTitle}>{t('info.longest_route')}</h2>, (
              <div className={styles.chartCard}>
                {d.loadingSegments ? <p className={mc.note}>{t('common.loading_indicator')}</p> : records(d.longestActiveSegment, t('info.last_seen'), t('info.no_active_routes'))}
              </div>
            ), 'longest')}
            {card(<h2 className={mc.sectionTitle}>{t('info.record_holder')}</h2>, (
              <div className={styles.chartCard}>
                {d.loadingSegments ? <p className={mc.note}>{t('common.loading_indicator')}</p> : records(d.recordHolderSegment, t('info.achieved'), t('info.no_record_holder'), true)}
              </div>
            ), 'holder')}
          </>
        );
      case 'mqtt':
        return card(<h2 className={mc.sectionTitle}>{t('info.mqtt_config')}</h2>, (
          <Rows rows={[
            [label('info.mqtt_enabled'), yesNo(deviceConfig?.mqtt?.enabled)],
            [label('info.mqtt_server'), deviceConfig?.mqtt?.server || t('info.not_configured')],
            [label('info.mqtt_username'), deviceConfig?.mqtt?.username || t('info.not_set')],
            [label('info.mqtt_encryption'), yesNo(deviceConfig?.mqtt?.encryption)],
            [label('info.mqtt_json'), deviceConfig?.mqtt?.json ? t('common.enabled') : t('common.disabled')],
            [label('info.mqtt_tls'), yesNo(deviceConfig?.mqtt?.tls)],
            [label('info.mqtt_root_topic'), deviceConfig?.mqtt?.rootTopic || 'msh'],
          ]} />
        ), 'mqtt');
      case 'server':
        return (
          <>
            {card(<h2 className={mc.sectionTitle}>{t('info.app_info')}</h2>, (
              <Rows rows={[
                [label('info.version'), version],
                ...(d.serverInfo ? [[label('info.timezone'), `${d.serverInfo.timezone}${d.serverInfo.timezoneProvided ? '' : ` ${t('info.timezone_default')}`}`] as Row] : []),
              ]} />
            ), 'app')}
            {stats?.hostUptimeSeconds !== undefined && card(<h2 className={mc.sectionTitle}>{t('info.host_metrics')}</h2>, (
              <>
                <p className={styles.prose}>{t('info.host_metrics_description')}</p>
                <Rows rows={[
                  [label('info.host_uptime'), formatUptime(stats.hostUptimeSeconds)],
                  ...(stats.hostFreememBytes !== undefined ? [[label('info.free_memory'), `${(stats.hostFreememBytes / 1024 / 1024).toFixed(0)} MB`] as Row] : []),
                  ...(stats.hostDiskfree1Bytes !== undefined ? [[label('info.disk_free_root'), `${(stats.hostDiskfree1Bytes / 1024 / 1024 / 1024).toFixed(2)} GB`] as Row] : []),
                  ...(stats.hostDiskfree2Bytes !== undefined ? [[label('info.disk_free_2'), `${(stats.hostDiskfree2Bytes / 1024 / 1024 / 1024).toFixed(2)} GB`] as Row] : []),
                  ...(stats.hostDiskfree3Bytes !== undefined ? [[label('info.disk_free_3'), `${(stats.hostDiskfree3Bytes / 1024 / 1024 / 1024).toFixed(2)} GB`] as Row] : []),
                  ...(stats.hostLoad1 !== undefined ? [[label('info.load_average'), `${(stats.hostLoad1 / 100).toFixed(2)} / ${(stats.hostLoad5 / 100).toFixed(2)} / ${(stats.hostLoad15 / 100).toFixed(2)}`] as Row] : []),
                ]} />
              </>
            ), 'host')}
          </>
        );
      default:
        return null;
    }
  }

  /** Today's "Longest Active" / "Record Holder" card: one record per transport class, or one for an MQTT feed. */
  function records(data: RouteSegmentRecords | null, timeLabel: string, noData: string, withClear = false) {
    if (!data) return <p className={mc.note}>{noData}</p>;
    const common = {
      timeLabel, distanceUnit: settings.distanceUnit, timeFormat: settings.timeFormat, dateFormat: settings.dateFormat,
      showTrophy: withClear, legacyNote: withClear ? t('info.record_legacy_transport_note') : undefined, clearLabel: t('info.clear_record'),
    };
    if (!showTransport) {
      return <RouteSegmentRecord segment={data} {...common} onClear={withClear && canWriteTraceroute ? () => void d.handleClearRecordHolder('all') : undefined} />;
    }
    const entries = ROUTE_SEGMENT_TRANSPORT_ORDER.map((cls) => [cls, data.byTransport[cls]] as const).filter(
      (e): e is [NodeTransportClass, RouteSegmentView] => e[1] !== null,
    );
    if (entries.length === 0) return <p className={mc.note}>{noData}</p>;
    return entries.map(([cls, segment]) => (
      <RouteSegmentRecord key={cls} segment={segment} transportLabel={t(`transport.${cls}`)} {...common}
        onClear={withClear && canWriteTraceroute ? () => void d.handleClearRecordHolder(cls) : undefined} />
    ));
  }

  function meshGroup() {
    // Today's chart data (infoTabCharts), shared with InfoTab.
    const other = t('info.other_devices');
    const hw = hardwareModelChart(nodes, other);
    const dist = d.packetDistribution;
    const deviceData = dist ? packetsByDeviceChart(dist, other) : [];
    const typeData = dist ? packetsByTypeChart(dist) : [];
    const byPort = d.portnumNodeDistribution;
    const portData = byPort ? packetsByDeviceChart(byPort, other) : [];
    const selectedTypeName = dist ? portnumTypeName(dist, d.selectedPortnum) : '';
    const mostRecent = mostRecentlyHeardName(nodes, unknown) ?? t('common.none');
    return (
      <>
        {card(<h2 className={mc.sectionTitle}>{t('info.network_stats')}</h2>, (
          <div className={styles.chartCard}>
            <Rows rows={[
              [label('info.total_nodes'), nodes.length],
              [label('info.total_channels'), channels.length],
              [label('info.total_messages'), d.messageCounts?.total ?? '—'],
              [label('info.active_channels'), activeChannels.length],
              ...(stats?.numPacketsTx !== undefined
                ? ([[label('info.packets_tx'), stats.numPacketsTx.toLocaleString()], [label('info.packets_rx'), stats.numPacketsRx?.toLocaleString() || t('info.na')]] as Row[])
                : []),
            ]} />
            {showTransport && nodes.length > 0 && (
              <TransportBreakdown label={t('info.heard_via')} counts={tally} testId="info-nodes-transport"
                note={tally.rf + tally.udp + tally.mqtt > nodes.length ? t('info.transport_overlap_note') : undefined} />
            )}
            {showTransport && d.messageCounts && d.messageCounts.total > 0 && (
              <TransportBreakdown counts={{ rf: d.messageCounts.byTransport.rf, udp: d.messageCounts.byTransport.udp ?? 0, mqtt: d.messageCounts.byTransport.mqtt }} testId="info-messages-transport" />
            )}
            {stats?.numPacketsTx !== undefined && <DeviceCounterNote text={t('info.device_counters_note')} testId="info-packets-device-note" />}
            {stats?.hostUptimeSeconds !== undefined && stats?.numPacketsTx === undefined && <p className={mc.note}>{t('info.packet_stats_unavailable')}</p>}
          </div>
        ), 'net')}
        {hw && card(<h2 className={mc.sectionTitle}>{t('info.hw_model_distribution')}</h2>, (
          <div className={styles.chartCard}>
            <PacketStatsChart title={t('info.hw_model_breakdown')} data={hw.data} total={hw.total} chartId="hw-model" bare stacked />
          </div>
        ), 'hw')}
        {dist?.enabled && card(<h2 className={mc.sectionTitle}>{t('info.packet_distribution')}</h2>, (
          <div className={styles.chartCard}>
            <p className={mc.note}>{t('info.total_packets', { count: dist.total })}</p>
            {showTransport && (
              <div className={styles.segmented}>
                {TRANSPORT_FILTER_OPTIONS.map((cls) => (
                  <button key={cls} type="button" className={mc.chip} aria-pressed={d.distributionTransport === cls} data-testid={`dist-transport-${cls}`} onClick={() => d.setDistributionTransport(cls)}>
                    {t(`transport.${cls}`)}
                  </button>
                ))}
              </div>
            )}
            <div className={styles.segmented}>
              {(['hour', '24h', 'all'] as const).map((r) => (
                <button key={r} type="button" className={mc.chip} aria-pressed={d.distributionTimeRange === r} onClick={() => d.setDistributionTimeRange(r)}>
                  {t(r === 'hour' ? 'info.last_hour' : r === '24h' ? 'info.last_24_hours' : 'info.all_data')}
                </button>
              ))}
            </div>
            {d.loadingDistribution && <p className={mc.note}>{t('common.loading_indicator')}</p>}
            {!d.loadingDistribution && dist.total > 0 && (
              <>
                <PacketStatsChart title={t('info.packets_by_device')} data={deviceData} total={dist.total} chartId="dist-device" bare stacked />
                <PacketStatsChart title={t('info.packets_by_type')} data={typeData} total={dist.total} chartId="dist-type" bare stacked />
              </>
            )}
            {!d.loadingDistribution && dist.total === 0 && (
              <p className={mc.note}>
                {d.distributionTransport === 'all' ? t('info.no_packet_data') : t('info.no_packets_for_transport', { transport: t(`transport.${d.distributionTransport}`) })}
              </p>
            )}
          </div>
        ), 'dist')}
        {dist?.enabled && dist.byType.length > 0 && card(<h2 className={mc.sectionTitle}>{t('info.packets_by_type_nodes')}</h2>, (
          <div className={styles.chartCard}>
            <select
              className={styles.input}
              aria-label={t('info.packets_by_type_nodes')}
              value={d.selectedPortnum ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                d.setSelectedPortnum(v ? parseInt(v, 10) : null);
                if (!v) d.setPortnumNodeDistribution(null);
              }}
            >
              <option value="">--</option>
              {[...dist.byType].sort((a, b) => b.count - a.count).map((p) => (
                <option key={p.portnum} value={p.portnum}>{portLabel(p.portnum_name)} ({p.count})</option>
              ))}
            </select>
            {d.selectedPortnum !== null && d.loadingPortnumNodes && <p className={mc.note}>{t('common.loading_indicator')}</p>}
            {d.selectedPortnum !== null && !d.loadingPortnumNodes && byPort && (
              byPort.byDevice.length === 0
                ? <p className={mc.note}>{t('info.no_packets_for_type')}</p>
                : <PacketStatsChart title={t('info.nodes_sending_type', { type: selectedTypeName })} data={portData} total={byPort.total} chartId="portnum-nodes" bare stacked />
            )}
            {d.selectedPortnum === null && <p className={mc.note}>{t('info.select_packet_type')}</p>}
          </div>
        ), 'port')}
        {card(null, <div className={styles.chartCard}><NetworkSurveyPanel sourceId={sourceId} /></div>, 'survey')}
        {card(<h2 className={mc.sectionTitle}>{t('info.recent_activity')}</h2>, (
          <Rows rows={[[label('info.last_message'), lastMessage], [label('info.most_active_node'), mostRecent]]} />
        ), 'recent')}
        {showTransport && currentNodeId && connectionStatus === 'connected' && card(null, (
          <div className={styles.chartCard}>
            <TransportSeriesGraphs nodeId={currentNodeId} telemetryHours={settings.telemetryVisualizationHours} baseUrl={appBasename} />
          </div>
        ), 'series')}
      </>
    );
  }

  // ── The summary ────────────────────────────────────────────────────────
  const visible = INFO_GROUPS.filter((g) => shown[g]);
  const head = (g: InfoGroup) => (
    <Link className={styles.groupLink} to={`${base}/info/${g}`} aria-label={t('workspace.info.open_group', { group: groupTitle[g] })}>
      <span>{groupTitle[g]}</span>
      <UiIcon name="chevronRight" size={18} />
    </Link>
  );

  if (isPhone) {
    const cards: InfoGroup[] = visible.filter((g) => g === 'connection' || g === 'radio' || g === 'node');
    const more = visible.filter((g) => !cards.includes(g));
    return (
      <div className={`${mc.page} ${styles.phoneScope}`} data-phone="">
        <ToolHead title={t('nav.info')} back={{ label: t('workspace.home.tools'), to: `${base}/tools` }} />
        <p className={mc.note}><UiIcon name="info" size={18} />{t('workspace.info.phone_hint', { device: source.name })}</p>
        {cards.map((g) => (
          <section key={g} className={mc.section}>
            {head(g)}
            <div className={mc.card}>
              <div className={styles.pairs}>
                {summary[g].map(([l, v]) => (
                  <div key={l} className={styles.pair}>
                    <span className={styles.pairLabel}>{l}</span>
                    <span className={styles.pairValue}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
        {more.length > 0 && (
          <section className={mc.section}>
            <h2 className={mc.sectionTitle}>{t('workspace.info.more')}</h2>
            <div className={mc.card}>
              {more.map((g) => (
                <Link key={g} to={`${base}/info/${g}`} className={styles.moreRow}>
                  <span className={styles.moreLabel}>{groupTitle[g]}</span>
                  <span className={styles.moreValue}>{moreLine[g]}</span>
                  <UiIcon name="chevronRight" size={18} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className={`${mc.page} ${styles.phoneScope}`}>
      <ToolHead title={t('nav.info')} subtitle={t('workspace.info.subtitle', { device: source.name })} back={{ label: t('workspace.home.tools'), to: `${base}/tools` }} />
      {!deviceConfig && !isMqttOnlySource && <p className={mc.note}>{t('info.device_config_unavailable')}</p>}
      <div className={mc.grid}>
        {visible.map((g) => (
          <section key={g} className={mc.section}>
            {head(g)}
            <div className={mc.card}>
              {g === 'connection' && isMqttOnlySource && <p className={styles.prose} data-testid="info-no-local-node">{t('info.no_local_node')}</p>}
              <Rows rows={summary[g]} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
