/** Today's MeshCore error bar (MeshCorePage's), under the status line of a native screen (note s8n3), with Dismiss. */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useIsPhone } from '../shell/useIsPhone';
import { useMeshCoreRuntime } from './runtime';
import styles from './MeshCoreScreen.module.css';

export default function MeshCoreErrorBar() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { meshCore } = useMeshCoreRuntime();
  if (!meshCore.error) return null;
  return (
    <div className={styles.error} role="alert" data-phone={isPhone || undefined}>
      <UiIcon name="alert" size={16} />
      <span className={styles.errorText}>{meshCore.error}</span>
      <button type="button" className={styles.dismiss} onClick={meshCore.actions.clearError}>
        {t('common.dismiss', 'Dismiss')}
      </button>
    </div>
  );
}
