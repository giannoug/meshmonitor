/**
 * Raw packet (boards 7-05, 7-08, 18-01, 18-02; s7n2): one packet's content,
 * the columns the table keeps right of Content (Date, Slot, RSSI, Size), the
 * time to the millisecond, hops with the relay byte, and today's full field
 * list ("Packet Details (Full JSON)"). A side panel on desktop, a sheet on the
 * phone.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import RelayNodeModal from '../../components/RelayNodeModal';
import { relayModalNodes, type DirectNeighborStats } from '../../components/usePacketMonitor';
import { useSettings } from '../../contexts/SettingsContext';
import { SourceProvider } from '../../contexts/SourceContext';
import { useNodes } from '../../hooks/useServerData';
import apiService from '../../services/api';
import type { PacketLog } from '../../types/packet';
import { formatPacketDateColumn, formatPacketTimestamp, getTransportMechanismName, toMs } from '../../utils/packetFormat';
import DeviceTag from '../patterns/DeviceTag';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import { packetHops, packetSlot } from './packetRows';
import { TypeBadge } from './PacketStream';
import styles from './PacketDetailPanel.module.css';

/** The packet with its metadata JSON expanded, as today's details modal lists it. */
function fullJson(p: PacketLog): string {
  let metadata: unknown = p.metadata;
  try {
    if (p.metadata) metadata = JSON.parse(p.metadata);
  } catch {
    // Not JSON: keep the text.
  }
  return JSON.stringify({ ...p, metadata }, null, 2);
}

/**
 * Today's relay estimate (RelayNodeModal) for one packet, with today's data: the device's nodes and
 * the direct-neighbour stats fetched when it opens (PacketMonitorPanel's handleRelayClick).
 */
function RelayModal({ packet, onClose }: { packet: PacketLog; onClose(): void }) {
  const { nodes } = useNodes();
  const [stats, setStats] = useState<DirectNeighborStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiService
      // The packet's own device: pooled stats would rank its relays by another device's neighbours.
      .getDirectNeighborStats(24, packet.sourceId)
      .then((s) => !cancelled && setStats(s))
      .catch((error) => {
        console.error('Failed to fetch direct neighbor stats:', error);
        if (!cancelled) setStats({});
      });
    return () => { cancelled = true; };
  }, [packet.sourceId]);
  if (!stats) return null;
  return (
    <RelayNodeModal
      isOpen
      onClose={onClose}
      relayNode={packet.relay_node ?? 0}
      rxTime={new Date(toMs(packet.timestamp))}
      nodes={relayModalNodes(nodes, stats)}
      messageRssi={packet.rssi ?? undefined}
      // The panel cannot open a node page (the pop-out window has none), as today's pop-out.
      onNodeClick={onClose}
    />
  );
}

export default function PacketDetailPanel({ packet: p, onClose, meshcore = false }: { packet: PacketLog; onClose(): void; meshcore?: boolean }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { timeFormat, dateFormat } = useSettings();
  const titleId = useId();
  const na = t('common.na');
  const title = t('workspace.packets.raw_packet', { id: p.id });
  const hops = packetHops(p);
  const [relayOpen, setRelayOpen] = useState(false);
  // Today's relay link: the relay byte, or an estimate when the byte is missing (a relayed packet only).
  const relayByte = p.relay_node ? `0x${p.relay_node.toString(16).padStart(2, '0').toUpperCase()}` : null;
  const relay = hops !== null && hops > 0 && (
    <>
      {' · '}
      <button
        type="button"
        className={styles.relay}
        title={relayByte ? t('packet_monitor.click_for_relay') : t('packet_monitor.estimated_relay')}
        onClick={() => setRelayOpen(true)}
      >
        via {relayByte ?? '?'}
      </button>
    </>
  );
  // Today's per-packet markers, in today's words.
  const markers: Array<{ key: string; icon: Parameters<typeof UiIcon>[0]['name']; text: string; warn?: boolean }> = [
    ...(p.spoof_suspected
      ? [{ key: 'spoof', icon: 'alert' as const, text: t('packet_monitor.spoof_suspected', 'Possible impersonation: claims your node id but arrived over RF'), warn: true }]
      : []),
    ...(p.xeddsa_signed
      ? [{ key: 'signed', icon: 'securityCheck' as const, text: t('packet_monitor.xeddsa_signed', 'Signed packet: XEdDSA signature verified by the device (firmware 2.8+)') }]
      : []),
    ...(!p.encrypted && p.decrypted_by === 'server' ? [{ key: 'server', icon: 'key' as const, text: t('packet_monitor.decrypted_by_server') }] : []),
    ...(!p.encrypted && p.decrypted_by === 'node' ? [{ key: 'node', icon: 'key' as const, text: t('packet_monitor.decrypted_by_node') }] : []),
  ];
  const from = p.from_node_longName || p.from_node_id || String(p.from_node);
  const to = p.to_node_id === '!ffffffff' ? t('packet_monitor.broadcast') : p.to_node_longName || p.to_node_id || na;

  const fields: Array<[string, ReactNode]> = [
    ...(p.sourceId
      ? [[t('unified.packets.column_source'), <span key="s" className={styles.source}><DeviceTag sourceId={p.sourceId} />{p.sourceName}</span>] as [string, ReactNode]]
      : []),
    [t('packet_monitor.column.dir'), p.direction === 'tx' ? 'TX' : 'RX'],
    [t('packet_monitor.column.via'), getTransportMechanismName(p.transport_mechanism).short],
    [t('packet_monitor.column.date'), formatPacketDateColumn(p.timestamp, dateFormat, t('packet_monitor.today', 'Today'))],
    [t('packet_monitor.column.time'), formatPacketTimestamp(p.timestamp, timeFormat)],
    [t('packet_monitor.column.slot'), packetSlot(p, na)],
    [t('packet_monitor.column.snr'), p.snr != null ? `${p.snr} dB` : na],
    [t('packet_monitor.column.rssi'), p.rssi != null ? `${p.rssi} dBm` : na],
    [t('packet_monitor.column.hops'), <>{hops !== null ? `${hops}/${p.hop_start}` : na}{relay}</>],
    [t('packet_monitor.column.size'), p.payload_size != null ? `${p.payload_size} B` : na],
    [t('packet_monitor.column.from'), from],
    [t('packet_monitor.column.to'), to],
  ];

  const body = (
    <>
      <p className={styles.quote}>
        {p.encrypted ? t('packet_monitor.encrypted') : `“${p.payload_preview || t('packet_monitor.no_preview')}”`}
      </p>
      {markers.length > 0 && (
        <ul className={styles.markers}>
          {markers.map((m) => (
            <li key={m.key} data-warn={m.warn || undefined}>
              <UiIcon name={m.icon} size={16} />
              {m.text}
            </li>
          ))}
        </ul>
      )}
      <dl className={styles.fields}>
        {fields.map(([label, value]) => (
          <div key={label} className={styles.field}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <details className={styles.json}>
        <summary>{t('packet_monitor.details_title')}</summary>
        <pre>{fullJson(p)}</pre>
      </details>
      {relayOpen &&
        (p.sourceId ? (
          <SourceProvider sourceId={p.sourceId} sourceName={p.sourceName ?? null}>
            <RelayModal packet={p} onClose={() => setRelayOpen(false)} />
          </SourceProvider>
        ) : (
          <RelayModal packet={p} onClose={() => setRelayOpen(false)} />
        ))}
    </>
  );

  if (isPhone) {
    return (
      // Escape reaches every open dialog; while the relay estimate is open over this sheet, only it closes (Ruling CR).
      <Sheet open onClose={() => (relayOpen ? setRelayOpen(false) : onClose())} title={title}>
        <div className={styles.sheetBody}>
          <TypeBadge packet={p} meshcore={meshcore} />
          {body}
        </div>
      </Sheet>
    );
  }

  return (
    <aside className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.head}>
        <TypeBadge packet={p} meshcore={meshcore} />
        <h2 id={titleId} className={styles.title}>{title}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
          <UiIcon name="close" size={18} />
        </button>
      </div>
      {body}
    </aside>
  );
}
