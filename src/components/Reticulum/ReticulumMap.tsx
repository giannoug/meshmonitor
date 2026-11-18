/**
 * ReticulumMap — peer positions shared via Sideband telemetry (#3960 Phase 3),
 * plus an optional path-graph overlay (#3960 Phase 4 WP5).
 *
 * Deliberately lean vs `MeshCoreMap`: Reticulum has no hop-count star and no
 * promiscuous position history — a peer only appears here when it shares
 * Sideband `SID_LOCATION` telemetry with our identity (design §7). So this
 * composes the shared `BaseMap` + `NodeMarkersLayer` with a self-contained
 * popup (no NodeCard model coupling), null-island filtered, and shows an
 * explicit empty state when no peer is sharing.
 *
 * The optional `paths` prop draws destination -> via/next-hop edges from the
 * path table (`ReticulumPathRow`) by reusing the shared `NeighborLinksLayer`
 * — an edge is drawn ONLY when both endpoints resolve to a positioned
 * destination in the current `destinations` set; rows with a null `viaHash`
 * (destination IS the next hop / zero-hop) never draw an edge.
 *
 * A Locations/Connections toggle (#6119) switches between this geographic map
 * and a position-free topology graph (`ReticulumConnectionsGraph`) built from
 * the same path table — most Reticulum clients share no location, so the
 * geographic map alone shows very few of them.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useSettings } from '../../contexts/SettingsContext';
import { useBaseMapSettings } from '../map/useBaseMapSettings';
import { BaseMap } from '../map/BaseMap';
import { MapLoadingOverlay } from '../map/MapLoadingOverlay';
import { NodeMarkersLayer, type NodeMarkerDescriptor } from '../map/layers/NodeMarkersLayer';
import { NeighborLinksLayer } from '../map/layers/NeighborLinksLayer';
import { createNodeIcon } from '../map/markerIcons';
import type { ReticulumDestinationRow, ReticulumPathRow } from '../../types/reticulum';
import { ReticulumConnectionsGraph } from './ReticulumConnectionsGraph';
import { ReticulumDestinationDetail } from './ReticulumDestinationDetail';
import { RETICULUM_COLOR, useReticulumMapData } from './useReticulumMapData';
import { UiIcon } from '../icons';
import styles from './ReticulumMap.module.css';

type ReticulumMapMode = 'locations' | 'connections';


interface ReticulumMapProps {
  /** Announced destinations; those carrying a shared Sideband position render. */
  destinations: ReticulumDestinationRow[];
  /**
   * Path-table rows (#3960 Phase 4 WP5). When provided, an edge is drawn
   * from a path's destination to its via/next-hop, but ONLY when both ends
   * resolve to a positioned destination in `destinations` (design §7: dest
   * -> next-hop when both have positions). Rows with a null `viaHash`
   * (destination IS the next hop / zero-hop) never draw an edge.
   */
  paths?: ReticulumPathRow[];
  loading?: boolean;
  resizeTrigger?: unknown;
}

function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
}

export const ReticulumMap: React.FC<ReticulumMapProps> = ({ destinations, paths, loading = false, resizeTrigger }) => {
  const { t } = useTranslation();
  const { setMapTileset } = useSettings();
  const baseMapSettings = useBaseMapSettings();
  const [mode, setMode] = useState<ReticulumMapMode>('locations');

  const { positioned, pathLinks, center, zoom } = useReticulumMapData(destinations, paths);

  const markers: NodeMarkerDescriptor[] = useMemo(
    () => positioned.map(d => {
      const name = d.displayName || shortHash(d.destinationHash);
      return {
        key: d.destinationHash,
        position: [d.latitude as number, d.longitude as number] as [number, number],
        iconSig: `${name}|reticulum`,
        buildIcon: () => createNodeIcon({
          variant: 'meshcore',
          fixedColor: RETICULUM_COLOR,
          labelName: name,
        }),
        children: (
          <>
            <Tooltip>
              <strong>{name}</strong>
              {d.appName && <><br />{d.appName}</>}
              {typeof d.rssi === 'number' && <><br />RSSI: {d.rssi} dBm</>}
            </Tooltip>
            <Popup>
              <ReticulumDestinationDetail destination={d} name={name} />
            </Popup>
          </>
        ),
      };
    }),
    [positioned],
  );

  return (
    <div className={styles.mapPane}>
      <div className={styles.modeToggle} role="tablist" aria-label={t('reticulum.map.view_toggle', 'Map view')}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'locations'}
          className={`${styles.modeButton} ${mode === 'locations' ? styles.modeButtonActive : ''}`}
          onClick={() => setMode('locations')}
        >
          <UiIcon name="location" size={13} />
          {t('reticulum.map.mode_locations', 'Locations')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'connections'}
          className={`${styles.modeButton} ${mode === 'connections' ? styles.modeButtonActive : ''}`}
          onClick={() => setMode('connections')}
        >
          <UiIcon name="network" size={13} />
          {t('reticulum.map.mode_connections', 'Connections')}
        </button>
      </div>

      {mode === 'connections' ? (
        <ReticulumConnectionsGraph paths={paths ?? []} destinations={destinations} loading={loading} />
      ) : (
        <>
          <BaseMap
            key={`${center[0]}-${center[1]}-${zoom}`}
            center={center}
            zoom={zoom}
            {...baseMapSettings}
            onTilesetChange={setMapTileset}
            resizeTrigger={resizeTrigger}
          >
            <NodeMarkersLayer markers={markers} />
            {pathLinks.length > 0 && <NeighborLinksLayer links={pathLinks} />}
          </BaseMap>

          {loading && <MapLoadingOverlay />}

          {!loading && positioned.length === 0 && (
            <div className={styles.emptyState} role="status">
              {t('reticulum.map.empty', 'No peers are sharing position/telemetry with this identity yet.')}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReticulumMap;
