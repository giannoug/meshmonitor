/**
 * `dms`, today's Messages view (the phone's DMs tab): the LXMF conversations,
 * each opening its thread. No "New conversation" (s9n2). Sends nothing.
 */
import { useTranslation } from 'react-i18next';
import ToolHead from '../meshcore/ToolHead';
import { LxmfList } from './ReticulumSidebar';
import { useRnsRuntime } from './runtime';
import styles from './Reticulum.module.css';

export default function LxmfInbox() {
  const { t } = useTranslation();
  const { sourceId } = useRnsRuntime();
  return (
    <div className={styles.page}>
      <ToolHead title={t('workspace.reticulum.lxmf_messages_title')} back={{ label: t('workspace.tabs.home'), to: `/source/${encodeURIComponent(sourceId)}` }} />
      <LxmfList sourceId={sourceId} large />
    </div>
  );
}
