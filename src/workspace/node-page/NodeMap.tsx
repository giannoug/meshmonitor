/**
 * The node page's map (Overview's Position card, the Position tab; s15n0:
 * position history shows on the node page's map as on the device map). A
 * page section composing BaseMap with the device map's markers
 * (`useDeviceMap` + `DeviceMapLayers`), centred on the node, which is the
 * map's selection. The selected node's trail is today's (`usePositionTrail`);
 * the full map adds its Oldest → Newest legend and, for a tracked asset,
 * today's playback bar. A pin opens that node's page. Draws only.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type L from 'leaflet';
import { UiIcon } from '../../components/icons';
import { AssetPlaybackBar } from '../../components/map/AssetPlaybackBar';
import { BaseMap } from '../../components/map/BaseMap';
import { DeviceMapLayers } from '../../components/map/DeviceMapLayers';
import { MapInstanceBridge } from '../../components/map/MapInstanceBridge';
import { usePositionTrail } from '../../components/map/usePositionTrail';
import { useMapContext } from '../../contexts/MapContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useSource } from '../../contexts/SourceContext';
import { useNodes } from '../../hooks/useServerData';
import type { DeviceInfo } from '../../types/device';
import { getEffectivePosition } from '../../utils/nodeHelpers';
import { useDeviceMap } from '../map/useDeviceMap';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './NodeMap.module.css';

export interface NodeMapProps {
  node: DeviceInfo;
  /** The device map's nodes (useSourceView's processed nodes). */
  mapNodes: DeviceInfo[];
  /** `card`: Overview's small map; `full`: the Position tab's, with legend and playback. */
  size: 'card' | 'full';
}

const noop = () => {};
const OFF = { showPolarGrid: false, showPaths: false, showRoute: false };

export default function NodeMap({ node, mapNodes, size }: NodeMapProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sourceId } = useSource();
  const settings = useSettings();
  const { selectedNodeId } = useMapContext();
  const { nodes } = useNodes();
  const data = useDeviceMap({ processedNodes: mapNodes, onLinkClick: noop });
  const trail = usePositionTrail(nodes);
  const [leaflet, setLeaflet] = useState<L.Map | null>(null);
  const isPhone = useIsPhone();
  const { latitude, longitude } = getEffectivePosition(node);
  if (latitude == null || longitude == null) return null;
  const full = size === 'full';
  const legend = trail.positionHistoryLegendData;

  return (
    <div className={styles.map} data-size={size} data-phone={isPhone || undefined}>
      <BaseMap
        center={[latitude, longitude]}
        zoom={full ? 13 : 12}
        tilesetId={settings.mapTileset}
        customTilesets={settings.customTilesets}
        cartoApiKey={settings.cartoApiKey}
        styleJson={settings.activeStyleJson ?? undefined}
      >
        <MapInstanceBridge onMap={setLeaflet} />
        <DeviceMapLayers
          mapState={OFF}
          nodes={data.nodeMarkers}
          onOmsClick={(_marker, key) =>
            void navigate(`/source/${encodeURIComponent(sourceId ?? '')}/node/${encodeURIComponent(key)}`)}
          clusterZoomThreshold={data.clusterZoomThreshold}
          estimatedRadii={data.estimatedRadii}
          accuracyRegions={data.accuracyRegions}
          ownNodePosition={null}
          geoJsonLayers={[]}
          traceroutePaths={null}
          selectedTraceroute={null}
          neighborLinks={[]}
        />
        {trail.positionHistoryElements}
      </BaseMap>
      {full && legend && (
        <p className={styles.legend}>
          <span className={styles.gradient} aria-hidden="true" />
          {t('map.legend.oldest')}
          <UiIcon name="forward" size={14} />
          {t('map.legend.newest')}
        </p>
      )}
      {full && trail.showAssetPlayback && selectedNodeId && (
        <AssetPlaybackBar
          fixes={trail.filteredPositionHistory}
          map={leaflet}
          resetKey={selectedNodeId}
          timeFormat={settings.timeFormat}
          dateFormat={settings.dateFormat}
          distanceUnit={settings.distanceUnit}
          onTrailCursorChange={trail.setPlaybackTrailCursor}
        />
      )}
    </div>
  );
}
