/**
 * MeshCore Nodes (boards 8-11 desktop, 8-28 phone): `/source/:id/nodes` on a
 * MeshCore device. Today's MeshCoreNodesView list on the Workspace's Nodes
 * layout: the same rows (nodes and contacts merged, today's age windows, the
 * ignore list, the shared advanced filters and search), today's sort, group by
 * role, export, favourite star, Import contact and Discover. The map half of
 * today's view is the device Map (`map`).
 *
 * Opening it and re-rendering send nothing on the mesh. Discover sends one
 * zero-hop request per press (DiscoverMenu); Import contact writes the radio
 * over its link and sends nothing on the mesh; the star is today's favourite.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import type { NodeFilterFeature } from '../../components/AdvancedNodeFilterPopup/AdvancedNodeFilterPopup';
import NodeQuickAgeFilter from '../../components/NodeQuickAgeFilter';
import { NodeSortControls } from '../../components/nodes/NodeSortControls';
import { meshcoreRoleLabel, meshcoreRoleLabelKey } from '../../components/MeshCore/meshcoreRole';
import { useToast } from '../../components/ToastContainer';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useHiddenMeshCoreKeys, useMeshCoreIgnoredNodes } from '../../hooks/useMeshCoreFilters';
import { useNodeDisplaySettings } from '../../hooks/useNodeDisplaySettings';
import { useNodeQuickAgeFilter } from '../../hooks/useNodeQuickAgeFilter';
import { useNodeRoleGrouping } from '../../hooks/useNodeRoleGrouping';
import { usePersistedListSort } from '../../hooks/usePersistedListSort';
import { usePersistedNodeFilters } from '../../hooks/usePersistedNodeFilters';
import type { SecurityFilter, SortField } from '../../types/ui';
import { formatRelativeTime } from '../../utils/datetime';
import { DEFAULT_NODE_FILTERS, passesNodeFilters } from '../../utils/nodeAdvancedFilter';
import { exportNodeList } from '../../utils/nodeExport';
import { readGroupNodesByRole, writeGroupNodesByRole } from '../../utils/nodeGrouping';
import {
  filterMeshCoreRowsByAge,
  mergeNodesAndContacts,
  meshcoreNodeSortKey,
  MESHCORE_NODE_EXPORT_COLUMNS,
  MESHCORE_NODE_SORT_FIELDS,
  MESHCORE_ROLE_FILTER_OPTIONS,
  toMeshCoreFilterSubject,
  type MeshCoreNodeRow,
} from '../../utils/meshcoreNodeRows';
import { orderFavoritesFirst, sortByKey } from '../../utils/nodeSort';
import { NODE_TYPE_CATEGORY_META } from '../../utils/nodeTypeCategory';
import { isHeardRecently } from '../chat/channelLabel';
import { tileTitle } from '../dashboard/healthTiles';
import NodeFiltersSheet from '../nodes/NodeFiltersSheet';
import nodesStyles from '../nodes/NodesTable.module.css';
import ConfirmSheet from '../patterns/ConfirmSheet';
import RowMenu from '../patterns/RowMenu';
import SendsLine from '../patterns/SendsLine';
import StateView from '../patterns/StateView';
import TwoLineRow from '../patterns/TwoLineRow';
import { useIsPhone } from '../shell/useIsPhone';
import DiscoverMenu from './DiscoverMenu';
import { isSweeping, runSweep, useSweep } from './settings/sweepStore';
import { shortMark } from './meshcoreLabels';
import { useMeshCoreRuntime } from './runtime';
import styles from './MeshCoreNodesTable.module.css';

/** Today's filter sections for MeshCore (MeshCoreNodesView). */
const FEATURES: Partial<Record<NodeFilterFeature, boolean>> = {
  security: true, telemetry: false, environment: false, pki: false, remoteAdmin: false,
  mqtt: false, favoriteLocked: false, hiddenFromMap: false, powerSource: false, channels: false,
  position: true, unknown: true, ignored: true, favorites: true, hops: true, roles: true,
};

const SORT_LABELS: Record<string, [string, string]> = {
  lastHeard: ['nodes.sort_updated', 'Sort: Updated'],
  longName: ['nodes.sort_name', 'Sort: Name'],
  id: ['nodes.sort_public_key', 'Sort: Public key'],
  snr: ['nodes.sort_signal', 'Sort: Signal'],
  battery: ['nodes.sort_charge', 'Sort: Charge'],
  uptime: ['nodes.sort_uptime', 'Sort: Uptime'],
  hops: ['nodes.sort_hops', 'Sort: Hops'],
};

const DEVICE_COLOURS = 8;
const avatarStyle = (key: string) => ({ background: `var(--device-${((parseInt(key.slice(0, 8), 16) || 0) % DEVICE_COLOURS) + 1})` });
const dash = '—';

export interface MeshCoreNodesTableProps {
  /**
   * A region feed's Nodes tab (Task 7.5, s8n5): the 8-11 table read-only, inside
   * the feed's page: no header, no Discover, Import contact or star, no node
   * page links, and only the advert columns (name, role, last heard, position, key).
   */
  feed?: boolean;
}

const TILE_SCOPES = ['online', 'direct', 'favorites'] as const;
type TileScope = (typeof TILE_SCOPES)[number];
const TILE_TITLES = { online: 'nodesOnline', direct: 'direct', favorites: 'favorites' } as const;

/** The Dashboard tiles' predicates (healthTiles): heard lately, no hops, a favourite. */
function inTileScope(r: MeshCoreNodeRow, scope: TileScope): boolean {
  if (scope === 'online') return isHeardRecently(r.lastHeard ? r.lastHeard / 1000 : undefined);
  if (scope === 'direct') return r.pathLen === 0;
  return !!r.isFavorite;
}

export default function MeshCoreNodesTable({ feed = false }: MeshCoreNodesTableProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const { timeFormat, dateFormat } = useSettings();
  const { sourceId, deviceName, meshCore, receiveOnly } = useMeshCoreRuntime();
  const { nodes, contacts, status, actions, hasLoadedOnce } = meshCore;
  const display = useNodeDisplaySettings(sourceId);
  const [quickAgeHours] = useNodeQuickAgeFilter();
  const hidden = useHiddenMeshCoreKeys(useMeshCoreIgnoredNodes(sourceId).data);
  const { field, direction, setField, toggleDirection } = usePersistedListSort<SortField>('meshcoreNodesSort', MESHCORE_NODE_SORT_FIELDS, {
    field: 'lastHeard',
    direction: 'desc',
  });
  const [nodeFilters, setNodeFilters] = usePersistedNodeFilters('meshcoreNodeFilters');
  const [securityFilter, setSecurityFilter] = useState<SecurityFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [groupByRole, setGroupByRole] = useState(() => readGroupNodesByRole());
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importHex, setImportHex] = useState('');
  const [importing, setImporting] = useState(false);
  const [newKeys, setNewKeys] = useState<Set<string>>(() => new Set());
  const [favBusy, setFavBusy] = useState<string | null>(null);
  const [params] = useSearchParams();
  // A Dashboard health tile opens the list on its scope (`?show=`, Task 8.1), shown as a chip while on.
  const [tileScope, setTileScope] = useState<TileScope | null>(() => (feed ? null : TILE_SCOPES.find((x) => x === params.get('show')) ?? null));

  const merged = useMemo(() => mergeNodesAndContacts(nodes, contacts, hidden), [nodes, contacts, hidden]);
  const aged = useMemo(
    () => filterMeshCoreRowsByAge(merged, {
      companionAgeHours: quickAgeHours ?? display.maxNodeAgeHours,
      infraAgeHours: quickAgeHours ?? display.maxInfraNodeAgeHours,
      hideIncompleteNodes: display.hideIncompleteNodes,
    }),
    [merged, quickAgeHours, display.maxNodeAgeHours, display.maxInfraNodeAgeHours, display.hideIncompleteNodes],
  );
  const filtered = useMemo(
    () =>
      aged.filter(
        (r) =>
          passesNodeFilters(toMeshCoreFilterSubject(r), nodeFilters, { securityFilter }) &&
          (!favouritesOnly || r.isFavorite) &&
          (!tileScope || inTileScope(r, tileScope)),
      ),
    [aged, nodeFilters, securityFilter, favouritesOnly, tileScope],
  );
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? filtered.filter((r) => r.name.toLowerCase().includes(q) || r.publicKey.toLowerCase().includes(q)) : filtered;
  }, [filtered, search]);
  const orderRows = useCallback(
    (xs: MeshCoreNodeRow[]) => orderFavoritesFirst(xs, (part) => sortByKey(part, (r) => meshcoreNodeSortKey(r, field), direction)),
    [field, direction],
  );
  const flat = useMemo(() => orderRows(searched), [orderRows, searched]);
  const { items, toggleCollapsed } = useNodeRoleGrouping(searched, orderRows, groupByRole, flat);
  const online = useMemo(() => merged.filter((r) => isHeardRecently(r.lastHeard ? r.lastHeard / 1000 : undefined)).length, [merged]);
  const tileChip = tileScope && (
    <button type="button" className={nodesStyles.chip} aria-pressed onClick={() => setTileScope(null)}>
      {tileTitle(t, TILE_TITLES[tileScope])}
    </button>
  );
  const filtersActive = JSON.stringify(nodeFilters) !== JSON.stringify(DEFAULT_NODE_FILTERS) || securityFilter !== 'all';

  const base = `/source/${encodeURIComponent(sourceId)}`;
  const nodeUrl = (key: string) => `${base}/node/${encodeURIComponent(key)}`;
  // Today's gate, and the server's: discover needs nodes:write.
  const canDiscover = !feed && (status?.connected ?? false) && status?.deviceType === 1 && hasPermission('nodes', 'write', { sourceId });
  // One radio sweep at a time on this source (Ruling HN N3): Contacts and Path & scope hold this, and it holds them.
  const sweep = useSweep(sourceId);
  const isRepeaterSource = status?.deviceType === 2;
  const canFavourite = hasPermission('nodes', 'write', { sourceId });

  const toggleFavourite = async (r: MeshCoreNodeRow) => {
    if (favBusy) return;
    setFavBusy(r.publicKey);
    try {
      if (!(await actions.setNodeFavorite(r.publicKey, !r.isFavorite))) showToast(t('meshcore.favorite.failed', 'Failed to update favorite'), 'error');
    } finally {
      setFavBusy(null);
    }
  };
  const importContact = async () => {
    const hex = importHex.trim().replace(/^meshcore:\/\//i, '').replace(/\s+/g, '');
    if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length < 2 || hex.length % 2 !== 0) {
      throw new Error(t('meshcore.import_contact.invalid_hex', 'Invalid hex — paste the full exported contact blob.'));
    }
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substring(i, i + 2), 16));
    setImporting(true);
    const ok = await actions.importContact(bytes).finally(() => setImporting(false));
    if (!ok) throw new Error(t('meshcore.import_contact.failed', 'Import failed — invalid advert data or device not connected.'));
    setImportOpen(false);
    setImportHex('');
  };
  const exportRows = (format: 'csv' | 'html') =>
    exportNodeList(format, MESHCORE_NODE_EXPORT_COLUMNS, flat, { filenamePrefix: 'meshcore-nodes', title: t('meshcore.nav.nodes', 'Nodes') });

  const role = (r: MeshCoreNodeRow) => t(meshcoreRoleLabelKey(r.advType), meshcoreRoleLabel(r.advType));
  const hops = (r: MeshCoreNodeRow) =>
    typeof r.pathLen === 'number' && r.pathLen >= 0 ? (r.pathLen === 0 ? t('node_details.direct', 'Direct') : String(r.pathLen)) : dash;
  const volts = (r: MeshCoreNodeRow) => (typeof r.batteryMv === 'number' && r.batteryMv > 0 ? `${(r.batteryMv / 1000).toFixed(2)} V` : null);
  const heard = (r: MeshCoreNodeRow) => (r.lastHeard ? formatRelativeTime(r.lastHeard, timeFormat, dateFormat, false) : null);
  const tags = (r: MeshCoreNodeRow) => (
    <>
      {r.isRepeaterNeighbor && (
        <span className={styles.tag} title={t('meshcore.nodes.repeater_neighbor_hint', "Listed in this repeater's neighbours table (heard directly).")}>
          {t('meshcore.nodes.repeater_neighbor', 'Neighbour')}
        </span>
      )}
      {newKeys.has(r.publicKey.toLowerCase()) && <span className={styles.tag} data-new="">{t('meshcore.discover.new_badge', 'NEW')}</span>}
    </>
  );
  const avatar = (r: MeshCoreNodeRow) => (
    <span className={nodesStyles.avatar} style={avatarStyle(r.publicKey)} aria-hidden="true">{shortMark(r.name)}</span>
  );
  const star = (r: MeshCoreNodeRow) => {
    const label = r.isFavorite ? t('meshcore.favorite.remove', 'Remove from favorites') : t('meshcore.favorite.add', 'Add to favorites');
    return (
      <button type="button" className={styles.star} aria-pressed={r.isFavorite} aria-label={label} title={canFavourite ? label : t('workspace.node_menu.needs', { permission: 'nodes:write' })}
        disabled={!canFavourite || favBusy === r.publicKey} onClick={() => void toggleFavourite(r)}>
        <UiIcon name={r.isFavorite ? 'favorite' : 'favoriteOff'} size={16} />
      </button>
    );
  };
  const groupHeader = (category: keyof typeof NODE_TYPE_CATEGORY_META, count: number, collapsed: boolean) => {
    const meta = NODE_TYPE_CATEGORY_META[category];
    return (
      <button type="button" className={styles.group} aria-expanded={!collapsed} onClick={() => toggleCollapsed(category)}>
        <UiIcon name={collapsed ? 'chevronRight' : 'chevronDown'} size={14} />
        {t(meta.labelKey, meta.label)}
        <span>· {count}</span>
      </button>
    );
  };

  const importLabel = t('workspace.meshcore.import_contact');
  const importButton = !feed && (
    <button type="button" className={`${nodesStyles.button} ${styles.tall}`} data-phone={isPhone || undefined} onClick={() => setImportOpen(true)}>
      <UiIcon name="plus" size={18} />
      {importLabel}
    </button>
  );
  const groupChip = (
    <button type="button" className={nodesStyles.chip} aria-pressed={groupByRole} onClick={() => setGroupByRole((v) => {
      writeGroupNodesByRole(!v);
      return !v;
    })}>
      {groupByRole && <UiIcon name="check" size={16} />}
      {t('nodes.group_by_role', 'Group by Role')}
    </button>
  );
  const filtersChip = (label: string) => (
    <button type="button" className={nodesStyles.chip} aria-pressed={filtersActive} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
      <UiIcon name="filter" size={16} />
      {label}
    </button>
  );
  const sort = (
    <NodeSortControls
      className={nodesStyles.sortControls}
      ariaLabel={t('meshcore.sort_by', 'Sort by')}
      value={field}
      direction={direction}
      options={MESHCORE_NODE_SORT_FIELDS.map((f) => ({ value: f, label: t(SORT_LABELS[f][0], SORT_LABELS[f][1]) }))}
      onChange={setField}
      onToggleDirection={toggleDirection}
    />
  );
  const searchBox = (
    <label className={nodesStyles.search}>
      <UiIcon name="search" size={18} />
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder={t('workspace.meshcore.search_nodes', { count: merged.length })} aria-label={t('meshcore.search_nodes', 'Search nodes…')} />
    </label>
  );
  const discover = canDiscover && (
    <DiscoverMenu
      onDiscover={(mode) => (isSweeping(sourceId) ? Promise.resolve('skipped' as const) : runSweep(sourceId, 'nodes', () => actions.discoverNodes(mode)))}
      busy={sweep !== null}
      reason={receiveOnly ? t('meshcore.receive_only.control_tooltip', 'Receive-only mode is on for this MeshCore source. Turn it off in MeshCore Settings to use this.') : undefined}
      onNew={setNewKeys}
    />
  );
  const age = (
    <span className={styles.age} data-phone={isPhone || undefined}>
      <NodeQuickAgeFilter settingsHours={display.maxNodeAgeHours} variant="meshcore" />
    </span>
  );
  // Today's export menu (ExportMenuButton, on desktop and phone): CSV or HTML of the rows shown.
  const exportMenu = (
    <RowMenu
      label={t('nodes.export', 'Export node list')}
      triggerClassName={`${nodesStyles.button} ${styles.tall}`}
      trigger={<><UiIcon name="download" size={18} />{t('common.export')}<UiIcon name="chevronDown" size={14} /></>}
      items={[
        { key: 'csv', label: 'CSV', icon: 'file', disabled: flat.length === 0, onSelect: () => exportRows('csv') },
        { key: 'html', label: 'HTML', icon: 'fileCode', disabled: flat.length === 0, onSelect: () => exportRows('html') },
      ]}
    />
  );

  const empty = search
    ? t('meshcore.no_search_results', 'No nodes match your search')
    : filtersActive && aged.length > 0
      ? t('meshcore.nodes.no_filter_results', 'No nodes match the current filters')
      : isRepeaterSource
        ? t('meshcore.no_nodes_repeater', 'No nodes yet. A repeater reports its direct (zero-hop) repeater neighbours, read from its neighbors table every 5 minutes. Other nodes appear only when the firmware is built with MESH_PACKET_LOGGING, which lets MeshMonitor read the adverts the repeater hears.')
        : t('meshcore.no_nodes', 'No nodes seen yet');

  // shortcut: every row is in the DOM (no virtualising), fine for a few hundred contacts; virtualise as NodesTable if a radio's list grows past that.
  const body = !hasLoadedOnce ? (
    <StateView kind="loading" />
  ) : items.length === 0 ? (
    <StateView kind="empty" title={empty} />
  ) : isPhone ? (
    <div className={nodesStyles.list}>
      <ul className={styles.rows} aria-label={t('nodes.title')}>
        {items.map((item) =>
          item.type === 'header' ? (
            <li key={`g-${item.category}`} className={styles.groupRow}>{groupHeader(item.category, item.count, item.collapsed)}</li>
          ) : (
            <li key={item.node.publicKey}>
              <TwoLineRow
                to={feed ? undefined : nodeUrl(item.node.publicKey)}
                leading={avatar(item.node)}
                title={
                  <span className={nodesStyles.rowTitle}>
                    <span className={nodesStyles.ellipsis}>{item.node.name}</span>
                    {item.node.isFavorite && <UiIcon name="favorite" size={14} className={nodesStyles.fav} />}
                    {tags(item.node)}
                  </span>
                }
                subtitle={(feed ? [role(item.node)] : [
                  typeof item.node.pathLen === 'number' && item.node.pathLen >= 0
                    ? (item.node.pathLen === 0 ? t('node_details.direct', 'Direct') : t('workspace.meshcore.hops', { count: item.node.pathLen }))
                    : null,
                  typeof item.node.snr === 'number' ? `${item.node.snr.toFixed(1)} dB` : null,
                  volts(item.node),
                ]).filter(Boolean).join(' · ') || undefined}
                trailing={heard(item.node) ? <span className={nodesStyles.time}>{heard(item.node)}</span> : undefined}
              />
            </li>
          ),
        )}
      </ul>
    </div>
  ) : (
    <div className={nodesStyles.scroll}>
      <table className={nodesStyles.table}>
        <thead>
          <tr>
            {!feed && <th scope="col" className={nodesStyles.star}><span className={nodesStyles.srOnly}>{t('node_filter.favorites')}</span></th>}
            <th scope="col">{t('nodes.node')}</th>
            {feed && <th scope="col">{t('workspace.meshcore.feed_role')}</th>}
            {!feed && (
              <>
                <th scope="col">{t('workspace.map.rssi')}</th>
                <th scope="col">{t('node_popup.snr')}</th>
                <th scope="col">{t('nodes.voltage')}</th>
                <th scope="col">{t('nodes.hops')}</th>
              </>
            )}
            <th scope="col">{t('nodes.last_heard')}</th>
            <th scope="col">{t('node_details.position')}</th>
            <th scope="col">{t('meshcore.discover.col_key', 'Key')}</th>
            {!feed && <th scope="col"><span className={nodesStyles.srOnly}>{t('meshcore.node_row.details', 'More details')}</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            if (item.type === 'header') {
              return (
                <tr key={`g-${item.category}`} className={styles.groupRow}>
                  <td colSpan={feed ? 5 : 10}>{groupHeader(item.category, item.count, item.collapsed)}</td>
                </tr>
              );
            }
            const r = item.node;
            return (
              <tr key={r.publicKey} data-stale={!r.lastHeard || undefined}>
                {!feed && <td className={nodesStyles.star}>{star(r)}</td>}
                <td>
                  <span className={nodesStyles.node}>
                    {avatar(r)}
                    <span className={nodesStyles.names}>
                      {feed ? <strong className={nodesStyles.name}>{r.name}</strong> : <Link className={nodesStyles.name} to={nodeUrl(r.publicKey)}>{r.name}</Link>}
                      {tags(r)}
                      {!feed && <span className={nodesStyles.id}>{role(r)}</span>}
                    </span>
                  </span>
                </td>
                {feed && <td>{role(r)}</td>}
                {!feed && (
                  <>
                    <td>{typeof r.rssi === 'number' ? r.rssi : dash}</td>
                    <td>{typeof r.snr === 'number' ? r.snr.toFixed(1) : dash}</td>
                    <td>{volts(r) ?? dash}</td>
                    <td>{hops(r)}</td>
                  </>
                )}
                <td>{heard(r) ?? dash}</td>
                <td>{r.hasPosition && typeof r.latitude === 'number' && typeof r.longitude === 'number' ? `${r.latitude.toFixed(2)}, ${r.longitude.toFixed(2)}` : dash}</td>
                <td><code className={nodesStyles.key}>{r.publicKey.slice(0, 4)}</code></td>
                {!feed && <td><Link className={styles.details} to={nodeUrl(r.publicKey)}>{t('meshcore.node_row.details', 'More details')}</Link></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={feed ? styles.feed : nodesStyles.page} data-phone={isPhone || undefined}>
      {isPhone ? (
        <>
          {!feed && <header className={nodesStyles.header}>
            <Link className={nodesStyles.iconButton} to={base}>
              <UiIcon name="back" size={22} />
              <span className={nodesStyles.srOnly}>{t('common.back')}</span>
            </Link>
            <h1 className={nodesStyles.title}>{t('nodes.title')}</h1>
            <Link className={nodesStyles.iconButton} to={`${base}/map`} aria-label={t('node_popup.show_on_map')} title={t('node_popup.show_on_map')}>
              <UiIcon name="map" size={22} />
            </Link>
          </header>}
          <div className={nodesStyles.toolbar}>
            <div className={styles.line}>
              {searchBox}
              {importButton}
            </div>
            <div className={nodesStyles.chips}>
              {groupChip}
              <button type="button" className={nodesStyles.chip} aria-pressed={favouritesOnly} onClick={() => setFavouritesOnly((v) => !v)}>
                {t('node_filter.favorites')}
              </button>
              {tileChip}
              {filtersChip(t('common.filters'))}
            </div>
            {discover}
          </div>
          <div className={nodesStyles.listHead}>
            <span className={nodesStyles.count}>{t('workspace.nodes.count', { count: flat.length })}{age}</span>
          </div>
          <div className={styles.headTools} data-phone="">
            {sort}
            {exportMenu}
          </div>
        </>
      ) : (
        <>
          {feed ? (
            <p className={nodesStyles.subtitle}>{t('workspace.meshcore.feed_nodes', { count: merged.length })}{age}</p>
          ) : (
            <header className={nodesStyles.header}>
              <div className={nodesStyles.titles}>
                <h1 className={nodesStyles.title}>{t('nodes.title')}</h1>
                <p className={nodesStyles.subtitle}>
                  {t('workspace.meshcore.nodes_subtitle', { known: merged.length, online, device: deviceName })}
                  {age}
                </p>
              </div>
            </header>
          )}
          <div className={nodesStyles.toolbar}>
            {searchBox}
            {sort}
            {filtersChip(t('workspace.map.more_filters'))}
            {groupChip}
            {tileChip}
            <span className={nodesStyles.spacer} />
            {exportMenu}
            {importButton}
          </div>
          {discover && <div className={styles.discoverBar}>{discover}</div>}
        </>
      )}
      {body}
      <NodeFiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        nodeFilters={nodeFilters}
        onNodeFiltersChange={setNodeFilters}
        securityFilter={securityFilter}
        onSecurityFilterChange={setSecurityFilter}
        channels={[]}
        features={FEATURES}
        roleOptions={MESHCORE_ROLE_FILTER_OPTIONS.map((o) => ({ value: o.value, label: t(meshcoreRoleLabelKey(o.value), o.label) }))}
      />
      <ConfirmSheet
        open={importOpen}
        title={importLabel}
        body={
          <div className={styles.import} data-phone={isPhone || undefined}>
            <p>{t('meshcore.import_contact.dialog_hint', 'Paste the hex-encoded signed advert blob or a meshcore:// URL exported from another node.')}</p>
            <textarea className={styles.textarea} value={importHex} onChange={(e) => setImportHex(e.target.value)} rows={4}
              aria-label={importLabel} placeholder="meshcore://04a3b7c2d1…" />
            <SendsLine>{t('workspace.meshcore.sends_import')}</SendsLine>
          </div>
        }
        confirmLabel={t('meshcore.import_contact.import', 'Import')}
        confirmDisabled={importHex.trim().length === 0}
        busy={importing}
        submitOnEnter={false}
        onCancel={() => setImportOpen(false)}
        onConfirm={importContact}
      />
    </div>
  );
}
