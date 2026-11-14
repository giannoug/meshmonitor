/**
 * Activity (boards c-home-e4-activity, c-home-e5-activity-empty; notes cs1,
 * cs2): replies to, reactions on and @mentions of this device's own node.
 *
 * - The default export is the page at `/source/:id/activity` on a
 *   Meshtastic-family device (phone tab, and the same URL on desktop). One
 *   owner per screen (Ruling AD): App is not mounted. The page runs the
 *   source's poll (the request App made here before), so channel and node
 *   names resolve, and its socket feeds `useActivity`'s `message:new`.
 * - The feed itself is `ActivityList`, shared with the desktop bell's
 *   ActivityPanel (kept out of this lazy chunk's provider stack).
 *
 * Read-only: nothing here sends on the mesh. Unseen items are marked seen
 * only by Mark all read (Ruling 2.8).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import ChatProviders from '../chat/ChatProviders';
import { useChatRuntime } from '../chat/useChatRuntime';
import Sheet from '../patterns/Sheet';
import StateView from '../patterns/StateView';
import { canReadMessages } from '../shell/deviceTabs';
import { useShellDevices } from '../shell/shellDevices';
import { useIsPhone } from '../shell/useIsPhone';
import { ActivityList, PushLine } from './ActivityList';
import { useActivity, useMarkSeen } from './useActivity';
import threadStyles from '../chat/ChannelThread.module.css';
import styles from './ActivityFeed.module.css';

export interface ActivityFeedRouteProps {
  sourceId: string;
  source: DashboardSource;
}

export default function ActivityFeedRoute({ sourceId, source }: ActivityFeedRouteProps) {
  return (
    <ChatProviders sourceId={sourceId} source={source} classicTab="messages">
      <ActivityPage sourceId={sourceId} deviceName={source.name} />
    </ChatProviders>
  );
}

function ActivityPage({ sourceId, deviceName }: { sourceId: string; deviceName: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { hasPermission } = useAuth();
  const { openSwitcher } = useShellDevices();
  useChatRuntime(-1);
  const canRead = canReadMessages(hasPermission, sourceId);
  const activity = useActivity(sourceId, { enabled: canRead });
  const markSeen = useMarkSeen(activity);
  const [menu, setMenu] = useState(false);
  const markAll = (
    <button
      type="button"
      className={styles.textButton}
      onClick={() => {
        setMenu(false);
        markSeen();
      }}
    >
      {t('workspace.activity.mark_all_read')}
    </button>
  );

  return (
    <div className={threadStyles.page} data-phone={isPhone || undefined}>
      <header className={threadStyles.header}>
        <div className={threadStyles.titles}>
          <h1 className={threadStyles.title}>{t('workspace.tabs.activity')}</h1>
          {isPhone && openSwitcher ? (
            <button
              type="button"
              className={styles.device}
              onClick={openSwitcher}
              aria-haspopup="dialog"
              aria-label={t('workspace.switcher.open', { name: deviceName })}
            >
              <span className={styles.deviceName}>{deviceName}</span>
              <UiIcon name="chevronDown" size={16} />
            </button>
          ) : (
            <p className={threadStyles.subtitle}>{deviceName}</p>
          )}
        </div>
        {canRead &&
          (isPhone ? (
            <button type="button" className={styles.iconButton} onClick={() => setMenu(true)} aria-label={t('common.options')}>
              <UiIcon name="more" size={22} />
            </button>
          ) : (
            markAll
          ))}
      </header>
      <div className={styles.scroll}>
        {canRead ? <ActivityList sourceId={sourceId} deviceName={deviceName} activity={activity} phone={isPhone} /> : <StateView kind="noPermission" />}
      </div>
      {!isPhone && canRead && <PushLine sourceId={sourceId} />}
      <Sheet open={menu} onClose={() => setMenu(false)} title={t('workspace.tabs.activity')}>
        <div className={styles.menu}>{markAll}</div>
      </Sheet>
    </div>
  );
}
