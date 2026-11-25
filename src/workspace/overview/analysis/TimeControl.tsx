/**
 * Time on the Overview map's bar (board 5-03): today's Time Slider toggle.
 * The slider itself is Map Analysis's TimeSliderControl, drawn by the canvas
 * (2D only, as today).
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useMapAnalysisCtx } from '../../../components/MapAnalysis/MapAnalysisContext';
import styles from './TimeControl.module.css';

export default function TimeControl() {
  const { t } = useTranslation();
  const { config, setTimeSlider } = useMapAnalysisCtx();
  const on = config.timeSlider.enabled;
  return (
    <button type="button" className={styles.button} aria-pressed={on} onClick={() => setTimeSlider({ enabled: !on })}>
      <UiIcon name="time" size={18} />
      {t('workspace.overview.time_slider')}
    </button>
  );
}
