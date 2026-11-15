/**
 * A packet stream as the Workspace draws it (boards 7-05, 7-08, 18-01, 18-02),
 * shared by Overview › Packets and the pop-out window: a virtualised table on
 * desktop (today's columns, the device tag first when the stream spans
 * devices) and two-line rows on the phone. Rows load more as the reader nears
 * the end (`useInfiniteVirtualRows`, as today).
 */
import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useInfiniteVirtualRows } from '../../hooks/useInfiniteVirtualRows';
import { useSettings } from '../../contexts/SettingsContext';
import type { PacketLog } from '../../types/packet';
import { formatPacketDateColumn, getTransportMechanismName, toMs } from '../../utils/packetFormat';
import DeviceTag from '../patterns/DeviceTag';
import { packetHops, packetKey, packetSlot, packetTypeFamily } from './packetRows';
import styles from './PacketStream.module.css';

/** A table row's height before it is measured. */
const ROW_PX = 44;
/** A phone row: two lines of text, at least the 52 px phone row. */
const PHONE_ROW_PX = 68;

const clock = (ts: number, timeFormat: string) =>
  new Date(toMs(ts)).toLocaleTimeString('en-US', { hour12: timeFormat === '12', hour: '2-digit', minute: '2-digit' });

export interface PacketStreamProps {
  packets: PacketLog[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMore(): void | Promise<void>;
  selectedKey: string | null;
  onSelect(packet: PacketLog): void;
  /** The stream spans devices: a device tag on each row. */
  withSource?: boolean;
  /** MeshCore devices in the stream: their rows' types are payload types, drawn muted. */
  meshcoreSourceIds?: ReadonlySet<string>;
}

/** A packet's type badge, coloured by its Meshtastic type family. */
export function TypeBadge({ packet: p, meshcore = false }: { packet: PacketLog; meshcore?: boolean }) {
  return (
    <span className={styles.type} data-family={packetTypeFamily(p, meshcore)}>{p.portnum_name || p.portnum}</span>
  );
}

/** Today's Dir cell: the spoof warning in place of RX/TX, with today's title. */
function Dir({ packet: p }: { packet: PacketLog }) {
  const { t } = useTranslation();
  if (!p.spoof_suspected) return <>{p.direction === 'tx' ? 'TX' : 'RX'}</>;
  const label = t('packet_monitor.spoof_suspected', 'Possible impersonation: claims your node id but arrived over RF');
  return (
    <span className={styles.spoof} title={label} role="img" aria-label={label}>
      <UiIcon name="alert" size={15} />
    </span>
  );
}

function useRowText() {
  const { t } = useTranslation();
  const na = t('common.na');
  return {
    from: (p: PacketLog) => p.from_node_longName || p.from_node_id || String(p.from_node ?? na),
    to: (p: PacketLog) =>
      p.to_node_id === '!ffffffff' ? t('packet_monitor.broadcast') : p.to_node_longName || p.to_node_id || String(p.to_node ?? na),
    content: (p: PacketLog) => (p.encrypted ? t('packet_monitor.encrypted') : p.payload_preview || t('packet_monitor.no_preview')),
    na,
  };
}

const activate = (run: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    run();
  }
};

/** Desktop: one row per packet, the four columns right of Content behind `moreCue` and the sideways scroll. */
export function PacketTable({
  packets, hasMore, loadingMore, loadMore, selectedKey, onSelect, withSource = false, moreCue = false, meshcoreSourceIds,
}: PacketStreamProps & { moreCue?: boolean }) {
  const { t } = useTranslation();
  const { timeFormat, dateFormat } = useSettings();
  const text = useRowText();
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = useInfiniteVirtualRows({
    count: packets.length, hasMore, loadingMore, loadMore, estimateSize: ROW_PX, getScrollElement: () => scrollRef.current,
  });
  const items = rows.getVirtualItems();
  const top = items[0]?.start ?? 0;
  const bottom = items.length ? rows.getTotalSize() - items[items.length - 1].end : 0;
  const more = [t('packet_monitor.column.date'), t('packet_monitor.column.slot'), t('packet_monitor.column.rssi'), t('packet_monitor.column.size')];
  const columns = 14 + (withSource ? 1 : 0);

  return (
    <div className={styles.tableWrap}>
      <div className={styles.scroll} ref={scrollRef} data-testid="packet-table-scroll">
        <table className={styles.table} data-more={moreCue ? 'behind' : undefined}>
          <thead>
            <tr>
              <th scope="col" className={styles.colNum}>#</th>
              {withSource && <th scope="col" className={styles.colSource}>{t('unified.packets.column_source')}</th>}
              <th scope="col" className={styles.colDir}>{t('packet_monitor.column.dir')}</th>
              <th scope="col" className={styles.colVia}>{t('packet_monitor.column.via')}</th>
              <th scope="col" className={styles.colTime}>{t('packet_monitor.column.time')}</th>
              <th scope="col">{t('packet_monitor.column.from')}</th>
              <th scope="col">{t('packet_monitor.column.to')}</th>
              <th scope="col" className={styles.colType}>{t('packet_monitor.column.type')}</th>
              <th scope="col" className={styles.colNarrow}>{t('packet_monitor.column.snr')}</th>
              <th scope="col" className={styles.colNarrow}>{t('packet_monitor.column.hops')}</th>
              <th scope="col">{t('packet_monitor.column.content')}</th>
              {more.map((label) => <th key={label} scope="col" className={styles.colMore}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {top > 0 && <tr aria-hidden="true"><td colSpan={columns} style={{ height: top }} /></tr>}
            {items.map(({ index }) => {
              const p = packets[index];
              if (!p) {
                return (
                  <tr key="loader" className={styles.loader} onClick={() => void loadMore()}>
                    <td colSpan={columns}>{loadingMore ? t('packet_monitor.loading_more') : t('packet_monitor.load_more_click', 'Click to load more packets...')}</td>
                  </tr>
                );
              }
              const hops = packetHops(p);
              const select = () => onSelect(p);
              return (
                <tr
                  key={packetKey(p)}
                  className={styles.row}
                  data-selected={selectedKey === packetKey(p) || undefined}
                  tabIndex={0}
                  onClick={select}
                  onKeyDown={activate(select)}
                >
                  <td className={styles.num}>{index + 1}</td>
                  {withSource && <td>{p.sourceId && <DeviceTag sourceId={p.sourceId} />}</td>}
                  <td><Dir packet={p} /></td>
                  <td title={getTransportMechanismName(p.transport_mechanism).full}>{getTransportMechanismName(p.transport_mechanism).short}</td>
                  <td className={styles.mono}>{clock(p.timestamp, timeFormat)}</td>
                  <td className={styles.strong} title={text.from(p)}>{text.from(p)}</td>
                  <td title={text.to(p)}>{text.to(p)}</td>
                  <td><TypeBadge packet={p} meshcore={!!p.sourceId && !!meshcoreSourceIds?.has(p.sourceId)} /></td>
                  <td>{p.snr != null ? p.snr.toFixed(1) : text.na}</td>
                  <td>{hops !== null ? `${hops}/${p.hop_start}` : text.na}</td>
                  <td title={text.content(p)}>{text.content(p)}</td>
                  <td>{formatPacketDateColumn(p.timestamp, dateFormat, t('packet_monitor.today', 'Today'))}</td>
                  <td>{packetSlot(p, text.na)}</td>
                  <td>{p.rssi != null ? p.rssi.toFixed(0) : text.na}</td>
                  <td>{p.payload_size ?? text.na}</td>
                </tr>
              );
            })}
            {bottom > 0 && <tr aria-hidden="true"><td colSpan={columns} style={{ height: bottom }} /></tr>}
          </tbody>
        </table>
      </div>
      {moreCue && (
        <button
          type="button"
          className={styles.cue}
          onClick={() => {
            const el = scrollRef.current;
            if (el) el.scrollLeft = el.scrollWidth;
          }}
        >
          {t('workspace.packets.more_columns', { count: more.length, names: more.join(', ') })}
          <UiIcon name="chevronRight" size={16} />
        </button>
      )}
    </div>
  );
}

/** Phone: two lines per packet — tag, type and sender; direction, transport, destination, hops, SNR — and the time. */
export function PacketList({ packets, hasMore, loadingMore, loadMore, selectedKey, onSelect, withSource = false, meshcoreSourceIds }: PacketStreamProps) {
  const { t } = useTranslation();
  const { timeFormat } = useSettings();
  const text = useRowText();
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = useInfiniteVirtualRows({
    count: packets.length, hasMore, loadingMore, loadMore, estimateSize: PHONE_ROW_PX, getScrollElement: () => scrollRef.current,
  });
  const items = rows.getVirtualItems();
  const top = items[0]?.start ?? 0;
  const bottom = items.length ? rows.getTotalSize() - items[items.length - 1].end : 0;

  return (
    <div className={styles.list} ref={scrollRef}>
      {top > 0 && <div aria-hidden="true" style={{ height: top }} />}
      {items.map(({ index }) => {
        const p = packets[index];
        if (!p) {
          return (
            <button key="loader" type="button" className={styles.listLoader} onClick={() => void loadMore()}>
              {loadingMore ? t('packet_monitor.loading_more') : t('packet_monitor.load_more_click', 'Click to load more packets...')}
            </button>
          );
        }
        const hops = packetHops(p);
        return (
          <button
            key={packetKey(p)}
            type="button"
            className={styles.listRow}
            data-testid="packet-row"
            data-selected={selectedKey === packetKey(p) || undefined}
            onClick={() => onSelect(p)}
          >
            <span className={styles.line1}>
              {withSource && p.sourceId && <DeviceTag sourceId={p.sourceId} />}
              <TypeBadge packet={p} meshcore={!!p.sourceId && !!meshcoreSourceIds?.has(p.sourceId)} />
              <span className={styles.from}>{text.from(p)}</span>
            </span>
            <span className={styles.line2}>
              <Dir packet={p} /> {getTransportMechanismName(p.transport_mechanism).short} ·{' '}
              <UiIcon name="forward" size={14} />
              {text.to(p)}
              {hops !== null && ` · ${t('unified.messages.hop_count', { count: hops })}`}
              {p.snr != null && ` · ${p.snr} dB`}
            </span>
            <span className={styles.time}>{clock(p.timestamp, timeFormat)}</span>
          </button>
        );
      })}
      {bottom > 0 && <div aria-hidden="true" style={{ height: bottom }} />}
    </div>
  );
}
