/**
 * The Layers drawer's Analysis group on the Overview map (boards 5-01, 5-02;
 * s5n1): Map Analysis's time-windowed layers (Traceroutes, Neighbors,
 * Heatmap, Trails, SNR Overlay), each with today's lookback choices, and
 * today's traceroute filters while Traceroutes is on. The rows, labels,
 * lookbacks and 3D rule are Map Analysis's own (`analysisControls`).
 */
import { useTranslation } from 'react-i18next';
import { useMapAnalysisCtx } from '../../../components/MapAnalysis/MapAnalysisContext';
import TracerouteControls from '../../../components/MapAnalysis/TracerouteControls';
import { TIMED_LAYERS, type useAnalysisControls } from '../../../components/MapAnalysis/analysisControls';
import type { LayerKey } from '../../../hooks/useMapAnalysisConfig';
import type { LayerGroupSpec, LayerItem } from '../../map/LayerGroup';
import drawer from '../../map/LayersDrawer.module.css';
import LookbackSelect from './LookbackSelect';
import styles from './AnalysisLayersGroup.module.css';

/** `controls`: the caller's `useAnalysisControls()` (one per map). */
export function useAnalysisLayersGroup(controls: ReturnType<typeof useAnalysisControls>): LayerGroupSpec {
  const { t } = useTranslation();
  const { config, setLayerEnabled, setLayerLookback } = useMapAnalysisCtx();
  const { twoDOnly, twoDOnlyTitle } = controls;

  const row = (key: LayerKey, label: string, options: Array<number | null>): LayerItem => {
    const layer = config.layers[key];
    const off3D = twoDOnly(key);
    return {
      kind: 'custom',
      id: key,
      label,
      node: (
        <div className={drawer.row} title={off3D ? twoDOnlyTitle(label) : undefined}>
          <span className={drawer.label}>{label}</span>
          {off3D && <span className={styles.badge}>{t('workspace.overview.two_d_only')}</span>}
          <LookbackSelect
            label={label}
            value={layer.lookbackHours}
            options={options}
            disabled={off3D}
            onChange={(h) => setLayerLookback(key, h)}
          />
          <input
            type="checkbox"
            role="switch"
            className={drawer.switch}
            aria-label={label}
            checked={layer.enabled}
            disabled={off3D}
            onChange={(e) => setLayerEnabled(key, e.target.checked)}
          />
        </div>
      ),
    };
  };

  const items: LayerItem[] = [
    {
      kind: 'custom',
      id: 'lookback-caption',
      label: t('workspace.overview.lookback'),
      node: <div className={styles.caption}>{t('workspace.overview.lookback')}</div>,
    },
    ...TIMED_LAYERS.flatMap(({ key, label, options }) => [
      row(key, label, options),
      // Today's traceroute filters, contextual as on the toolbar: only while Traceroutes is on.
      ...(key === 'traceroutes' && config.layers.traceroutes.enabled
        ? [{ kind: 'custom' as const, id: 'traceroute-filters', label: 'Traceroute filters', node: <TracerouteControls /> }]
        : []),
    ]),
  ];

  return { id: 'analysis', title: t('workspace.map.group_analysis'), items };
}
