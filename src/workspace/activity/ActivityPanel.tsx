/**
 * The desktop Activity panel (board c-home-e6-desktop-activity): the bell in
 * the sidebar header of a Meshtastic-family device opens it as a right Sheet,
 * "Activity · <device>", with Mark all read in its head and the
 * Settings › Notifications line at its foot. A row opens the conversation
 * and closes the panel. The bell carries a dot while anything is unseen.
 *
 * The bell sits in the shell, above any source socket, so its feed refreshes
 * from the shell's polled unread counts (Ruling N, `useActivity`).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import Sheet from '../patterns/Sheet';
import { ActivityList, PushLine } from './ActivityList';
import { useActivity, useMarkSeen } from './useActivity';
import styles from './ActivityFeed.module.css';

export default function ActivityPanel({ sourceId, deviceName }: { sourceId: string; deviceName: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const activity = useActivity(sourceId);
  const markSeen = useMarkSeen(activity);
  const label = t('workspace.tabs.activity');
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className={styles.bell}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={activity.unseenCount ? t('workspace.shell.device_unread', { name: label, count: activity.unseenCount }) : label}
        title={label}
      >
        <UiIcon name="notifications" size={18} />
        {activity.unseenCount > 0 && <span className={styles.bellDot} aria-hidden="true" />}
      </button>
      <Sheet
        open={open}
        onClose={close}
        side="right"
        title={t('workspace.activity.panel_title', { name: deviceName })}
        actions={
          <button type="button" className={styles.textButton} onClick={markSeen}>
            {t('workspace.activity.mark_all_read')}
          </button>
        }
        footer={<PushLine sourceId={sourceId} onNavigate={close} />}
      >
        <ActivityList sourceId={sourceId} deviceName={deviceName} activity={activity} phone={false} onNavigate={close} />
      </Sheet>
    </>
  );
}
