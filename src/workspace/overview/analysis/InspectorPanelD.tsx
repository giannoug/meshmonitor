/**
 * The inspector beside the Overview map on desktop (boards 5-01, 5-03, 5-06):
 * today's Map Analysis inspector (node, route segment, neighbour link, trail),
 * as it is, plus "Open node page" for a selected node or trail: that device's
 * Workspace node page for a Meshtastic node, or the device for MeshCore (as
 * 4.1's popup row). Opening it is navigation only.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import AnalysisInspectorPanel from '../../../components/MapAnalysis/AnalysisInspectorPanel';
import { useMapAnalysisCtx, type SelectedTarget } from '../../../components/MapAnalysis/MapAnalysisContext';
import styles from './InspectorPanelD.module.css';

/** The selected node's page, or null when the selection has no one node on one device. */
function nodePageOf(selected: SelectedTarget | null): string | null {
  if (!selected || (selected.type !== 'node' && selected.type !== 'trail') || !selected.sourceId) return null;
  const base = `/source/${encodeURIComponent(selected.sourceId)}`;
  if (selected.nodeKey?.startsWith('mc:')) return base;
  if (selected.nodeNum === undefined) return null;
  return `${base}/node/${encodeURIComponent(`!${(selected.nodeNum >>> 0).toString(16).padStart(8, '0')}`)}`;
}

export default function InspectorPanelD() {
  const { t } = useTranslation();
  const { config, selected } = useMapAnalysisCtx();
  const to = config.inspectorOpen ? nodePageOf(selected) : null;
  return (
    <div className={styles.column}>
      <AnalysisInspectorPanel />
      {to && (
        <Link className={styles.open} to={to}>
          {t('workspace.overview.open_node_page')}
          <UiIcon name="chevronRight" size={16} />
        </Link>
      )}
    </div>
  );
}
