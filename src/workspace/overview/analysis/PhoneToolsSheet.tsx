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
import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { useAnalysisControls } from '../../../components/MapAnalysis/analysisControls';
import { useMapAnalysisCtx } from '../../../components/MapAnalysis/MapAnalysisContext';
import Sheet from '../../patterns/Sheet';
import { ToolItems } from './MapToolsMenu';
import styles from './PhoneToolsSheet.module.css';

export interface PhoneToolsSheetProps {
  open: boolean;
  onClose(): void;
  tools: ReturnType<typeof useAnalysisControls>['tools'];
  /** `time`: opened from Time, so the sheet lands on that section. */
  initialSection?: 'time';
}

export default function PhoneToolsSheet({ open, onClose, tools, initialSection }: PhoneToolsSheetProps) {
  const title = useTranslation().t('workspace.overview.tools');
  return (
    <Sheet open={open} onClose={onClose} title={title} side="bottom">
      <ToolsBody title={title} onClose={onClose} tools={tools} initialSection={initialSection} />
    </Sheet>
  );
}

/** Mounted with the open sheet, so its effect runs once per opening. */
function ToolsBody({ title, onClose, tools, initialSection }: Omit<PhoneToolsSheetProps, 'open'> & { title: string }) {
  const { t } = useTranslation();
  const { config, setTimeSlider } = useMapAnalysisCtx();
  const timeId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  // After the sheet's own focus-on-open (a child effect runs before it), so a microtask.
  useEffect(() => {
    if (initialSection === 'time') queueMicrotask(() => heading.current?.focus());
  }, [initialSection]);
  return (
    <>
      <p className={styles.hint}>{t('workspace.overview.tools_sheet_hint')}</p>
      <div className={styles.tools} role="radiogroup" aria-label={title}>
        <ToolItems tools={tools} role="radio" onPicked={onClose} className={styles.tool} />
      </div>
      <section className={styles.time} aria-labelledby={timeId}>
        <h3 id={timeId} ref={heading} tabIndex={-1} className={styles.groupTitle}>{t('workspace.overview.time')}</h3>
        <ul className={styles.card}>
          <li className={styles.item}>
            <label className={styles.row}>
              <span className={styles.label}>Time Slider</span>
              <input
                type="checkbox"
                role="switch"
                className={styles.switch}
                checked={config.timeSlider.enabled}
                onChange={(e) => setTimeSlider({ enabled: e.target.checked })}
              />
            </label>
          </li>
        </ul>
      </section>
    </>
  );
}
