/**
 * The Layers drawer (board f2-layers, ds2): today's map toggles, grouped
 * Base map / Nodes / Links / Analysis / Overlays, with "N more" for the
 * less-used ones. Nothing is removed and the toggles are MapContext's own.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import LayerGroup, { type LayerGroupSpec } from './LayerGroup';
import styles from './LayersDrawer.module.css';

export interface LayersDrawerProps {
  groups: LayerGroupSpec[];
  onClose(): void;
}

export default function LayersDrawer({ groups, onClose }: LayersDrawerProps) {
  const { t } = useTranslation();
  return (
    <aside className={styles.drawer} aria-labelledby="layers-title" data-testid="layers-drawer">
      <div className={styles.head}>
        <h2 id="layers-title" className={styles.title}>{t('workspace.map.layers')}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
          <UiIcon name="close" size={18} />
        </button>
      </div>
      <div className={styles.body}>
        {groups.map((g) => <LayerGroup key={g.id} group={g} />)}
      </div>
    </aside>
  );
}
