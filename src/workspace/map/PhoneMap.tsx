/**
 * The device map's phone layout (boards g1-map, g2-layers; ds4): the map is
 * full screen under the tab bar, with Back, the search pill (today's node
 * list filter, as the desktop toolbar) and Layers across the top, and the map
 * buttons down the right. Layers and the node list open as bottom sheets with
 * the desktop's content (the same groups, the same rows). The peeks decide
 * their own phone form (NodePeek, NeighbourPeek).
 *
 * DeviceMap owns the data and the map; this draws only what floats over it.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import type { DeviceInfo } from '../../types/device';
import Sheet from '../patterns/Sheet';
import LayerGroup, { type LayerGroupSpec } from './LayerGroup';
import { MapNodeRows } from './MapNodeList';
import { MapSearch } from './MapToolbar';
import drawerStyles from './LayersDrawer.module.css';
import styles from './PhoneMap.module.css';

export type PhoneMapSheet = 'layers' | 'list';

export interface PhoneMapProps {
  sourceId: string;
  sheet: PhoneMapSheet | null;
  onSheet(sheet: PhoneMapSheet): void;
  onCloseSheet(): void;
  groups: LayerGroupSpec[];
  nodes: DeviceInfo[];
  selectedId: string | null;
  hopsOf(node: DeviceInfo): number;
  onPick(node: DeviceInfo): void;
  /** The map's own buttons (MapControls). */
  controls: ReactNode;
  /** The mode lines the desktop shows at the foot (neighbours hint, Traceroute mode). */
  status: ReactNode;
}

export default function PhoneMap(p: PhoneMapProps) {
  const { t } = useTranslation();
  const layers = t('workspace.map.layers');
  const nodeList = t('nodes.node_list');
  return (
    <>
      <div className={styles.overlay}>
        <div className={styles.top}>
          <Link className={styles.button} to={`/source/${encodeURIComponent(p.sourceId)}`}>
            <UiIcon name="back" size={22} />
            <span className={styles.srOnly}>{t('common.back')}</span>
          </Link>
          <MapSearch className={styles.pill} />
          <button type="button" className={styles.button} aria-label={layers} title={layers} onClick={() => p.onSheet('layers')}>
            <UiIcon name="map" size={22} />
          </button>
        </div>
        <div className={styles.side}>
          <button type="button" className={styles.button} aria-label={nodeList} title={nodeList} onClick={() => p.onSheet('list')}>
            <UiIcon name="list" size={22} />
          </button>
          {p.controls}
        </div>
        <span className={styles.spacer} />
        <div className={styles.status}>{p.status}</div>
      </div>
      <Sheet open={p.sheet === 'layers'} onClose={p.onCloseSheet} title={layers} side="bottom">
        <div className={`${drawerStyles.body} ${drawerStyles.phone}`}>
          {p.groups.map((g) => <LayerGroup key={g.id} group={g} />)}
        </div>
      </Sheet>
      <Sheet open={p.sheet === 'list'} onClose={p.onCloseSheet} title={`${t('workspace.map.on_the_map')} · ${p.nodes.length}`} side="bottom">
        <div className={styles.list}>
          <MapNodeRows sourceId={p.sourceId} nodes={p.nodes} selectedId={p.selectedId} hopsOf={p.hopsOf} onPick={p.onPick} />
        </div>
      </Sheet>
    </>
  );
}
