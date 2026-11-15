/**
 * The phone's Tools sheet (board 5-09): Tools and Time on the map's bar both
 * open it. The tools are the desktop menu's rows as one choice (`ToolItems`:
 * today's gates, reasons and exclusivity, the waypoint's Sends line); picking
 * one closes the sheet, so the next tap lands on the map. Time is today's
 * Time Slider switch; its window is today's slider, drawn on the map (2D).
 *
 * Choosing a tool sends nothing. Add Waypoint's next tap opens the waypoint
 * sheet (3.6), whose Save sends one waypoint on the channel picked there.
 */
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { useAnalysisControls } from '../../../components/MapAnalysis/analysisControls';
import { useMapAnalysisCtx } from '../../../components/MapAnalysis/MapAnalysisContext';
import Sheet from '../../patterns/Sheet';
import drawer from '../../map/LayersDrawer.module.css';
import { ToolItems } from './MapToolsMenu';
import styles from './PhoneToolsSheet.module.css';

export interface PhoneToolsSheetProps {
  open: boolean;
  onClose(): void;
  tools: ReturnType<typeof useAnalysisControls>['tools'];
}

export default function PhoneToolsSheet({ open, onClose, tools }: PhoneToolsSheetProps) {
  const { t } = useTranslation();
  const { config, setTimeSlider } = useMapAnalysisCtx();
  const timeId = useId();
  const title = t('workspace.overview.tools');
  return (
    <Sheet open={open} onClose={onClose} title={title} side="bottom">
      <p className={styles.hint}>{t('workspace.overview.tools_sheet_hint')}</p>
      <div className={styles.tools} role="radiogroup" aria-label={title}>
        <ToolItems tools={tools} role="radio" onPicked={onClose} />
      </div>
      <section className={`${drawer.group} ${drawer.phone} ${styles.time}`} aria-labelledby={timeId}>
        <h3 id={timeId} className={drawer.groupTitle}>{t('workspace.overview.time')}</h3>
        <ul className={drawer.card}>
          <li className={drawer.item}>
            <label className={drawer.row}>
              <span className={drawer.label}>Time Slider</span>
              <input
                type="checkbox"
                role="switch"
                className={drawer.switch}
                checked={config.timeSlider.enabled}
                onChange={(e) => setTimeSlider({ enabled: e.target.checked })}
              />
            </label>
          </li>
        </ul>
      </section>
    </Sheet>
  );
}
