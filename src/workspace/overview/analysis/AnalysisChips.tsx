/**
 * One chip per Map Analysis layer that is on (board 5-01): its name, today's
 * lookback, and × to turn it off. The same switches as the Layers drawer's
 * Analysis group, kept in view while the drawer is closed.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useMapAnalysisCtx } from '../../../components/MapAnalysis/MapAnalysisContext';
import { TIMED_LAYERS } from '../../../components/MapAnalysis/analysisControls';
import LookbackSelect from './LookbackSelect';
import styles from './AnalysisChips.module.css';

export default function AnalysisChips() {
  const { t } = useTranslation();
  const { config, setLayerEnabled, setLayerLookback } = useMapAnalysisCtx();
  const on = TIMED_LAYERS.filter((l) => config.layers[l.key].enabled);
  if (on.length === 0) return null;
  return (
    <div className={styles.chips} role="group" aria-label={t('workspace.overview.layers_on')}>
      {on.map(({ key, label, options }) => (
        <div key={key} className={styles.chip}>
          <span className={styles.label}>{label}</span>
          <LookbackSelect label={label} value={config.layers[key].lookbackHours} options={options} onChange={(h) => setLayerLookback(key, h)} />
          <button type="button" className={styles.off} aria-label={t('workspace.overview.layer_off', { label })} onClick={() => setLayerEnabled(key, false)}>
            <UiIcon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
