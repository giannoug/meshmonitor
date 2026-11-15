/**
 * Under the phone map (boards 5-08, 5-10): the hint while nothing is
 * inspected, then today's inspector while something is (its phone form: a
 * sheet docked under the map, at most 45 % of the height), with "Open node
 * page" for a node or trail. Not modal: the map above stays live, so the next
 * tap inspects the next thing. Close clears the selection.
 *
 * One at a time: neither shows while a tool is on or a tool's panel holds the
 * bottom of the map (`busy`).
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import AnalysisInspectorPanel from '../../../components/MapAnalysis/AnalysisInspectorPanel';
import { useMapAnalysisCtx } from '../../../components/MapAnalysis/MapAnalysisContext';
import { nodePageOf } from './nodePage';
import styles from './PhoneInspector.module.css';

export default function PhoneInspector({ busy }: { busy: boolean }) {
  const { t } = useTranslation();
  const { selected, setSelected } = useMapAnalysisCtx();
  if (busy) return null;
  if (!selected) {
    return (
      <p className={styles.hint}>
        <UiIcon name="info" size={18} />
        {t('workspace.overview.inspect_hint')}
      </p>
    );
  }
  const to = nodePageOf(selected);
  return (
    <AnalysisInspectorPanel
      onClose={() => setSelected(null)}
      footer={to && (
        <Link className={styles.open} to={to}>
          {t('workspace.overview.open_node_page')}
          <UiIcon name="chevronRight" size={16} />
        </Link>
      )}
    />
  );
}
