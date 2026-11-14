/**
 * The device map's toolbar (board Main): the node filter (shared with Nodes,
 * as today's list filter), today's quick age window, More filters (today's
 * filter popup) and Layers. `MapControls` are the map's own buttons: fit all
 * nodes and Measure Distance, both from today's Map controls panel.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import NodeQuickAgeFilter from '../../components/NodeQuickAgeFilter';
import { useSettings } from '../../contexts/SettingsContext';
import { useUI } from '../../contexts/UIContext';
import styles from './DeviceMap.module.css';

export interface MapToolbarProps {
  layersOpen: boolean;
  onLayers(): void;
}

export default function MapToolbar({ layersOpen, onLayers }: MapToolbarProps) {
  const { t } = useTranslation();
  const { maxNodeAgeHours } = useSettings();
  const { nodesNodeFilter, setNodesNodeFilter, setShowNodeFilterPopup } = useUI();
  return (
    <div className={styles.toolbar}>
      <label className={styles.search}>
        <UiIcon name="search" size={18} />
        <input
          type="search"
          value={nodesNodeFilter}
          onChange={(e) => setNodesNodeFilter(e.target.value)}
          placeholder={t('nodes.filter_placeholder')}
          aria-label={t('nodes.filter_title')}
        />
      </label>
      <span className={styles.chip}>
        <NodeQuickAgeFilter settingsHours={maxNodeAgeHours} />
      </span>
      <button type="button" className={styles.chip} title={t('nodes.filter_title')} onClick={() => setShowNodeFilterPopup(true)}>
        <UiIcon name="filter" size={16} />
        {t('workspace.map.more_filters')}
      </button>
      <span className={styles.spacer} />
      <button type="button" className={styles.chip} aria-pressed={layersOpen} onClick={onLayers}>
        <UiIcon name="map" size={16} />
        {t('workspace.map.layers')}
      </button>
    </div>
  );
}

export interface MapControlsProps {
  canFit: boolean;
  onFit(): void;
  measureActive: boolean;
  /** Today's gate: no measuring in 3D, or with fewer than two positioned nodes. */
  measureDisabled: boolean;
  onMeasure(active: boolean): void;
}

export function MapControls({ canFit, onFit, measureActive, measureDisabled, onMeasure }: MapControlsProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.controls}>
      <button type="button" className={styles.control} onClick={onFit} disabled={!canFit} aria-label={t('workspace.map.fit_all')} title={t('workspace.map.fit_all')}>
        <UiIcon name="fitBounds" size={20} />
      </button>
      <button
        type="button"
        className={styles.control}
        aria-pressed={measureActive}
        disabled={measureDisabled}
        onClick={() => onMeasure(!measureActive)}
        aria-label={t('workspace.map.measure')}
        title={t('workspace.map.measure')}
      >
        <UiIcon name="ruler" size={20} />
      </button>
    </div>
  );
}
