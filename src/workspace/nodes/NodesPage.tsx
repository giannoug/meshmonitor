/**
 * Nodes (boards f3-nodes, g3-nodes): `/source/:id/nodes` on a Meshtastic-family
 * device. One data path, as the device map's (Ruling AD: App is not mounted;
 * the poll and useSourceView run under ChatProviders at Classic's `/nodes`, so
 * the text filter, the quick age window and the sort apply as on today's
 * Nodes). Today's list filters (`filterNodeList`), the shared advanced filters
 * (NodeFiltersSheet, as the map's More filters), then a quick chip: all,
 * online (heard in the shell's "N online" window), favourites or direct.
 * Desktop shows NodesTable, phone NodesList. Nothing here transmits or runs
 * a timer: Add node from URL writes a row on the server only.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { UiIcon } from '../../components/icons';
import NodeQuickAgeFilter from '../../components/NodeQuickAgeFilter';
import { ExportMenuButton } from '../../components/nodes/ExportMenuButton';
import { ImportContactUrlModal } from '../../components/nodes/ImportContactUrlModal';
import { NodeSortControls } from '../../components/nodes/NodeSortControls';
import { useToast } from '../../components/ToastContainer';
import { useAuth } from '../../contexts/AuthContext';
import { MapProvider } from '../../contexts/MapContext';
import { useData } from '../../contexts/DataContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useUI } from '../../contexts/UIContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { usePersistedNodeFilters } from '../../hooks/usePersistedNodeFilters';
import { sourcePollQueryKey } from '../../hooks/pollQueryKey';
import { useChannels, useNodes } from '../../hooks/useServerData';
import { useSourceView } from '../../hooks/useSourceView';
import { appBasename } from '../../init';
import type { DeviceInfo } from '../../types/device';
import type { SortField } from '../../types/ui';
import { formatDateTime } from '../../utils/datetime';
import { filterNodeList } from '../../utils/nodeAdvancedFilter';
import { buildNodeExportRows, exportNodeList, NODE_EXPORT_COLUMNS, type NodeExportRow } from '../../utils/nodeExport';
import { getEffectiveHops } from '../../utils/nodeHops';
import { parseNodeId } from '../../utils/nodeHelpers';
import { MESHTASTIC_SORT_OPTIONS, orderFavoritesFirst, sortNodesByField } from '../../utils/nodeSort';
import ChatProviders from '../chat/ChatProviders';
import { isHeardRecently } from '../chat/channelLabel';
import { useChatRuntime } from '../chat/useChatRuntime';
import { MapSearch } from '../map/MapToolbar';
import { themeColors } from '../map/themeColors';
import SendsLine from '../patterns/SendsLine';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import ColumnPicker from './ColumnPicker';
import NodeFiltersSheet from './NodeFiltersSheet';
import NodesList from './NodesList';
import NodesTable from './NodesTable';
import { useNodeColumns, type CellContext } from './nodeColumns';
import styles from './NodesTable.module.css';

export interface NodesRouteProps {
  sourceId: string;
  source: DashboardSource;
}

export default function NodesRoute({ sourceId, source }: NodesRouteProps) {
  return (
    <ChatProviders sourceId={sourceId} source={source} classicTab="nodes">
      {/* useSourceView reads the map state (selection, traceroute paths). */}
      <MapProvider>
        <Nodes sourceId={sourceId} deviceName={source.name} />
      </MapProvider>
    </ChatProviders>
  );
}

type Scope = 'all' | 'online' | 'favorites' | 'direct';
type Traceroutes = Parameters<typeof getEffectiveHops>[2];
const noop = () => {};
const EXPORT_COLUMNS = NODE_EXPORT_COLUMNS.map((c) => ({ key: c.key, label: c.label, value: (row: NodeExportRow) => row[c.key] }));

function Nodes({ sourceId, deviceName }: { sourceId: string; deviceName: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { pollData } = useChatRuntime(-1);
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const csrfFetch = useCsrfFetch();
  const settings = useSettings();
  const { currentNodeId } = useData();
  const { nodes, isLoading } = useNodes();
  const { channels } = useChannels();
  const ui = useUI();
  const [nodeFilters, setNodeFilters] = usePersistedNodeFilters('nodeFilters');
  const [columns, setColumns] = useNodeColumns();
  const [scope, setScope] = useState<Scope>('all');
  const [importOpen, setImportOpen] = useState(false);

  const authFetch = useCallback((url: string, init?: RequestInit) => csrfFetch(url, init), [csrfFetch]);
  const refetchPoll = useCallback(() => queryClient.invalidateQueries({ queryKey: sourcePollQueryKey(sourceId) }), [queryClient, sourceId]);
  // useSourceView also builds the map's traceroute paths, which need the theme's colours.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 a theme change re-reads the CSS variables, as App does
  const mergedThemeColors = useMemo(() => themeColors(settings.overlayColors), [settings.overlayColors, settings.theme]);
  const view = useSourceView({
    baseUrl: appBasename,
    authFetch,
    refetchPoll,
    nodeFilters,
    mergedThemeColors,
    setSelectedRouteSegment: noop,
    setShowPurgeDataModal: noop,
  });

  const traceroutes = pollData?.traceroutes as unknown as Traceroutes;
  const currentNodeNum = currentNodeId ? parseNodeId(currentNodeId) : null;
  const hopsOf = (node: DeviceInfo) =>
    node.user?.id === currentNodeId ? 0 : getEffectiveHops(node, settings.nodeHopsCalculation, traceroutes, currentNodeNum);

  // Today's Nodes list: processedNodes, its own filters, then favourites first by the chosen sort.
  const listed = useMemo(() => {
    const filtered = filterNodeList(view.processedNodes, {
      securityFilter: ui.securityFilter,
      channelFilter: ui.channelFilter,
      showIncompleteNodes: settings.showIncompleteNodes,
      filterRemoteAdminOnly: ui.filterRemoteAdminOnly,
    });
    return orderFavoritesFirst(filtered, (list) => sortNodesByField(list, ui.sortField, ui.sortDirection, hopsOf));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 hopsOf reads only the values listed
  }, [view.processedNodes, ui.securityFilter, ui.channelFilter, settings.showIncompleteNodes, ui.filterRemoteAdminOnly, ui.sortField, ui.sortDirection, traceroutes, currentNodeId, settings.nodeHopsCalculation]);

  const now = Date.now();
  const inScope: Record<Scope, (n: DeviceInfo) => boolean> = {
    all: () => true,
    online: (n) => isHeardRecently(n.lastHeard, now),
    favorites: (n) => !!n.isFavorite,
    direct: (n) => hopsOf(n) === 0,
  };
  const shown = listed.filter(inScope[scope]);
  const countOf = (s: Scope) => listed.filter(inScope[s]).length;
  const onlineTotal = nodes.filter((n) => isHeardRecently(n.lastHeard, now)).length;

  const ctx: CellContext = {
    t,
    hopsOf,
    home: nodes.find((n) => n.user?.id === currentNodeId),
    distanceUnit: settings.distanceUnit,
    timeFormat: settings.timeFormat,
    dateFormat: settings.dateFormat,
  };
  const onSort = (field: SortField) => (field === ui.sortField ? ui.setSortDirection(ui.sortDirection === 'asc' ? 'desc' : 'asc') : ui.setSortField(field));
  const sort = (
    <NodeSortControls
      value={ui.sortField}
      direction={ui.sortDirection}
      options={MESHTASTIC_SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
      onChange={ui.setSortField}
      onToggleDirection={() => ui.setSortDirection(ui.sortDirection === 'asc' ? 'desc' : 'asc')}
      className={styles.sortControls}
    />
  );
  const exportNodes = (format: 'csv' | 'html') => {
    const rows = buildNodeExportRows(shown, {
      nodeHopsCalculation: settings.nodeHopsCalculation,
      traceroutes,
      currentNodeNum,
      currentNodeId,
      formatLastHeard: (s) => formatDateTime(new Date(s * 1000), settings.timeFormat, settings.dateFormat),
    });
    exportNodeList(format, EXPORT_COLUMNS, rows, { filenamePrefix: 'meshmonitor-nodes' });
  };

  const canImport = hasPermission('nodes', 'write', { sourceId });
  const importLabel = t('nodes.import_contact_title');
  const importButton = (
    <button
      type="button"
      className={styles.iconButton}
      onClick={() => setImportOpen(true)}
      disabled={!canImport}
      aria-label={importLabel}
      title={canImport ? importLabel : t('workspace.node_menu.needs', { permission: 'nodes:write' })}
    >
      <UiIcon name="plus" size={20} />
    </button>
  );
  const filtersOn = ui.showNodeFilterPopup;
  const openFilters = () => ui.setShowNodeFilterPopup(true);
  const chip = (s: Scope, label: string, count?: number) => (
    <button key={s} type="button" className={styles.chip} aria-pressed={scope === s} onClick={() => setScope(isPhone && scope === s ? 'all' : s)}>
      {label}
      {count !== undefined && <span className={styles.chipCount}>{count}</span>}
    </button>
  );
  // Today's quick age window sits beside the count, as on Classic's Nodes header.
  const age = <NodeQuickAgeFilter settingsHours={settings.maxNodeAgeHours} />;
  // shortcut: every row renders (Classic virtualises its list); add useVirtualizer if a large mesh lags.
  const body = !view.shouldShowData() && !isLoading && nodes.length === 0
    ? <StateView kind="empty" title={t('workspace.map.not_connected')} />
    : shown.length === 0
      ? <StateView kind="empty" />
      : isPhone
        ? <NodesList sourceId={sourceId} nodes={shown} ctx={ctx} />
        : <NodesTable sourceId={sourceId} nodes={shown} columns={columns} ctx={ctx} sortField={ui.sortField} sortDirection={ui.sortDirection} onSort={onSort} />;
  const base = `/source/${encodeURIComponent(sourceId)}`;

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {isPhone ? (
        <>
          <header className={styles.header}>
            <Link className={styles.iconButton} to={base}>
              <UiIcon name="back" size={22} />
              <span className={styles.srOnly}>{t('common.back')}</span>
            </Link>
            <h1 className={styles.title}>{t('nodes.title')}</h1>
            {importButton}
            <Link className={styles.iconButton} to={`${base}/map`} aria-label={t('node_popup.show_on_map')} title={t('node_popup.show_on_map')}>
              <UiIcon name="map" size={22} />
            </Link>
          </header>
          <div className={styles.toolbar}>
            <MapSearch className={styles.search} />
            <div className={styles.chips}>
              {chip('online', t('workspace.nodes.online'), countOf('online'))}
              {chip('favorites', t('node_filter.favorites'))}
              {chip('direct', t('workspace.chat.direct'))}
              <button type="button" className={styles.chip} aria-expanded={filtersOn} onClick={openFilters}>
                <UiIcon name="filter" size={16} />
                {t('common.filters')}
              </button>
            </div>
          </div>
          <div className={styles.listHead}>
            <span className={styles.count}>
              {scope === 'online' ? t('workspace.shell.online_count', { count: shown.length }) : t('workspace.nodes.count', { count: shown.length })}
              {age}
            </span>
            {sort}
          </div>
        </>
      ) : (
        <>
          <header className={styles.header}>
            <div className={styles.titles}>
              <h1 className={styles.title}>{t('nodes.title')}</h1>
              <p className={styles.subtitle}>
                {t('workspace.nodes.subtitle', { online: onlineTotal, known: nodes.length, device: deviceName })}
                {age}
              </p>
            </div>
            <Link className={styles.button} to={`${base}/map`}>
              <UiIcon name="map" size={18} />
              {t('node_popup.show_on_map')}
            </Link>
            <span className={styles.export}>
              <ExportMenuButton disabled={shown.length === 0} onExport={exportNodes} />
            </span>
            {importButton}
          </header>
          <div className={styles.toolbar}>
            <MapSearch className={styles.search} />
            {chip('all', t('common.all'), listed.length)}
            {chip('online', t('workspace.nodes.online'), countOf('online'))}
            {chip('favorites', t('node_filter.favorites'), countOf('favorites'))}
            <button type="button" className={styles.chip} aria-expanded={filtersOn} onClick={openFilters}>
              <UiIcon name="filter" size={16} />
              {t('workspace.map.more_filters')}
            </button>
            <span className={styles.spacer} />
            {sort}
            <ColumnPicker columns={columns} onChange={setColumns} />
          </div>
        </>
      )}
      {body}
      <NodeFiltersSheet
        open={filtersOn}
        onClose={() => ui.setShowNodeFilterPopup(false)}
        nodeFilters={nodeFilters}
        onNodeFiltersChange={setNodeFilters}
        securityFilter={ui.securityFilter}
        onSecurityFilterChange={ui.setSecurityFilter}
        channels={channels}
      />
      {importOpen && (
        <ImportContactUrlModal
          sourceId={sourceId}
          onClose={() => setImportOpen(false)}
          note={<SendsLine>{t('workspace.nodes.import_sends', { device: deviceName })}</SendsLine>}
          onImported={(node, alreadyKnown) => {
            // As Classic: the server wrote the row; the poll brings it in.
            void queryClient.invalidateQueries({ queryKey: sourcePollQueryKey(sourceId) });
            const name = node?.user?.longName || node?.user?.shortName || t('nodes.import_contact_unnamed');
            showToast(alreadyKnown ? t('nodes.import_contact_updated', { name }) : t('nodes.import_contact_added', { name }), 'success');
          }}
        />
      )}
    </div>
  );
}
