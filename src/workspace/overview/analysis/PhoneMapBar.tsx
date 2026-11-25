/**
 * The bar under the phone's all-devices map (board 5-08): Tools, Time,
 * Layers (with the count of analysis layers on) and Zoom to fit, 44 px each.
 * Tools and Time open the one Tools sheet (5-09); Layers opens the Layers
 * sheet (5-12) with the desktop drawer's groups, Reset, and what the desktop
 * keeps on its bar or on the map: Filters (devices, node types, transports,
 * the node picker) and Legend. Both sheets are the modal Sheet (Ruling BC),
 * one at a time.
 *
 * Opening either sheet sends nothing.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import type { useAnalysisControls } from '../../../components/MapAnalysis/analysisControls';
import Sheet from '../../patterns/Sheet';
import LayerGroup, { type LayerGroupSpec } from '../../map/LayerGroup';
import PhoneToolsSheet from './PhoneToolsSheet';
import styles from './PhoneMapBar.module.css';

export interface PhoneMapBarProps {
  tools: ReturnType<typeof useAnalysisControls>['tools'];
  /** The Layers sheet's groups, in order. */
  groups: LayerGroupSpec[];
  layersOpen: boolean;
  onLayersOpen(open: boolean): void;
  /** Analysis layers on (the desktop's Layers count). */
  layersOn: number;
  /** The Layers sheet's head buttons (Reset). */
  layersActions: ReactNode;
  /** The map's Zoom to fit button. */
  fit: ReactNode;
}

export default function PhoneMapBar({ tools, groups, layersOpen, onLayersOpen, layersOn, layersActions, fit }: PhoneMapBarProps) {
  const { t } = useTranslation();
  const [toolsOpen, setToolsOpen] = useState<false | 'tools' | 'time'>(false);
  const layers = t('workspace.map.layers');
  const toolOn = Object.values(tools).some((tool) => tool.shown && tool.active);
  return (
    <>
      <div className={styles.bar} role="toolbar" aria-label={t('workspace.overview.map_tools')}>
        <button
          type="button"
          className={styles.button}
          aria-haspopup="dialog"
          aria-label={toolOn ? t('workspace.overview.tools_on') : undefined}
          onClick={() => setToolsOpen('tools')}
        >
          <UiIcon name="wrench" size={18} />
          {t('workspace.overview.tools')}
        </button>
        <button type="button" className={styles.button} aria-haspopup="dialog" onClick={() => setToolsOpen('time')}>
          <UiIcon name="time" size={18} />
          {t('workspace.overview.time')}
        </button>
        <button
          type="button"
          className={styles.button}
          aria-haspopup="dialog"
          aria-label={layersOn > 0 ? t('workspace.overview.layers_count', { count: layersOn }) : undefined}
          onClick={() => onLayersOpen(true)}
        >
          <UiIcon name="map" size={18} />
          {layers}
          {layersOn > 0 && <span className={styles.badge}>{layersOn}</span>}
        </button>
        {fit}
      </div>
      <PhoneToolsSheet open={toolsOpen !== false} initialSection={toolsOpen === 'time' ? 'time' : undefined} onClose={() => setToolsOpen(false)} tools={tools} />
      <Sheet open={layersOpen} onClose={() => onLayersOpen(false)} title={layers} side="bottom" actions={layersActions}>
        <div className={styles.layers}>
          {groups.map((g) => <LayerGroup key={g.id} group={g} />)}
        </div>
      </Sheet>
    </>
  );
}
