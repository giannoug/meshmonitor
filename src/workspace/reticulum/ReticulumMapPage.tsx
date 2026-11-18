/**
 * The Reticulum map (boards 9-05, 9-14; note s9n3), native at
 * `/source/:id/map`, on the screen's one poll. Today's Locations /
 * Connections switch (Locations first, as today):
 *
 * - Locations: the shared map shell (`BaseMap`) with today's markers for the
 *   peers sharing Sideband telemetry and today's path edges between two
 *   positioned ends (`useReticulumMapData`); with none, today's empty note.
 * - Connections: today's position-free topology (`buildReticulumConnectionGraph`
 *   and its radial layout): this instance at the centre, direct links solid,
 *   paths through a relay dashed, relay nodes as diamonds.
 *
 * A node or marker that resolves to a destination opens its details
 * (DestinationPanel): beside the map on desktop, in a sheet on the phone.
 * Nothing here sends.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useSettings } from '../../contexts/SettingsContext';
import { useBaseMapSettings } from '../../components/map/useBaseMapSettings';
import { BaseMap } from '../../components/map/BaseMap';
import { MapLoadingOverlay } from '../../components/map/MapLoadingOverlay';
import { NodeMarkersLayer, type NodeMarkerDescriptor } from '../../components/map/layers/NodeMarkersLayer';
import { NeighborLinksLayer } from '../../components/map/layers/NeighborLinksLayer';
import { createNodeIcon } from '../../components/map/markerIcons';
import { UiIcon } from '../../components/icons';
import { RETICULUM_COLOR, useReticulumMapData } from '../../components/Reticulum/useReticulumMapData';
import {
  buildReticulumConnectionGraph,
  placeReticulumGraph,
  RETICULUM_GRAPH_VIEW as VIEW,
} from '../../components/Reticulum/reticulumConnectionGraph';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import ToolHead from '../meshcore/ToolHead';
import DestinationPanel from './DestinationPanel';
import { peerMark, shortHash, useRnsRuntime } from './runtime';
import styles from './Reticulum.module.css';

type Mode = 'locations' | 'connections';

export default function ReticulumMapPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { setMapTileset } = useSettings();
  const baseMapSettings = useBaseMapSettings();
  const { sourceId, deviceName, rns } = useRnsRuntime();
  const { destinations, paths, loading } = rns;
  const [mode, setMode] = useState<Mode>('locations');
  const [selected, setSelected] = useState<{ hash: string; label?: string } | null>(null);
  const { positioned, pathLinks, center, zoom } = useReticulumMapData(destinations, paths);
  const open = selected ? destinations.find((d) => d.destinationHash === selected.hash) ?? null : null;

  const markers: NodeMarkerDescriptor[] = useMemo(
    () =>
      positioned.map((d) => {
        const name = d.displayName || shortHash(d.destinationHash);
        return {
          key: d.destinationHash,
          position: [d.latitude as number, d.longitude as number] as [number, number],
          iconSig: `${name}|reticulum`,
          buildIcon: () => createNodeIcon({ variant: 'meshcore', fixedColor: RETICULUM_COLOR, labelName: name }),
          eventHandlers: { click: () => setSelected({ hash: d.destinationHash }) },
          children: (
            <Tooltip>
              <strong>{name}</strong>
              {d.appName && <><br />{d.appName}</>}
              {typeof d.rssi === 'number' && <><br />RSSI: {d.rssi} dBm</>}
            </Tooltip>
          ),
        };
      }),
    [positioned],
  );

  const graph = useMemo(
    () => buildReticulumConnectionGraph(paths, destinations, { localLabel: t('reticulum.connections.local', 'This instance') }),
    [paths, destinations, t],
  );
  const placed = useMemo(() => placeReticulumGraph(graph), [graph]);

  const toggle = (
    <div className={styles.segmentGroup} role="tablist" aria-label={t('reticulum.map.view_toggle', 'Map view')}>
      {(['locations', 'connections'] as const).map((m) => (
        <button key={m} type="button" role="tab" aria-selected={mode === m} className={styles.segmentButton} onClick={() => setMode(m)}>
          <UiIcon name={m === 'locations' ? 'location' : 'link'} size={16} />
          {m === 'locations' ? t('reticulum.map.mode_locations', 'Locations') : t('reticulum.map.mode_connections', 'Connections')}
        </button>
      ))}
    </div>
  );

  const legend = (
    <ul className={styles.mapLegend} aria-hidden="true">
      <li>
        <span className={styles.legendLine} /> {t('reticulum.connections.legend_direct', 'Direct link')}
      </li>
      <li>
        <span className={styles.legendLine} data-relay="" /> {t('reticulum.connections.legend_relay', 'Through a relay')}
      </li>
      <li>
        <span className={styles.legendDiamond} /> {t('reticulum.connections.legend_relay_node', 'Relay node')}
      </li>
    </ul>
  );

  const connections =
    graph.nodes.length === 0 ? (
      !loading && <p className={styles.empty} role="status">{t('reticulum.connections.empty', 'No paths reported yet, so there is nothing to graph.')}</p>
    ) : (
      <svg
        className={styles.graph}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t('reticulum.connections.aria', 'Reticulum connection topology')}
      >
        {[0.24, 0.42].map((r) => (
          <circle key={r} cx={VIEW / 2} cy={VIEW / 2} r={VIEW * r} className={styles.ring} />
        ))}
        {graph.edges.map((edge) => {
          const a = placed.get(edge.from);
          const b = placed.get(edge.to);
          if (!a || !b) return null;
          return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.edge} data-relay={edge.kind === 'relay' || undefined} />;
        })}
        {graph.nodes.map((node) => {
          const p = placed.get(node.id);
          if (!p) return null;
          const clickable = !!node.destination;
          const label = node.label;
          const mark = node.kind === 'local' ? peerMark(deviceName) : peerMark(node.destination?.displayName || label);
          const pick = () => node.destination && setSelected({ hash: node.destination.destinationHash, label: node.label });
          return (
            <g
              key={node.id}
              transform={`translate(${p.x} ${p.y})`}
              className={styles.gNode}
              data-kind={node.kind}
              data-on={(selected && node.destination?.destinationHash === selected.hash) || undefined}
              onClick={clickable ? pick : undefined}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-label={clickable ? node.label : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        pick();
                      }
                    }
                  : undefined
              }
            >
              {node.kind === 'relay' ? (
                <rect x={-13} y={-13} width={26} height={26} transform="rotate(45)" className={styles.gShape} />
              ) : node.kind === 'local' ? (
                <rect x={-20} y={-20} width={40} height={40} rx={8} className={styles.gShape} />
              ) : (
                <circle r={16} className={styles.gShape} />
              )}
              <text className={styles.gMark} textAnchor="middle" dy="0.35em">{mark}</text>
              <text className={styles.gLabel} textAnchor="middle" y={node.kind === 'local' ? 38 : 34}>{label}</text>
            </g>
          );
        })}
      </svg>
    );

  const locations = (
    <div className={styles.mapBox}>
      <BaseMap key={`${center[0]}-${center[1]}-${zoom}`} center={center} zoom={zoom} {...baseMapSettings} onTilesetChange={setMapTileset}>
        <NodeMarkersLayer markers={markers} />
        {pathLinks.length > 0 && <NeighborLinksLayer links={pathLinks} />}
      </BaseMap>
      {loading && <MapLoadingOverlay />}
      {!loading && positioned.length === 0 && (
        <p className={styles.mapEmpty} role="status">
          {t('reticulum.map.empty', 'No peers are sharing position/telemetry with this identity yet.')}
        </p>
      )}
    </div>
  );

  const title = t('workspace.reticulum.map');
  const body = (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {isPhone ? (
        <ToolHead title={title} back={{ label: t('workspace.tabs.home'), to: `/source/${encodeURIComponent(sourceId)}` }} />
      ) : (
        <ToolHead
          title={title}
          subtitle={mode === 'connections' ? t('workspace.reticulum.connections_subtitle') : t('workspace.reticulum.locations_subtitle')}
          back={{ label: '', to: '' }}
          actions={toggle}
        />
      )}
      {isPhone && toggle}
      {mode === 'connections' && legend}
      {mode === 'connections' ? connections : locations}
    </div>
  );

  if (isPhone) {
    return (
      <>
        {body}
        <Sheet open={!!open} onClose={() => setSelected(null)} title={open ? selected?.label || open.displayName || shortHash(open.destinationHash) : ''}>
          {open && <DestinationPanel destination={open} name={selected?.label} embedded />}
        </Sheet>
      </>
    );
  }
  return (
    <div className={styles.split}>
      {body}
      {open && <DestinationPanel destination={open} name={selected?.label} onClose={() => setSelected(null)} />}
    </div>
  );
}
