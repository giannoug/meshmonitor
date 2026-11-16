/**
 * "Configuring This radio ▾" / "Configuring Remote: Hilltop Relay ▾" under
 * the settings list's head (b-set-d6, Task 5.9). It opens the frame's picker
 * (TargetPicker) through the store, so the sidebar loads nothing more.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { updateRemote, useRemoteEntry } from './remoteTargetStore';
import styles from './Remote.module.css';

export default function TargetPickerTrigger({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const { node } = useRemoteEntry(sourceId);
  return (
    <button
      type="button"
      className={styles.trigger}
      data-remote={node ? '' : undefined}
      aria-haspopup="dialog"
      onClick={() => updateRemote(sourceId, { pickerOpen: true })}
    >
      <span className={styles.triggerLabel}>{t('workspace.settings.remote.configuring')}</span>{' '}
      <span className={styles.triggerValue}>
        {node ? t('workspace.settings.remote.remote_name', { name: node.longName }) : t('workspace.settings.remote.this_radio')}
      </span>
      <UiIcon name="chevronDown" size={16} />
    </button>
  );
}

