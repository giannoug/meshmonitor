/**
 * Tools on the Overview map's bar (board 5-04): Map Analysis's Tools menu,
 * one tool at a time — Measure, Link Profile, Site Planner, Add Waypoint, Add
 * Local Marker — with today's gates, tooltips and exclusivity
 * (`useAnalysisControls`). A disabled tool shows today's reason in place of
 * its description.
 *
 * Choosing a tool sends nothing. Add Waypoint's next map click opens the
 * waypoint sheet (3.6), whose Save sends one waypoint on the channel picked
 * there; Add Local Marker's opens the marker sheet, which never transmits.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../../components/icons';
import type { AnalysisTool, useAnalysisControls } from '../../../components/MapAnalysis/analysisControls';
import SendsLine from '../../patterns/SendsLine';
import styles from './MapToolsMenu.module.css';

type ToolKey = keyof ReturnType<typeof useAnalysisControls>['tools'];

/** Board order, with each tool's icon and one-line description. */
const ORDER: Array<{ key: ToolKey; icon: UiIconName; hint: string }> = [
  { key: 'measure', icon: 'ruler', hint: 'workspace.overview.tool_measure' },
  { key: 'linkProfile', icon: 'altitude', hint: 'workspace.overview.tool_link_profile' },
  { key: 'sitePlanner', icon: 'target', hint: 'workspace.overview.tool_site_planner' },
  { key: 'addWaypoint', icon: 'location', hint: 'workspace.overview.tool_waypoint' },
  { key: 'addMarker', icon: 'pin', hint: 'workspace.overview.tool_marker' },
];

export default function MapToolsMenu({ tools }: { tools: Record<ToolKey, AnalysisTool> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const active = ORDER.some(({ key }) => tools[key].shown && tools[key].active);

  // Closes on a press outside and on Escape, as today's toolbar menus.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrap}>
      <button
        type="button"
        className={`${styles.trigger} ${active ? styles.active : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <UiIcon name="wrench" size={18} />
        {t('workspace.overview.tools')}
        <UiIcon name={open ? 'chevronUp' : 'chevronDown'} size={14} />
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label={t('workspace.overview.tools')}>
          <div className={styles.heading}>{t('workspace.overview.tools_heading')}</div>
          {ORDER.filter(({ key }) => tools[key].shown).map(({ key, icon, hint }) => {
            const tool = tools[key];
            return (
              <button
                key={key}
                type="button"
                role="menuitemradio"
                aria-checked={tool.active}
                aria-disabled={tool.disabled}
                aria-label={tool.label}
                title={tool.title}
                className={styles.item}
                onClick={() => {
                  if (tool.disabled) return;
                  tool.toggle();
                  setOpen(false);
                }}
              >
                <span className={styles.radio} aria-hidden="true">{tool.active && <UiIcon name="check" size={14} />}</span>
                <UiIcon name={icon} size={18} />
                <span className={styles.text}>
                  <span className={styles.label}>{tool.label}</span>
                  <span className={styles.hint}>{tool.disabled ? tool.title : t(hint)}</span>
                  {key === 'addWaypoint' && !tool.disabled && <SendsLine>{t('workspace.overview.tool_waypoint_sends')}</SendsLine>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
