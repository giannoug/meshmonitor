/**
 * 13-13 / 13-18: a user's Account half. Today's fields and today's controls
 * (UsersTab): Administrator with Make / Remove Admin (never your own), for a
 * local account Set Password (off while password changes are locked), the
 * Password changes locked switch and Passkeys; then Deactivate User and
 * Permanently Delete in a Danger Zone (never yourself or the anonymous user).
 * The page owns every request and every confirm; this only draws and calls.
 * Phone (in the Manage sheet): a summary line, the rows, and Permissions.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../../components/icons';
import type { AdminUser } from '../../../components/users/userPermissionModel';
import DangerZone from '../../patterns/DangerZone';
import styles from './ManageUser.module.css';

export interface ManageUserProps {
  user: AdminUser;
  /** The signed-in admin's id. */
  me: number | undefined;
  phone?: boolean;
  onToggleAdmin(): void;
  onTogglePasswordLocked(): void;
  onSetPassword(): void;
  onPasskeys(): void;
  onDeactivate(): void;
  onDelete(): void;
  /** Phone: opens the device chips page (q4). */
  onPermissions?(): void;
}

function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
      {children && <div className={styles.value}>{children}</div>}
    </div>
  );
}

function NavRow({ icon, label, value, onClick }: { icon: UiIconName; label: string; value?: string; onClick(): void }) {
  return (
    <button type="button" className={styles.navRow} onClick={onClick}>
      <span className={styles.navIcon} aria-hidden="true"><UiIcon name={icon} size={20} /></span>
      <span className={styles.navLabel}>{label}</span>
      {value && <span className={styles.navValue}>{value}</span>}
      <UiIcon name="chevronRight" size={18} />
    </button>
  );
}

export default function ManageUser(props: ManageUserProps) {
  const { user, me, phone } = props;
  const { t } = useTranslation();
  const self = user.id === me;
  const anonymous = user.username === 'anonymous';
  const local = user.authProvider === 'local';
  const provider = user.authProvider.toUpperCase();
  const status = user.isActive ? t('users.active') : t('users.inactive');
  const passkeys = t('passkey_admin.count', { count: user.passkeyCount ?? 0 })
    + (user.passwordLoginDisabled ? ` • ${t('passkey_admin.password_off_short')}` : '');
  const special = anonymous && <span className={styles.badge}>{t('users.special_user')}</span>;

  const admin = (
    <Row label={t('users.administrator')} hint={t(self ? 'workspace.users.admin_hint_self' : 'workspace.users.admin_hint_other')}>
      <button type="button" className={styles.button} onClick={props.onToggleAdmin} disabled={self}>
        <UiIcon name={user.isAdmin ? 'favoriteOff' : 'favorite'} size={16} />
        {user.isAdmin ? t('users.remove_admin') : t('users.make_admin')}
      </button>
    </Row>
  );
  const signIn = local && (
    <>
      <Row label={t('users.password_label')} hint={t('workspace.users.password_local')}>
        <button
          type="button"
          className={styles.button}
          onClick={props.onSetPassword}
          disabled={user.passwordLocked}
          title={user.passwordLocked ? t('users.password_locked_hint') : ''}
        >
          <UiIcon name="encrypted" size={16} />
          {t('users.set_password')}
        </button>
      </Row>
      <Row label={t('users.password_locked')} hint={t('workspace.users.password_locked_hint')}>
        <button
          type="button"
          role="switch"
          aria-checked={user.passwordLocked}
          aria-label={t('users.password_locked')}
          className={styles.switch}
          onClick={props.onTogglePasswordLocked}
        >
          <span className={styles.knob} />
        </button>
      </Row>
    </>
  );
  const danger = (
    <DangerZone title={t('settings.danger_zone')}>
      <div className={styles.list}>
        <Row label={t('users.deactivate_user')} hint={t('users.deactivate_warning')}>
          <button
            type="button"
            className={styles.danger}
            onClick={props.onDeactivate}
            disabled={self || anonymous}
            title={anonymous ? t('users.cannot_deactivate_anonymous') : ''}
          >
            {t('users.deactivate_user')}
          </button>
        </Row>
        <Row label={t('users.permanently_delete')} hint={t('users.permanently_delete_hint')}>
          <button
            type="button"
            className={styles.danger}
            onClick={props.onDelete}
            disabled={self || anonymous}
            title={anonymous ? t('users.cannot_delete_anonymous') : t('users.permanently_delete_hint')}
          >
            {t('users.permanently_delete')}
          </button>
        </Row>
      </div>
    </DangerZone>
  );

  if (phone) {
    return (
      <div className={styles.account} data-phone="">
        <p className={styles.summary}>
          {[user.displayName ?? `@${user.username}`, user.email].filter(Boolean).join(' · ')}
          <br />
          {[provider, status].join(' · ')}
          {special}
        </p>
        <div className={styles.card}>
          <div className={styles.list}>
            {admin}
            {signIn}
          </div>
          {local && <NavRow icon="key" label={t('passkey_admin.label')} value={passkeys} onClick={props.onPasskeys} />}
          {props.onPermissions && <NavRow icon="security" label={t('users.permissions')} onClick={props.onPermissions} />}
        </div>
        {danger}
      </div>
    );
  }

  return (
    <div className={styles.account}>
      <section className={styles.column}>
        <h3 className={styles.heading}>{t('workspace.users.details')}</h3>
        <div className={`${styles.card} ${styles.list}`}>
          <Row label={t('users.username_label')}>
            <span className={styles.mono}>@{user.username}</span>
            {special}
          </Row>
          <Row label={t('users.display_name')} hint={anonymous && t('users.anonymous_hint')}>{user.displayName || '-'}</Row>
          <Row label={t('users.email')}>{user.email || '-'}</Row>
          <Row label={t('users.auth_provider')}><span className={styles.badge}>{provider}</span></Row>
          <Row label={t('common.status')}><span className={styles.badge} data-active={user.isActive || undefined}>{status}</span></Row>
          {admin}
        </div>
      </section>
      <section className={styles.column}>
        {local && (
          <>
            <h3 className={styles.heading}>{t('workspace.users.sign_in')}</h3>
            <div className={`${styles.card} ${styles.list}`}>
              {signIn}
              <Row label={t('passkey_admin.label')} hint={passkeys}>
                <button type="button" className={styles.button} onClick={props.onPasskeys}>
                  <UiIcon name="key" size={16} />
                  {t('passkey_admin.open')}
                </button>
              </Row>
            </div>
          </>
        )}
        {danger}
      </section>
    </div>
  );
}
