/**
 * Raw packet (boards 7-05, 7-08, 18-01, 18-02; s7n2): one packet's content,
 * the columns the table keeps right of Content (Date, Slot, RSSI, Size), the
 * time to the millisecond, hops with the relay byte, and today's full field
 * list ("Packet Details (Full JSON)"). A side panel on desktop, a sheet on the
 * phone.
 */
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useSettings } from '../../contexts/SettingsContext';
import type { PacketLog } from '../../types/packet';
import { formatPacketDateColumn, formatPacketTimestamp, getTransportMechanismName } from '../../utils/packetFormat';
import DeviceTag from '../patterns/DeviceTag';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import { packetHops, packetSlot } from './packetRows';
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

export default function PacketDetailPanel({ packet: p, onClose }: { packet: PacketLog; onClose(): void }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { timeFormat, dateFormat } = useSettings();
  const titleId = useId();
  const na = t('common.na');
  const title = t('workspace.packets.raw_packet', { id: p.id });
  const hops = packetHops(p);
  const relay = p.relay_node ? ` · via 0x${p.relay_node.toString(16).padStart(2, '0').toUpperCase()}` : '';
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
    [t('packet_monitor.column.hops'), `${hops !== null ? `${hops}/${p.hop_start}` : na}${relay}`],
    [t('packet_monitor.column.size'), p.payload_size != null ? `${p.payload_size} B` : na],
    [t('packet_monitor.column.from'), from],
    [t('packet_monitor.column.to'), to],
  ];

  const body = (
    <>
      <p className={styles.quote}>
        {p.encrypted ? t('packet_monitor.encrypted') : `“${p.payload_preview || t('packet_monitor.no_preview')}”`}
      </p>
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
    </>
  );

  if (isPhone) {
    return (
      <Sheet open onClose={onClose} title={title}>
        <div className={styles.sheetBody}>
          <span className={styles.type}>{p.portnum_name || p.portnum}</span>
          {body}
        </div>
      </Sheet>
    );
  }

  return (
    <aside className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.head}>
        <span className={styles.type}>{p.portnum_name || p.portnum}</span>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
          <UiIcon name="close" size={18} />
        </button>
      </div>
      {body}
    </aside>
  );
}
