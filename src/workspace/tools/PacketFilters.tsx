/**
 * Today's single-source packet filters (PacketMonitorPanel): search, time
 * window, type, encrypted, transport, from node, last hop, Hide Own Packets and
 * Clear Filters, on `usePacketMonitor`. Shared by the pop-out window (18-01,
 * 18-02) and the device monitor (o1, q2; Task 8.5).
 */
import { useTranslation } from 'react-i18next';
import PacketSearchInput from '../../components/packets/PacketSearchInput';
import TimeWindowSelect from '../../components/packets/TimeWindowSelect';
import SearchableSelect from '../../components/common/SearchableSelect';
import { PORTNUM_FILTER_OPTIONS, type usePacketMonitor } from '../../components/usePacketMonitor';
import styles from './PacketFilters.module.css';

type Monitor = ReturnType<typeof usePacketMonitor>;

/** Today's search box: decoded content and metadata JSON. */
export function PacketSearch({ m }: { m: Monitor }) {
  const { t } = useTranslation();
  return (
    <PacketSearchInput
      value={m.filters.search}
      onCommit={(next) => m.setFilters((f) => (f.search === next ? f : { ...f, search: next }))}
      placeholder={t('packet_monitor.filter.search_placeholder', 'Search content / JSON…')}
      title={t('packet_monitor.filter.search_tooltip', 'Filters packets whose decoded content or metadata JSON contains this text (case-insensitive). Use this instead of the browser find, which cannot see off-screen rows.')}
    />
  );
}

/** Today's filters: search, time window, type, encrypted, transport, from node, last hop, Hide Own Packets, Clear Filters. */
export function PacketFilters({ m, withSearch = true }: { m: Monitor; withSearch?: boolean }) {
  const { t } = useTranslation();
  const { filters, setFilters } = m;
  const moreMatches = (n: number) => t('packet_monitor.filter.more_matches', { count: n, defaultValue: '…and {{count}} more — keep typing to narrow' });
  return (
    <div className={styles.filters}>
      {withSearch && <PacketSearch m={m} />}
      <TimeWindowSelect value={m.timeWindow} onChange={m.setTimeWindow} />
      <select
        value={filters.portnum ?? ''}
        onChange={(e) => setFilters({ ...filters, portnum: e.target.value ? parseInt(e.target.value, 10) : undefined })}
      >
        <option value="">{t('packet_monitor.filter.all_types')}</option>
        {PORTNUM_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select
        value={filters.encrypted !== undefined ? String(filters.encrypted) : ''}
        onChange={(e) => setFilters({ ...filters, encrypted: e.target.value ? e.target.value === 'true' : undefined })}
      >
        <option value="">{t('packet_monitor.filter.all_packets')}</option>
        <option value="true">{t('packet_monitor.filter.encrypted_only')}</option>
        <option value="false">{t('packet_monitor.filter.decoded_only')}</option>
      </select>
      <select
        value={filters.transport_mechanism ?? ''}
        title={t('packet_monitor.filter.transport_tooltip')}
        onChange={(e) => setFilters({ ...filters, transport_mechanism: e.target.value !== '' ? parseInt(e.target.value, 10) : undefined })}
      >
        <option value="">{t('packet_monitor.filter.all_transports')}</option>
        <option value="1">{t('packet_monitor.filter.transport_lora')}</option>
        <option value="6">{t('packet_monitor.filter.transport_udp')}</option>
        <option value="5">{t('packet_monitor.filter.transport_mqtt')}</option>
        <option value="7">{t('packet_monitor.filter.transport_api')}</option>
        <option value="0">{t('packet_monitor.filter.transport_internal')}</option>
      </select>
      <SearchableSelect
        value={filters.from_node !== undefined ? String(filters.from_node) : ''}
        onChange={(val) => setFilters({ ...filters, from_node: val ? parseInt(val, 10) : undefined })}
        options={m.fromNodeOptions}
        emptyLabel={t('packet_monitor.filter.all_nodes')}
        placeholder={t('packet_monitor.filter.search_nodes', 'Search nodes…')}
        title={t('packet_monitor.filter.from_node_tooltip')}
        ariaLabel={t('packet_monitor.filter.from_node_tooltip')}
        noMatchesText={t('packet_monitor.filter.no_matches', 'No matches')}
        moreMatchesText={moreMatches}
      />
      <SearchableSelect
        value={filters.relay_node !== undefined ? String(filters.relay_node) : ''}
        onChange={(val) => setFilters({ ...filters, relay_node: val === '' ? undefined : val === 'unknown' ? 'unknown' : parseInt(val, 10) })}
        options={m.relayFilterOptions}
        emptyLabel={t('packet_monitor.filter.all_last_hops')}
        placeholder={t('packet_monitor.filter.search_last_hops', 'Search last hops…')}
        title={t('packet_monitor.filter.last_hop_tooltip')}
        ariaLabel={t('packet_monitor.filter.last_hop_tooltip')}
        noMatchesText={t('packet_monitor.filter.no_matches', 'No matches')}
        moreMatchesText={moreMatches}
      />
      <label className={styles.check} title={t('packet_monitor.filter.hide_own_tooltip')}>
        <input type="checkbox" checked={m.hideOwnPackets} onChange={(e) => m.setHideOwnPackets(e.target.checked)} />
        <span>{t('packet_monitor.filter.hide_own')}</span>
      </label>
      <button type="button" className={styles.link} onClick={() => { setFilters({}); m.setTimeWindow('all'); }}>
        {t('packet_monitor.filter.clear')}
      </button>
    </div>
  );
}

/** The filters in a sheet body (phone). */
export function PacketFiltersSheetBody({ m }: { m: Monitor }) {
  return <div className={styles.sheetBody}><PacketFilters m={m} /></div>;
}
