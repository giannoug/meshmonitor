/**
 * Logging in to a room server (boards 8-03, 8-17; today's Rooms login banner
 * and #5400 progress): the password (empty for a guest) in a password field,
 * Remember password where the server can keep it, Login and Log in with saved
 * password (the saved one is used while the field is empty, as today), Forget
 * saved password, today's attempt-and-countdown progress with Cancel, and the
 * refused-login hint. Every login is one request per press, with its Sends
 * line; the server's own attempts are today's.
 *
 * Auto-sync (with configuration:write and a saved password, as today) is the
 * room's periodic re-login, run by today's server scheduler at the interval
 * picked here (today's 1–24 h choices): its Sends line says what it costs.
 */
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { PasswordField } from '../../components/shared/config/PasswordField';
import { MeshCoreLoginProgress } from '../../components/MeshCore/MeshCoreLoginProgress';
import SendsLine from '../patterns/SendsLine';
import { useIsPhone } from '../shell/useIsPhone';
import { useMeshCoreRuntime } from './runtime';
import { SYNC_INTERVALS, type useMeshCoreRoom } from './useMeshCoreRoom';
import styles from './Room.module.css';

type Room = ReturnType<typeof useMeshCoreRoom>;

export default function RoomLogin({ room, name }: { room: Room; name: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const id = useId();
  const { receiveOnly } = useMeshCoreRuntime();
  const { login, sync } = room;
  const off = login.loading || receiveOnly || !room.canSend;
  const offReason = receiveOnly
    ? t('meshcore.receive_only.control_tooltip')
    : !room.canSend
      ? t('workspace.node_menu.needs', { permission: 'messages:write' })
      : undefined;
  const waiting = !!login.progress && (login.progress.phase === 'waiting' || login.progress.phase === 'retrying');
  const max = login.progress?.maxAttempts ?? 0;
  const savedWarning =
    !login.error && sync.failure
      ? sync.failure.reason === 'rejected'
        ? t('meshcore.rooms.saved_password_refused')
        : t('meshcore.rooms.saved_password_unanswered', { count: sync.failure.count })
      : null;
  const intervals = SYNC_INTERVALS.includes(sync.interval) ? SYNC_INTERVALS : [...SYNC_INTERVALS, sync.interval].sort((a, b) => a - b);
  const hours = (min: number) => Math.round((min / 60) * 10) / 10;

  return (
    <div className={styles.loginLayout} data-phone={isPhone || undefined}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{t('workspace.meshcore.login_title')}</h2>
        <p className={styles.cardSub}>
          {room.posts.length > 0 ? t('meshcore.rooms.not_logged_in_banner') : t('workspace.meshcore.login_sub')}
        </p>
        <label className={styles.label} htmlFor={`${id}-password`}>
          {t('meshcore.rooms.password_placeholder', 'Password (empty for guest)')}
        </label>
        <PasswordField
          id={`${id}-password`}
          autoComplete="off"
          wrapperClassName={styles.passwordWrap}
          className={styles.password}
          value={login.password}
          onChange={(e) => login.setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !off) void login.run();
          }}
          disabled={off}
          title={offReason}
        />
        {room.canRemember && (
          <label className={styles.check}>
            <input type="checkbox" checked={login.remember} onChange={(e) => login.setRemember(e.target.checked)} />
            {t('meshcore.rooms.remember_password', 'Remember password')}
          </label>
        )}
        <div className={styles.buttons}>
          <button type="button" className={styles.primary} data-phone={isPhone || undefined} disabled={off || login.useSaved} title={offReason} onClick={() => void login.login()}>
            {login.loading && !login.useSaved ? t('meshcore.rooms.logging_in', 'Logging in…') : t('meshcore.rooms.login_button', 'Login')}
          </button>
          {room.saved && (
            <button type="button" className={styles.secondary} data-phone={isPhone || undefined} disabled={off} title={offReason} onClick={() => void login.loginWithSaved()}>
              {t('meshcore.rooms.login_with_saved_button', 'Log in with saved password')}
            </button>
          )}
          {room.saved && (
            <button type="button" className={styles.plain} data-phone={isPhone || undefined} disabled={room.forgetting} onClick={() => void room.forget()}>
              {room.forgetting ? t('meshcore.rooms.forgetting_password', 'Forgetting…') : t('meshcore.rooms.forget_password', 'Forget saved password')}
            </button>
          )}
        </div>
        {!login.progress && <SendsLine>{t('workspace.meshcore.sends_login_press', { room: name })}</SendsLine>}
        {login.progress && (
          <div className={styles.progress}>
            <MeshCoreLoginProgress progress={login.progress} onCancel={() => void login.cancel()} />
            <SendsLine>
              {max > 0 ? t('workspace.meshcore.sends_login', { room: name, max }) : t('workspace.meshcore.sends_login_press', { room: name })}
            </SendsLine>
          </div>
        )}
        {(login.noReply || waiting) && (
          <p className={styles.hint}>
            <UiIcon name="info" size={16} />
            <span>{t('meshcore.rooms.login_no_reply_hint')}</span>
          </p>
        )}
        {login.error && <p className={styles.error} role="alert">{login.error}</p>}
        {login.notice && !login.error && <p className={styles.notice} role="status">{login.notice}</p>}
      </div>

      {room.canConfig && room.saved && (
        <section className={styles.side} aria-label={t('meshcore.rooms.auto_sync', 'Auto-sync')}>
          <h2 className={styles.sideTitle}>{t('meshcore.rooms.auto_sync', 'Auto-sync')}</h2>
          <div className={styles.card}>
            <label className={styles.toggleRow}>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{t('meshcore.rooms.auto_sync', 'Auto-sync')}</span>
                <span className={styles.rowSub}>{t('meshcore.rooms.sync_enabled_tooltip', 'Periodically re-login to fetch new posts')}</span>
              </span>
              <input type="checkbox" role="switch" className={styles.switch} checked={sync.enabled} onChange={(e) => sync.setEnabled(e.target.checked)} />
            </label>
            <label className={styles.toggleRow}>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{t('workspace.meshcore.relogin_every')}</span>
                <span className={styles.rowSub}>{t('workspace.meshcore.relogin_range')}</span>
              </span>
              <select className={styles.select} value={sync.interval} disabled={!sync.enabled} onChange={(e) => sync.setInterval(Number(e.target.value))}>
                {intervals.map((m) => (
                  <option key={m} value={m}>{t('workspace.meshcore.every_hours', { hours: hours(m) })}</option>
                ))}
              </select>
            </label>
            {sync.enabled && <SendsLine>{t('workspace.meshcore.sends_autosync', { room: name, hours: hours(sync.interval) })}</SendsLine>}
            {sync.dirty && (
              <button type="button" className={styles.secondary} onClick={() => void sync.save()}>
                {t('meshcore.rooms.save_sync', 'Save')}
              </button>
            )}
            {receiveOnly && <p className={styles.rowSub}>{t('meshcore.receive_only.control_tooltip')}</p>}
          </div>
          {savedWarning && (
            <p className={styles.warning} role="note">
              <UiIcon name="alert" size={16} />
              <span>{savedWarning}</span>
            </p>
          )}
        </section>
      )}
      {!(room.canConfig && room.saved) && savedWarning && (
        <p className={styles.warning} role="note">
          <UiIcon name="alert" size={16} />
          <span>{savedWarning}</span>
        </p>
      )}
    </div>
  );
}
