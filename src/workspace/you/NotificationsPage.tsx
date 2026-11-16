/**
 * You › Notifications (board s2-notifications, Task 5.8, ds15): push per
 * device for this browser. Each device's switch subscribes or unsubscribes
 * this browser for that device (today's per-source rows, #5493) and says what
 * it pushes (direct messages, mentions, replies); what each device sends, and
 * Apprise and filters, stay in that device's Settings › Notifications.
 *
 * Read once on open (each device's subscription state, and its preferences
 * while subscribed); no poll. Nothing here sends on the mesh.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { UiIcon } from '../../components/icons';
import apiService from '../../services/api';
import TwoLineRow from '../patterns/TwoLineRow';
import { familyOf, isReceiveOnly } from '../shell/deviceTabs';
import { useIsPhone } from '../shell/useIsPhone';
import { useShellDevices } from '../shell/shellDevices';
import type { WorkspaceSource } from '../shell/useWorkspaceSources';
import { SavedLine } from '../settings/categories/autosave';
import { useNotificationPrefs } from '../settings/useNotificationPrefs';
import { pushSupported, subscribeHere, unsubscribeHere, usePushHere } from '../settings/webPush';
import layout from './LayoutPage.module.css';
import styles from './YouHome.module.css';
import own from './NotificationsPage.module.css';

/** The device's own Notifications page, or null where the type has none. */
function notificationsPath(s: WorkspaceSource): string | null {
  const base = `/source/${encodeURIComponent(s.id)}`;
  if (s.type === 'meshcore') return `${base}/notifications`;
  return familyOf(s.type) === 'meshtastic' ? `${base}/settings/notifications` : null;
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { sources, home } = useShellDevices();
  const devices = sources.filter((s) => s.status !== 'disabled' && notificationsPath(s) !== null);
  const where = home && notificationsPath(home) ? home : devices[0];
  const title = t('nav.notifications');

  return (
    <div className={layout.page} data-phone={isPhone || undefined}>
      {isPhone ? (
        <header className={layout.phoneHead}>
          <Link to="/you" className={layout.back}>
            <UiIcon name="back" size={20} />
            {t('workspace.tabs.you')}
          </Link>
          <h1 className={layout.phoneTitle}>{title}</h1>
        </header>
      ) : (
        <header className={layout.head}>
          <h1 className={layout.title}>{title}</h1>
        </header>
      )}
      <p className={own.intro}>{t(isPhone ? 'workspace.you.notifications.intro_phone' : 'workspace.you.notifications.intro')}</p>

      <section className={styles.group}>
        <h2 className={styles.groupTitle}>{t(isPhone ? 'workspace.you.notifications.this_phone' : 'workspace.you.notifications.this_browser')}</h2>
        <div className={styles.card}>
          {devices.map((s) => (
            <DeviceRow key={s.id} source={s} />
          ))}
        </div>
      </section>

      {where && (
        <section className={styles.group}>
          <div className={styles.card}>
            <TwoLineRow
              to={notificationsPath(where)!}
              leading={
                <span className={styles.icon} data-tone="plain">
                  <UiIcon name="notifications" size={20} />
                </span>
              }
              title={t('workspace.you.notifications.what_each_sends')}
              trailing={
                <>
                  {t('workspace.you.notifications.in_its_settings')}
                  <UiIcon name="chevronRight" size={18} />
                </>
              }
            />
          </div>
        </section>
      )}
      <p className={own.foot}>{t('workspace.you.notifications.foot')}</p>
    </div>
  );
}

function DeviceRow({ source }: { source: WorkspaceSource }) {
  const { t } = useTranslation();
  const push = usePushHere(source.id);
  const subscribed = !!push.data?.subscribed;
  const { data: prefs } = useNotificationPrefs(source.id, subscribed);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ saved: boolean; error?: string }>({ saved: false });
  const supported = pushSupported() && (window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname));
  const on = subscribed && prefs?.enableWebPush !== false;

  let summary: string;
  if (!subscribed) {
    summary = t('workspace.you.notifications.off');
    if (isReceiveOnly(source)) summary += ` · ${t('workspace.you.notifications.receive_only')}`;
  } else {
    const kinds = [
      prefs?.enableDirectMessages && t('workspace.you.notifications.dms'),
      prefs?.notifyOnMention && t('workspace.you.notifications.mentions'),
      prefs?.notifyOnReply && t('workspace.you.notifications.replies'),
    ].filter((k): k is string => !!k);
    summary =
      kinds.length === 1 && prefs?.enableDirectMessages
        ? t('workspace.you.notifications.dms_only')
        : kinds.length
          ? kinds.join(', ')
          : t('workspace.you.notifications.on');
  }

  const change = async (next: boolean) => {
    setBusy(true);
    setState({ saved: false });
    try {
      if (next) {
        const granted = Notification.permission === 'granted' || (await Notification.requestPermission()) === 'granted';
        if (!granted) {
          setState({ saved: false, error: t('notifications.permission_denied_text') });
          return;
        }
        await subscribeHere(source.id);
        // A subscription delivers only with the Web Push service on, as the device page turns it on.
        await apiService.post('/api/push/preferences', { enableWebPush: true, sourceId: source.id });
      } else {
        await unsubscribeHere(source.id);
      }
      setState({ saved: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ saved: false, error: next ? t('notifications.alert_subscribe_failed', { error: message }) : t('notifications.alert_unsubscribe_failed') });
    } finally {
      setBusy(false);
      await push.reread();
    }
  };

  return (
    <TwoLineRow
      leading={
        <span className={own.tag} style={{ background: source.colorToken }} aria-hidden="true">
          {source.abbrev}
        </span>
      }
      title={source.name}
      subtitle={
        <>
          {summary}
          <SavedLine status={state} />
        </>
      }
      trailing={
        <label className={own.hit}>
          <input
            type="checkbox"
            role="switch"
            className={own.switch}
            aria-label={source.name}
            checked={on}
            disabled={!supported || busy || push.isLoading}
            onChange={(e) => void change(e.target.checked)}
          />
        </label>
      }
    />
  );
}
