/**
 * The all-devices map (boards f6-overview, 5-08-overview-map): `/` and
 * `/overview/map` (and `/overview` on desktop). Today's DashboardMap as is,
 * fed the way DashboardPage feeds it: every device merged (Unified) when there
 * are two or more, else the one device's own data. MeshCore nodes show here
 * (Ruling 3.1). The search pill is today's node filter wording, as on the
 * device map; it narrows the pins by name or id.
 *
 * One owner per screen (Ruling AD): DashboardPage is not mounted. The data is
 * today's polled hooks, so this adds no timer and sends nothing. On `/` only
 * (`landing`), the admin's default landing page applies, as on Classic's `/`.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardMap from '../../components/Dashboard/DashboardMap';
import type { NodeSourceRef } from '../../components/Dashboard/DashboardNodePopup';
import { UiIcon } from '../../components/icons';
import { MapProvider, useMapContext } from '../../contexts/MapContext';
import { useSettings } from '../../contexts/SettingsContext';
import {
  UNIFIED_SOURCE_ID,
  useDashboardSourceData,
  useDashboardSources,
  useDashboardUnifiedData,
  type DashboardDataOptions,
} from '../../hooks/useDashboardData';
import { useDefaultLandingRedirect } from '../../hooks/useDefaultLandingRedirect';
import { useMeshCoreNeighbors } from '../../hooks/useMapAnalysisData';
import { useMaxInfraNodeAgeHoursAcross, useMaxNodeAgeHoursAcross } from '../../hooks/useNodeDisplaySettings';
import { useIsPhone } from '../shell/useIsPhone';
import '../../styles/dashboard.css';
import styles from './OverviewMap.module.css';

/** As DashboardPage: the server leaves out nodes the map hides by age. */
const DATA_OPTIONS: DashboardDataOptions = { ageWindow: true };

interface NamedNode {
  longName?: unknown;
  shortName?: unknown;
  nodeId?: unknown;
  user?: { longName?: unknown; shortName?: unknown; id?: unknown };
}

/** The nodes whose long name, short name or id contains `query` (any case). */
function filterNodes(nodes: unknown[], query: string): unknown[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.filter((n) => {
    const { longName, shortName, nodeId, user } = n as NamedNode;
    return [longName, shortName, nodeId, user?.longName, user?.shortName, user?.id].some(
      (v) => typeof v === 'string' && v.toLowerCase().includes(q),
    );
  });
}

export default function OverviewMap({ landing = false }: { landing?: boolean }) {
  return (
    <MapProvider>
      <AllDevicesMap landing={landing} />
    </MapProvider>
  );
}

function AllDevicesMap({ landing }: { landing: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const { mapTileset, customTilesets, defaultMapCenterLat, defaultMapCenterLon, defaultLandingPage } = useSettings();
  const { data: sources = [], isSuccess } = useDashboardSources();
  useDefaultLandingRedirect({ skip: !landing, isSuccess, defaultLandingPage, sources });

  const sourceIds = sources.map((s) => s.id);
  const maxNodeAgeHours = useMaxNodeAgeHoursAcross(sourceIds);
  const maxInfraNodeAgeHours = useMaxInfraNodeAgeHoursAcross(sourceIds);

  // DashboardPage's default selection: Unified with 2+ devices, else the first enabled one.
  const unified = sources.length >= 2;
  const single = unified ? null : ((sources.find((s) => s.enabled) ?? sources[0])?.id ?? null);
  const singleData = useDashboardSourceData(single, DATA_OPTIONS);
  const unifiedData = useDashboardUnifiedData(sources, unified, DATA_OPTIONS);
  const data = unified ? unifiedData : singleData;

  // MeshCore neighbour links, fetched only while Show Neighbors is on (as DashboardPage).
  const { showNeighborInfo } = useMapContext();
  const neighborSources = unified ? sourceIds : single ? [single] : [];
  const meshcoreNeighbors = useMeshCoreNeighbors({
    enabled: showNeighborInfo && neighborSources.length > 0,
    sources: neighborSources,
    lookbackHours: maxNodeAgeHours,
  });

  const [query, setQuery] = useState('');
  const nodes = useMemo(() => filterNodes(data.nodes, query), [data.nodes, query]);

  // A popup's "seen by" row: that device's node page (today's Node Details), or the MeshCore device.
  // Stable, so the map's memoized marker popups don't rebuild on every render.
  const onNodeSourceSelect = useCallback(
    (source: NodeSourceRef, nodeId: string | undefined) => {
      const base = `/source/${encodeURIComponent(source.sourceId)}`;
      void navigate(source.protocol !== 'MeshCore' && nodeId ? `${base}/node/${encodeURIComponent(nodeId)}` : base);
    },
    [navigate],
  );

  return (
    <div className={styles.page}>
      <DashboardMap
        nodes={nodes}
        traceroutes={data.traceroutes}
        neighborInfo={data.neighborInfo}
        meshcoreNeighbors={(meshcoreNeighbors.data?.items as unknown[] | undefined) ?? []}
        channels={data.channels}
        tilesetId={mapTileset}
        customTilesets={customTilesets}
        defaultCenter={{ lat: defaultMapCenterLat ?? 30.0, lng: defaultMapCenterLon ?? -90.0 }}
        sourceId={unified ? UNIFIED_SOURCE_ID : single}
        maxNodeAgeHours={maxNodeAgeHours}
        maxInfraNodeAgeHours={maxInfraNodeAgeHours}
        onNodeSourceSelect={onNodeSourceSelect}
        isLoading={data.isLoading}
      />
      <div className={styles.overlay}>
        {isPhone && (
          <Link className={styles.back} to="/overview">
            <UiIcon name="back" size={22} />
            <span className={styles.srOnly}>{t('common.back')}</span>
          </Link>
        )}
        <label className={styles.search}>
          <UiIcon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('nodes.filter_placeholder')}
            aria-label={t('nodes.filter_title')}
          />
        </label>
      </div>
    </div>
  );
}
